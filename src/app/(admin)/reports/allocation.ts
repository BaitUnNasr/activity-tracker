// Work-allocation costing maths, mirroring the society's Excel sheets
// (Reports/*.xlsx). No imports, so allocation.check.ts can run it under plain node.

export type Bucket = "A" | "B" | "C" | "D" | "E";
export type Shares = Record<Bucket, number>;

// Costing categories A–E and the Task Master tasks that roll up into each.
export const CATEGORIES: { key: Bucket; label: string; tasks: string[] }[] = [
  { key: "A", label: "Mobilisation", tasks: ["Mobilisation"] },
  { key: "B", label: "Loan Servicing", tasks: ["Loans"] },
  { key: "C", label: "General", tasks: ["General"] },
  { key: "D", label: "Investment", tasks: ["Investment Deposit", "Investment Services"] },
  { key: "E", label: "Revival", tasks: ["Revival"] },
];

// ponytail: tasks not listed above are costed as General; add a costing column
// to Task Master if admins need to remap tasks without a code change.
const BUCKET_OF = new Map(CATEGORIES.flatMap((c) => c.tasks.map((t) => [t, c.key] as const)));
export const bucketOf = (task: string): Bucket => BUCKET_OF.get(task) ?? "C";

export const zeroShares = (): Shares => ({ A: 0, B: 0, C: 0, D: 0, E: 0 });
export const sumShares = (s: Shares) => s.A + s.B + s.C + s.D + s.E;

// Each worked day is split across the categories so it sums to 1 (100%), like
// one row of the daily sheet. Days with no logged hours are left out.
export function dailyShares(entries: { date: string; task: string; hours: number }[]): Map<string, Shares> {
  const days = new Map<string, Shares>();
  for (const e of entries) {
    if (!(e.hours > 0)) continue;
    const day = days.get(e.date) ?? zeroShares();
    day[bucketOf(e.task)] += e.hours;
    days.set(e.date, day);
  }
  for (const day of days.values()) {
    const total = day.A + day.B + day.C + day.D + day.E;
    for (const k of Object.keys(day) as Bucket[]) day[k] /= total;
  }
  return days;
}

// "Grand Total" and "Aggregate Category %" rows: the sum of the daily splits,
// divided by the number of days worked.
export function aggregateShares(days: Iterable<Shares>) {
  const total = zeroShares();
  let worked = 0;
  for (const d of days) {
    worked++;
    for (const k of Object.keys(total) as Bucket[]) total[k] += d[k];
  }
  const aggregate = zeroShares();
  if (worked) for (const k of Object.keys(total) as Bucket[]) aggregate[k] = total[k] / worked;
  return { total, worked, aggregate };
}
