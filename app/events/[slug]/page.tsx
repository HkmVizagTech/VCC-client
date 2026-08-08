import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { API_URL } from "@/lib/api";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Clock,
  CalendarCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface PublicEventDetail {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  venue?: string;
  bannerImage?: string;
  registrationStart?: string;
  registrationEnd?: string;
  eventStart: string;
  eventEnd: string;
  status: string;
  coordinatorId?: { name: string } | null;
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  registration_open: "Registrations Open",
  registration_closed: "Registrations Closed",
  ongoing: "Ongoing",
  completed: "Completed",
  archived: "Archived",
};

async function getEvent(slug: string): Promise<PublicEventDetail | null> {
  try {
    const res = await fetch(`${API_URL}/api/events/public/${slug}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.event || null;
  } catch {
    return null;
  }
}

export default async function PublicEventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) notFound();

  const registrationOpen = event.status === "registration_open";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
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

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <Link
          href="/events"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          All events
        </Link>

        <article className="overflow-hidden rounded-xl border bg-card">
          {event.bannerImage && (
            <div className="relative h-52 w-full sm:h-64">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.bannerImage}
                alt={event.name}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  registrationOpen
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {statusLabels[event.status] || event.status}
              </span>
              {event.coordinatorId?.name && (
                <span className="text-xs text-muted-foreground">
                  Coordinated by {event.coordinatorId.name}
                </span>
              )}
            </div>

            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              {event.name}
            </h1>

            {event.description && (
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                {event.description}
              </p>
            )}

            <div className="mt-6 grid gap-3 rounded-lg border bg-muted/40 p-5 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">Date</p>
                  <p className="text-muted-foreground">
                    {format(new Date(event.eventStart), "EEEE, MMMM d, yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">Timings</p>
                  <p className="text-muted-foreground">
                    {format(new Date(event.eventStart), "h:mm a")} —{" "}
                    {format(new Date(event.eventEnd), "h:mm a")}
                  </p>
                </div>
              </div>
              {event.venue && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">Venue</p>
                    <p className="text-muted-foreground">{event.venue}</p>
                  </div>
                </div>
              )}
              {event.registrationEnd && (
                <div className="flex items-center gap-3">
                  <CalendarCheck className="h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">Registration closes</p>
                    <p className="text-muted-foreground">
                      {format(
                        new Date(event.registrationEnd),
                        "MMM d, yyyy h:mm a"
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 rounded-lg bg-primary/5 p-5 text-center">
              {registrationOpen ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Registrations are currently open for this event.
                  </p>
                  <div className="mt-3">
                    <Link
                      href={`/events/${event.slug}/register`}
                      className="inline-flex h-11 items-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
                    >
                      Register as a Volunteer
                    </Link>
                  </div>
                </>
              ) : event.status === "registration_closed" ? (
                <p className="text-sm text-muted-foreground">
                  Registrations for this event have closed.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Registration will open soon. Please check back.
                </p>
              )}
            </div>
          </div>
        </article>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Hare Krishna Movement Visakhapatnam &mdash; Volunteer Care Cell
      </footer>
    </div>
  );
}
