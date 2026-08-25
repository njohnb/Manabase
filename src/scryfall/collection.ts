import type { HttpClient } from "../http/client.ts";
import type { Result } from "../result.ts";
import type { ScryfallCollection } from "./types.ts";

/**
 * Scryfall's hard maximum for `POST /cards/collection` (MCP-PRD §4.1.2, verified).
 *
 * The endpoint itself is the point: a 100-card decklist is 2 requests, never a loop over
 * `/cards/named` at one request per card. `/cards/collection` is already claimed by the card lane
 * in `src/scryfall/client.ts`, so these requests are spaced at 500 ms like every other card call
 * and need no special handling here.
 */
const BATCH_SIZE = 75;

export interface NameResolution {
  /** Canonical Scryfall names, in response order. */
  resolved: string[];
  /** The submitted names Scryfall matched nothing for. */
  unresolved: string[];
}

/** Narrow the parsed body far enough to read it. Never trusts the cast alone. */
function asCollection(value: unknown): ScryfallCollection | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const body = value as { data?: unknown; not_found?: unknown };
  return Array.isArray(body.data) && Array.isArray(body.not_found)
    ? (value as ScryfallCollection)
    : undefined;
}

function unexpectedBodyFailure(): Result<NameResolution> {
  return {
    ok: false,
    error: {
      code: "unexpected",
      message:
        "Scryfall returned a body that is not a card collection: no `data` array, no `not_found` " +
        "array, or both. No name was resolved from it, and no card name can be reported as " +
        "unrecognized on the strength of it.",
    },
  };
}

/**
 * Resolve card names through Scryfall, reporting the ones that matched nothing.
 *
 * This exists for one reason and has one consumer. Commander Spellbook silently ignores a card
 * name it does not recognize — HTTP 200, no warning, no unresolved list, no echo of the input, and
 * no endpoint it serves will say so (MCP-PRD §4.4, verified 2026-08-24). A decklist with one typo
 * therefore returns fewer combos than the deck really holds, with no signal anywhere. The guard has
 * to come from Scryfall, and `not_found` is it.
 *
 * Never throws (MCP-PRD D-10): the client guards itself and every failure returns as a `Failure`.
 * A failing batch stops the walk and returns that `Failure` unchanged — proceeding would submit a
 * deck whose typos we did not check for while reporting `unresolved_cards: []`, which reads as "we
 * checked and found none" (MCP-PRD §3.6).
 *
 * The resolved canonical names are returned but are deliberately NOT what the caller submits
 * upstream. Dropping or rewriting a name on Scryfall's say-so would change the deck the user asked
 * about on our own initiative, and Commander Spellbook matching against Scryfall's canonical names
 * is recorded as *inferred, not verified* (MCP-PRD §4.4).
 */
export async function resolveNames(
  client: HttpClient,
  names: string[],
): Promise<Result<NameResolution>> {
  const resolved: string[] = [];
  const unresolved: string[] = [];

  for (let start = 0; start < names.length; start += BATCH_SIZE) {
    const batch = names.slice(start, start + BATCH_SIZE);

    const result = await client.post("/cards/collection", {
      identifiers: batch.map((name) => ({ name })),
    });
    if (!result.ok) return result;

    const body = asCollection(result.value);
    if (body === undefined) return unexpectedBodyFailure();

    for (const card of body.data) resolved.push(card.name);
    for (const miss of body.not_found) {
      // Only ever `{ name }` identifiers go up, and Scryfall echoes the identifier object it could
      // not match, so an entry without a readable `name` is a shape this endpoint has never
      // produced. It is skipped rather than guessed at: `not_found` carries no index back to the
      // submitted list, so there is nothing to fall back to that would not be an invention.
      if (typeof miss?.name === "string") unresolved.push(miss.name);
    }
  }

  return { ok: true, value: { resolved, unresolved } };
}
