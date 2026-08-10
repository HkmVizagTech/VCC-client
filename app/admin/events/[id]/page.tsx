"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { authFetch } from "@/lib/authClient";
import { useAuth } from "@/contexts/AuthContext";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  UserCheck,
  ListTree,
  CalendarClock,
  MapPin,
  Users,
  Copy,
} from "lucide-react";
import { RegistrationsSection } from "./registrations-section";
import type { CustomFieldDef } from "@/components/custom-fields-builder";
import { RefreshButton } from "@/components/refresh-button";

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

interface Service {
  _id: string;
  name: string;
  description?: string;
  requiredVolunteers: number;
  coordinatorId?: Coordinator | null;
  status: string;
  createdAt: string;
}

interface EventDetail {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  venue?: string;
  eventStart: string;
  eventEnd: string;
  availabilitySlots?: string[];
  customFields?: CustomFieldDef[];
  status: string;
}

const emptyForm = {
  name: "",
  description: "",
  requiredVolunteers: "",
  coordinatorId: "",
};

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const eventId = params.id;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canManage =
    user?.role === "super_admin" || user?.role === "event_coordinator";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventRes, servicesRes] = await Promise.all([
        authFetch(`/api/events/${eventId}`),
        authFetch(`/api/services/event/${eventId}`),
      ]);
      if (eventRes.ok) {
        const data = await eventRes.json();
        setEvent(data.event);
      }
      if (servicesRes.ok) {
        const data = await servicesRes.json();
        setServices(data.services);
      } else {
        toast.error("Failed to load services");
      }
    } catch {
      toast.error("Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

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

  useEffect(() => {
    fetchData();
    fetchCoordinators();
  }, [fetchData, fetchCoordinators]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const handleSubmit = async () => {
    if (!form.name) {
      toast.error("Service name is required");
      return;
    }
    setSubmitting(true);
    try {
      const url = editing
        ? `/api/services/${editing._id}`
        : "/api/services";
      const method = editing ? "PUT" : "POST";
      const body = editing
        ? {
            name: form.name,
            description: form.description || undefined,
            requiredVolunteers: form.requiredVolunteers
              ? Number(form.requiredVolunteers)
              : 0,
          }
        : {
            eventId,
            name: form.name,
            description: form.description || undefined,
            requiredVolunteers: form.requiredVolunteers
              ? Number(form.requiredVolunteers)
              : 0,
            coordinatorId: form.coordinatorId || undefined,
          };
      const res = await authFetch(url, {
        method,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(editing ? "Service updated" : "Service created");
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.message || "Something went wrong");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssign = async (service: Service, coordinatorId: string) => {
    if (!coordinatorId) return;
    try {
      const res = await authFetch(`/api/services/${service._id}/coordinator`, {
        method: "PUT",
        body: JSON.stringify({ coordinatorId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Coordinator assigned");
        fetchData();
      } else {
        toast.error(data.message || "Could not assign coordinator");
      }
    } catch {
      toast.error("Could not assign coordinator");
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!event || status === event.status) return;
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
      fetchData();
    }
  };

  const handleDelete = async (service: Service) => {
    try {
      const res = await authFetch(`/api/services/${service._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Service deleted");
        fetchData();
      } else {
        toast.error(data.message || "Could not delete service");
      }
    } catch {
      toast.error("Could not delete service");
    }
  };

  const openCreate = () => {
    fetchCoordinators();
    setDialogOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditing(service);
    setForm({
      name: service.name,
      description: service.description || "",
      requiredVolunteers:
        service.requiredVolunteers !== undefined
          ? String(service.requiredVolunteers)
          : "",
      coordinatorId: "",
    });
    setDialogOpen(true);
  };

  const copyRegistrationLink = async () => {
    if (!event) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/events/${event.slug}/register`
      );
      toast.success("Registration link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to events
        </Link>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{event?.name || "Event"}</h1>
            {event?.description && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {event.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {event && (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4" />
                    {format(new Date(event.eventStart), "MMM d, yyyy h:mm a")} —{" "}
                    {format(new Date(event.eventEnd), "MMM d, yyyy h:mm a")}
                  </span>
                  {event.venue && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {event.venue}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          {event &&
            (canManage ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyRegistrationLink}
                  title="Copy registration link"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
                <Select
                  value={event.status}
                  onValueChange={(v) => {
                    if (v && v !== event.status) handleStatusChange(v);
                  }}
                >
                  <SelectTrigger className="w-44">
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
              </div>
            ) : (
              <Badge variant="outline">
                {statusLabels[event.status] || event.status}
              </Badge>
            ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTree className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Services</h2>
          <Badge variant="secondary">{services.length}</Badge>
          <RefreshButton
            onRefresh={fetchData}
            loading={loading}
            variant="ghost"
            size="icon"
            title="Refresh services"
          />
        </div>
        {canManage && (
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger render={<Button onClick={openCreate} />}>
              <Plus className="mr-2 h-4 w-4" />
              Add Service
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Edit Service" : "Add Service"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Service Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Prasadam Distribution"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder="What does this seva involve?"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Required Volunteers</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.requiredVolunteers}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        requiredVolunteers: e.target.value,
                      })
                    }
                    placeholder="e.g. 10"
                  />
                </div>
                {!editing && (
                  <div className="space-y-2">
                    <Label>Coordinator</Label>
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
                )}
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting
                    ? "Saving..."
                    : editing
                      ? "Update Service"
                      : "Create Service"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">No services yet</p>
          <p className="text-sm text-muted-foreground">
            Add seva services volunteers can register for
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div key={service._id} className="rounded-lg border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{service.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {service.description || "No description"}
                  </p>
                </div>
                {service.status === "inactive" && (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{service.requiredVolunteers}</span>
                <span className="text-muted-foreground">volunteers needed</span>
              </div>
              <div className="mt-4 border-t pt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 text-xs text-muted-foreground">
                      Coordinator
                    </div>
                    {canManage ? (
                      <Select
                        value={service.coordinatorId?._id || null}
                        onValueChange={(v) => {
                          if (v) handleAssign(service, v);
                        }}
                      >
                        <SelectTrigger className="w-full truncate">
                          <SelectValue
                            placeholder="Assign coordinator"
                            className="truncate"
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {coordinators.map((c) => (
                            <SelectItem key={c._id} value={c._id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm">
                        {service.coordinatorId?.name || "—"}
                      </span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="mt-3 flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        fetchCoordinators();
                        openEdit(service);
                      }}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button variant="ghost" size="icon" title="Delete" />
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete &ldquo;{service.name}&rdquo;?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the service from this event.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(service)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserCheck className="h-3.5 w-3.5" />
        Assign coordinators to services so volunteers can be directed.
      </div>

      <div className="border-t pt-6">
        <RegistrationsSection
          eventId={eventId}
          services={services}
          canManage={canManage}
          availabilitySlots={event?.availabilitySlots || []}
          customFields={event?.customFields || []}
          eventStart={event?.eventStart}
          eventEnd={event?.eventEnd}
        />
      </div>
    </div>
  );
}
