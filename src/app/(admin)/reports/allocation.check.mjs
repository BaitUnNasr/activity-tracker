// Run: node src/app/(admin)/reports/allocation.check.mjs
// Replays Reports/01 april 21/mh 18 ishaque sayed.xlsx through allocation.ts and
// expects the sheet's own "Aggregate Category %" row.
import assert from "node:assert/strict";
import { aggregateShares, dailyShares } from "./allocation.ts";

// Worked days of April 2021 as [Mobilisation, Loans, General] percentages.
const april = [
  [50, 30, 20], [45, 25, 30], [70, 10, 20], [80, 10, 10], [75, 5, 20], [80, 10, 10],
  [70, 10, 20], [85, 10, 5], [70, 10, 20], [65, 20, 15], [90, 0, 10], [80, 5, 15],
  [90, 5, 5], [80, 0, 20], [75, 10, 15], [80, 10, 10], [85, 5, 10], [90, 5, 5],
  [75, 5, 20], [60, 0, 40], [70, 10, 20], [65, 5, 30],
];
const entries = april.flatMap((split, i) => {
  const date = `2021-04-${String(i + 1).padStart(2, "0")}`;
  return ["Mobilisation", "Loans", "General"].map((task, j) => ({ date, task, hours: split[j] / 10 }));
});
entries.push({ date: "2021-04-30", task: "Investment Services", hours: 0 }); // zero-hour rows don't count as a day

const { total, worked, aggregate } = aggregateShares(dailyShares(entries).values());
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

assert.equal(worked, 22);
close(total.Mobilisation, 16.3);
close(aggregate.Mobilisation, 0.74090909090909096);
close(aggregate.Loans, 0.090909090909090925);
close(aggregate.General, 0.16818181818181818);
assert.equal(aggregate["Investment Services"], undefined); // zero-hour task never appears
console.log("allocation ok");
