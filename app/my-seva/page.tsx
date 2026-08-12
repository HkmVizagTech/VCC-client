"use client";

import { useState, useCallback } from "react";
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
  Loader2,
  ArrowRight,
} from "lucide-react";
import { API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/* ---------- Types ---------- */

interface Coordinator {
  name: string;
  phone?: string;
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
  phone: string;
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

/* ---------- Seva Card ---------- */

function SevaCard({ registration }: { registration: Registration }) {
  const { eventId: event, serviceId: service, status } = registration;
  const config = statusConfig[status] || statusConfig.registered;
  const StatusIcon = config.icon;

  return (
    <div className="overflow-hidden rounded-xl border bg-card ring-1 ring-foreground/5">
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
                <span className="font-medium">{service.coordinatorId.name}</span>
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

/* ---------- Main Page ---------- */

export default function MySevaLookupPage() {
  const [step, setStep] = useState<"phone" | "result">("phone");
  const [phone, setPhone] = useState("");
  const [data, setData] = useState<SevaData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSeva = useCallback(async (cleanedPhone: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/volunteers/by-phone/${cleanedPhone}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "No volunteer found with this number");
      }
      const json = await res.json();
      setData(json);
      setStep("result");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not find your records");
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleLookup() {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    await fetchSeva(cleaned);
  }

  if (step === "phone") {
    return (
      <div className="flex flex-col items-center pt-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Phone className="h-6 w-6 text-primary" />
        </div>
        <h2 className="mt-4 text-xl font-bold">Look Up Your Seva</h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Enter your registered phone number to view your seva assignments.
        </p>

        <div className="mt-8 w-full max-w-xs space-y-4">
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">
              Phone Number
            </label>
            <div className="flex items-center gap-2">
              <span className="flex h-9 items-center rounded-md border bg-muted px-2.5 text-sm text-muted-foreground">
                +91
              </span>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="Enter 10-digit number"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              />
            </div>
          </div>

          <Button
            className="w-full gap-2"
            size="lg"
            disabled={phone.replace(/\D/g, "").length !== 10 || loading}
            onClick={handleLookup}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            View My Seva
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { volunteer, registrations } = data;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">{volunteer.name}</h2>
            <p className="text-sm text-muted-foreground">+91 {volunteer.phone}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
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
        <button
          type="button"
          onClick={() => { setStep("phone"); setPhone(""); setData(null); }}
          className="text-xs font-medium text-primary hover:underline"
        >
          Different number
        </button>
      </div>

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
