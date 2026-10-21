// Whole minutes, so 7.9999h reads "8h" rather than "7h 60m".
export function fmtHrs(n: number) {
  const total = Math.round(n * 60);
  const h = Math.floor(total / 60), m = total % 60;
  return m === 0 ? `${h}h` : h === 0 ? `${m}m` : `${h}h ${m}m`;
}
