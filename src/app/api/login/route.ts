import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/src/lib/auth";
import { db } from "@/src/db/client";
import { user } from "@/src/db/schema";

// Sign in with an employee code instead of an email. The code is resolved to the
// user's email server-side (the email is never returned to the client), then the
// request is forwarded to better-auth's email/password sign-in.
export async function POST(req: NextRequest) {
  let body: { employeeCode?: string; password?: string; rememberMe?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const employeeCode = body.employeeCode?.trim();
  const { password, rememberMe } = body;

  if (!employeeCode || !password) {
    return NextResponse.json(
      { message: "Employee code and password are required" },
      { status: 400 },
    );
  }

  const [row] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.employeeCode, employeeCode))
    .limit(1);

  // Same generic message whether the code is unknown or the password is wrong,
  // so employee codes can't be enumerated.
  const invalid = () =>
    NextResponse.json({ message: "Invalid employee code or password" }, { status: 401 });

  if (!row) return invalid();

  try {
    const res = await auth.api.signInEmail({
      body: { email: row.email, password, rememberMe: !!rememberMe },
      asResponse: true,
    });
    if (!res.ok) return invalid();
    // Forward better-auth's response verbatim so its Set-Cookie header reaches the client.
    return res;
  } catch {
    return invalid();
  }
}
