"use client";

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/authClient";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Link from "next/link";
import { Users, Calendar, ClipboardList, UserCheck } from "lucide-react";
import { RefreshButton } from "@/components/refresh-button";

interface UpcomingEvent {
  _id: string;
  eventId: string;
  name: string;
  status: string;
  eventStart: string;
  eventEnd: string;
  venue?: string;
  registrationCount: number;
}

interface DashboardStats {
  totalVolunteers: number;
  activeEvents: number;
  totalRegistrations: number;
  assigned: number;
  attended: number;
  byStatus: Record<string, number>;
  recentRegistrations: { _id: string; count: number }[];
  upcomingEvents: UpcomingEvent[];
}

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  registration_open: {
    label: "Open",
    className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
  registration_closed: {
    label: "Closed",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  },
  ongoing: {
    label: "Ongoing",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  completed: {
    label: "Completed",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  },
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/stats/dashboard");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        toast.error("Failed to load dashboard stats");
      }
    } catch {
      toast.error("Failed to load dashboard stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Volunteers",
      value: stats?.totalVolunteers ?? 0,
      icon: Users,
      color: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950",
    },
    {
      label: "Active Events",
      value: stats?.activeEvents ?? 0,
      icon: Calendar,
      color:
        "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950",
    },
    {
      label: "Total Registrations",
      value: stats?.totalRegistrations ?? 0,
      icon: ClipboardList,
      color:
        "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-950",
    },
    {
      label: "Assigned",
      value: stats?.assigned ?? 0,
      icon: UserCheck,
      color:
        "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-950",
    },
  ];

  // Registration funnel
  const funnelSteps = [
    { label: "Registered", value: stats?.byStatus?.registered ?? 0 },
    { label: "Assigned", value: stats?.assigned ?? 0 },
    { label: "Attended", value: stats?.attended ?? 0 },
  ];
  const funnelMax = Math.max(...funnelSteps.map((s) => s.value), 1);

  // Upcoming & ongoing events
  const upcomingEvents = stats?.upcomingEvents ?? [];

  // Recent registrations
  const recent = stats?.recentRegistrations ?? [];
  const recentMax = Math.max(...recent.map((r) => r.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.name || "Admin"}
          </p>
        </div>
        <RefreshButton
          onRefresh={fetchStats}
          loading={loading}
          title="Refresh dashboard stats"
        />
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-lg border bg-card p-6"
          >
            <div className={`rounded-lg p-3 ${card.color}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {card.label}
              </p>
              <p className="text-3xl font-bold">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Registration Funnel */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Registration Funnel</h2>
          <div className="space-y-4">
            {funnelSteps.map((step) => {
              const pct = Math.round((step.value / funnelMax) * 100);
              return (
                <div key={step.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{step.label}</span>
                    <span className="text-muted-foreground">{step.value}</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming & Ongoing Events */}
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Upcoming Events</h2>
            <Link
              href="/admin/events"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming events
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => {
                const sc = statusConfig[event.status] || statusConfig.draft;
                const startDate = new Date(event.eventStart);
                const endDate = new Date(event.eventEnd);
                const dateStr =
                  startDate.toDateString() === endDate.toDateString()
                    ? startDate.toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                      })
                    : `${startDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} – ${endDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`;
                return (
                  <Link
                    key={event._id}
                    href={`/admin/events/${event._id}`}
                    className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {event.name}
                        </p>
                        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${sc.className}`}>
                          {sc.label}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{dateStr}</span>
                        {event.venue && <span>📍 {event.venue}</span>}
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-lg font-bold">
                        {event.registrationCount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        registrations
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Registrations Trend */}
      {recent.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Recent Registrations Trend
          </h2>
          <div className="flex items-end gap-2" style={{ height: 160 }}>
            {recent.map((day) => {
              const pct = Math.round((day.count / recentMax) * 100);
              return (
                <div
                  key={day._id}
                  className="group flex flex-1 flex-col items-center gap-1"
                >
                  <span className="text-xs font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    {day.count}
                  </span>
                  <div
                    className="w-full min-w-[8px] rounded-t bg-primary transition-all group-hover:bg-primary/80"
                    style={{ height: `${Math.max(pct, 4)}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {day._id.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
