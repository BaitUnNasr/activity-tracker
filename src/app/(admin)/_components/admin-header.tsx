"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ActivitySquare,
  CalendarClock,
  CalendarDays,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Settings,
  User as UserIcon,
  Users,
} from "lucide-react";

import { cn } from "@/src/lib/utils";
import { signOut } from "@/src/lib/auth-client";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "@/src/components/ui/sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/src/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/src/components/ui/drawer";
import type { SessionUser } from "@/src/lib/session";
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar";

const navLinks = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Users", href: "/users", icon: Users },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Holidays", href: "/holidays", icon: CalendarDays },
  { label: "Schedule", href: "/schedule", icon: CalendarClock },
  { label: "Task Master", href: "/task-master", icon: ListTodo },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function AdminHeader({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const initials = user?.name ? getInitials(user.name) : "?";
  const visibleNavLinks = navLinks.filter(
    (link) =>
      !(link.href === "/users" && user?.designation === "General") &&
      !(link.href === "/holidays" && user?.designation !== "Admin") &&
      !(link.href === "/tasks" && user?.designation == "Admin") &&
      !(link.href === "/schedule" && user?.designation !== "Admin") &&
      !(link.href === "/task-master" && user?.designation !== "Admin"),
  );

  function handleAvatarClick() {
    if (window.innerWidth < 640) {
      setDrawerOpen(true);
    } else {
      setDropdownOpen((v) => !v);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <nav className="flex items-center justify-between gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr]" aria-label="Main navigation">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex size-9 items-center justify-center rounded-full bg-brand">
          <ActivitySquare className="size-5 text-gray-900 dark:text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight text-card-foreground">
          Pulse
        </span>
      </div>

      {/* Desktop nav tabs */}
      <div className="hidden sm:flex justify-center">
        <div className="flex items-center gap-1 rounded-full bg-muted border border-border p-1">
          {visibleNavLinks.map(({ label, href }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "px-3 lg:px-4 py-2 text-xs lg:text-sm rounded-full whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-foreground text-brand font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 sm:justify-end">
        {/* Hamburger — mobile only */}
        <IconButton
          aria-label="Open menu"
          className="sm:hidden"
          onClick={() => setSheetOpen(true)}
        >
          <Menu className="h-4 w-4" />
        </IconButton>

        {/* Avatar + dropdown */}
        <div className="relative">
          <button
            onClick={handleAvatarClick}
            aria-label="User menu"
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
            className="rounded-full ring-2 ring-border shadow hover:opacity-90 transition-opacity"
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-foreground text-background text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
                aria-hidden="true"
              />
              <div
                role="menu"
                className="absolute right-0 top-11 z-50 w-56 rounded-2xl border border-border bg-background shadow-lg overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {user?.name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {user?.email ?? "—"}
                  </p>
                </div>

                <SidebarProvider
                  defaultOpen
                  style={{ minHeight: 0, width: "auto" } as React.CSSProperties}
                  className="flex-col"
                >
                  <SidebarMenu className="p-2">
                    <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => { router.push("/profile"); setDropdownOpen(false); }}>
                        <UserIcon />
                        <span>Profile</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => { router.push("/settings"); setDropdownOpen(false); }}>
                        <Settings />
                        <span>Settings</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>

                  <SidebarSeparator />

                  <SidebarMenu className="p-2">
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={handleSignOut}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <LogOut />
                        <span>Sign out</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarProvider>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile profile Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <div className="px-4 pb-4 pt-5 border-b border-border flex items-center gap-4">
            <Avatar className="h-14 w-14 shrink-0 rounded-2xl">
              <AvatarFallback className="bg-foreground text-background text-base font-bold rounded-2xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <DrawerTitle className="text-base font-bold text-foreground truncate">
                {user?.name ?? "—"}
              </DrawerTitle>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {user?.email ?? "—"}
              </p>
            </div>
          </div>
          <SidebarProvider
            defaultOpen
            style={{ minHeight: 0, width: "auto" } as React.CSSProperties}
            className="flex-col"
          >
            <SidebarMenu className="p-2">
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => { router.push("/profile"); setDrawerOpen(false); }}>
                  <UserIcon />
                  <span>Profile</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => { router.push("/settings"); setDrawerOpen(false); }}>
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarSeparator />
            <SidebarMenu className="p-2">
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleSignOut}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarProvider>
        </DrawerContent>
      </Drawer>

      {/* Mobile Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="top" className="p-0">
          {/* Sheet header — matches nav logo */}
          <SheetHeader className="px-4 py-4 border-b border-border">
            <SheetTitle asChild>
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-full bg-brand">
                  <ActivitySquare className="size-5 text-gray-900 dark:text-white" />
                </div>
                <span className="text-xl font-bold tracking-tight text-foreground">
                  Pulse
                </span>
              </div>
            </SheetTitle>
          </SheetHeader>

          {/* Nav links */}
          <SidebarProvider
            defaultOpen
            style={{ minHeight: 0, width: "auto" } as React.CSSProperties}
            className="flex-col flex-1"
          >
            <SidebarMenu className="p-3">
              {visibleNavLinks.map(({ label, href, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + "/");
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={isActive} size="lg" className={cn(isActive && "!bg-brand text-background")}>
                      <Link href={href} onClick={() => setSheetOpen(false)}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

          </SidebarProvider>
        </SheetContent>
      </Sheet>
    </nav>
  );
}

function IconButton({
  children,
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "h-9 w-9 grid place-items-center rounded-full bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
