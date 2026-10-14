import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { getAdminUser } from "@/src/lib/access";
import { Card } from "@/src/components/ui/card";
import { HeaderGlow } from "@/src/components/page-ui";
import { shareOf, sumShares, type Category } from "./allocation";
import { colName } from "@/src/lib/xlsx";
import { fetchBranchReport, fetchBranches, fetchDailyReport, periodOf, type Period } from "./data";
import { branchSheet, dailySheet } from "./excel";
import { ExcelButton, ReportFilters, SalaryInput } from "./_components/report-controls";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const amt = (x: number) => x.toLocaleString("en-IN", { maximumFractionDigits: 0 });

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const weekday = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });

const th = "px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap";
const td = "px-3 py-2 whitespace-nowrap tabular-nums";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; branch?: string; user?: string }>;
}) {
  if (!(await getAdminUser())) redirect("/dashboard");

  const params = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month ?? "") ? params.month! : currentMonth();
  const period = periodOf(month);
  const branches = await fetchBranches();
  const branch = branches.find((b) => String(b.id) === params.branch) ?? null;

  return (
    <div className="mt-6">
      <div className="relative isolate flex flex-wrap items-end justify-between gap-4 mb-6">
        <HeaderGlow />
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Work allocation for costing — how each employee&apos;s time, and salary, splits across categories.
          </p>
        </div>
        <div className="print:hidden">
          <ReportFilters month={month} branchId={branch?.id ?? null} branches={branches} />
        </div>
      </div>

      {params.user ? (
        <DailyReport userId={params.user} period={period} branchId={branch?.id ?? null} />
      ) : branch ? (
        <BranchReport branch={branch} period={period} />
      ) : (
        <Card className="px-6 py-12 text-center text-sm text-muted-foreground">
          Select a branch to see its work allocation.
        </Card>
      )}
    </div>
  );
}

function ReportCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 py-0 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5 border-b border-border">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </Card>
  );
}

function CategoryHeader({ categories, sub }: { categories: Category[]; sub: string[] }) {
  return (
    <>
      {categories.map((c, i) => (
        <th key={c.key} colSpan={sub.length} className={cn(th, "text-center border-l border-border")}>
          {colName(i)} · {c.label}
        </th>
      ))}
    </>
  );
}

// ─── Branch Work Allocation (= "work allocation consolidation.xlsx") ──────────

async function BranchReport({ branch, period }: { branch: { id: number; name: string }; period: Period }) {
  const { rows, categories } = await fetchBranchReport(branch.id, period);

  const salaryTotal = rows.reduce((s, r) => s + (r.gross ?? 0), 0);
  const catTotal = (k: string) => rows.reduce((s, r) => s + (r.gross ?? 0) * shareOf(r.shares, k), 0);
  const grandTotal = rows.reduce((s, r) => s + (r.gross ?? 0) * sumShares(r.shares), 0);
  const ofSalary = (x: number) => (salaryTotal ? pct(x / salaryTotal) : "—");

  const sheet = branchSheet(branch.name, period, rows, categories);

  return (
    <ReportCard
      title={
        <span className="inline-flex items-center gap-2">
          <Building2 className="h-4 w-4" /> {branch.name} · Work Allocation for Costing
        </span>
      }
      subtitle={`${fmtDate(period.start)} to ${fmtDate(period.end)} · Salary changes apply from this month onward · Click a name for the daily sheet`}
      action={<ExcelButton filename={`work-allocation-${branch.name}-${period.month}.xlsx`} sheet={sheet} />}
    >
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th rowSpan={2} className={cn(th, "text-left")}>Sr.</th>
            <th rowSpan={2} className={cn(th, "text-left")}>Employee</th>
            <th rowSpan={2} className={cn(th, "text-right")}>Days</th>
            <th rowSpan={2} className={cn(th, "text-right")}>Gross Salary</th>
            <CategoryHeader categories={categories} sub={["%", "Amt."]} />
            <th colSpan={2} className={cn(th, "text-center border-l border-border")}>Total</th>
          </tr>
          <tr>
            {[...categories, null].map((c) => (
              <SubHeads key={c?.key ?? "total"} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6 + 2 * categories.length} className="px-4 py-12 text-center text-muted-foreground">
                No employees in this branch logged work or have a salary set for this month.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={r.userId} className="hover:bg-muted/40 transition-colors">
                <td className={cn(td, "text-muted-foreground")}>{i + 1}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link
                    href={`/reports?month=${period.month}&branch=${branch.id}&user=${r.userId}`}
                    className="font-medium text-foreground underline underline-offset-2 hover:font-bold"
                  >
                    {r.name}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground font-mono">#{r.employeeCode}</span>
                </td>
                <td className={cn(td, "text-right")}>{r.worked}</td>
                <td className={cn(td, "text-right")}>
                  <SalaryInput userId={r.userId} month={period.month} gross={r.gross} />
                </td>
                {categories.map((c) => (
                  <PctAmt key={c.key} share={shareOf(r.shares, c.key)} gross={r.gross} />
                ))}
                <PctAmt share={sumShares(r.shares)} gross={r.gross} strong />
              </tr>
            ))
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="bg-muted font-semibold border-t border-border">
            <tr>
              <td className={td} colSpan={3}>Total</td>
              <td className={cn(td, "text-right")}>{amt(salaryTotal)}</td>
              {categories.map((c) => (
                <Pair key={c.key} left={ofSalary(catTotal(c.key))} right={amt(catTotal(c.key))} />
              ))}
              <Pair left={ofSalary(grandTotal)} right={amt(grandTotal)} />
            </tr>
          </tfoot>
        )}
      </table>
    </ReportCard>
  );
}

