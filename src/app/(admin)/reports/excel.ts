// Excel exports, laid out and styled like the society's own sheets in
// Reports/: the per-employee "Daily Work Allocation for Costing" and the branch
// "work allocation consolidation".

import { colName, excelDate, type XlsxCell, type XlsxSheet, type XlsxStyle } from "@/src/lib/xlsx";
import { shareOf, sumShares, type Category, type Shares } from "./allocation";
import type { BranchRow, DailyRow, Period } from "./data";

const SOCIETY = "Bait-un-Nas'r Urban Co-operative Credit Society Ltd.";

const WHITE = "FFFFFF";
const white = { style: "thin", color: WHITE } as const;
const s = (v: string | number | null, style: XlsxStyle): XlsxCell => ({ v, s: style });

// ─── Branch consolidation ("mh work allocation consolidation.xlsx") ──────────

const GREEN = "C6E0B4"; // "Green, Accent 6, Lighter 60%" in the original
const ACCOUNTING = '_(* #,##0_);_(* \\(#,##0\\);_(* \\-??_);_(@_)';
const box = { l: "thin", r: "thin", t: "thin", b: "thin" } as const;
const head: XlsxStyle = { border: box, align: { h: "center", v: "center", wrap: true } };
const input = (numFmt?: string): XlsxStyle => ({ font: { name: "Verdana", sz: 10 }, fill: GREEN, border: box, numFmt, align: { v: "center" } });
const amount: XlsxStyle = { border: box, numFmt: ACCOUNTING, align: { v: "center" } };
const percent: XlsxStyle = { border: box, numFmt: "0%", align: { v: "center" } };
const periodDate: XlsxStyle = { fill: GREEN, border: { b: "thin" }, numFmt: "d-mmm-yy", align: { h: "center" } };

export function branchSheet(branch: string, period: Period, rows: BranchRow[], categories: Category[]): XlsxSheet {
  const salaryTotal = rows.reduce((t, r) => t + (r.gross ?? 0), 0);
  const amountOf = (r: BranchRow, share: number) => (r.gross === null ? 0 : r.gross * share);
  const catTotals = [...categories.map((c) => rows.reduce((t, r) => t + amountOf(r, shareOf(r.shares, c.key)), 0)),
    rows.reduce((t, r) => t + amountOf(r, sumShares(r.shares)), 0)];

  const totalCol = 3 + 2 * categories.length; // the Total %-age column; Amt. follows
  const headerCols = totalCol + 2;
  const headRow = (cells: [number, string][]) => {
    const row: XlsxCell[] = Array.from({ length: headerCols }, () => s(null, head));
    for (const [i, v] of cells) row[i] = s(v, head);
    return row;
  };

  return {
    name: `${branch} ${period.month}`,
    rows: [
      [s(SOCIETY, { font: { name: "Verdana", sz: 10, b: true } })],
      ["Fortnightly Work Allocation Sheet for Costing", ...Array(11).fill(null),
        s(`Branch: ${branch}`, { fill: "FFFF00" }), s(null, { fill: "FFFF00" }), s(null, { fill: "FFFF00" })],
      ["For the period     from", null, s(excelDate(period.start), periodDate), s(null, periodDate),
        s("to", { align: { h: "center" } }), s(excelDate(period.end), periodDate), s(null, periodDate)],
      headRow([[0, "Sr. No."], [1, "Name of Employee"], [2, "Gross Monthly Salary"], [3, "Categories"], [totalCol, "Total"]]),
      headRow(categories.map((c, i): [number, string] => [3 + 2 * i, `${colName(i)} = ${c.label}`])),
      headRow([...categories, null].flatMap((_, i): [number, string][] => [[3 + 2 * i, "%-age"], [4 + 2 * i, "Amt."]])),
      ...rows.map((r, i): XlsxCell[] => [
        s(i + 1, head),
        s(r.name, { fill: GREEN, border: box, align: { v: "center" } }),
        s(r.gross, input(ACCOUNTING)),
        ...categories.flatMap((c) => [s(shareOf(r.shares, c.key), input("0%")), s(amountOf(r, shareOf(r.shares, c.key)), amount)]),
        s(sumShares(r.shares), percent),
        s(amountOf(r, sumShares(r.shares)), amount),
      ]),
      [s(null, head), s("Total", { border: box }), s(salaryTotal, amount),
        ...catTotals.flatMap((t) => [s(salaryTotal ? t / salaryTotal : null, percent), s(t, amount)])],
    ],
    merges: [
      "C3:D3", "F3:G3", "A4:A6", "B4:B6", "C4:C6", `D4:${colName(totalCol - 1)}4`, `${colName(totalCol)}4:${colName(totalCol + 1)}5`,
      ...categories.map((_, i) => `${colName(3 + 2 * i)}5:${colName(4 + 2 * i)}5`),
    ],
    widths: [null, 20.71, null, ...categories.flatMap(() => [12.5, 12.5])], // wide enough for "F = Investment Services"
  };
}

// ─── Daily sheet ("mh 18 ishaque sayed.xlsx") ────────────────────────────────

