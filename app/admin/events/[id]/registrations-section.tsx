"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format, eachDayOfInterval } from "date-fns";
import { authFetch } from "@/lib/authClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  ServiceAvailabilityPicker,
  serviceAvailabilitySummary,
  availableOn,
  type ServiceAvailabilityEntry,
} from "@/components/service-availability-picker";
import {
  CustomFieldsRenderer,
  type CustomFieldAnswers,
} from "@/components/custom-fields-renderer";
import type { CustomFieldDef } from "@/components/custom-fields-builder";
import { RefreshButton } from "@/components/refresh-button";
import { toast } from "sonner";
import { ClipboardList, UserCheck, Plus, Loader2, Eye } from "lucide-react";

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
} as const;

const NEXT_STATUSES: Record<string, string[]> = {
  registered: ["assigned", "confirmed", "cancelled"],
  assigned: ["confirmed", "cancelled"],
  confirmed: ["attended", "no_show", "cancelled"],
  attended: [],
  no_show: [],
  cancelled: [],
};

const GENDERS = ["male", "female", "other"] as const;

const SKILLS = [
  "medical",
  "photography",
  "videography",
  "driving",
  "electrical",
  "sound",
  "it",
  "graphic_design",
  "cooking",
  "crowd_management",
  "other",
] as const;

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

const emptyForm = {
  name: "",
  whatsapp: "",
  age: "",
  gender: "",
  locality: "",
  occupation: "",
  skills: [] as string[],
  serviceAvailability: [] as ServiceAvailabilityEntry[],
  customAnswers: {} as CustomFieldAnswers,
  notes: "",
};

interface CustomAnswer {
  fieldId: string;
  label: string;
  type: string;
  value: unknown;
}

function formatAnswerValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  return String(value);
}

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
  serviceAvailability?: ServiceAvailabilityEntry[];
  customAnswers?: CustomAnswer[];
  createdAt: string;
}

interface ServiceOption {
  _id: string;
  name: string;
}

