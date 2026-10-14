// Work-allocation costing maths, mirroring the society's Excel sheets
// (Reports/*.xlsx). No imports, so allocation.check.mjs can run it under plain node.

// A category is a Task Master task: costing is split per task. `key` is the task
// name (what a logged entry stores); the letter shown in sheets comes from its position.
export type Category = { key: string; label: string };
export type Shares = Record<string, number>; // task name -> share; absent = 0

export const shareOf = (s: Shares, key: string) => s[key] ?? 0;
export const sumShares = (s: Shares) => Object.values(s).reduce((t, v) => t + v, 0);

// Each worked day is split across the categories so it sums to 1 (100%), like
// one row of the daily sheet. Days with no logged hours are left out.
export function dailyShares(entries: { date: string; task: string; hours: number }[]): Map<string, Shares> {
  const days = new Map<string, Shares>();
  for (const e of entries) {
    if (!(e.hours > 0)) continue;
    const day = days.get(e.date) ?? {};
    day[e.task] = (day[e.task] ?? 0) + e.hours;
    days.set(e.date, day);
  }
  for (const day of days.values()) {
    const total = sumShares(day);
    for (const k of Object.keys(day)) day[k] /= total;
  }
  return days;
}

// "Grand Total" and "Aggregate Category %" rows: the sum of the daily splits,
// divided by the number of days worked.
export function aggregateShares(days: Iterable<Shares>) {
  const total: Shares = {};
  let worked = 0;
  for (const d of days) {
    worked++;
    for (const k of Object.keys(d)) total[k] = (total[k] ?? 0) + d[k];
  }
  const aggregate: Shares = {};
  if (worked) for (const k of Object.keys(total)) aggregate[k] = total[k] / worked;
  return { total, worked, aggregate };
}
