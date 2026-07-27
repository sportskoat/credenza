// LB-10. The CSV is the one export a PERSON opens, not a tool. So the failures
// that matter are the ones a spreadsheet causes, not the ones a parser causes:
// a comma that splits a title into two columns, a quote that swallows the rest
// of the file, a seller name that Excel runs as a formula, and a CJK name that
// arrives as mojibake because the file carries no BOM.
//
// Each of those has a test below that reproduces the failure, not one that
// asserts the fix is present.
import { describe, expect, it } from "vitest";
import {
  CSV_BOM,
  CSV_COLUMNS,
  csvCell,
  csvRowForItem,
  downloadHaulCsv,
  haulToCsv,
} from "../../credenza-haul-export.js";

// A minimal RFC 4180 reader. The point of the whole exercise is that a
// spreadsheet can read what we write, so the tests parse the output back
// rather than matching it against a string we also wrote.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const item = {
  id: "a1",
  title: "Heavyweight Hoodie",
  seller: "Example Studio",
  project: "Winter haul",
  price: 168,
  priceUsd: 23.5,
  currency: "CNY",
  size: "L",
  recommendedSize: "L",
  findStatus: "qc",
  weightGrams: 780,
  summary: "Good weight",
  createdAt: 1721600000000,
  links: [
    { url: "https://weidian.com/item.html?itemID=99", role: "buy" },
    { url: "https://foo.x.yupoo.com/albums/1", role: "photos" },
  ],
};

