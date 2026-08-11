"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { authFetch } from "@/lib/authClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Users,
  Search,
  Clock,
  UserCheck,
  UserX,
  ClipboardList,
} from "lucide-react";
import { RefreshButton } from "@/components/refresh-button";

// --- Types ---

interface Event {
  _id: string;
  name: string;
  status: string;
}

interface Service {
  _id: string;
  name: string;
}

interface Volunteer {
  _id: string;
  name: string;
  phone: string;
}

interface Registration {
  _id: string;
  status: string;
  volunteerId?: Volunteer;
  serviceId?: { _id: string; name: string } | null;
  createdAt: string;
}

// --- Constants ---

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  assigned: "Assigned",
  attended: "Attended",
  no_show: "No Show",
};

const STATUS_STYLES: Record<string, string> = {
  confirmed: "default",
  assigned: "secondary",
  attended: "default",
  no_show: "destructive",
};

type TabValue = "pending" | "completed";

// --- Component ---

export default function AttendancePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  // Fetch events on mount
  const fetchEvents = useCallback(async () => {
    try {
      const res = await authFetch("/api/events?limit=100");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      toast.error("Failed to fetch events");
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Fetch services when event changes
  useEffect(() => {
    if (!selectedEventId) {
      setServices([]);
      setSelectedServiceId("");
      return;
    }
    const fetchServices = async () => {
      try {
        const res = await authFetch(`/api/services/event/${selectedEventId}`);
        if (res.ok) {
          const data = await res.json();
          setServices(data.services || []);
        }
      } catch {
        toast.error("Failed to fetch services");
      }
    };
    fetchServices();
    setSelectedServiceId("");
  }, [selectedEventId]);

  // Fetch registrations when event changes
  const fetchRegistrations = useCallback(async () => {
    if (!selectedEventId) {
      setRegistrations([]);
      return;
    }
    setLoadingRegistrations(true);
    try {
      // Fetch confirmed/assigned (pending) and attended/no_show (completed) together
      const params = new URLSearchParams({ limit: "500" });
      const res = await authFetch(
        `/api/registrations/event/${selectedEventId}?${params.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        // Keep only attendance-relevant statuses
        const relevant = (data.registrations || []).filter(
          (r: Registration) =>
            ["confirmed", "assigned", "attended", "no_show"].includes(r.status)
        );
        setRegistrations(relevant);
      } else {
        toast.error("Failed to load registrations");
      }
    } catch {
      toast.error("Failed to load registrations");
    } finally {
      setLoadingRegistrations(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  // --- Attendance actions ---

  const markAttendance = async (
    registrationId: string,
    newStatus: "attended" | "no_show"
  ) => {
    setActionId(registrationId);
    try {
      const res = await authFetch(
        `/api/registrations/${registrationId}/status`,
        {
          method: "PUT",
          body: JSON.stringify({ status: newStatus }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(
          newStatus === "attended" ? "Checked in" : "Marked as no show"
        );
        fetchRegistrations();
      } else {
        toast.error(data.message || "Could not update status");
      }
    } catch {
      toast.error("Could not update status");
    } finally {
      setActionId(null);
    }
  };

  const confirmThenTransition = async (
    registrationId: string,
    finalStatus: "attended" | "no_show"
  ) => {
    setActionId(registrationId);
    try {
      // Step 1: assigned -> confirmed
      const confirmRes = await authFetch(
        `/api/registrations/${registrationId}/status`,
        {
          method: "PUT",
          body: JSON.stringify({ status: "confirmed" }),
        }
      );
      if (!confirmRes.ok) {
        const data = await confirmRes.json();
        toast.error(data.message || "Could not confirm registration");
        setActionId(null);
        return;
      }
      // Step 2: confirmed -> attended or no_show
      const finalRes = await authFetch(
        `/api/registrations/${registrationId}/status`,
        {
          method: "PUT",
          body: JSON.stringify({ status: finalStatus }),
        }
      );
      const data = await finalRes.json();
      if (finalRes.ok) {
        toast.success(
          finalStatus === "attended"
            ? "Confirmed and checked in"
            : "Confirmed and marked as no show"
        );
        fetchRegistrations();
      } else {
        toast.error(
          data.message || `Confirmed but could not mark ${finalStatus}`
        );
        fetchRegistrations();
      }
    } catch {
      toast.error("Could not update status");
    } finally {
      setActionId(null);
    }
  };

  // --- Filtered data ---

  const filteredRegistrations = useMemo(() => {
    let filtered = registrations;

    // Tab filter
    if (activeTab === "pending") {
      filtered = filtered.filter(
        (r) => r.status === "confirmed" || r.status === "assigned"
      );
    } else {
      filtered = filtered.filter(
        (r) => r.status === "attended" || r.status === "no_show"
      );
    }

    // Service filter
    if (selectedServiceId) {
      filtered = filtered.filter(
        (r) => r.serviceId?._id === selectedServiceId
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((r) => {
        const vol = r.volunteerId;
        return (
          vol?.name?.toLowerCase().includes(q) ||
          vol?.phone?.includes(q)
        );
      });
    }

    return filtered;
  }, [registrations, activeTab, selectedServiceId, searchQuery]);

  // --- Summary stats ---

  const stats = useMemo(() => {
    // Stats are computed across all registrations for the event (not filtered by service/search)
    const allForEvent = registrations;
    const totalExpected = allForEvent.filter(
      (r) =>
        r.status === "confirmed" ||
        r.status === "assigned" ||
        r.status === "attended" ||
        r.status === "no_show"
    ).length;
    const checkedIn = allForEvent.filter(
      (r) => r.status === "attended"
    ).length;
    const noShow = allForEvent.filter((r) => r.status === "no_show").length;
    const pending = allForEvent.filter(
      (r) => r.status === "confirmed" || r.status === "assigned"
    ).length;
    return { totalExpected, checkedIn, noShow, pending };
  }, [registrations]);

  // --- Render ---

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            Track volunteer check-ins for events
          </p>
        </div>
        <RefreshButton
          onRefresh={fetchRegistrations}
          loading={loadingRegistrations}
          title="Refresh attendance data"
        />
      </div>

      {/* Event selector */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-72">
          <label className="mb-1.5 block text-sm font-medium">Event</label>
          <Select
            value={selectedEventId || null}
            onValueChange={(v) => {
              if (v && v !== "__none") setSelectedEventId(v);
              else setSelectedEventId("");
            }}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={loadingEvents ? "Loading..." : "Select an event"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Select an event</SelectItem>
              {events.map((e) => (
                <SelectItem key={e._id} value={e._id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedEventId && services.length > 0 && (
          <div className="w-56">
            <label className="mb-1.5 block text-sm font-medium">
              Service Filter
            </label>
            <Select
              value={selectedServiceId || null}
              onValueChange={(v) => {
                if (v && v !== "__all") setSelectedServiceId(v);
                else setSelectedServiceId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All services</SelectItem>
                {services.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedEventId && (
          <div className="relative w-64">
            <label className="mb-1.5 block text-sm font-medium">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        )}
      </div>

      {/* No event selected state */}
      {!selectedEventId && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">Select an event</p>
          <p className="text-sm text-muted-foreground">
            Choose an event above to start tracking attendance
          </p>
        </div>
      )}

      {/* Stats cards */}
      {selectedEventId && !loadingRegistrations && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            icon={<Users className="h-5 w-5 text-primary" />}
            label="Total Expected"
            value={stats.totalExpected}
          />
          <StatCard
            icon={<CheckCircle className="h-5 w-5 text-green-600" />}
            label="Checked In"
            value={stats.checkedIn}
          />
          <StatCard
            icon={<XCircle className="h-5 w-5 text-destructive" />}
            label="No Show"
            value={stats.noShow}
          />
          <StatCard
            icon={<Clock className="h-5 w-5 text-amber-500" />}
            label="Pending"
            value={stats.pending}
          />
        </div>
      )}

      {/* Tab toggle */}
      {selectedEventId && (
        <div className="flex gap-1 rounded-lg border p-1 w-fit">
          <button
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "pending"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("pending")}
          >
            Pending ({stats.pending})
          </button>
          <button
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "completed"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("completed")}
          >
            Completed ({stats.checkedIn + stats.noShow})
          </button>
        </div>
      )}

      {/* Registrations table */}
      {selectedEventId && loadingRegistrations && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      )}

      {selectedEventId && !loadingRegistrations && filteredRegistrations.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          {activeTab === "pending" ? (
            <UserCheck className="mb-3 h-10 w-10 text-muted-foreground/50" />
          ) : (
            <UserX className="mb-3 h-10 w-10 text-muted-foreground/50" />
          )}
          <p className="font-medium">
            {activeTab === "pending"
              ? "No pending check-ins"
              : "No completed records"}
          </p>
          <p className="text-sm text-muted-foreground">
            {activeTab === "pending"
              ? "All volunteers have been checked in or there are no confirmed registrations"
              : "No volunteers have been checked in or marked as no show yet"}
          </p>
        </div>
      )}

      {selectedEventId && !loadingRegistrations && filteredRegistrations.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Volunteer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                {activeTab === "pending" && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRegistrations.map((reg) => {
                const vol = reg.volunteerId;
                const isProcessing = actionId === reg._id;
                return (
                  <TableRow key={reg._id}>
                    <TableCell className="font-medium">
                      {vol?.name || "—"}
                    </TableCell>
                    <TableCell>{vol?.phone || "—"}</TableCell>
                    <TableCell>
                      {reg.serviceId?.name ? (
                        <Badge variant="outline">{reg.serviceId.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          STATUS_STYLES[reg.status] as
                            | "default"
                            | "secondary"
                            | "destructive"
                            | "outline"
                        }
                      >
                        {STATUS_LABELS[reg.status] || reg.status}
                      </Badge>
                    </TableCell>
                    {activeTab === "pending" && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {reg.status === "confirmed" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isProcessing}
                                onClick={() =>
                                  markAttendance(reg._id, "attended")
                                }
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircle className="mr-1 h-3.5 w-3.5" />
                                Check In
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isProcessing}
                                onClick={() =>
                                  markAttendance(reg._id, "no_show")
                                }
                                className="text-destructive hover:text-destructive"
                              >
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                No Show
                              </Button>
                            </>
                          )}
                          {reg.status === "assigned" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isProcessing}
                                onClick={() =>
                                  confirmThenTransition(reg._id, "attended")
                                }
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircle className="mr-1 h-3.5 w-3.5" />
                                Confirm & Check In
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isProcessing}
                                onClick={() =>
                                  confirmThenTransition(reg._id, "no_show")
                                }
                                className="text-destructive hover:text-destructive"
                              >
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                No Show
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// --- Stat card sub-component ---

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
