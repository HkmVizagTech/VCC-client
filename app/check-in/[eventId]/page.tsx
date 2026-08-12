"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  Check,
  Loader2,
  MapPin,
  ShieldCheck,
  User,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

/* ---------- Types ---------- */

interface CheckInEvent {
  _id: string;
  name: string;
  venue?: string;
  eventStart?: string;
  eventEnd?: string;
  days?: string[];
}

interface LookupResult {
  volunteer: { _id: string; name: string; phone: string; photoKey?: string };
  event: CheckInEvent;
  registration: {
    _id: string;
    status: string;
    alreadyCheckedIn: boolean;
    checkedInDays?: string[];
    noShowDays?: string[];
    serviceId?: { _id: string; name: string } | null;
  };
}

interface CheckInResult {
  message: string;
  alreadyCheckedIn: boolean;
  date?: string;
  volunteer: { name: string; phone: string; photoKey?: string };
  event: CheckInEvent;
  registration: {
    status: string;
    serviceId?: { _id: string; name: string } | null;
  };
}

type Step = "phone" | "confirm" | "done";

const dayLabel = (day: string) =>
  format(new Date(`${day}T00:00:00`), "EEE, MMM d");

/* ---------- Page ---------- */

export default function CheckInPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;

  const [event, setEvent] = useState<CheckInEvent | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [selectedDay, setSelectedDay] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load event info for the header
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/events/public/${eventId}`);
        if (!res.ok) {
          throw new Error("Event not found");
        }
        const json = await res.json();
        setEvent(json.event);
      } catch {
        setEventError("This check-in link is not valid.");
      }
    };
    load();
  }, [eventId]);

  // Step 1: look up the volunteer by phone — "is this you?"
  const handleLookup = useCallback(async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/events/public/${eventId}/check-in?phone=${cleaned}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Could not find your registration");
      }
      setLookup(data);

      const days = data.event.days || [];
      const today = format(new Date(), "yyyy-MM-dd");
      setSelectedDay(days.includes(today) ? today : days[0] || "");

      const allCheckedIn =
        days.length > 0 &&
        days.every((d: string) =>
          (data.registration.checkedInDays || []).includes(d)
        );

      if (allCheckedIn) {
        setResult({
          message: "Already checked in",
          alreadyCheckedIn: true,
          volunteer: data.volunteer,
          event: data.event,
          registration: data.registration,
        });
        setStep("done");
      } else {
        setStep("confirm");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not find your registration"
      );
    } finally {
      setLoading(false);
    }
  }, [phone, eventId]);

  // Step 2: volunteer confirms it's them → record attendance for the day
  const handleConfirm = useCallback(async () => {
    if (!lookup || !selectedDay) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/events/public/${eventId}/check-in`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: lookup.volunteer.phone, date: selectedDay }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Could not check in");
      }
      setResult(data);
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not check in");
    } finally {
      setConfirming(false);
    }
  }, [lookup, selectedDay, eventId]);

  const reset = () => {
    setStep("phone");
    setPhone("");
    setLookup(null);
    setSelectedDay("");
    setResult(null);
    setError(null);
  };

  if (eventError) {
    return (
      <CenteredCard>
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Link Not Valid</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          {eventError}
        </p>
      </CenteredCard>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
        {/* Event header */}
        {!event ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <div className="text-center">
            <h1 className="text-xl font-bold">{event.name}</h1>
            <div className="mt-2 flex flex-col items-center gap-1 text-sm text-muted-foreground">
              {event.eventStart && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(event.eventStart), "EEE, MMM d, yyyy")}
                  {event.eventEnd &&
                    new Date(event.eventEnd).toDateString() !==
                      new Date(event.eventStart).toDateString() &&
                    ` – ${format(new Date(event.eventEnd), "MMM d")}`}
                </span>
              )}
              {event.venue && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {event.venue}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
          {step === "phone" && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <h2 className="mt-4 text-lg font-bold">Venue Check-in</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your registered mobile number to confirm your attendance.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="phone"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Mobile Number
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 items-center rounded-md border bg-muted px-2.5 text-sm text-muted-foreground">
                      +91
                    </span>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="Enter 10-digit number"
                      maxLength={10}
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, ""))
                      }
                      onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                      autoFocus
                    />
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  className="w-full gap-2"
                  size="lg"
                  disabled={
                    phone.replace(/\D/g, "").length !== 10 || loading
                  }
                  onClick={handleLookup}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  Continue
                </Button>
              </div>
            </>
          )}

          {step === "confirm" && lookup && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <User className="h-6 w-6 text-primary" />
              </div>
              <h2 className="mt-4 text-lg font-bold">Confirm Your Identity</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Is this you? Pick the day, then confirm to record attendance.
              </p>

              <div className="mt-5 flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                {lookup.volunteer.photoKey ? (
                  <img
                    src={`/api/upload/photo?key=${encodeURIComponent(lookup.volunteer.photoKey)}`}
                    alt={lookup.volunteer.name}
                    className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {lookup.volunteer.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    +91 {lookup.volunteer.phone}
                  </p>
                </div>
              </div>

              {lookup.registration.serviceId && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Assigned seva:{" "}
                  <Badge variant="outline" className="align-middle">
                    {lookup.registration.serviceId.name}
                  </Badge>
                </p>
              )}

              {/* Day picker */}
              {lookup.event.days && lookup.event.days.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">Which day are you checking in for?</p>
                  <div className="flex flex-wrap gap-2">
                    {lookup.event.days.map((day) => {
                      const isAttended = (
                        lookup.registration.checkedInDays || []
                      ).includes(day);
                      const isNoShow = (
                        lookup.registration.noShowDays || []
                      ).includes(day);
                      const active = selectedDay === day;
                      const isToday =
                        day === format(new Date(), "yyyy-MM-dd");
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={isAttended}
                          onClick={() => setSelectedDay(day)}
                          className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default ${
                            isAttended
                              ? "border-transparent bg-muted text-muted-foreground"
                              : isNoShow
                                ? "border-amber-400/60 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50"
                                : active
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-input bg-transparent text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          {isAttended && <Check className="h-3 w-3" />}
                          {dayLabel(day)}
                          {isToday && " · Today"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(lookup.registration.noShowDays || []).includes(selectedDay) && (
                <div className="mt-4 flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    You were marked as a no show for {dayLabel(selectedDay)}.
                    Checking in will record you as attended.
                  </span>
                </div>
              )}

              {(lookup.registration.checkedInDays || []).includes(
                selectedDay
              ) && (
                <p className="mt-4 text-sm text-muted-foreground">
                  You are already checked in for {dayLabel(selectedDay)}.
                </p>
              )}

              {error && (
                <p className="mt-4 text-sm text-destructive">{error}</p>
              )}

              <div className="mt-5 space-y-2">
                <Button
                  className="w-full gap-2"
                  size="lg"
                  disabled={
                    confirming ||
                    !selectedDay ||
                    (lookup.registration.checkedInDays || []).includes(
                      selectedDay
                    )
                  }
                  onClick={handleConfirm}
                >
                  {confirming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Confirm Attendance
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  disabled={confirming}
                  onClick={reset}
                >
                  Not you — enter a different number
                </Button>
              </div>
            </>
          )}

          {step === "done" && result && (
            <ResultView result={result} onReset={reset} />
          )}
        </div>

        <p className="mt-auto pt-6 text-center text-xs text-muted-foreground">
          Hare Krishna Movement Visakhapatnam
        </p>
      </main>
    </div>
  );
}

/* ---------- Result view ---------- */

function ResultView({
  result,
  onReset,
}: {
  result: CheckInResult;
  onReset: () => void;
}) {
  const { volunteer, event, registration } = result;

  return (
    <div className="text-center">
      {result.alreadyCheckedIn ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <User className="h-6 w-6 text-muted-foreground" />
        </div>
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15">
          <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
      )}

      <h2 className="mt-4 text-lg font-bold">
        {result.alreadyCheckedIn ? "Already Checked In" : "Check-in Confirmed"}
      </h2>

      {result.date && (
        <p className="mt-1 text-sm text-muted-foreground">
          {dayLabel(result.date)}
          {result.alreadyCheckedIn ? " — you were already checked in" : ""}
        </p>
      )}

      <div className="mt-4 flex items-center justify-center gap-3 rounded-lg bg-muted/50 p-3">
        {volunteer.photoKey && (
          <img
            src={`/api/upload/photo?key=${encodeURIComponent(volunteer.photoKey)}`}
            alt={volunteer.name}
            className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
          />
        )}
        <div className="text-left">
          <p className="font-semibold">{volunteer.name}</p>
          <p className="text-sm text-muted-foreground">
            +91 {volunteer.phone}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{event.name}</p>
        {registration.serviceId ? (
          <p>
            Service:{" "}
            <Badge variant="outline" className="align-middle">
              {registration.serviceId.name}
            </Badge>
          </p>
        ) : (
          <p>Service will be assigned shortly.</p>
        )}
      </div>

      <Button variant="outline" className="mt-6" onClick={onReset}>
        Check in another volunteer
      </Button>
    </div>
  );
}

/* ---------- Shared ---------- */

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}
