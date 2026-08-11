"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { authFetch } from "@/lib/authClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Phone, Calendar, MapPin, Briefcase, Award } from "lucide-react";

interface VolunteerSummary {
  _id: string;
  name: string;
  phone?: string;
  age?: number;
  gender?: string;
  locality?: string;
  occupation?: string;
  skills?: string[];
  photoKey?: string;
  notes?: string;
  createdAt?: string;
}

interface CustomAnswer {
  fieldId: string;
  label: string;
  type: string;
  value: unknown;
}

interface ServiceAvailabilityEntry {
  date: string;
  timeSlot: string;
}

interface RegistrationRecord {
  _id: string;
  status: string;
  eventId?: {
    _id: string;
    name: string;
    eventId?: string;
    status?: string;
    eventStart?: string;
    eventEnd?: string;
    venue?: string;
  } | null;
  serviceId?: { _id: string; name: string } | null;
  serviceAvailability?: ServiceAvailabilityEntry[];
  customAnswers?: CustomAnswer[];
  notes?: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  registered: "Registered",
  assigned: "Assigned",
  confirmed: "Confirmed",
  attended: "Attended",
  no_show: "No Show",
  cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<string, "default" | "outline" | "secondary" | "destructive"> = {
  registered: "outline",
  assigned: "secondary",
  confirmed: "default",
  attended: "default",
  no_show: "destructive",
  cancelled: "secondary",
};

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

function formatAnswerValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  volunteer: VolunteerSummary | null;
  focusEventId?: string;
}

export function VolunteerDetailsDialog({
  open,
  onOpenChange,
  volunteer,
  focusEventId,
}: Props) {
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !volunteer?._id) return;
    setLoading(true);
    authFetch(`/api/registrations/volunteer/${volunteer._id}`)
      .then((res) => (res.ok ? res.json() : { registrations: [] }))
      .then((data) => setRegistrations(data.registrations || []))
      .catch(() => setRegistrations([]))
      .finally(() => setLoading(false));
  }, [open, volunteer?._id]);

  const sortedRegistrations = focusEventId
    ? [...registrations].sort((a, b) => {
        if (a.eventId?._id === focusEventId) return -1;
        if (b.eventId?._id === focusEventId) return 1;
        return 0;
      })
    : registrations;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Volunteer Details</DialogTitle>
        </DialogHeader>

        {!volunteer ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No volunteer selected.
          </p>
        ) : (
          <div className="max-h-[75vh] space-y-5 overflow-y-auto py-2 pr-1">
            {/* Profile card */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {volunteer.photoKey && (
                    <img
                      src={`/api/upload/photo?key=${encodeURIComponent(volunteer.photoKey)}`}
                      alt={volunteer.name}
                      className="h-14 w-14 shrink-0 rounded-full border object-cover"
                    />
                  )}
                  <div>
                    <div className="text-lg font-semibold">{volunteer.name}</div>
                  </div>
                </div>
                {volunteer.createdAt && (
                  <div className="text-xs text-muted-foreground">
                    Registered {format(new Date(volunteer.createdAt), "MMM d, yyyy")}
                  </div>
                )}
              </div>

              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                {volunteer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{volunteer.phone}</span>
                  </div>
                )}
                {volunteer.age !== undefined && volunteer.age !== null && (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{volunteer.age} years</span>
                  </div>
                )}
                {volunteer.gender && (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="capitalize">{volunteer.gender}</span>
                  </div>
                )}
                {volunteer.locality && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{volunteer.locality}</span>
                  </div>
                )}
                {volunteer.occupation && (
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{volunteer.occupation}</span>
                  </div>
                )}
              </div>

              {volunteer.skills && volunteer.skills.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Award className="h-3 w-3" />
                    Skills
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {volunteer.skills.map((s) => (
                      <Badge key={s} variant="outline">
                        {skillLabels[s] || s.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {volunteer.notes && (
                <div className="mt-3">
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Notes
                  </div>
                  <p className="text-sm">{volunteer.notes}</p>
                </div>
              )}
            </div>

            {/* Registrations */}
            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Registrations ({registrations.length})
              </h3>

              {loading ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading registrations...
                </div>
              ) : sortedRegistrations.length === 0 ? (
                <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                  No registrations yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {sortedRegistrations.map((reg) => (
                    <div
                      key={reg._id}
                      className={`rounded-lg border p-4 ${
                        reg.eventId?._id === focusEventId
                          ? "border-primary/50 bg-primary/5"
                          : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">
                            {reg.eventId?.name || "(Deleted event)"}
                          </div>
                          {reg.eventId?.eventStart && (
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(reg.eventId.eventStart), "MMM d, yyyy")}
                              {reg.eventId.venue && (
                                <>
                                  <span className="mx-1">·</span>
                                  <MapPin className="h-3 w-3" />
                                  {reg.eventId.venue}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <Badge
                          variant={STATUS_VARIANTS[reg.status] || "outline"}
                        >
                          {STATUS_LABELS[reg.status] || reg.status}
                        </Badge>
                      </div>

                      {reg.serviceId?.name && (
                        <div className="mt-3 text-sm">
                          <span className="text-muted-foreground">Assigned to: </span>
                          <span className="font-medium">{reg.serviceId.name}</span>
                        </div>
                      )}

                      {reg.serviceAvailability &&
                        reg.serviceAvailability.length > 0 && (
                          <div className="mt-3">
                            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Availability
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {reg.serviceAvailability.map((a, i) => (
                                <Badge key={i} variant="secondary" className="text-xs font-normal">
                                  {a.date ? `${format(new Date(`${a.date}T00:00:00`), "EEE, MMM d")} · ` : ""}{a.timeSlot}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                      {reg.customAnswers && reg.customAnswers.length > 0 && (
                        <div className="mt-3">
                          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Registration Answers
                          </div>
                          <div className="space-y-2">
                            {reg.customAnswers.map((a) => (
                              <div
                                key={a.fieldId}
                                className="rounded-md border bg-background p-2.5"
                              >
                                <div className="text-xs font-medium text-muted-foreground">
                                  {a.label}
                                </div>
                                <div className="mt-0.5 text-sm">
                                  {formatAnswerValue(a.value)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {reg.notes && (
                        <div className="mt-3">
                          <div className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Volunteer&apos;s Notes
                          </div>
                          <p className="text-sm">{reg.notes}</p>
                        </div>
                      )}

                      <div className="mt-3 text-xs text-muted-foreground">
                        Registered on{" "}
                        {format(new Date(reg.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
