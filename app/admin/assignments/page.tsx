"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { authFetch } from "@/lib/authClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "sonner";
import {
  ClipboardList,
  Users,
  ArrowRight,
  Search,
  UserCheck,
  Loader2,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  registered: "Registered",
  assigned: "Assigned",
  confirmed: "Confirmed",
  attended: "Attended",
  no_show: "No Show",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  registered: "outline",
  assigned: "secondary",
  confirmed: "default",
  attended: "default",
  no_show: "destructive",
  cancelled: "secondary",
};

interface RegisteredVolunteer {
  _id: string;
  name: string;
  phone: string;
  whatsappNumber?: string;
  volunteerNumber: string;
  age?: number;
  gender?: string;
  locality?: string;
  occupation?: string;
  skills?: string[];
}

interface Registration {
  _id: string;
  status: string;
  volunteerId?: RegisteredVolunteer;
  serviceId?: { _id: string; name: string } | null;
  createdAt: string;
}

interface ServiceOption {
  _id: string;
  name: string;
  requiredVolunteers?: number;
  coordinatorId?: string;
}

interface EventOption {
  _id: string;
  name: string;
  date?: string;
}

export default function AssignmentsPage() {
  const { user } = useAuth();

  // Event selection
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [eventsLoading, setEventsLoading] = useState(true);

  // Data
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Unassigned pool controls
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkServiceId, setBulkServiceId] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Fetch events on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch("/api/events?limit=100");
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events);
        } else {
          toast.error("Failed to load events");
        }
      } catch {
        toast.error("Failed to load events");
      } finally {
        setEventsLoading(false);
      }
    })();
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch registrations + services when event changes
  const fetchEventData = useCallback(async () => {
    if (!selectedEventId) return;
    setLoading(true);
    setSelectedIds(new Set());
    setBulkServiceId("");
    try {
      const [regRes, svcRes] = await Promise.all([
        authFetch(
          `/api/registrations/event/${selectedEventId}?limit=500`
        ),
        authFetch(`/api/services/event/${selectedEventId}`),
      ]);
      if (regRes.ok) {
        const regData = await regRes.json();
        setRegistrations(regData.registrations);
      } else {
        toast.error("Failed to load registrations");
        setRegistrations([]);
      }
      if (svcRes.ok) {
        const svcData = await svcRes.json();
        setServices(svcData.services);
      } else {
        toast.error("Failed to load services");
        setServices([]);
      }
    } catch {
      toast.error("Failed to load event data");
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    fetchEventData();
  }, [fetchEventData]);

  // Derived data
  const unassigned = useMemo(() => {
    return registrations.filter(
      (r) =>
        (!r.serviceId || r.status === "registered") &&
        r.status !== "cancelled"
    );
  }, [registrations]);

  const filteredUnassigned = useMemo(() => {
    if (!search) return unassigned;
    const q = search.toLowerCase();
    return unassigned.filter((r) => {
      const vol = r.volunteerId;
      if (!vol) return false;
      return (
        vol.name.toLowerCase().includes(q) ||
        vol.phone.includes(q) ||
        vol.volunteerNumber.toLowerCase().includes(q) ||
        (vol.locality || "").toLowerCase().includes(q) ||
        (vol.skills || []).some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [unassigned, search]);

  const assignedByService = useMemo(() => {
    const map = new Map<string, Registration[]>();
    for (const svc of services) {
      map.set(svc._id, []);
    }
    for (const reg of registrations) {
      if (
        reg.serviceId &&
        reg.status !== "registered" &&
        reg.status !== "cancelled"
      ) {
        const list = map.get(reg.serviceId._id);
        if (list) {
          list.push(reg);
        }
      }
    }
    return map;
  }, [registrations, services]);

  // Actions
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
        fetchEventData();
      } else {
        toast.error(data.message || "Could not assign service");
      }
    } catch {
      toast.error("Could not assign service");
    }
  };

  const bulkAssign = async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one volunteer");
      return;
    }
    if (!bulkServiceId) {
      toast.error("Select a target service");
      return;
    }
    setBulkAssigning(true);
    try {
      const res = await authFetch("/api/registrations/bulk-assign", {
        method: "PUT",
        body: JSON.stringify({
          registrationIds: Array.from(selectedIds),
          serviceId: bulkServiceId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          `${selectedIds.size} volunteer${selectedIds.size > 1 ? "s" : ""} assigned`
        );
        setSelectedIds(new Set());
        setBulkServiceId("");
        fetchEventData();
      } else {
        toast.error(data.message || "Bulk assign failed");
      }
    } catch {
      toast.error("Bulk assign failed");
    } finally {
      setBulkAssigning(false);
    }
  };

  // Checkbox helpers
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredUnassigned.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUnassigned.map((r) => r._id)));
    }
  };

  // Access check
  if (
    user?.role !== "super_admin" &&
    user?.role !== "event_coordinator"
  ) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">
          Service assignments require event coordinator access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Service Assignments</h1>
          <p className="text-sm text-muted-foreground">
            Assign volunteers to services for an event
          </p>
        </div>
      </div>

      {/* Event selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium whitespace-nowrap">
          Select Event
        </label>
        <Select
          value={selectedEventId || null}
          onValueChange={(v) => {
            if (v) {
              setSelectedEventId(v);
              setSearch("");
              setSearchInput("");
            }
          }}
        >
          <SelectTrigger className="w-72">
            <SelectValue
              placeholder={eventsLoading ? "Loading events..." : "Choose an event"}
            />
          </SelectTrigger>
          <SelectContent>
            {events.map((evt) => (
              <SelectItem key={evt._id} value={evt._id}>
                {evt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* No event selected */}
      {!selectedEventId && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">No event selected</p>
          <p className="text-sm text-muted-foreground">
            Choose an event above to manage service assignments
          </p>
        </div>
      )}

      {/* Loading state */}
      {selectedEventId && loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      )}

      {/* Main content */}
      {selectedEventId && !loading && (
        <>
          {/* ── Unassigned Pool ── */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold">Unassigned Pool</h2>
                <Badge variant="secondary">{unassigned.length}</Badge>
              </div>
              <div className="relative min-w-52 flex-1 max-w-sm">
                <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search by name, phone, skills..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>

            {/* Bulk assign bar */}
            {filteredUnassigned.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/50 px-4 py-3">
                <span className="text-sm font-medium">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} selected`
                    : "Select volunteers to bulk assign"}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={bulkServiceId || null}
                  onValueChange={(v) => {
                    if (v) setBulkServiceId(v);
                  }}
                >
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Target service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={
                    selectedIds.size === 0 ||
                    !bulkServiceId ||
                    bulkAssigning
                  }
                  onClick={bulkAssign}
                >
                  {bulkAssigning && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Assign{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                </Button>
              </div>
            )}

            {filteredUnassigned.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                <UserCheck className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="font-medium">No unassigned volunteers</p>
                <p className="text-sm text-muted-foreground">
                  {search
                    ? "No matches for your search"
                    : "All volunteers have been assigned to services"}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            filteredUnassigned.length > 0 &&
                            selectedIds.size === filteredUnassigned.length
                          }
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>Volunteer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Skills</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assign Service</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnassigned.map((reg) => {
                      const vol = reg.volunteerId;
                      return (
                        <TableRow key={reg._id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(reg._id)}
                              onCheckedChange={() => toggleOne(reg._id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {vol?.name || "—"}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {vol?.volunteerNumber || "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {vol?.phone || "—"}
                            {vol?.whatsappNumber &&
                              vol.whatsappNumber !== vol.phone && (
                                <div className="text-xs text-muted-foreground">
                                  WA: {vol.whatsappNumber}
                                </div>
                              )}
                          </TableCell>
                          <TableCell>
                            {(vol?.skills || []).length === 0 ? (
                              <span className="text-muted-foreground">
                                —
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {(vol?.skills || []).slice(0, 3).map((s) => (
                                  <Badge key={s} variant="outline">
                                    {s.replace(/_/g, " ")}
                                  </Badge>
                                ))}
                                {(vol?.skills || []).length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{(vol?.skills || []).length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                STATUS_STYLES[reg.status] as "outline"
                              }
                            >
                              {STATUS_LABELS[reg.status] || reg.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
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
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* ── Service Breakdown ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Service Breakdown</h2>
              <Badge variant="secondary">{services.length} services</Badge>
            </div>

            {services.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="font-medium">No services configured</p>
                <p className="text-sm text-muted-foreground">
                  Add services to this event first
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((svc) => {
                  const assigned = assignedByService.get(svc._id) || [];
                  const required = svc.requiredVolunteers || 0;
                  const fillPct =
                    required > 0
                      ? Math.min(
                          100,
                          Math.round((assigned.length / required) * 100)
                        )
                      : 0;
                  const isFull = required > 0 && assigned.length >= required;

                  return (
                    <div
                      key={svc._id}
                      className="rounded-lg border bg-card p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold leading-tight">
                            {svc.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {assigned.length}
                            {required > 0 ? ` / ${required}` : ""} volunteers
                          </p>
                        </div>
                        <Badge
                          variant={isFull ? "default" : "secondary"}
                        >
                          {isFull ? "Full" : `${fillPct}%`}
                        </Badge>
                      </div>

                      {/* Progress bar */}
                      {required > 0 && (
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isFull
                                ? "bg-green-500"
                                : fillPct >= 50
                                  ? "bg-primary"
                                  : "bg-amber-500"
                            }`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      )}

                      {/* Assigned volunteers list */}
                      {assigned.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          No volunteers assigned yet
                        </p>
                      ) : (
                        <div className="max-h-40 space-y-1 overflow-y-auto">
                          {assigned.map((reg) => {
                            const vol = reg.volunteerId;
                            return (
                              <div
                                key={reg._id}
                                className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-muted/50"
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="font-medium truncate block">
                                    {vol?.name || "—"}
                                  </span>
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {vol?.volunteerNumber || ""}
                                  </span>
                                </div>
                                <Badge
                                  variant={
                                    STATUS_STYLES[reg.status] as "outline"
                                  }
                                  className="ml-2 shrink-0"
                                >
                                  {STATUS_LABELS[reg.status] || reg.status}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-6 rounded-md border bg-muted/30 px-4 py-3 text-sm">
            <div>
              <span className="text-muted-foreground">Total registrations:</span>{" "}
              <span className="font-semibold">
                {registrations.filter((r) => r.status !== "cancelled").length}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Unassigned:</span>{" "}
              <span className="font-semibold">{unassigned.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Assigned:</span>{" "}
              <span className="font-semibold">
                {registrations.filter(
                  (r) =>
                    r.serviceId &&
                    r.status !== "registered" &&
                    r.status !== "cancelled"
                ).length}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Services:</span>{" "}
              <span className="font-semibold">{services.length}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
