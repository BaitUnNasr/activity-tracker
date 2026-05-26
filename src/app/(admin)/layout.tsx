import { headers } from "next/headers";

import { getSessionUser } from "@/src/lib/session";
import { AdminHeader } from "./_components/admin-header";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser(await headers());

  return (
    <div className="min-h-dvh bg-brand p-3 sm:p-5 md:p-6">
      <div className="mx-auto max-w-[1400px] rounded-2xl sm:rounded-[2rem] bg-background p-4 sm:p-6 md:p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.18)] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]">
        <AdminHeader user={user} />
        <main>{children}</main>
      </div>
    </div>
  );
}
