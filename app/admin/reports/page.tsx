"use client";

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/authClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { Download, BarChart3, FileSpreadsheet } from "lucide-react";

interface EventOption {
  _id: string;
  name: string;
}

interface Registration {
  _id: string;
  volunteerId: {
    _id: string;
    volunteerNumber: string;
    name: string;
    phone: string;
    whatsappNumber?: string;
    age?: number;
    gender?: string;
    locality?: string;
    occupation?: string;
    skills?: string[];
  };
  eventId: {
    _id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  serviceId?: {
    _id: string;
    name: string;
  };
  status: string;
  createdAt: string;
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

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows
    .map((r) =>
      r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await authFetch("/api/events?limit=100");
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || data);
        }
      } catch {
        toast.error("Failed to load events");
      } finally {
        setEventsLoading(false);
      }
    }
    fetchEvents();
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedEvent && selectedEvent !== "__all") {
        params.set("eventId", selectedEvent);
      }
      const res = await authFetch(`/api/stats/report?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRegistrations(data.registrations || []);
      } else {
        toast.error("Failed to load report");
      }
    } catch {
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [selectedEvent]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleDownload = () => {
    if (registrations.length === 0) {
      toast.error("No data to export");
      return;
    }

    const header = [
      "Volunteer Number",
      "Name",
      "Phone",
      "WhatsApp",
      "Age",
      "Gender",
      "Locality",
      "Occupation",
      "Skills",
      "Event",
      "Service",
      "Status",
      "Registered At",
    ];

    const rows = registrations.map((r) => [
      r.volunteerId?.volunteerNumber ?? "",
      r.volunteerId?.name ?? "",
      r.volunteerId?.phone ?? "",
      r.volunteerId?.whatsappNumber ?? r.volunteerId?.phone ?? "",
      r.volunteerId?.age != null ? String(r.volunteerId.age) : "",
      r.volunteerId?.gender ?? "",
      r.volunteerId?.locality ?? "",
      r.volunteerId?.occupation ?? "",
      (r.volunteerId?.skills ?? [])
        .map((s) => skillLabels[s] || s)
        .join("; "),
      r.eventId?.name ?? "",
      r.serviceId?.name ?? "",
      r.status ?? "",
      r.createdAt ? format(new Date(r.createdAt), "yyyy-MM-dd HH:mm") : "",
    ]);

    const eventName =
      selectedEvent && selectedEvent !== "__all"
        ? events.find((e) => e._id === selectedEvent)?.name ?? "event"
        : "all-events";
    const safeName = eventName.replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase();
    const dateStr = format(new Date(), "yyyy-MM-dd");

    downloadCSV([header, ...rows], `vcc-report-${safeName}-${dateStr}.csv`);
    toast.success(`Exported ${registrations.length} records`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          View and export registration data
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Event:</span>
        </div>
        {eventsLoading ? (
          <Skeleton className="h-9 w-52" />
        ) : (
          <Select
            value={selectedEvent || null}
            onValueChange={(v) => setSelectedEvent(v ?? "")}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="All Events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All Events</SelectItem>
              {events.map((event) => (
                <SelectItem key={event._id} value={event._id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant="outline"
          onClick={handleDownload}
          disabled={loading || registrations.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Download CSV
        </Button>
        <span className="text-sm text-muted-foreground">
          {registrations.length} record{registrations.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : registrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <FileSpreadsheet className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">No registrations found</p>
          <p className="text-sm text-muted-foreground">
            {selectedEvent && selectedEvent !== "__all"
              ? "Try selecting a different event"
              : "No registration data available yet"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vol #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Locality</TableHead>
                <TableHead>Skills</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((r) => (
                <TableRow key={r._id}>
                  <TableCell className="font-mono text-xs">
                    {r.volunteerId?.volunteerNumber ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {r.volunteerId?.name ?? "—"}
                  </TableCell>
                  <TableCell>{r.volunteerId?.phone ?? "—"}</TableCell>
                  <TableCell className="capitalize">
                    {r.volunteerId?.gender || "—"}
                  </TableCell>
                  <TableCell>{r.volunteerId?.locality || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(r.volunteerId?.skills ?? []).length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        (r.volunteerId?.skills ?? []).slice(0, 2).map((s) => (
                          <Badge key={s} variant="outline" className="text-xs">
                            {skillLabels[s] || s}
                          </Badge>
                        ))
                      )}
                      {(r.volunteerId?.skills ?? []).length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{(r.volunteerId?.skills ?? []).length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">
                    {r.eventId?.name ?? "—"}
                  </TableCell>
                  <TableCell>{r.serviceId?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === "attended"
                          ? "default"
                          : r.status === "confirmed"
                            ? "secondary"
                            : "outline"
                      }
                      className="capitalize"
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.createdAt
                      ? format(new Date(r.createdAt), "dd MMM yyyy")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
