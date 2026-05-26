import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { BadgeCheck, Briefcase, Building2, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar";

import { db } from "@/src/db/client";
import { user as userTable } from "@/src/db/schema";
import { getSessionUser, type SessionUser } from "@/src/lib/session";
import { ChangePasswordForm } from "./_components/change-password-form";

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatJoined(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default async function ProfilePage() {
  const sessionUser = await getSessionUser(await headers());

  let joinedAt: Date | null = null;
  if (sessionUser) {
    const [row] = await db
      .select({ createdAt: userTable.createdAt })
      .from(userTable)
      .where(eq(userTable.id, sessionUser.id));
    joinedAt = row?.createdAt ?? null;
  }

  return (
    <div className="mt-6">
      <div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
          My Profile
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your personal information and account security.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ProfileCard user={sessionUser} joinedAt={joinedAt} />
        <div className="lg:col-span-2 space-y-5">
          <PersonalInfo user={sessionUser} />
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}

function ProfileCard({
  user,
  joinedAt,
}: {
  user: SessionUser | null;
  joinedAt: Date | null;
}) {
  const initials = user?.name ? getInitials(user.name) : "?";

  return (
    <div className="rounded-3xl border border-border p-6 flex flex-col items-center text-center bg-card">
      <Avatar className="h-28 w-28">
        <AvatarFallback className="bg-brand text-gray-900 text-3xl font-bold">
          {initials}
        </AvatarFallback>
      </Avatar>

      <h2 className="mt-4 text-xl font-semibold text-card-foreground">{user?.name ?? "—"}</h2>
      <p className="text-sm text-muted-foreground">{user?.designation ?? "—"}</p>

      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-brand text-foreground">
        # {user?.employeeCode ?? "—"}
      </span>

      {joinedAt && (
        <div className="mt-4 w-full pt-4 border-t border-dashed border-border flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Joined</span>
          <span className="font-semibold text-foreground">{formatJoined(joinedAt)}</span>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-muted grid place-items-center shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-semibold text-foreground text-right">{value}</span>
    </div>
  );
}

function PersonalInfo({ user }: { user: SessionUser | null }) {
  const typeLabel = user?.type === "F" ? "Full-time" : user?.type === "T" ? "Trainee" : "—";

  return (
    <div className="rounded-3xl border border-border p-6 bg-card">
      <h3 className="text-lg font-semibold text-card-foreground mb-2">Personal Information</h3>
      <div className="divide-y divide-border">
        <DetailRow icon={User} label="Full Name" value={user?.name ?? "—"} />
        <DetailRow icon={Briefcase} label="Type" value={typeLabel} />
        <DetailRow icon={Building2} label="Branch" value={user?.branch ?? "—"} />
        <DetailRow icon={BadgeCheck} label="Designation" value={user?.designation ?? "—"} />
      </div>
    </div>
  );
}