function SubHeads() {
  return (
    <>
      <th className={cn(th, "text-right border-l border-border")}>%</th>
      <th className={cn(th, "text-right")}>Amt.</th>
    </>
  );
}

function Pair({ left, right }: { left: string; right: string }) {
  return (
    <>
      <td className={cn(td, "text-right border-l border-border")}>{left}</td>
      <td className={cn(td, "text-right")}>{right}</td>
    </>
  );
}

function PctAmt({ share, gross, strong }: { share: number; gross: number | null; strong?: boolean }) {
  return (
    <>
      <td className={cn(td, "text-right border-l border-border", share === 0 && "text-muted-foreground/50", strong && "font-semibold")}>
        {pct(share)}
      </td>
      <td className={cn(td, "text-right", strong && "font-semibold")}>{gross === null ? "—" : amt(gross * share)}</td>
    </>
  );
}

// ─── Daily Work Allocation (= one employee's monthly sheet) ──────────────────

async function DailyReport({ userId, period, branchId }: { userId: string; period: Period; branchId: number | null }) {
  const report = await fetchDailyReport(userId, period);
  if (!report) {
    return <Card className="px-6 py-12 text-center text-sm text-muted-foreground">Employee not found.</Card>;
  }
  const { employee, rows, categories, total, worked, aggregate } = report;
  const daysLabel = `${worked} day${worked === 1 ? "" : "s"}`;

  const sheet = dailySheet(employee, period, rows, categories, total, aggregate);

  const backHref = `/reports?month=${period.month}${branchId ? `&branch=${branchId}` : ""}`;

  return (
    <ReportCard
      title={
        <span className="inline-flex items-center gap-2">
          <Link href={backHref} aria-label="Back to branch report" className="print:hidden rounded-full p-1 -ml-1 hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          {employee.name} · Daily Work Allocation
        </span>
      }
      subtitle={`#${employee.employeeCode} · ${employee.branch ?? "No branch"} · ${fmtDate(period.start)} to ${fmtDate(period.end)} · ${daysLabel} worked`}
      action={<ExcelButton filename={`daily-allocation-${employee.name}-${period.month}.xlsx`} sheet={sheet} />}
    >
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className={cn(th, "text-left")}>Date</th>
            <th className={cn(th, "text-left")}>Weekday</th>
            <th className={cn(th, "text-left")}>Remarks</th>
            <CategoryHeader categories={categories} sub={["%"]} />
            <th className={cn(th, "text-right border-l border-border")}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.date} className={cn(!r.shares && "text-muted-foreground bg-muted/30")}>
              <td className={td}>{fmtDate(r.date)}</td>
              <td className={td}>{weekday(r.date)}</td>
              <td className={cn(td, "text-xs")}>{r.remark}</td>
              {categories.map((c) => (
                <td key={c.key} className={cn(td, "text-right border-l border-border", r.shares && shareOf(r.shares, c.key) === 0 && "text-muted-foreground/50")}>
                  {r.shares ? pct(shareOf(r.shares, c.key)) : ""}
                </td>
              ))}
              <td className={cn(td, "text-right border-l border-border font-semibold")}>{r.shares ? "100%" : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted font-semibold border-t border-border">
          <tr>
            <td className={td} colSpan={3}>Grand Total</td>
            {categories.map((c) => (
              <td key={c.key} className={cn(td, "text-right border-l border-border")}>{pct(shareOf(total, c.key))}</td>
            ))}
            <td className={cn(td, "text-right border-l border-border")}>{pct(sumShares(total))}</td>
          </tr>
          <tr className="border-t border-border">
            <td className={td} colSpan={3}>Aggregate Category %</td>
            {categories.map((c) => (
              <td key={c.key} className={cn(td, "text-right border-l border-border")}>{pct(shareOf(aggregate, c.key))}</td>
            ))}
            <td className={cn(td, "text-right border-l border-border")}>{worked ? "100%" : "—"}</td>
          </tr>
        </tfoot>
      </table>
    </ReportCard>
  );
}