const dotted = { r: "thin", b: "dotted" } as const;
const header: XlsxStyle = {
  font: { name: "Verdana", sz: 12, color: WHITE },
  fill: "000000",
  border: { l: white, r: white, t: white, b: white },
  align: { h: "center", v: "center" },
};
const subHeader: XlsxStyle = { ...header, font: { name: "Verdana", sz: 10, color: WHITE } };
const dayPct: XlsxStyle = { border: dotted, numFmt: "0%", align: { h: "right", v: "center" } };
const grandTotal: XlsxStyle = {
  font: { name: "Verdana", sz: 12, color: WHITE },
  fill: "20124D",
  border: { r: white, b: "thin" },
  numFmt: "0%",
  align: { h: "right", v: "center" },
};
const aggregatePct: XlsxStyle = { fill: "EFEFEF", border: { r: "thin", b: "thin" }, numFmt: "0%", align: { h: "right", v: "center" } };
const weekday = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });

export function dailySheet(
  employee: { name: string; branch: string | null },
  period: Period,
  days: DailyRow[],
  categories: Category[],
  total: Shares,
  aggregate: Shares,
): XlsxSheet {
  const lastCol = 3 + categories.length; // the Total column
  const blank = Array(lastCol + 1).fill(null);
  const firstDay = 12; // data starts on row 12, as in the original
  const totalRow = firstDay + days.length;

  return {
    name: `${employee.name} ${period.month}`,
    font: { name: "Arial", sz: 10 },
    rowHeight: 15.75,
    rows: [
      [null, s(SOCIETY, { font: { b: true, sz: 18 }, align: { v: "center" } })],
      blank,
      [null, null, null, s("Daily Work Allocation for Costing", { font: { b: true, sz: 14 }, align: { v: "center" } })],
      blank,
      ["Employee Name", s(employee.name, { font: { b: true, color: WHITE }, fill: "4C1130" }), s(null, { fill: "4C1130" }),
        null, null, null, null, s("From", { align: { h: "right" } }),
        s(excelDate(period.start), { fill: "CCCCCC", numFmt: "d-mmm-yyyy", align: { h: "right" } })],
      ["Location", s(employee.branch ?? "", { font: { color: WHITE }, fill: "073763" }), s(null, { fill: "073763" }),
        null, null, null, null, s("To", { align: { h: "right" } }),
        s(excelDate(period.end), { fill: "CCCCCC", numFmt: "d-mmm-yyyy", align: { h: "right" } })],
      blank,
      blank,
      [s("Date", header), s("Weekdays", header), s("Remarks", header), s("Categories (in Percentages)", header),
        ...Array(Math.max(0, categories.length - 1)).fill(s(null, header)), s("Total", header)],
      [s(null, header), s(null, header), s(null, header), ...categories.map((_, i) => s(colName(i), subHeader)), s(null, header)],
      [s(null, header), s(null, header), s(null, header), ...categories.map((c) => s(c.label, subHeader)), s(null, header)],
      ...days.map((d): XlsxCell[] => {
        const sunday = new Date(d.date + "T00:00:00").getDay() === 0;
        const shares = d.shares;
        return [
          s(excelDate(d.date), { border: { l: "thin", ...dotted }, numFmt: "d-mmm-yyyy", align: { h: "center", v: "center" } }),
          s(weekday(d.date), {
            border: dotted,
            align: { h: "center", v: "center" },
            ...(sunday && { fill: "5B0F00", font: { color: WHITE } }),
          }),
          s(d.remark, { border: dotted, align: { h: "center", v: "center" } }),
          ...categories.map((c) => s(shares ? shareOf(shares, c.key) : 0, dayPct)),
          s(shares ? 1 : 0, dayPct),
        ];
      }),
      [s("Grand Total", { ...grandTotal, border: { l: "thin", b: "thin" }, align: { h: "center", v: "center" } }),
        s(null, { border: { b: "thin" } }), s(null, { border: { r: "thin", b: "thin" } }),
        ...categories.map((c) => s(shareOf(total, c.key), grandTotal)), s(sumShares(total), grandTotal)],
      blank,
      [s("Aggregate Category %", { font: { sz: 12, color: WHITE }, fill: "000000", border: { l: "thin" }, align: { h: "center", v: "center" } }),
        s(null, { fill: "000000" }), s(null, { fill: "000000", border: { r: "thin" } }),
        ...categories.map((c) => s(shareOf(aggregate, c.key), aggregatePct)),
        s(days.some((d) => d.shares) ? 1 : 0, aggregatePct)],
    ],
    merges: [
      "B5:C5", "B6:C6", "A9:A11", "B9:B11", "C9:C11", `D9:${colName(lastCol - 1)}9`, `${colName(lastCol)}9:${colName(lastCol)}11`,
      `A${totalRow}:C${totalRow}`, `A${totalRow + 2}:C${totalRow + 2}`,
    ],
    widths: [14.43, 14.43, 17.86, ...categories.map(() => 21), 14.43],
  };
}
