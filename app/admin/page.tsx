"use client";

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/authClient";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Users, Calendar, ClipboardList, UserCheck } from "lucide-react";
import { RefreshButton } from "@/components/refresh-button";

interface DashboardStats {
  totalVolunteers: number;
  activeEvents: number;
  totalRegistrations: number;
  assigned: number;
  confirmed: number;
  attended: number;
  byStatus: Record<string, number>;
  recentRegistrations: { _id: string; count: number }[];
  skillsDistribution: { _id: string; count: number }[];
}

const skillLabels: Record<string, string> = {
  medical: "Medical",
  photography: "Photography",
  videography: "Videography",
  driving: "Driving",
  electrical: "Electrical",
  sound: "Sound",
  it: "IT / Tech",
  graphic_design: "Graphic Design",
  cooking: "Cooking",
  crowd_management: "Crowd Management",
  other: "Other",
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
    { label: "Confirmed", value: stats?.confirmed ?? 0 },
    { label: "Attended", value: stats?.attended ?? 0 },
  ];
  const funnelMax = Math.max(...funnelSteps.map((s) => s.value), 1);

  // Skills distribution
  const skills = stats?.skillsDistribution ?? [];
  const skillMax = Math.max(...skills.map((s) => s.count), 1);

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

        {/* Skills Distribution */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Skills Distribution</h2>
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data available</p>
          ) : (
            <div className="space-y-3">
              {skills.map((skill) => {
                const pct = Math.round((skill.count / skillMax) * 100);
                return (
                  <div key={skill._id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {skillLabels[skill._id] || skill._id}
                      </span>
                      <span className="text-muted-foreground">
                        {skill.count}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all dark:bg-blue-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
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
