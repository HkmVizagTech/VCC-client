"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCog,
  ClipboardList,
  CheckCircle,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  HeartHandshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const superAdminNav = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Events", href: "/admin/events", icon: Calendar },
  { label: "Volunteers", href: "/admin/volunteers", icon: Users },
  { label: "Devotees", href: "/admin/devotees", icon: HeartHandshake },
  { label: "Coordinators", href: "/admin/coordinators", icon: UserCog },
  { label: "Assignments", href: "/admin/assignments", icon: ClipboardList },
  { label: "Attendance", href: "/admin/attendance", icon: CheckCircle },
  { label: "Reports", href: "/admin/reports", icon: BarChart3 },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

function SidebarContent({
  role,
  onLogout,
}: {
  role: string;
  onLogout: () => void;
}) {
  const nav =
    role === "super_admin"
      ? superAdminNav
      : role === "event_coordinator"
        ? superAdminNav.filter((n) =>
            [
              "Dashboard",
              "Events",
              "Volunteers",
              "Devotees",
              "Assignments",
              "Attendance",
              "Reports",
            ].includes(n.label)
          )
        : superAdminNav.filter((n) =>
            ["Dashboard", "Volunteers", "Assignments", "Attendance"].includes(
              n.label
            )
          );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-5">
        <h2 className="text-lg font-bold text-primary">VCC Admin</h2>
        <p className="text-xs text-muted-foreground">HKM Visakhapatnam</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t px-3 py-4">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.push("/admin/login");
    }
  }, [user, loading, router, isLoginPage]);

  const handleLogout = async () => {
    await logout();
    router.push("/admin/login");
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 border-r bg-card lg:block">
        <SidebarContent role={user.role} onLogout={handleLogout} />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:px-6">
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="lg:hidden" />
              }
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent role={user.role} onLogout={handleLogout} />
            </SheetContent>
          </Sheet>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user.name}</span>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {user.role.replace(/_/g, " ")}
            </span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