export function RegistrationsSection({
  eventId,
  services,
  canManage,
  availabilitySlots,
  customFields,
  eventStart,
  eventEnd,
}: {
  eventId: string;
  services: ServiceOption[];
  canManage: boolean;
  availabilitySlots: string[];
  customFields?: CustomFieldDef[];
  eventStart?: string;
  eventEnd?: string;
}) {
  const [viewingAnswers, setViewingAnswers] = useState<Registration | null>(
    null
  );
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [availDate, setAvailDate] = useState("");
  const [availSlot, setAvailSlot] = useState("");
  const [changingId, setChangingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await authFetch(
        `/api/registrations/event/${eventId}?${params.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setRegistrations(data.registrations);
      } else {
        toast.error("Failed to load registrations");
      }
    } catch {
      toast.error("Failed to load registrations");
    } finally {
      setLoading(false);
    }
  }, [eventId, statusFilter]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const eventDays = useMemo(() => {
    if (!eventStart || !eventEnd) return [];
    return eachDayOfInterval({
      start: new Date(eventStart),
      end: new Date(eventEnd),
    });
  }, [eventStart, eventEnd]);

  const filteredRegistrations = useMemo(() => {
    if (!availDate || !availSlot) return registrations;
    return registrations.filter((r) =>
      availableOn(r.serviceAvailability, availDate, availSlot)
    );
  }, [registrations, availDate, availSlot]);

  const changeStatus = async (id: string, status: string) => {
    setChangingId(id);
    try {
      const res = await authFetch(`/api/registrations/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Status changed to ${STATUS_LABELS[status]}`);
        fetchRegistrations();
      } else {
        toast.error(data.message || "Could not update status");
      }
    } catch {
      toast.error("Could not update status");
    } finally {
      setChangingId(null);
    }
  };

  const assignService = async (id: string, serviceId: string) => {
    try {
      const res = await authFetch(`/api/registrations/${id}/service`, {
        method: "PUT",
        body: JSON.stringify({ serviceId }),
      });
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

  const toggleSkill = (skill: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
  };

  const handleAddRegistration = async () => {
    if (!form.name || !form.whatsapp) {
      toast.error("Name and WhatsApp number are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch("/api/registrations", {
        method: "POST",
        body: JSON.stringify({
          eventId,
          name: form.name,
          phone: form.whatsapp,
          whatsappNumber: form.whatsapp,
          age: form.age ? Number(form.age) : undefined,
          gender: form.gender || undefined,
          locality: form.locality || undefined,
          occupation: form.occupation || undefined,
          skills: form.skills,
          serviceAvailability: form.serviceAvailability,
          customAnswers: form.customAnswers,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Volunteer registered");
        setDialogOpen(false);
        resetForm();
        fetchRegistrations();
      } else {
        toast.error(data.message || "Something went wrong");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Registrations</h2>
          <Badge variant="secondary">
            {availDate && availSlot
              ? filteredRegistrations.length
              : registrations.length}
          </Badge>
          <RefreshButton
            onRefresh={fetchRegistrations}
            loading={loading}
            variant="ghost"
            size="icon"
            title="Refresh registrations"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger render={<Button variant="default" size="sm" />}>
                <Plus className="mr-2 h-4 w-4" />
                Add Registration
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Register Volunteer</DialogTitle>
                </DialogHeader>
                <div className="max-h-[70vh] space-y-4 overflow-y-auto py-2 pr-1">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Full Name *</Label>
                      <Input
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        placeholder="Volunteer's name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>WhatsApp Number *</Label>
                      <Input
                        type="tel"
                        value={form.whatsapp}
                        onChange={(e) =>
                          setForm({ ...form, whatsapp: e.target.value })
                        }
                        placeholder="+91 9876543210"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Age</Label>
                      <Input
                        type="number"
                        min={13}
                        max={100}
                        value={form.age}
                        onChange={(e) =>
                          setForm({ ...form, age: e.target.value })
                        }
                        placeholder="e.g. 25"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Select
                        value={form.gender || null}
                        onValueChange={(v) => {
                          if (v) setForm({ ...form, gender: v });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {GENDERS.map((g) => (
                            <SelectItem key={g} value={g}>
                              {g.charAt(0).toUpperCase() + g.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Locality / Area</Label>
                      <Input
                        value={form.locality}
                        onChange={(e) =>
                          setForm({ ...form, locality: e.target.value })
                        }
                        placeholder="e.g. MVP Colony"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Occupation</Label>
                      <Input
                        value={form.occupation}
                        onChange={(e) =>
                          setForm({ ...form, occupation: e.target.value })
                        }
                        placeholder="e.g. Student"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Skills</Label>
                    <div className="flex flex-wrap gap-2">
                      {SKILLS.map((skill) => {
                        const active = form.skills.includes(skill);
                        return (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => toggleSkill(skill)}
                            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input bg-transparent text-muted-foreground hover:bg-accent"
                            }`}
                          >
                            {skillLabels[skill]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {availabilitySlots.length > 0 && eventStart && eventEnd && (
                    <ServiceAvailabilityPicker
                      start={new Date(eventStart)}
                      end={new Date(eventEnd)}
                      slots={availabilitySlots}
                      value={form.serviceAvailability}
                      onChange={(serviceAvailability) =>
                        setForm({ ...form, serviceAvailability })
                      }
                    />
                  )}
                  {customFields && customFields.length > 0 && (
                    <div className="border-t pt-4">
                      <CustomFieldsRenderer
                        fields={customFields}
                        values={form.customAnswers}
                        onChange={(customAnswers) =>
                          setForm({ ...form, customAnswers })
                        }
                      />
                    </div>
                  )}
                  <Button
                    className="w-full"
                    onClick={handleAddRegistration}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      "Register Volunteer"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Select
            value={statusFilter || null}
            onValueChange={(v) => {
              if (v && v !== "__all") setStatusFilter(v);
              else setStatusFilter("");
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {eventDays.length > 0 && availabilitySlots.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Available:
          </span>
          <Select
            value={availDate || null}
            onValueChange={(v) => {
              if (v && v !== "__all") setAvailDate(v);
              else setAvailDate("");
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Any day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Any day</SelectItem>
              {eventDays.map((d) => (
                <SelectItem
                  key={format(d, "yyyy-MM-dd")}
                  value={format(d, "yyyy-MM-dd")}
                >
                  {format(d, "EEE, MMM d")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={availSlot || null}
            onValueChange={(v) => {
              if (v && v !== "__all") setAvailSlot(v);
              else setAvailSlot("");
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Any time slot" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Any time slot</SelectItem>
              {availabilitySlots.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(availDate || availSlot) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAvailDate("");
                setAvailSlot("");
              }}
            >
              Clear
            </Button>
          )}
          {availDate && availSlot && (
            <span className="text-sm text-muted-foreground">
              {filteredRegistrations.length} available on{" "}
              {format(new Date(`${availDate}T00:00:00`), "EEE, MMM d")} ·{" "}
              {availSlot}
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : registrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <UserCheck className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium">No registrations yet</p>
          <p className="text-sm text-muted-foreground">
            {statusFilter
              ? "No registrations with this status"
              : "Volunteer registrations will appear here"}
          </p>
        </div>
      ) : filteredRegistrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <UserCheck className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium">No volunteers available</p>
          <p className="text-sm text-muted-foreground">
            No registrations for the selected day and time slot
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Volunteer</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Skills</TableHead>
                {canManage && <TableHead>Service</TableHead>}
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRegistrations.map((reg) => {
                const vol = reg.volunteerId;
                const next = NEXT_STATUSES[reg.status] || [];
                const availability = serviceAvailabilitySummary(
                  reg.serviceAvailability
                );
                return (
                  <TableRow key={reg._id}>
                    <TableCell>
                      <div className="font-medium">{vol?.name || "—"}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {vol?.volunteerNumber || "—"}
                      </div>
                    </TableCell>
                    <TableCell>{vol?.phone || "—"}</TableCell>
                    <TableCell>
                      {availability ? (
                        <span className="text-xs">{availability}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(vol?.skills || []).length === 0 ? (
                        <span className="text-muted-foreground">—</span>
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
                    {canManage && (
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
                    )}
                    <TableCell>
                      <Badge variant={STATUS_STYLES[reg.status] as "outline"}>
                        {STATUS_LABELS[reg.status] || reg.status}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {(reg.customAnswers?.length || 0) > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewingAnswers(reg)}
                              title="View custom answers"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {next.map((s) => (
                            <Button
                              key={s}
                              variant="outline"
                              size="sm"
                              disabled={changingId === reg._id}
                              onClick={() => changeStatus(reg._id, s)}
                            >
                              {STATUS_LABELS[s]}
                            </Button>
                          ))}
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

      <Dialog
        open={viewingAnswers !== null}
        onOpenChange={(open) => {
          if (!open) setViewingAnswers(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {viewingAnswers?.volunteerId?.name || "Volunteer"} — Custom Answers
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto py-2">
            {(viewingAnswers?.customAnswers || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No custom answers submitted.
              </p>
            ) : (
              (viewingAnswers?.customAnswers || []).map((a) => (
                <div key={a.fieldId} className="rounded-md border p-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {a.label}
                  </div>
                  <div className="mt-1 text-sm">{formatAnswerValue(a.value)}</div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
