"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AvailabilityPicker,
} from "@/components/availability-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
} from "lucide-react";

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

const GENDERS = ["male", "female", "other"] as const;

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
  availability: { days: [] as string[], timeSlots: [] as string[] },
  notes: "",
};

interface RegisterEvent {
  _id: string;
  name: string;
  status: string;
  eventStart: string;
  eventEnd: string;
  venue?: string;
}

interface SuccessData {
  volunteerNumber: string;
  sevaToken: string;
  name: string;
  eventName: string;
}

export default function RegisterPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [event, setEvent] = useState<RegisterEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState<{
    name: string;
    volunteerNumber: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/events/public/${slug}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setEvent(data.event || null);
      }
    } catch {
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const toggleSkill = (skill: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    if (!form.name || !form.whatsapp) {
      setSuccess(null);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event._id,
          name: form.name,
          phone: form.whatsapp,
          whatsappNumber: form.whatsapp,
          age: form.age ? Number(form.age) : undefined,
          gender: form.gender || undefined,
          locality: form.locality || undefined,
          occupation: form.occupation || undefined,
          skills: form.skills,
          availability: form.availability,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess({
          volunteerNumber: data.volunteer.volunteerNumber,
          sevaToken: data.volunteer.sevaToken,
          name: data.volunteer.name,
          eventName: event.name,
        });
      } else if (res.status === 409) {
        setAlreadyRegistered({
          name: data.volunteer?.name || "you",
          volunteerNumber: data.volunteer?.volunteerNumber || "",
        });
      } else {
        alert(data.message || "Registration failed. Please try again.");
      }
    } catch {
      alert("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyToken = async () => {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.sevaToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const registrationOpen = event?.status === "registration_open";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-primary">
              Hare Krishna Movement
            </h1>
            <p className="text-sm text-muted-foreground">Visakhapatnam</p>
          </div>
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-primary"
          >
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <Link
          href={`/events/${slug}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to event
        </Link>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading event...
          </div>
        ) : !event ? (
          <div className="rounded-lg border border-dashed py-20 text-center">
            <p className="text-lg font-medium">Event not found</p>
          </div>
        ) : success ? (
          <div className="rounded-xl border bg-card p-6 text-center sm:p-10">
            <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-green-600" />
            <h2 className="text-2xl font-bold">Registration Confirmed!</h2>
            <p className="mt-2 text-muted-foreground">
              Thank you, {success.name}. You are registered for{" "}
              <span className="font-medium text-foreground">
                {success.eventName}
              </span>
              .
            </p>

            <div className="mx-auto mt-6 max-w-md space-y-3 rounded-lg border bg-muted/40 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Volunteer Number
                </span>
                <span className="font-mono font-bold text-primary">
                  {success.volunteerNumber}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  Seva Token
                </span>
                <button
                  type="button"
                  onClick={copyToken}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs hover:bg-accent"
                  title="Copy seva token"
                >
                  <span className="truncate">
                    {success.sevaToken.slice(0, 12)}...
                  </span>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 shrink-0" />
                  )}
                </button>
              </div>
            </div>

            <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
              Save your seva token securely. You will need it to track your
              assignment and confirm attendance for this seva.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/events"
                className="inline-flex h-10 items-center rounded-md border px-5 text-sm font-medium hover:bg-accent"
              >
                Browse more events
              </Link>
              <Link
                href="/"
                className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
              >
                Go to Home
              </Link>
            </div>
          </div>
        ) : alreadyRegistered ? (
          <div className="rounded-xl border bg-card p-6 text-center sm:p-10">
            <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-primary" />
            <h2 className="text-2xl font-bold">Already Registered</h2>
            <p className="mt-2 text-muted-foreground">
              You are already registered for this event.
            </p>
            <p className="mt-3 text-sm">
              Volunteer{" "}
              <span className="font-mono font-bold text-primary">
                {alreadyRegistered.volunteerNumber}
              </span>{" "}
              registered under the name {alreadyRegistered.name}.
            </p>
            <Link
              href="/events"
              className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              Browse more events
            </Link>
          </div>
        ) : !registrationOpen ? (
          <div className="rounded-xl border bg-card p-6 text-center sm:p-10">
            <h2 className="text-2xl font-bold">{event.name}</h2>
            <p className="mt-3 text-muted-foreground">
              {event.status === "registration_closed"
                ? "Registrations for this event have closed."
                : event.status === "ongoing"
                  ? "This event is currently in progress."
                  : "Registration for this event is not open right now."}
            </p>
            <Link
              href="/events"
              className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              Browse more events
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b bg-primary/5 p-6">
              <h2 className="text-2xl font-bold">{event.name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {format(new Date(event.eventStart), "EEEE, MMMM d, yyyy")}
                </span>
                {event.venue && <span>{event.venue}</span>}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Fill in your details below to register as a volunteer.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6 sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    placeholder="Your name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp Number *</Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    value={form.whatsapp}
                    onChange={(e) =>
                      setForm({ ...form, whatsapp: e.target.value })
                    }
                    placeholder="+91 9876543210"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    min={13}
                    max={100}
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
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
                  <Label htmlFor="locality">Locality / Area</Label>
                  <Input
                    id="locality"
                    value={form.locality}
                    onChange={(e) =>
                      setForm({ ...form, locality: e.target.value })
                    }
                    placeholder="e.g. MVP Colony"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input
                    id="occupation"
                    value={form.occupation}
                    onChange={(e) =>
                      setForm({ ...form, occupation: e.target.value })
                    }
                    placeholder="e.g. Software Engineer"
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

              <AvailabilityPicker
                value={form.availability}
                onChange={(availability) =>
                  setForm({ ...form, availability })
                }
              />

              <div className="space-y-2">
                <Label htmlFor="notes">Anything else?</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Allergies, or other notes"
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  "Register as a Volunteer"
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                By registering you agree to be contacted regarding this seva.
              </p>
            </form>
          </div>
        )}
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Hare Krishna Movement Visakhapatnam &mdash; Volunteer Care Cell
      </footer>
    </div>
  );
}
