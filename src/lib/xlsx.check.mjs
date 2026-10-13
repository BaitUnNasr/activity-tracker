// Run: node src/lib/xlsx.check.mjs [out.xlsx]
// Checks the zip/CRC plumbing and date serials; pass a path to also write a
// sample workbook to open in Excel.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { colName, crc32, excelDate, toXlsx } from "./xlsx.ts";

assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926); // standard CRC-32 check value
assert.deepEqual([0, 25, 26, 27, 701, 702].map(colName), ["A", "Z", "AA", "AB", "ZZ", "AAA"]);
assert.equal(excelDate("2021-04-01"), 44287); // C3 of "mh work allocation consolidation.xlsx"

const bold = { font: { b: true } };
const bytes = toXlsx({
  name: "Check <&> sheet",
  font: { name: "Arial", sz: 10 },
  rows: [
    [{ v: "Title & <escaping>", s: { font: { b: true, sz: 18 } } }],
    [
      "Text",
      42,
      { v: 0.7409, s: { numFmt: "0%", fill: "EFEFEF", border: { r: "thin", b: "dotted" } } },
      { v: excelDate("2026-09-01"), s: { numFmt: "d-mmm-yyyy", align: { h: "center" } } },
      { v: "White on black", s: { font: { color: "FFFFFF" }, fill: "000000" } },
      { s: { fill: "000000" } }, // blank but styled
      null,
      NaN,
      { v: 1, s: bold },
    ],
  ],
  merges: ["A1:D1", "E2:F2"],
  widths: [20, null, 8],
});
const view = new DataView(bytes.buffer);
assert.equal(view.getUint32(0, true), 0x04034b50); // starts with a local file header
assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50); // ends with the directory record
assert.equal(view.getUint16(bytes.length - 12, true), 6); // six package parts

if (process.argv[2]) writeFileSync(process.argv[2], bytes);
console.log("xlsx ok");
