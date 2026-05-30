import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { ArrowLeft, BadgeCheck, Briefcase, Building2, Mail, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { db } from "@/src/db/client";
import {
  user as userTable,
  userBranchLink,
  userDesignationLink,
  branchMaster,
  designationMaster,
} from "@/src/db/schema";
import { getSessionUser } from "@/src/lib/session";
import { type HistoryEntry, HistorySection } from "../../_components/user-card";
import {
  StatusToggle,
  TransferBranchButton,
  UpdateDesignationButton,
} from "./_components/user-actions";

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function formatJoined(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessionUser = await getSessionUser(await headers());
  if (!sessionUser || sessionUser.designation === "General") redirect("/dashboard");

  const [userRow, branches, designations, allBranches, allDesignations] = await Promise.all([
    db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        employeeCode: userTable.employeeCode,
        type: userTable.type,
        isActive: userTable.isActive,
        createdAt: userTable.createdAt,
      })
      .from(userTable)
      .where(eq(userTable.id, id))
      .limit(1),
    db
      .select({
        name: branchMaster.name,
        branchId: userBranchLink.branchId,
        startDate: userBranchLink.startDate,
        endDate: userBranchLink.endDate,
      })
      .from(userBranchLink)
      .leftJoin(branchMaster, eq(userBranchLink.branchId, branchMaster.id))
      .where(eq(userBranchLink.userId, id))
      .orderBy(desc(userBranchLink.startDate)),
    db
      .select({
        name: designationMaster.name,
        designationId: userDesignationLink.designationId,
        startDate: userDesignationLink.startDate,
        endDate: userDesignationLink.endDate,
      })
      .from(userDesignationLink)
      .leftJoin(designationMaster, eq(userDesignationLink.designationId, designationMaster.id))
      .where(eq(userDesignationLink.userId, id))
      .orderBy(desc(userDesignationLink.startDate)),
    db.select({ id: branchMaster.id, name: branchMaster.name }).from(branchMaster).where(eq(branchMaster.isActive, true)).orderBy(asc(branchMaster.name)),
    db.select({ id: designationMaster.id, name: designationMaster.name }).from(designationMaster).where(eq(designationMaster.isActive, true)).orderBy(asc(designationMaster.name)),
  ]);

  const userData = userRow[0];
  if (!userData) notFound();

  const currentBranch      = branches.find((b) => !b.endDate);
  const currentDesignation = designations.find((d) => !d.endDate);

  const branchHistory: HistoryEntry[]      = branches.map((b) => ({ name: b.name ?? "—", startDate: b.startDate, endDate: b.endDate ?? null }));
  const designationHistory: HistoryEntry[] = designations.map((d) => ({ name: d.name ?? "—", startDate: d.startDate, endDate: d.endDate ?? null }));

  const typeLabel = userData.type === "F" ? "Full-time" : userData.type === "T" ? "Trainee" : "—";
  const initials  = getInitials(userData.name);

  return (
    <div className="mt-6">
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/users"
          className="h-9 w-9 rounded-full border border-border bg-muted grid place-items-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
          aria-label="Back to users"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-none">
            {userData.name}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {currentDesignation?.name ?? "—"} · {currentBranch?.name ?? "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: avatar card + history */}
        <Card className="items-center text-center gap-1">
          <Avatar className="h-28 w-28">
            <AvatarFallback className="bg-brand text-foreground text-3xl font-bold">{initials}</AvatarFallback>
          </Avatar>

          <h2 className="text-xl font-semibold text-card-foreground">{userData.name}</h2>
          <p className="text-sm text-muted-foreground">{currentDesignation?.name ?? "—"}</p>

          <div className="flex items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-brand text-foreground">
              # {userData.employeeCode}
            </span>
            {/* <Badge
              variant="outline"
              className={cn(
                userData.isActive
                  ? "bg-brand/10 border-brand/30 text-foreground"
                  : "bg-muted border-border text-muted-foreground",
              )}
            >
              {userData.isActive ? "Active" : "Inactive"}
            </Badge> */}
            <StatusToggle userId={userData.id} isActive={userData.isActive} />
          </div>

          {userData.createdAt && (
            <div className="mt-4 w-full pt-4 border-t border-dashed border-border flex items-center justify-between text-sm">
              <span className="text-muted-foreground ms-5">Joined</span>
              <span className="font-semibold text-foreground me-5">{formatJoined(userData.createdAt)}</span>
            </div>
          )}

          <HistorySection
            branchHistory={branchHistory}
            designationHistory={designationHistory}
            branchAction={
              <TransferBranchButton
                userId={userData.id}
                branches={allBranches}
                currentBranchId={currentBranch?.branchId ?? null}
                currentBranchName={currentBranch?.name ?? null}
              />
            }
            designationAction={
              <UpdateDesignationButton
                userId={userData.id}
                designations={allDesignations}
                currentDesignationId={currentDesignation?.designationId ?? null}
                currentDesignationName={currentDesignation?.name ?? null}
              />
            }
          />
        </Card>

        {/* Right: personal info */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Personal Information</CardTitle>
              <CardDescription>Account details for this user.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                <InfoRow icon={User}       label="Full Name"   value={userData.name} />
                <InfoRow icon={Mail}       label="Email"       value={userData.email} />
                <InfoRow icon={Briefcase}  label="Type"        value={typeLabel} />

                <InfoRow icon={Building2}  label="Branch"      value={currentBranch?.name ?? "—"} />
                <InfoRow icon={BadgeCheck} label="Designation" value={currentDesignation?.name ?? "—"} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
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
