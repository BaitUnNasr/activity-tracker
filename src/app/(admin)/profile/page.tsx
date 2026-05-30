import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { BadgeCheck, Briefcase, Building2, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";

import { db } from "@/src/db/client";
import {
  user as userTable,
  userBranchLink,
  userDesignationLink,
  branchMaster,
  designationMaster,
} from "@/src/db/schema";
import { getSessionUser, type SessionUser } from "@/src/lib/session";
import { ChangePasswordForm } from "./_components/change-password-form";
import { type HistoryEntry, DetailRow, HistorySection } from "../_components/user-card";

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default async function ProfilePage() {
  const sessionUser = await getSessionUser(await headers());

  let branchHistory: HistoryEntry[] = [];
  let designationHistory: HistoryEntry[] = [];

  if (sessionUser) {
    const [userRow, branches, designations] = await Promise.all([
      db.select({ createdAt: userTable.createdAt }).from(userTable).where(eq(userTable.id, sessionUser.id)),
      db
        .select({ name: branchMaster.name, startDate: userBranchLink.startDate, endDate: userBranchLink.endDate })
        .from(userBranchLink)
        .leftJoin(branchMaster, eq(userBranchLink.branchId, branchMaster.id))
        .where(eq(userBranchLink.userId, sessionUser.id))
        .orderBy(desc(userBranchLink.startDate)),
      db
        .select({ name: designationMaster.name, startDate: userDesignationLink.startDate, endDate: userDesignationLink.endDate })
        .from(userDesignationLink)
        .leftJoin(designationMaster, eq(userDesignationLink.designationId, designationMaster.id))
        .where(eq(userDesignationLink.userId, sessionUser.id))
        .orderBy(desc(userDesignationLink.startDate)),
    ]);

    branchHistory = branches.map((b) => ({ name: b.name ?? "—", startDate: b.startDate, endDate: b.endDate ?? null }));
    designationHistory = designations.map((d) => ({ name: d.name ?? "—", startDate: d.startDate, endDate: d.endDate ?? null }));
  }

  return (
    <div className="mt-6">
      <div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">My Profile</h1>
        <p className="text-muted-foreground mt-2">Manage your personal information and account security.</p>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ProfileCard user={sessionUser} branchHistory={branchHistory} designationHistory={designationHistory} />
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
  branchHistory,
  designationHistory,
}: {
  user: SessionUser | null;
  branchHistory: HistoryEntry[];
  designationHistory: HistoryEntry[];
}) {
  const initials = user?.name ? getInitials(user.name) : "?";

  return (
    <Card className="items-center text-center gap-1">
      <Avatar className="h-28 w-28">
        <AvatarFallback className="bg-brand text-foreground text-3xl font-bold">{initials}</AvatarFallback>
      </Avatar>

      <h2 className="text-xl font-semibold text-card-foreground">{user?.name ?? "—"}</h2>
      <p className="text-sm text-muted-foreground">{user?.designation ?? "—"}</p>

      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-brand text-foreground">
        # {user?.employeeCode ?? "—"}
      </span>

      <HistorySection branchHistory={branchHistory} designationHistory={designationHistory} />
    </Card>
  );
}

function PersonalInfo({ user }: { user: SessionUser | null }) {
  const typeLabel = user?.type === "F" ? "Full-time" : user?.type === "T" ? "Trainee" : "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Personal Information</CardTitle>
        <CardDescription>Your account details as registered in the system.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          <DetailRow icon={User} label="Full Name" value={user?.name ?? "—"} />
          <DetailRow icon={Briefcase} label="Type" value={typeLabel} />
          <DetailRow icon={Building2} label="Branch" value={user?.branch ?? "—"} />
          <DetailRow icon={BadgeCheck} label="Designation" value={user?.designation ?? "—"} />
        </div>
      </CardContent>
    </Card>
  );
}
