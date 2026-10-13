// Minimal .xlsx writer: one sheet, inline strings, per-cell styles (font, fill,
// borders, number format, alignment), merged ranges and column widths. Parts
// are zipped uncompressed ("stored"), which Excel accepts. No imports, so
// xlsx.check.mjs can run it under plain node.
// ponytail: single sheet, no formulas; switch to exceljs if reports need those.

type Color = string; // RRGGBB
type Side = "thin" | "dotted" | { style: "thin" | "dotted"; color: Color };

export type XlsxStyle = {
  font?: { b?: boolean; sz?: number; color?: Color; name?: string };
  fill?: Color;
  border?: { l?: Side; r?: Side; t?: Side; b?: Side };
  numFmt?: string; // Excel format code, e.g. "0%" or "d-mmm-yyyy"
  align?: { h?: "left" | "center" | "right"; v?: "top" | "center" | "bottom"; wrap?: boolean };
};
// A cell is a bare value, or a value with a style. A styled cell without a
// value still renders (fills and borders on blank or merged cells).
export type XlsxCell = string | number | null | { v?: string | number | null; s?: XlsxStyle };
export type XlsxSheet = {
  name: string;
  rows: XlsxCell[][];
  merges?: string[];
  widths?: (number | null)[]; // null keeps Excel's default width
  font?: { name: string; sz: number }; // workbook default font
  rowHeight?: number; // points, applied to every row
};

const NS = "http://schemas.openxmlformats.org";
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const esc = (s: string) =>
  s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[&<>"]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`);

export const colName = (i: number): string => (i >= 26 ? colName(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + (i % 26));

// "YYYY-MM-DD" → Excel date serial (days since 1899-12-30); pair with a date numFmt.
export const excelDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return (Date.UTC(y, m - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000;
};

// Builds styles.xml, de-duplicating fonts/fills/borders/formats/xfs as it goes.
function styleBook(defaultFont: { name: string; sz: number }) {
  const tables = { font: [] as string[], fill: [] as string[], border: [] as string[], numFmt: [] as string[], xf: [] as string[] };
  const add = (t: keyof typeof tables, xml: string) => {
    const i = tables[t].indexOf(xml);
    return i >= 0 ? i : tables[t].push(xml) - 1;
  };
  const font = (f: XlsxStyle["font"] = {}) =>
    add("font", `<font>${f.b ? "<b/>" : ""}<sz val="${f.sz ?? defaultFont.sz}"/>${f.color ? `<color rgb="FF${f.color}"/>` : ""}<name val="${esc(f.name ?? defaultFont.name)}"/></font>`);
  const side = (tag: string, s?: Side) => {
    if (!s) return `<${tag}/>`;
    const { style, color } = typeof s === "string" ? { style: s, color: "000000" } : s;
    return `<${tag} style="${style}"><color rgb="FF${color}"/></${tag}>`;
  };

  font();
  add("fill", `<fill><patternFill patternType="none"/></fill>`);
  add("fill", `<fill><patternFill patternType="gray125"/></fill>`);
  add("border", `<border><left/><right/><top/><bottom/><diagonal/></border>`);
  add("xf", `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`);

  const xfOf = (s: XlsxStyle) => {
    const fontId = font(s.font);
    const fillId = s.fill ? add("fill", `<fill><patternFill patternType="solid"><fgColor rgb="FF${s.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const b = s.border ?? {};
    const borderId = add("border", `<border>${side("left", b.l)}${side("right", b.r)}${side("top", b.t)}${side("bottom", b.b)}<diagonal/></border>`);
    const numFmtId = s.numFmt ? 164 + add("numFmt", s.numFmt) : 0;
    const a = s.align;
    const align = a ? `<alignment${a.h ? ` horizontal="${a.h}"` : ""}${a.v ? ` vertical="${a.v}"` : ""}${a.wrap ? ` wrapText="1"` : ""}/>` : "";
    return add(
      "xf",
      `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${align}</xf>`,
    );
  };

  const xml = () =>
    `${XML}<styleSheet xmlns="${NS}/spreadsheetml/2006/main">` +
    (tables.numFmt.length
      ? `<numFmts count="${tables.numFmt.length}">${tables.numFmt.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(f)}"/>`).join("")}</numFmts>`
      : "") +
    `<fonts count="${tables.font.length}">${tables.font.join("")}</fonts>` +
    `<fills count="${tables.fill.length}">${tables.fill.join("")}</fills>` +
    `<borders count="${tables.border.length}">${tables.border.join("")}</borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="${tables.xf.length}">${tables.xf.join("")}</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;

  return { xfOf, xml };
}

function sheetXml({ rows, merges = [], widths = [], rowHeight }: XlsxSheet, xfOf: (s: XlsxStyle) => number): string {
  const cols = widths
    .map((w, i) => (w === null ? "" : `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`))
    .join("");
  const cell = (c: XlsxCell, ref: string) => {
    if (c === null || c === "") return "";
    const { v = null, s } = typeof c === "object" ? c : { v: c, s: undefined };
    const style = s ? ` s="${xfOf(s)}"` : "";
    if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
    if (typeof v === "string" && v !== "") return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    return style ? `<c r="${ref}"${style}/>` : "";
  };
  const ht = rowHeight ? ` ht="${rowHeight}" customHeight="1"` : "";
  const data = rows
    .map((row, r) => `<row r="${r + 1}"${ht}>${row.map((c, i) => cell(c, `${colName(i)}${r + 1}`)).join("")}</row>`)
    .join("");
  return (
    `${XML}<worksheet xmlns="${NS}/spreadsheetml/2006/main">` +
    // Without a sheetView, Excel shrinks custom row heights to 80%.
    `<sheetViews><sheetView workbookViewId="0"/></sheetViews>` +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${data}</sheetData>` +
    (merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "") +
    `</worksheet>`
  );
}

export function toXlsx(sheet: XlsxSheet) {
  const name = esc(sheet.name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Sheet1");
  const rel = `${NS}/officeDocument/2006/relationships`;
  const styles = styleBook(sheet.font ?? { name: "Calibri", sz: 11 });
  const worksheet = sheetXml(sheet, styles.xfOf); // must run before styles.xml() so every style is registered
  return zip([
    ["[Content_Types].xml",
      `${XML}<Types xmlns="${NS}/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      `</Types>`],
    ["_rels/.rels",
      `${XML}<Relationships xmlns="${NS}/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml",
      `${XML}<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${rel}">` +
      `<sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels",
      `${XML}<Relationships xmlns="${NS}/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>`],
    ["xl/worksheets/sheet1.xml", worksheet],
    ["xl/styles.xml", styles.xml()],
  ]);
}

// ─── Stored (uncompressed) zip ────────────────────────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files: [string, string][]) {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const [path, text] of files) {
    const name = enc.encode(path);
    const data = enc.encode(text);
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(12, 0x21, true); // date 1980-01-01; method 0 = stored
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);

    const entry = new Uint8Array(46 + name.length);
    const cv = new DataView(entry.buffer);
    cv.setUint32(0, 0x02014b50, true); // central directory entry
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    entry.set(name, 46);

    parts.push(local, data);
    central.push(entry);
    offset += local.length + data.length;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); // end of central directory
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
