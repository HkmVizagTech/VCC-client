"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { authFetch } from "@/lib/authClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
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
import { toast } from "sonner";
import {
  Plus,
  Calendar,
  Pencil,
  Trash2,
  ListTree,
  Copy,
} from "lucide-react";
import {
  CustomFieldsBuilder,
  type CustomFieldDef,
} from "@/components/custom-fields-builder";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshButton } from "@/components/refresh-button";
import { useAuth } from "@/contexts/AuthContext";

const EVENT_STATUSES = [
  "draft",
  "registration_open",
  "registration_closed",
  "ongoing",
  "completed",
  "archived",
] as const;

const statusLabels: Record<string, string> = {
  draft: "Draft",
  registration_open: "Registration Open",
  registration_closed: "Registration Closed",
  ongoing: "Ongoing",
  completed: "Completed",
  archived: "Archived",
};

interface Coordinator {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface EventItem {
  _id: string;
  eventId: string;
  name: string;
  description?: string;
  venue?: string;
  bannerImage?: string;
  eventStart: string;
  eventEnd: string;
  registrationStart?: string;
  registrationEnd?: string;
  availabilitySlots?: string[];
  customFields?: CustomFieldDef[];
  status: string;
  coordinatorId?: Coordinator | null;
  photoRequired?: boolean;
}

interface EventFormPayload {
  name: string;
  description?: string;
  venue?: string;
  bannerImage?: string;
  registrationStart?: string;
  registrationEnd?: string;
  eventStart: string;
  eventEnd: string;
  availabilitySlots: string[];
  customFields: CustomFieldDef[];
  coordinatorId: string;
  photoRequired: boolean;
  eventId?: string;
  password?: string;
}

const emptyForm = {
  eventId: "",
  name: "",
  description: "",
  venue: "",
  bannerImage: "",
  registrationStart: "",
  registrationEnd: "",
  eventStart: "",
  eventEnd: "",
  coordinatorId: "",
  availabilitySlots: [] as string[],
  customFields: [] as CustomFieldDef[],
  photoRequired: false,
};

function toLocalInput(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventItem | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const { user } = useAuth();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await authFetch(`/api/events?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        toast.error("Failed to load events");
      }
    } catch {
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const fetchCoordinators = useCallback(async () => {
    try {
      const res = await authFetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setCoordinators(
          data.users.filter((u: Coordinator) => u.role !== "super_admin")
        );
      }
    } catch {
      toast.error("Failed to load coordinators");
    }
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
    setEditPassword("");
  };

  const handleSubmit = async () => {
    if (!form.name || !form.eventStart || !form.eventEnd) {
      toast.error("Name, event start and event end are required");
      return;
    }
    if (!editing && !(form.eventId || "").trim()) {
      toast.error("Event ID is required (e.g. SKJ26)");
      return;
    }
    if (!form.coordinatorId) {
      toast.error("Coordinator is required");
      return;
    }
    setSubmitting(true);
    try {
      const url = editing ? `/api/events/${editing._id}` : "/api/events";
      const method = editing ? "PUT" : "POST";
      const cleanedFields = form.customFields
        .filter((f) => f.label.trim())
        .map((f) => ({
          ...f,
          label: f.label.trim(),
          options: f.options?.map((o) => o.trim()).filter(Boolean),
        }));

      const body: EventFormPayload = {
        name: form.name,
        description: form.description || undefined,
        venue: form.venue || undefined,
        bannerImage: form.bannerImage || undefined,
        registrationStart: form.registrationStart || undefined,
        registrationEnd: form.registrationEnd || undefined,
        eventStart: form.eventStart,
        eventEnd: form.eventEnd,
        availabilitySlots: form.availabilitySlots.filter((s) => s.trim()),
        customFields: cleanedFields,
        coordinatorId: form.coordinatorId,
        photoRequired: form.photoRequired,
      };
      if (!editing) {
        body.eventId = (form.eventId || "").trim().toUpperCase();
      } else if (user?.role === "super_admin") {
        const newId = (form.eventId || "").trim().toUpperCase();
        if (newId !== editing.eventId) {
          if (!editPassword) {
            toast.error("Enter your password to change the Event ID");
            setSubmitting(false);
            return;
          }
          body.eventId = newId;
          body.password = editPassword;
        }
      }
      const res = await authFetch(url, {
        method,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(editing ? "Event updated" : "Event created");
        setDialogOpen(false);
        resetForm();
        fetchEvents();
      } else {
        toast.error(data.message || "Something went wrong");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (event: EventItem, status: string) => {
    if (status === event.status) return;
    setStatusUpdatingId(event._id);
    try {
      const res = await authFetch(`/api/events/${event._id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Status updated to "${statusLabels[status]}"`);
      } else {
        toast.error(data.message || "Could not update status");
      }
    } catch {
      toast.error("Could not update status");
    } finally {
      setStatusUpdatingId(null);
      fetchEvents();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!deletePassword) {
      toast.error("Enter your password to confirm deletion");
      return;
    }
    setDeleting(true);
    try {
      const res = await authFetch(`/api/events/${deleteTarget._id}`, {
        method: "DELETE",
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Event deleted");
        setDeleteTarget(null);
        setDeletePassword("");
        fetchEvents();
      } else {
        toast.error(data.message || "Could not delete event");
      }
    } catch {
      toast.error("Could not delete event");
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (event: EventItem) => {
    setEditing(event);
    setForm({
      eventId: event.eventId || "",
      name: event.name,
      description: event.description || "",
      venue: event.venue || "",
      bannerImage: event.bannerImage || "",
      registrationStart: toLocalInput(event.registrationStart),
      registrationEnd: toLocalInput(event.registrationEnd),
      eventStart: toLocalInput(event.eventStart),
      eventEnd: toLocalInput(event.eventEnd),
      coordinatorId: event.coordinatorId?._id || "",
      availabilitySlots: event.availabilitySlots || [],
      customFields: event.customFields || [],
      photoRequired: event.photoRequired || false,
    });
    setDialogOpen(true);
    fetchCoordinators();
  };

  const openCreate = () => {
    fetchCoordinators();
    setForm(emptyForm);
    setEditing(null);
    setEditPassword("");
    setDialogOpen(true);
  };

  const copyRegistrationLink = async (event: EventItem) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/events/${event.eventId}/register`
      );
      toast.success("Registration link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-sm text-muted-foreground">
            Festivals and seva programs
          </p>
        </div>
        <div className="flex items-center gap-2">
        <RefreshButton
          onRefresh={fetchEvents}
          loading={loading}
          title="Refresh events"
        />
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button onClick={openCreate} />}>
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Event" : "Create Event"}
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto py-2 pr-1">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Event ID *</Label>
                  <Input
                    value={form.eventId}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        eventId: e.target.value.toUpperCase().replace(/\s/g, ""),
                      })
                    }
                    placeholder="e.g. SKJ26"
                    disabled={!!editing && user?.role !== "super_admin"}
                  />
                  {!editing ? (
                    <p className="text-xs text-muted-foreground">
                      Unique ID shared with the mobile app. Cannot be changed
                      later.
                    </p>
                  ) : user?.role === "super_admin" ? (
                    <p className="text-xs text-muted-foreground">
                      Changing the Event ID requires your password.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Unique ID shared with the mobile app. Cannot be changed.
                    </p>
                  )}
                  {editing && user?.role === "super_admin" && (
                    <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                      This ID is shared with the mobile app. Changing it means
                      the public registration link becomes{" "}
                      <span className="font-mono">
                        /events/{(form.eventId || "").toUpperCase() || "..."}/register
                      </span>{" "}
                      and the mobile app will use the new ID going forward.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Event Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    placeholder="e.g. Sri Krishna Janmashtami 2026"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Short description of the festival"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Venue</Label>
                  <Input
                    value={form.venue}
                    onChange={(e) =>
                      setForm({ ...form, venue: e.target.value })
                    }
                    placeholder="e.g. Temple premises"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Banner Image URL</Label>
                  <Input
                    value={form.bannerImage}
                    onChange={(e) =>
                      setForm({ ...form, bannerImage: e.target.value })
                    }
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Registration Opens</Label>
                  <Input
                    type="datetime-local"
                    value={form.registrationStart}
                    onChange={(e) =>
                      setForm({ ...form, registrationStart: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Registration Closes</Label>
                  <Input
                    type="datetime-local"
                    value={form.registrationEnd}
                    onChange={(e) =>
                      setForm({ ...form, registrationEnd: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Event Starts *</Label>
                  <Input
                    type="datetime-local"
                    value={form.eventStart}
                    onChange={(e) =>
                      setForm({ ...form, eventStart: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Event Ends *</Label>
                  <Input
                    type="datetime-local"
                    value={form.eventEnd}
                    onChange={(e) =>
                      setForm({ ...form, eventEnd: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Coordinator *</Label>
                <Select
                  value={form.coordinatorId || null}
                  onValueChange={(v) => {
                    if (v) setForm({ ...form, coordinatorId: v });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a coordinator" />
                  </SelectTrigger>
                  <SelectContent>
                    {coordinators.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name} — {c.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editing && user?.role === "super_admin" && (
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Your admin password"
                    autoComplete="current-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Required only if you change the Event ID.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Availability Time Slots</Label>
                <p className="text-xs text-muted-foreground">
                  Time slot options volunteers will choose from for each day of
                  the event.
                </p>
                <div className="space-y-2">
                  {form.availabilitySlots.map((slot, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={slot}
                        onChange={(e) => {
                          const next = [...form.availabilitySlots];
                          next[idx] = e.target.value;
                          setForm({ ...form, availabilitySlots: next });
                        }}
                        placeholder="e.g. Full Day 9am-9pm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const next = form.availabilitySlots.filter(
                            (_, i) => i !== idx
                          );
                          setForm({ ...form, availabilitySlots: next });
                        }}
                        title="Remove slot"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm({
                        ...form,
                        availabilitySlots: [...form.availabilitySlots, ""],
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add time slot
                  </Button>
                </div>
              </div>
              <div className="border-t pt-4 space-y-4">
                <label className="flex items-center gap-2.5 cursor-pointer text-sm">
                  <Checkbox
                    checked={form.photoRequired}
                    onCheckedChange={(v) =>
                      setForm({ ...form, photoRequired: Boolean(v) })
                    }
                  />
                  <span>
                    <span className="font-medium">Photo required</span>
                    <span className="ml-1 text-muted-foreground text-xs">
                      — volunteers must upload a photo to register
                    </span>
                  </span>
                </label>
                <CustomFieldsBuilder
                  value={form.customFields}
                  onChange={(customFields) =>
                    setForm({ ...form, customFields })
                  }
                />
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? "Saving..."
                  : editing
                    ? "Update Event"
                    : "Create Event"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={statusFilter || null}
          onValueChange={(v) => {
            if (v && v !== "__all") setStatusFilter(v);
            else setStatusFilter("");
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All statuses</SelectItem>
            {EVENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">No events found</p>
          <p className="text-sm text-muted-foreground">
            Create an event to start collecting registrations
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Coordinator</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => {
                return (
                  <TableRow key={event._id}>
                    <TableCell className="max-w-64">
                      <div className="font-medium">{event.name}</div>
                      <div className="text-xs font-mono text-muted-foreground">
                        {event.eventId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(event.eventStart), "MMM d, yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(event.eventStart), "h:mm a")} —{" "}
                        {format(new Date(event.eventEnd), "h:mm a")}
                      </div>
                    </TableCell>
                    <TableCell>{event.venue || "—"}</TableCell>
                    <TableCell>
                      {event.coordinatorId?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={event.status}
                        onValueChange={(v) => {
                          if (v && v !== event.status) handleStatusChange(event, v);
                        }}
                      >
                        <SelectTrigger
                          className="w-44"
                          disabled={statusUpdatingId === event._id}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EVENT_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {statusLabels[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyRegistrationLink(event)}
                          title="Copy registration link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          render={
                            <Link
                              href={`/admin/events/${event._id}`}
                              title="Services"
                            />
                          }
                        >
                          <ListTree className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(event)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {user?.role === "super_admin" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeleteTarget(event);
                              setDeletePassword("");
                            }}
                            title="Delete event"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {events.length} of {total} events
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeletePassword("");
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete event?</DialogTitle>
            <DialogDescription>
              This permanently deletes &ldquo;{deleteTarget?.name}&rdquo;
              ({deleteTarget?.eventId}), along with all its services and
              registrations. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Re-enter your password to confirm</Label>
            <Input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Your admin password"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null);
                setDeletePassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
