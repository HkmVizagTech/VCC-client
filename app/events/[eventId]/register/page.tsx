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
  ServiceAvailabilityPicker,
  type ServiceAvailabilityEntry,
} from "@/components/service-availability-picker";
import {
  CustomFieldsRenderer,
  type CustomFieldAnswers,
} from "@/components/custom-fields-renderer";
import type { CustomFieldDef } from "@/components/custom-fields-builder";
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
  Loader2,
} from "lucide-react";
import { PhotoCapture } from "@/components/photo-capture";

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
  phone: "",
  age: "",
  gender: "",
  locality: "",
  occupation: "",
  skills: [] as string[],
  photoKey: null as string | null,
  serviceAvailability: [] as ServiceAvailabilityEntry[],
  customAnswers: {} as CustomFieldAnswers,
  notes: "",
};

interface RegisterEvent {
  _id: string;
  eventId: string;
  name: string;
  status: string;
  eventStart: string;
  eventEnd: string;
  venue?: string;
  availabilitySlots?: string[];
  customFields?: CustomFieldDef[];
  photoRequired?: boolean;
}

interface SuccessData {
  phone: string;
  name: string;
  eventName: string;
}

export default function RegisterPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;

  const [event, setEvent] = useState<RegisterEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState<{
    name: string;
  } | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/events/public/${eventId}`, {
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
  }, [eventId]);

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

    const cleaned = form.phone.replace(/\D/g, "");
    if (!form.name || cleaned.length !== 10) {
      if (cleaned.length !== 10) {
        alert("Please enter a valid 10-digit phone number");
      }
      return;
    }
    if (event.photoRequired && !form.photoKey) {
      alert("A photo is required for this event");
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
          phone: cleaned,
          age: form.age ? Number(form.age) : undefined,
          gender: form.gender || undefined,
          locality: form.locality || undefined,
          occupation: form.occupation || undefined,
          skills: form.skills,
          photoKey: form.photoKey || undefined,
          serviceAvailability: form.serviceAvailability,
          customAnswers: form.customAnswers,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess({
          phone: data.volunteer.phone,
          name: data.volunteer.name,
          eventName: event.name,
        });
      } else if (res.status === 409) {
        setAlreadyRegistered({
          name: data.volunteer?.name || "you",
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
          href={`/events/${eventId}`}
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

            <div className="mx-auto mt-6 max-w-md rounded-lg border bg-muted/40 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Registered Phone
                </span>
                <span className="font-mono font-bold text-primary">
                  +91 {success.phone}
                </span>
              </div>
            </div>

            <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
              Use your phone number to look up your seva assignments on the My
              Seva page.
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
            <p className="mt-3 text-sm text-muted-foreground">
              Registered under the name{" "}
              <span className="font-medium text-foreground">
                {alreadyRegistered.name}
              </span>
              .
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
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 items-center rounded-md border bg-muted px-2.5 text-sm text-muted-foreground">
                      +91
                    </span>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={form.phone}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          phone: e.target.value.replace(/\D/g, ""),
                        })
                      }
                      placeholder="10-digit number"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Photo
                  {event?.photoRequired && (
                    <span className="text-destructive">*</span>
                  )}
                </Label>
                <PhotoCapture
                  value={form.photoKey}
                  onChange={(key) => setForm({ ...form, photoKey: key })}
                  disabled={submitting}
                />
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

              {event?.availabilitySlots &&
                event.availabilitySlots.length > 0 && (
                  <ServiceAvailabilityPicker
                    start={new Date(event.eventStart)}
                    end={new Date(event.eventEnd)}
                    slots={event.availabilitySlots}
                    value={form.serviceAvailability}
                    onChange={(serviceAvailability) =>
                      setForm({ ...form, serviceAvailability })
                    }
                  />
                )}

              {event?.customFields && event.customFields.length > 0 && (
                <div className="border-t pt-4">
                  <CustomFieldsRenderer
                    fields={event.customFields}
                    values={form.customAnswers}
                    onChange={(customAnswers) =>
                      setForm({ ...form, customAnswers })
                    }
                  />
                </div>
              )}

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
