"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { authFetch } from "@/lib/authClient";
import { useAuth } from "@/contexts/AuthContext";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  ClipboardList,
  QrCode,
  RotateCcw,
  CalendarDays,
} from "lucide-react";
import { RefreshButton } from "@/components/refresh-button";
import { CheckInQr } from "@/components/check-in-qr";
import { eventDayKeys, todayKey } from "@/lib/utils/event-days";

// --- Types ---

interface Event {
  _id: string;
  name: string;
  eventId: string;
  status: string;
  eventStart?: string;
  eventEnd?: string;
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

interface DayEntry {
  date: string;
  status: "attended" | "no_show";
  checkedInAt?: string;
  source?: string;
}

interface Registration {
  _id: string;
  status: string;
  volunteerId?: Volunteer;
  serviceId?: { _id: string; name: string } | null;
  dayAttendance?: DayEntry[];
  createdAt: string;
}

// --- Constants ---

const OVERALL_LABELS: Record<string, string> = {
  registered: "Registered",
  assigned: "Assigned",
  attended: "Attended",
  no_show: "No Show",
  cancelled: "Cancelled",
};

const OVERALL_STYLES: Record<string, string> = {
  registered: "outline",
  assigned: "secondary",
  attended: "default",
  no_show: "destructive",
  cancelled: "secondary",
};

const dayLabel = (day: string) =>
  format(new Date(`${day}T00:00:00`), "EEE, MMM d");

// --- Component ---

export default function AttendancePage() {
  const { user } = useAuth();
  const canAssign =
    user?.role === "super_admin" || user?.role === "event_coordinator";

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [activeDay, setActiveDay] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  // Fetch events on mount
  const fetchEvents = useCallback(async () => {
    try {
      const res = await authFetch("/api/stats/events");
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

  const selectedEvent = useMemo(
    () => events.find((e) => e._id === selectedEventId),
    [events, selectedEventId]
  );

  const eventDays = useMemo(
    () => eventDayKeys(selectedEvent?.eventStart, selectedEvent?.eventEnd),
    [selectedEvent]
  );

  // Default the day to today when the event is running, else the first day.
  useEffect(() => {
    if (!selectedEventId || eventDays.length === 0) {
      setActiveDay("");
      return;
    }
    const today = todayKey();
    setActiveDay(eventDays.includes(today) ? today : eventDays[0]);
  }, [selectedEventId, eventDays]);

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
      const params = new URLSearchParams({ limit: "500" });
      const res = await authFetch(
        `/api/registrations/event/${selectedEventId}?${params.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        // Anyone who registered can check in, so keep every non-cancelled
        // registration in the attendance pool.
        const relevant = (data.registrations || []).filter(
          (r: Registration) => r.status !== "cancelled"
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

  const markDay = async (
    registrationId: string,
    date: string,
    status: "attended" | "no_show" | "unmark"
  ) => {
    setActionId(registrationId);
    try {
      const res = await authFetch(
        `/api/registrations/${registrationId}/attendance`,
        {
          method: "PUT",
          body: JSON.stringify({ date, status }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        const labels: Record<string, string> = {
          attended: "Checked in",
          no_show: "Marked as no show",
          unmark: "Attendance record removed",
        };
        toast.success(labels[status]);
        fetchRegistrations();
      } else {
        toast.error(data.message || "Could not update attendance");
      }
    } catch {
      toast.error("Could not update attendance");
    } finally {
      setActionId(null);
    }
  };

  const assignService = async (registrationId: string, serviceId: string) => {
    try {
      const res = await authFetch(
        `/api/registrations/${registrationId}/service`,
        {
          method: "PUT",
          body: JSON.stringify({ serviceId }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Service assigned");
        fetchRegistrations();
      } else {
        toast.error(data.message || "Could not assign service");
      }
    } catch {
      toast.error("Could not assign service");
    }
  };

  // --- Derived data ---

  const dayEntryFor = useCallback(
    (reg: Registration, date: string) =>
      (reg.dayAttendance || []).find((d) => d.date === date),
    []
  );

  const filteredRegistrations = useMemo(() => {
    let filtered = registrations;

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
          vol?.name?.toLowerCase().includes(q) || vol?.phone?.includes(q)
        );
      });
    }

    return filtered;
  }, [registrations, selectedServiceId, searchQuery]);

  const stats = useMemo(() => {
    const total = registrations.length;
    const checkedIn = registrations.filter(
      (r) => dayEntryFor(r, activeDay)?.status === "attended"
    ).length;
    const noShow = registrations.filter(
      (r) => dayEntryFor(r, activeDay)?.status === "no_show"
    ).length;
    return {
      total,
      checkedIn,
      noShow,
      pending: total - checkedIn - noShow,
    };
  }, [registrations, activeDay, dayEntryFor]);

  // --- Render ---

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            Track volunteer check-ins per day, for each event
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedEvent && (
            <Dialog open={qrOpen} onOpenChange={setQrOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm" />}>
                <QrCode className="mr-2 h-4 w-4" />
                Check-in QR
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Venue Check-in QR</DialogTitle>
                </DialogHeader>
                <CheckInQr
                  eventId={selectedEvent.eventId}
                  eventName={selectedEvent.name}
                />
              </DialogContent>
            </Dialog>
          )}
          <RefreshButton
            onRefresh={fetchRegistrations}
            loading={loadingRegistrations}
            title="Refresh attendance data"
          />
        </div>
      </div>

      {/* Event + day selectors */}
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

        {selectedEventId && eventDays.length > 0 && (
          <div className="w-44">
            <label className="mb-1.5 block text-sm font-medium">Day</label>
            <Select
              value={activeDay || null}
              onValueChange={(v) => {
                if (v) setActiveDay(v);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {eventDays.map((d) => (
                  <SelectItem key={d} value={d}>
                    {dayLabel(d)}
                    {d === todayKey() ? " · Today" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
            label="Registered"
            value={stats.total}
          />
          <StatCard
            icon={<CheckCircle className="h-5 w-5 text-green-600" />}
            label={`Checked In · ${dayLabel(activeDay)}`}
            value={stats.checkedIn}
          />
          <StatCard
            icon={<XCircle className="h-5 w-5 text-destructive" />}
            label={`No Show · ${dayLabel(activeDay)}`}
            value={stats.noShow}
          />
          <StatCard
            icon={<Clock className="h-5 w-5 text-amber-500" />}
            label={`Pending · ${dayLabel(activeDay)}`}
            value={stats.pending}
          />
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

      {selectedEventId && !loadingRegistrations && eventDays.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium">No attendance days</p>
          <p className="text-sm text-muted-foreground">
            This event has no date range configured
          </p>
        </div>
      )}

      {selectedEventId &&
        !loadingRegistrations &&
        eventDays.length > 0 &&
        filteredRegistrations.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <UserCheck className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">No registrations</p>
            <p className="text-sm text-muted-foreground">
              {searchQuery || selectedServiceId
                ? "No registrations match the current filters"
                : "No volunteers have registered for this event yet"}
            </p>
          </div>
        )}

      {selectedEventId &&
        !loadingRegistrations &&
        eventDays.length > 0 &&
        filteredRegistrations.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Volunteer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>{dayLabel(activeDay)}</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => {
                  const vol = reg.volunteerId;
                  const isProcessing = actionId === reg._id;
                  const entry = dayEntryFor(reg, activeDay);
                  return (
                    <TableRow key={reg._id}>
                      <TableCell className="font-medium">
                        {vol?.name || "—"}
                      </TableCell>
                      <TableCell>{vol?.phone || "—"}</TableCell>
                      <TableCell>
                        {canAssign && services.length > 0 ? (
                          <Select
                            value={reg.serviceId?._id || null}
                            onValueChange={(v) => {
                              if (v) assignService(reg._id, v);
                            }}
                          >
                            <SelectTrigger className="w-44 truncate">
                              <SelectValue
                                placeholder="Assign service"
                                className="truncate"
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {services.map((s) => (
                                <SelectItem key={s._id} value={s._id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : reg.serviceId?.name ? (
                          <Badge variant="outline">{reg.serviceId.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!entry ? (
                          <Badge variant="outline">Pending</Badge>
                        ) : entry.status === "attended" ? (
                          <Badge className="bg-green-600 text-white hover:bg-green-600">
                            Checked In
                          </Badge>
                        ) : (
                          <Badge variant="destructive">No Show</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (OVERALL_STYLES[reg.status] as
                              | "default"
                              | "secondary"
                              | "destructive"
                              | "outline") || "outline"
                          }
                        >
                          {OVERALL_LABELS[reg.status] || reg.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!entry || entry.status === "no_show" ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isProcessing}
                                onClick={() =>
                                  markDay(reg._id, activeDay, "attended")
                                }
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircle className="mr-1 h-3.5 w-3.5" />
                                Check In
                              </Button>
                              {!entry && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isProcessing}
                                  onClick={() =>
                                    markDay(reg._id, activeDay, "no_show")
                                  }
                                  className="text-destructive hover:text-destructive"
                                >
                                  <XCircle className="mr-1 h-3.5 w-3.5" />
                                  No Show
                                </Button>
                              )}
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isProcessing}
                              onClick={() =>
                                markDay(reg._id, activeDay, "unmark")
                              }
                              title="Remove this day's check-in"
                            >
                              <RotateCcw className="mr-1 h-3.5 w-3.5" />
                              Undo
                            </Button>
                          )}
                        </div>
                      </TableCell>
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