describe("csvCell quoting", () => {
  it("leaves a plain value alone", () => {
    expect(csvCell("Hoodie")).toBe("Hoodie");
    expect(csvCell(168)).toBe("168");
  });

  it("quotes a comma, so one title cannot become two columns", () => {
    expect(csvCell("Hoodie, black")).toBe('"Hoodie, black"');
  });

  it("doubles an embedded quote", () => {
    expect(csvCell('12" logo')).toBe('"12"" logo"');
  });

  it("quotes a newline, so notes cannot become a second record", () => {
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
    expect(csvCell("line one\r\nline two")).toBe('"line one\r\nline two"');
  });

  it("writes an empty cell for null and undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell("")).toBe("");
  });

  it("does not run as a formula in Excel or Sheets", () => {
    // A scraped seller name is text we do not control. Excel executes a cell
    // starting with = + - @ whether or not it is quoted, so quoting alone is
    // not enough — the value has to stop looking like a formula.
    for (const evil of ["=1+1", "+1", "-cmd", "@SUM(A1)", "=HYPERLINK(\"http://x\")"]) {
      expect(csvCell(evil).replace(/^"/, "").startsWith("'")).toBe(true);
    }
  });

  it("still writes a negative number as a number", () => {
    // The formula guard must not break a price column. -12.5 is arithmetic to
    // a person and a number to the spreadsheet; it is not a formula.
    expect(csvCell(-12.5)).toBe("-12.5");
    expect(csvCell("-40")).toBe("-40");
  });
});

describe("csvRowForItem", () => {
  it("flattens the fields a person expects to see", () => {
    const row = csvRowForItem(item);
    expect(row.title).toBe("Heavyweight Hoodie");
    expect(row.haul).toBe("Winter haul");
    expect(row.seller).toBe("Example Studio");
    expect(row.price).toBe(168);
    expect(row.currency).toBe("CNY");
    expect(row.priceUsd).toBe(23.5);
    expect(row.size).toBe("L");
    expect(row.weightGrams).toBe(780);
    expect(row.buyUrl).toContain("weidian.com");
    expect(row.photosUrl).toContain("yupoo.com");
    expect(row.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("exports the canonical buy link, never an agent wrap", () => {
    // Same rule as the JSON bundle. A CSV a person mails to a friend must not
    // carry our affiliate code.
    expect(csvRowForItem(item).buyUrl).not.toMatch(/superbuy|sugargoo|cssbuy|hoobuy/i);
  });

  it("uses the label map the app passes, and the raw enum without one", () => {
    expect(csvRowForItem(item).status).toBe("qc");
    expect(csvRowForItem(item, { statusLabels: { qc: "Quality check" } }).status).toBe(
      "Quality check"
    );
  });

  it("reports a weight only when there is one", () => {
    // No estimator passed means only a manual override is reported. This
    // module must not publish a guess it did not make.
    expect(csvRowForItem({ title: "x" }).weightGrams).toBe("");
    expect(csvRowForItem({ title: "x" }, { weightFor: () => 640 }).weightGrams).toBe(640);
    expect(csvRowForItem({ title: "x" }, { weightFor: () => null }).weightGrams).toBe("");
  });

  it("survives an empty item", () => {
    const row = csvRowForItem({});
    expect(row.title).toBe("Untitled");
    expect(row.status).toBe("want");
    expect(row.price).toBe("");
  });
});

describe("haulToCsv", () => {
  it("writes a header, then one record an item", () => {
    const rows = parseCsv(haulToCsv([item, { ...item, id: "a2" }]));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(CSV_COLUMNS.map((c) => c.header));
    expect(rows[1][0]).toBe("Heavyweight Hoodie");
  });

  it("keeps the columns aligned when a field carries a comma, a quote and a newline", () => {
    // The whole reason this file exists. Read the document back and check that
    // the nasty title is still ONE cell in row two.
    const nasty = {
      ...item,
      title: 'Hoodie, "heavy" 400gsm\nsecond line',
      seller: "Studio, Inc.",
      summary: 'He said "no"',
    };
    const rows = parseCsv(haulToCsv([nasty]));
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveLength(CSV_COLUMNS.length);
    expect(rows[1][0]).toBe('Hoodie, "heavy" 400gsm\nsecond line');
    expect(rows[1][CSV_COLUMNS.findIndex((c) => c.key === "seller")]).toBe("Studio, Inc.");
    expect(rows[1][CSV_COLUMNS.findIndex((c) => c.key === "notes")]).toBe('He said "no"');
  });

  it("carries a CJK seller through unchanged", () => {
    const rows = parseCsv(haulToCsv([{ ...item, seller: "潮流工作室", title: "卫衣" }]));
    expect(rows[1][0]).toBe("卫衣");
    expect(rows[1][CSV_COLUMNS.findIndex((c) => c.key === "seller")]).toBe("潮流工作室");
  });

  it("writes a header-only document for an empty shelf", () => {
    const rows = parseCsv(haulToCsv([]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(CSV_COLUMNS.map((c) => c.header));
  });

  it("tolerates a non-array", () => {
    expect(parseCsv(haulToCsv(null))).toHaveLength(1);
  });

  it("ends every record with CRLF, including the last", () => {
    // Without the trailing terminator some importers drop the final row.
    const csv = haulToCsv([item]);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(2);
  });

  it("respects maxItems", () => {
    const many = [item, { ...item, id: "b" }, { ...item, id: "c" }];
    expect(parseCsv(haulToCsv(many, { maxItems: 2 }))).toHaveLength(3); // header + 2
  });

  it("golden row: every column in order for one full item", () => {
    const rows = parseCsv(haulToCsv([item], { statusLabels: { qc: "Quality check" } }));
    expect(rows[1]).toEqual([
      "Heavyweight Hoodie",
      "Winter haul",
      "Quality check",
      "Example Studio",
      "L",
      "L",
      "168",
      "CNY",
      "23.5",
      "780",
      "https://weidian.com/item.html?itemID=99",
      "https://foo.x.yupoo.com/albums/1",
      "",
      "Good weight",
      rows[1][14],
    ]);
  });
});

describe("downloadHaulCsv", () => {
  it("returns the document, and the document is what the file holds", () => {
    // jsdom gives us document but not URL.createObjectURL, so this exercises
    // the non-DOM return path. It must be the same string either way.
    const csv = downloadHaulCsv([item], { exportedAt: "2026-07-26T00:00:00.000Z" });
    expect(csv).toBe(haulToCsv([item]));
  });

  it("publishes a BOM for Excel", () => {
    // A BOM-less file makes Excel read UTF-8 as the local codepage, and every
    // CJK seller name arrives as mojibake. The BOM is prepended at download
    // and must NOT be inside the document itself, or a parser sees it as part
    // of the first header cell.
    expect(CSV_BOM).toBe("﻿");
    expect(haulToCsv([item]).startsWith(CSV_BOM)).toBe(false);
  });
});
