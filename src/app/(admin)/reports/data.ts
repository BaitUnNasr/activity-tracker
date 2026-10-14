// Readers for the costing reports. Deliberately NOT a "use server" module (they
// expose salaries); the reports page checks getAdminUser before calling them.

import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";

import { db } from "@/src/db/client";
import {
  branchMaster,
  holidayMaster,
  salaryMaster,
  taskDayMeta,
  taskEntry,
  taskMaster,
  user,
  userBranchLink,
} from "@/src/db/schema";
import { aggregateShares, dailyShares, type Category, type Shares } from "./allocation";

export type Period = { month: string; start: string; end: string; asOf: string };

const pad = (n: number) => String(n).padStart(2, "0");
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// `month` is YYYY-MM. Branch membership is taken on the last day of the month,
// or today while the month is still running.
export function periodOf(month: string): Period {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = toDateStr(new Date(y, m, 0));
  const today = toDateStr(new Date());
  return { month, start, end, asOf: end < today ? end : today };
}

export async function fetchBranches() {
  return db
    .select({ id: branchMaster.id, name: branchMaster.name })
    .from(branchMaster)
    .where(eq(branchMaster.isActive, true))
    .orderBy(asc(branchMaster.name));
}

const salariesFor = (userIds: string[], start: string) =>
  db
    .selectDistinctOn([salaryMaster.userId], { userId: salaryMaster.userId, gross: salaryMaster.gross })
    .from(salaryMaster)
    .where(and(inArray(salaryMaster.userId, userIds), lte(salaryMaster.month, start)))
    .orderBy(salaryMaster.userId, desc(salaryMaster.month));

const entriesFor = (userIds: string[], p: Period) =>
  db
    .select({ userId: taskEntry.userId, date: taskEntry.date, task: taskEntry.task, hours: taskEntry.hours })
    .from(taskEntry)
    .where(and(inArray(taskEntry.userId, userIds), gte(taskEntry.date, p.start), lte(taskEntry.date, p.end)));

// Every active Task Master task, in master order, then any other task name that
// appears in the logged hours (renamed or deleted tasks keep their history).
async function categoriesFor(entries: { task: string }[]): Promise<Category[]> {
  const tasks = await db.select({ name: taskMaster.name }).from(taskMaster).where(eq(taskMaster.isActive, true)).orderBy(asc(taskMaster.id));
  const names = new Set(tasks.map((t) => t.name));
  for (const e of entries) names.add(e.task);
  return [...names].map((name) => ({ key: name, label: name }));
}

export type BranchRow = {
  userId: string;
  name: string;
  employeeCode: string;
  gross: number | null;
  worked: number;
  shares: Shares;
};

// Branch Work Allocation: one row per employee with their aggregate category %.
export async function fetchBranchReport(branchId: number, p: Period): Promise<{ rows: BranchRow[]; categories: Category[] }> {
  const members = await db
    .select({ id: user.id, name: user.name, employeeCode: user.employeeCode, isActive: user.isActive })
    .from(userBranchLink)
    .innerJoin(user, eq(user.id, userBranchLink.userId))
    .where(
      and(
        eq(userBranchLink.branchId, branchId),
        lte(userBranchLink.startDate, p.asOf),
        or(isNull(userBranchLink.endDate), gte(userBranchLink.endDate, p.asOf)),
      ),
    );
  if (!members.length) return { rows: [], categories: await categoriesFor([]) };

  const ids = members.map((m) => m.id);
  const [entries, salaries] = await Promise.all([entriesFor(ids, p), salariesFor(ids, p.start)]);
  const grossOf = new Map(salaries.map((s) => [s.userId, s.gross]));

  const rows = members
    .map((m) => {
      const { worked, aggregate } = aggregateShares(dailyShares(entries.filter((e) => e.userId === m.id)).values());
      return { userId: m.id, name: m.name, employeeCode: m.employeeCode, gross: grossOf.get(m.id) ?? null, worked, shares: aggregate, isActive: m.isActive };
    })
    // Like the Excel: staff who logged work or are on the salary master.
    .filter((r) => r.worked > 0 || (r.isActive && r.gross !== null))
    .sort((a, b) => a.employeeCode.localeCompare(b.employeeCode, undefined, { numeric: true }));
  return { rows, categories: await categoriesFor(entries) };
}

export type DailyRow = { date: string; remark: string; shares: Shares | null };

// Daily Work Allocation: every day of the month for one employee.
export async function fetchDailyReport(userId: string, p: Period) {
  const [[emp], [branch], entries, metas, holidays] = await Promise.all([
    db.select({ id: user.id, name: user.name, employeeCode: user.employeeCode }).from(user).where(eq(user.id, userId)),
    db
      .select({ name: branchMaster.name })
      .from(userBranchLink)
      .innerJoin(branchMaster, eq(branchMaster.id, userBranchLink.branchId))
      .where(
        and(
          eq(userBranchLink.userId, userId),
          lte(userBranchLink.startDate, p.asOf),
          or(isNull(userBranchLink.endDate), gte(userBranchLink.endDate, p.asOf)),
        ),
      )
      .limit(1),
    entriesFor([userId], p),
    db
      .select()
      .from(taskDayMeta)
      .where(and(eq(taskDayMeta.userId, userId), gte(taskDayMeta.date, p.start), lte(taskDayMeta.date, p.end))),
    db
      .select()
      .from(holidayMaster)
      .where(and(lte(holidayMaster.startDate, p.end), gte(holidayMaster.endDate, p.start))),
  ]);
  if (!emp) return null;

  const byDay = dailyShares(entries);
  const metaOf = new Map(metas.map((m) => [m.date, m]));
  const [y, m] = p.month.split("-").map(Number);
  const rows: DailyRow[] = [];
  for (let d = 1; `${p.month}-${pad(d)}` <= p.end; d++) {
    const date = `${p.month}-${pad(d)}`;
    const meta = metaOf.get(date);
    const remark =
      holidays.find((h) => h.startDate <= date && h.endDate >= date)?.name ??
      (meta?.onLeave ? `Leave${meta.leaveType ? ` (${meta.leaveType})` : ""}` : null) ??
      (new Date(y, m - 1, d).getDay() === 0 ? "Sunday" : null) ??
      (meta?.halfDay ? "Half day" : "");
    rows.push({ date, remark, shares: byDay.get(date) ?? null });
  }

  return {
    employee: { ...emp, branch: branch?.name ?? null },
    rows,
    categories: await categoriesFor(entries),
    ...aggregateShares(byDay.values()),
  };
}
