"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  Calendar,
  MapPin,
  MessageCircle,
  Phone,
  User,
  CheckCircle,
  XCircle,
  Shield,
  Clock,
} from "lucide-react";
import { API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/* ---------- Types ---------- */

interface Coordinator {
  name: string;
  phone?: string;
  email?: string;
}

interface ServiceInfo {
  name: string;
  description?: string;
  coordinatorId?: Coordinator;
}

interface EventInfo {
  name: string;
  eventStart: string;
  eventEnd?: string;
  status: string;
  venue?: string;
}

interface Registration {
  _id: string;
  status: string;
  eventId: EventInfo;
  serviceId?: ServiceInfo;
}

interface Volunteer {
  name: string;
  volunteerNumber?: string;
  phone?: string;
  photoKey?: string;
}

interface SevaData {
  volunteer: Volunteer;
  registrations: Registration[];
}

/* ---------- Helpers ---------- */

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }
> = {
  registered: { label: "Registered", variant: "secondary", icon: Clock },
  assigned: { label: "Assigned", variant: "default", icon: Shield },
  attended: { label: "Attended", variant: "default", icon: CheckCircle },
  cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle },
  no_show: { label: "No Show", variant: "destructive", icon: XCircle },
};

function formatDateRange(start: string, end?: string) {
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const startStr = format(s, "EEE, MMM d, yyyy");
  if (!e || e.toDateString() === s.toDateString()) return startStr;
  return `${startStr} - ${format(e, "MMM d")}`;
}

/* ---------- Components ---------- */

function SevaCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

function SevaCard({ registration }: { registration: Registration }) {
  const { eventId: event, serviceId: service, status } = registration;
  const config = statusConfig[status] || statusConfig.registered;
  const StatusIcon = config.icon;

  return (
    <div className="overflow-hidden rounded-xl border bg-card ring-1 ring-foreground/5">
      {/* Event header band */}
      <div className="bg-primary/5 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug">{event.name}</h3>
          <Badge variant={config.variant} className="shrink-0">
            <StatusIcon className="mr-1 h-3 w-3" />
            {config.label}
          </Badge>
        </div>

        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{formatDateRange(event.eventStart, event.eventEnd)}</span>
          </div>
          {event.venue && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-muted-foreground/40 underline-offset-2 hover:text-primary hover:decoration-primary"
              >
                {event.venue}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Service & coordinator */}
      <div className="px-4 py-3 space-y-3">
        {service && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Service
            </p>
            <p className="mt-0.5 font-medium">{service.name}</p>
            {service.description && (
              <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                {service.description}
              </p>
            )}
          </div>
        )}

        {service?.coordinatorId && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Coordinator
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">
                  {service.coordinatorId.name}
                </span>
              </div>
              {service.coordinatorId.phone && (
                <div className="flex items-center gap-1.5">
                  <a
                    href={`tel:+91${service.coordinatorId.phone}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                    title="Call"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                  <a
                    href={`https://wa.me/91${service.coordinatorId.phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:text-green-400"
                    title="WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function MySevaTokenPage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<SevaData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSeva = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/seva/${params.token}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Invalid or expired link");
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [params.token]);

  useEffect(() => {
    fetchSeva();
  }, [fetchSeva]);

  /* Loading state */
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <SevaCardSkeleton />
        <SevaCardSkeleton />
      </div>
    );
  }

  /* Error state */
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Link Not Valid</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          {error || "This seva link is invalid or has expired. Please contact the volunteer care cell."}
        </p>
        <Link href="/my-seva">
          <Button variant="outline" size="sm" className="mt-6">
            Look up by phone number
          </Button>
        </Link>
      </div>
    );
  }

  const { volunteer, registrations } = data;

  return (
    <div className="space-y-5">
      {/* Volunteer info */}
      <div className="rounded-xl border bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          {volunteer.photoKey ? (
            <img
              src={`/api/upload/photo?key=${encodeURIComponent(volunteer.photoKey)}`}
              alt={volunteer.name}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/20"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
          )}
          <div>
            <h2 className="font-semibold">{volunteer.name}</h2>
            {volunteer.volunteerNumber && (
              <p className="text-sm text-muted-foreground">
                HKV-{volunteer.volunteerNumber}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section heading */}
      <div>
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Your Seva Assignments
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {registrations.length === 0
            ? "No seva assignments found."
            : `${registrations.length} assignment${registrations.length > 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Seva cards */}
      {registrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-14 text-center">
          <Shield className="h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium">No seva assignments yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You will see your assignments here once registered.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {registrations.map((reg) => (
            <SevaCard key={reg._id} registration={reg} />
          ))}
        </div>
      )}
    </div>
  );
}
