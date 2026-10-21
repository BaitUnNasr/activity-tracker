import { and, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/src/db/client";
import { holidayMaster, scheduleMaster, taskDayMeta, taskEntry } from "@/src/db/schema";
import { fetchVisibleUsers } from "@/src/lib/access";
import { activeSchedule, baseHours, targetFor, toDateStr } from "@/src/lib/day-target";
import type { SessionUser } from "@/src/lib/session";
import type { UnderTargetRow } from "../dashboard/data";

export type BacklogData = {
  today: string;
  month: string; // YYYY-MM
  holidays: Record<string, string>; // date → holiday name
  days: Record<string, UnderTargetRow[]>; // date → employees short of target
};

// Backlog = active employee whose logged time on a working day is below that
// day's target (schedule hours, halved on a half day, plus extra hours).
// Skipped days: Sundays, holidays, future dates. Skipped people: on leave that
// day, or not yet created. Compared in whole minutes — float hours drift.
export async function fetchBacklogMonth(
  viewer: SessionUser,
  month: string,
): Promise<BacklogData> {
  const [y, m] = month.split("-").map(Number);
  const today = toDateStr(new Date());
  const from = `${month}-01`;
  const monthEnd = toDateStr(new Date(y, m, 0));
  const to = monthEnd < today ? monthEnd : today;

  const users = (await fetchVisibleUsers(viewer)).filter((u) => u.isActive);
  const ids = users.map((u) => u.id);

  // Whole month is in the future → nothing can be behind yet.
  if (from > today || ids.length === 0) return { today, month, holidays: {}, days: {} };

  const [holidays, schedules, entries, metas] = await Promise.all([
    db
      .select()
      .from(holidayMaster)
      .where(and(lte(holidayMaster.startDate, to), gte(holidayMaster.endDate, from))),
    db.select().from(scheduleMaster),
    db
      .select({
        userId: taskEntry.userId,
        date: taskEntry.date,
        hours: sql<string>`sum(${taskEntry.hours})`,
      })
      .from(taskEntry)
      .where(and(inArray(taskEntry.userId, ids), gte(taskEntry.date, from), lte(taskEntry.date, to)))
      .groupBy(taskEntry.userId, taskEntry.date),
    db
      .select()
      .from(taskDayMeta)
      .where(and(inArray(taskDayMeta.userId, ids), gte(taskDayMeta.date, from), lte(taskDayMeta.date, to))),
  ]);

  const holidayByDate: Record<string, string> = {};
  for (const h of holidays) {
    const cur = new Date(`${h.startDate}T00:00:00`);
    for (let d = toDateStr(cur); d <= h.endDate; d = toDateStr(cur)) {
      holidayByDate[d] = h.name;
      cur.setDate(cur.getDate() + 1);
    }
  }

  const logged = new Map(entries.map((e) => [`${e.userId}|${e.date}`, Number(e.hours)]));
  const metaOf = new Map(metas.map((x) => [`${x.userId}|${x.date}`, x]));

  const days: Record<string, UnderTargetRow[]> = {};
  const cur = new Date(`${from}T00:00:00`);
  for (let date = from; date <= to; date = toDateStr(cur)) {
    const isSunday = cur.getDay() === 0;
    cur.setDate(cur.getDate() + 1);
    if (isSunday || holidayByDate[date]) continue;

    const sched = activeSchedule(schedules, date);
    const rows: UnderTargetRow[] = [];
    for (const u of users) {
      if (toDateStr(u.createdAt) > date) continue;
      const meta = metaOf.get(`${u.id}|${date}`);
      if (meta?.onLeave) continue;

      const target = targetFor(baseHours(sched, u.type), meta);
      const hoursLogged = logged.get(`${u.id}|${date}`) ?? 0;
      if (Math.round(hoursLogged * 60) >= Math.round(target * 60)) continue;

      rows.push({ user: u, hoursLogged, target });
    }
    if (rows.length) days[date] = rows;
  }

  return { today, month, holidays: holidayByDate, days };
}
