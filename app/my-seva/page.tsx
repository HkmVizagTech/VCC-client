"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  confirmed: { label: "Confirmed", variant: "default", icon: CheckCircle },
  attended: { label: "Attended", variant: "default", icon: CheckCircle },
  cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle },
  declined: { label: "Declined", variant: "destructive", icon: XCircle },
  no_show: { label: "No Show", variant: "destructive", icon: XCircle },
};

function formatDateRange(start: string, end?: string) {
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const startStr = format(s, "EEE, MMM d, yyyy");
  if (!e || e.toDateString() === s.toDateString()) return startStr;
  return `${startStr} - ${format(e, "MMM d")}`;
}

function canConfirm(status: string) {
  return ["registered", "assigned"].includes(status);
}

function canDecline(status: string) {
  return !["cancelled", "declined", "attended", "no_show"].includes(status);
}

/* ---------- Seva Card ---------- */

function SevaCard({
  registration,
  onAction,
}: {
  registration: Registration;
  onAction: (id: string, action: "confirm" | "decline") => Promise<void>;
}) {
  const [loading, setLoading] = useState<"confirm" | "decline" | null>(null);
  const { eventId: event, serviceId: service, status } = registration;
  const config = statusConfig[status] || statusConfig.registered;
  const StatusIcon = config.icon;

  async function handleAction(action: "confirm" | "decline") {
    setLoading(action);
    try {
      await onAction(registration._id, action);
    } finally {
      setLoading(null);
    }
  }

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

        {(canConfirm(status) || canDecline(status)) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {canConfirm(status) && (
              <Button
                size="sm"
                disabled={loading !== null}
                onClick={() => handleAction("confirm")}
                className="gap-1.5 bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:text-white dark:hover:bg-green-700"
              >
                {loading === "confirm" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5" />
                )}
                Confirm Seva
              </Button>
            )}
            {canDecline(status) && status !== "confirmed" && (
              <Button
                variant="outline"
                size="sm"
                disabled={loading !== null}
                onClick={() => handleAction("decline")}
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {loading === "decline" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Unable to Serve
              </Button>
            )}
            {canDecline(status) && status === "confirmed" && (
              <Button
                variant="outline"
                size="sm"
                disabled={loading !== null}
                onClick={() => handleAction("decline")}
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {loading === "decline" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Cancel Seva
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- OTP Lookup Page ---------- */

type Step = "phone" | "otp" | "result";

export default function MySevaLookupPage() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [data, setData] = useState<SevaData | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Countdown for resend */
  const startCountdown = useCallback(() => {
    setCountdown(30);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  /* Send OTP */
  async function handleSendOtp() {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/seva/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Failed to send OTP");
      }
      toast.success("OTP sent to your phone");
      setStep("otp");
      startCountdown();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setSending(false);
    }
  }

  /* Resend OTP */
  async function handleResend() {
    const cleaned = phone.replace(/\D/g, "");
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/seva/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Failed to resend OTP");
      }
      toast.success("OTP resent");
      startCountdown();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to resend OTP");
    } finally {
      setSending(false);
    }
  }

  /* Verify OTP */
  async function handleVerifyOtp() {
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit OTP");
      return;
    }

    const cleaned = phone.replace(/\D/g, "");
    setVerifying(true);
    try {
      const res = await fetch(`${API_URL}/api/seva/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned, otp }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Invalid OTP");
      }
      const json = await res.json();
      setData(json);
      setStep("result");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  /* Re-fetch after action */
  async function refetch() {
    const cleaned = phone.replace(/\D/g, "");
    try {
      const res = await fetch(`${API_URL}/api/seva/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned, otp }),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silent refresh failure
    }
  }

  async function handleAction(registrationId: string, action: "confirm" | "decline") {
    try {
      const res = await fetch(
        `${API_URL}/api/seva/${registrationId}/${action}`,
        { method: "PUT" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `Failed to ${action}`);
      }
      toast.success(action === "confirm" ? "Seva confirmed!" : "Seva declined");
      await refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action}`);
      throw err;
    }
  }

  /* ---------- Phone entry step ---------- */
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
            <label
              htmlFor="phone"
              className="mb-1.5 block text-sm font-medium"
            >
              Phone Number
            </label>
            <div className="flex items-center gap-2">
              <span className="flex h-8 items-center rounded-lg border bg-muted px-2.5 text-sm text-muted-foreground">
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
                onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
              />
            </div>
          </div>

          <Button
            className="w-full gap-2"
            size="lg"
            disabled={phone.replace(/\D/g, "").length !== 10 || sending}
            onClick={handleSendOtp}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Send OTP
          </Button>
        </div>
      </div>
    );
  }

  /* ---------- OTP verification step ---------- */
  if (step === "otp") {
    return (
      <div className="flex flex-col items-center pt-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <h2 className="mt-4 text-xl font-bold">Verify OTP</h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Enter the 6-digit code sent to{" "}
          <span className="font-medium text-foreground">
            +91 {phone.slice(0, 2)}****{phone.slice(-2)}
          </span>
        </p>

        <div className="mt-8 w-full max-w-xs space-y-4">
          <div>
            <label htmlFor="otp" className="mb-1.5 block text-sm font-medium">
              OTP Code
            </label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              placeholder="Enter 6-digit OTP"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
              className="text-center text-lg tracking-[0.3em]"
            />
          </div>

          <Button
            className="w-full gap-2"
            size="lg"
            disabled={otp.length !== 6 || verifying}
            onClick={handleVerifyOtp}
          >
            {verifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Verify
          </Button>

          <div className="text-center text-sm">
            {countdown > 0 ? (
              <span className="text-muted-foreground">
                Resend OTP in{" "}
                <span className="font-medium text-foreground">
                  {countdown}s
                </span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={sending}
                className="font-medium text-primary hover:underline disabled:opacity-50"
              >
                {sending ? "Sending..." : "Resend OTP"}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setOtp("");
            }}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Change phone number
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Results step ---------- */
  if (!data) return null;

  const { volunteer, registrations } = data;

  return (
    <div className="space-y-5">
      {/* Volunteer info */}
      <div className="rounded-xl border bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
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
          onClick={() => {
            setStep("phone");
            setPhone("");
            setOtp("");
            setData(null);
          }}
          className="text-xs font-medium text-primary hover:underline"
        >
          Different number
        </button>
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
            <SevaCard
              key={reg._id}
              registration={reg}
              onAction={handleAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
