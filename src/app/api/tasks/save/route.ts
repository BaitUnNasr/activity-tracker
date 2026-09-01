import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/src/lib/session";
import { saveDay } from "@/src/app/(admin)/tasks/actions";
import type { LeaveType } from "@/src/app/(admin)/tasks/leave";

// Beacon target for the on-hide/close flush. userId comes from the session — never
// from the body — so a client can only ever write to its own timesheet.
export async function POST(req: Request) {
  const user = await getSessionUser(await headers());
  if (!user) return NextResponse.json({ success: false }, { status: 401 });

  let body: {
    date?: string;
    halfDay?: boolean;
    onLeave?: boolean;
    leaveType?: LeaveType | null;
    entries?: { taskId: number; category: string; answer: string; hours: number }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  if (!body.date) return NextResponse.json({ success: false, message: "Missing date" }, { status: 400 });

  const result = await saveDay(
    body.date,
    !!body.halfDay,
    !!body.onLeave,
    body.leaveType ?? null,
    body.entries ?? [],
  );
  return NextResponse.json(result);
}
