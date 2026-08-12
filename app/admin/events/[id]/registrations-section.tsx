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
  slotsAreDateSpecific,
  type ServiceAvailabilityEntry,
} from "@/components/service-availability-picker";
import {
  CustomFieldsRenderer,
  type CustomFieldAnswers,
} from "@/components/custom-fields-renderer";
import type { CustomFieldDef } from "@/components/custom-fields-builder";
import { RefreshButton } from "@/components/refresh-button";
import { VolunteerDetailsDialog } from "@/components/volunteer-details-dialog";
import { PhotoCapture } from "@/components/photo-capture";
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

const emptyForm = {
  name: "",
  phone: "",
  age: "",
  gender: "",
  occupationType: "",
  institution: "",
  company: "",
  photoKey: null as string | null,
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


interface RegisteredVolunteer {
  _id: string;
  name: string;
  phone: string;
  age?: number;
  gender?: string;
  locality?: string;
  occupation?: string;
  photoKey?: string;
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
  const [viewingReg, setViewingReg] = useState<Registration | null>(null);
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

  const dateSpecific = useMemo(
    () => slotsAreDateSpecific(availabilitySlots),
    [availabilitySlots]
  );

  const filteredRegistrations = useMemo(() => {
    if (!availDate && !availSlot) return registrations;
    return registrations.filter((r) => {
      const entries = r.serviceAvailability || [];
      if (!entries.length) return false;
      if (dateSpecific) {
        return availSlot
          ? entries.some((e) => e.timeSlot === availSlot)
          : true;
      }
      return entries.some(
        (e) =>
          (!availDate || e.date === availDate) &&
          (!availSlot || e.timeSlot === availSlot)
      );
    });
  }, [registrations, availDate, availSlot, dateSpecific]);

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

  const resetForm = () => {
    setForm(emptyForm);
  };

  const handleAddRegistration = async () => {
    const cleaned = form.phone.replace(/\D/g, "");
    if (!form.name || cleaned.length !== 10) {
      toast.error("Name and a valid 10-digit phone number are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch("/api/registrations", {
        method: "POST",
        body: JSON.stringify({
          eventId,
          name: form.name,
          phone: cleaned,
          age: form.age ? Number(form.age) : undefined,
          gender: form.gender || undefined,
          occupationType: form.occupationType || undefined,
          institution: form.institution || undefined,
          company: form.company || undefined,
          occupation:
            form.occupationType === "student"
              ? "Student"
              : form.occupationType === "working"
                ? "Working"
                : undefined,
          photoKey: form.photoKey || undefined,
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
            {availDate || availSlot
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
                      <Label>Phone Number *</Label>
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 items-center rounded-md border bg-muted px-2.5 text-sm text-muted-foreground">
                          +91
                        </span>
                        <Input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={form.phone}
                          onChange={(e) =>
                            setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })
                          }
                          placeholder="10-digit number"
                        />
                      </div>
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
                  <div className="space-y-2">
                    <Label>Are you a Student or Working?</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.occupationType}
                      onChange={(e) =>
                        setForm({ ...form, occupationType: e.target.value })
                      }
                    >
                      <option value="">Select</option>
                      <option value="student">Student</option>
                      <option value="working">Working Professional</option>
                    </select>
                    {form.occupationType === "student" && (
                      <div className="space-y-2 pt-1">
                        <Label>College / School Name</Label>
                        <Input
                          value={form.institution}
                          onChange={(e) =>
                            setForm({ ...form, institution: e.target.value })
                          }
                          placeholder="e.g. GITAM University"
                        />
                      </div>
                    )}
                    {form.occupationType === "working" && (
                      <div className="space-y-2 pt-1">
                        <Label>Company / Organisation Name</Label>
                        <Input
                          value={form.company}
                          onChange={(e) =>
                            setForm({ ...form, company: e.target.value })
                          }
                          placeholder="e.g. Infosys"
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Photo</Label>
                    <PhotoCapture
                      value={form.photoKey}
                      onChange={(key) => setForm({ ...form, photoKey: key })}
                      disabled={submitting}
                    />
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
          {!dateSpecific && (
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
          )}
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
          {availSlot && (
            <span className="text-sm text-muted-foreground">
              {filteredRegistrations.length} available
              {dateSpecific
                ? ` in ${availSlot}`
                : ` on ${format(new Date(`${availDate}T00:00:00`), "EEE, MMM d")} · ${availSlot}`}
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
            No registrations match the selected availability
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Volunteer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Availability</TableHead>
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
                      <div className="flex items-center gap-2.5">
                        {vol?.photoKey ? (
                          <img
                            src={`/api/upload/photo?key=${encodeURIComponent(vol.photoKey)}`}
                            alt={vol.name}
                            className="h-8 w-8 shrink-0 rounded-full border object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                            {vol?.name?.charAt(0).toUpperCase() || "?"}
                          </div>
                        )}
                        <div className="font-medium">{vol?.name || "—"}</div>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewingReg(reg)}
                            title="View full details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
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

      <VolunteerDetailsDialog
        open={viewingReg !== null}
        onOpenChange={(open) => {
          if (!open) setViewingReg(null);
        }}
        volunteer={viewingReg?.volunteerId || null}
        focusEventId={eventId}
      />
    </div>
  );
}
