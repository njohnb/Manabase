import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolveCrSource } from "../../src/rules/source.ts";

// Synthetic landing pages. The shape copies the live page (verified 2026-11-15): absolute hrefs on
// media.wizards.com, a literal space in the filename, a DOCX/PDF/TXT trio sharing one date stamp.
const PAGE = "https://magic.wizards.com/en/rules";

function link(file: string, year = "2026"): string {
  return `<a href="https://media.wizards.com/${year}/downloads/${file}">${file}</a>`;
}

describe("resolveCrSource — picks the newest TXT by date stamp", () => {
  test("one trio: the TXT, its same-stamp PDF as the citation, the space encoded", () => {
    const html = `<html>${link("MagicCompRules 20261106.docx")}${link("MagicCompRules 20261106.pdf")}${link("MagicCompRules 20261106.txt")}</html>`;

    const r = resolveCrSource(html, PAGE);

    assert.deepEqual(r, {
      ok: true,
      value: {
        dateStamp: "20261106",
        txtUrl: "https://media.wizards.com/2026/downloads/MagicCompRules%2020261106.txt",
        pdfUrl: "https://media.wizards.com/2026/downloads/MagicCompRules%2020261106.pdf",
        citationUrl: "https://media.wizards.com/2026/downloads/MagicCompRules%2020261106.pdf",
      },
    });
  });

  test("two stamps listed oldest-first: the newer wins, never the first match (OQ-08)", () => {
    const html =
      link("MagicCompRules 20260807.txt") + link("MagicCompRules 20260807.pdf") +
      link("MagicCompRules 20261106.txt") + link("MagicCompRules 20261106.pdf");

    const r = resolveCrSource(html, PAGE);

    assert.ok(r.ok);
    assert.equal(r.value.dateStamp, "20261106");
    assert.match(r.value.txtUrl, /20261106\.txt$/);
    assert.match(r.value.pdfUrl!, /20261106\.pdf$/);
  });

  test("a stamp crossing a year boundary still orders by date, not by path", () => {
    const html = link("MagicCompRules 20270110.txt", "2027") + link("MagicCompRules 20261106.txt");

    const r = resolveCrSource(html, PAGE);

    assert.ok(r.ok);
    assert.equal(r.value.dateStamp, "20270110");
  });

  test("no PDF with the newest stamp: no pdfUrl, and the TXT is cited instead", () => {
    const html = link("MagicCompRules 20260807.pdf") + link("MagicCompRules 20261106.txt");

    const r = resolveCrSource(html, PAGE);

    assert.ok(r.ok);
    assert.equal("pdfUrl" in r.value, false);
    assert.equal(r.value.citationUrl, r.value.txtUrl);
  });

  test("a relative href resolves against the landing page", () => {
    const html = `<a href='/downloads/MagicCompRules 20261106.txt'>txt</a>`;

    const r = resolveCrSource(html, PAGE);

    assert.ok(r.ok);
    assert.equal(r.value.txtUrl, "https://magic.wizards.com/downloads/MagicCompRules%2020261106.txt");
  });
});

describe("resolveCrSource — a page that changed shape is a failure, never a guess", () => {
  test("no .txt link at all", () => {
    const html = link("MagicCompRules 20261106.pdf") + link("MagicCompRules 20261106.docx");

    const r = resolveCrSource(html, PAGE);

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "unexpected");
    assert.match(r.error.message, /no dated Comprehensive Rules \.txt/i);
  });

  test("a challenge page or empty body is the same failure", () => {
    const r = resolveCrSource("<html><title>Just a moment...</title></html>", PAGE);

    assert.ok(r.ok === false);
    assert.equal(r.error.code, "unexpected");
  });
});
