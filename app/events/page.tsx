import Link from "next/link";
import { format } from "date-fns";
import { API_URL } from "@/lib/api";
import { CalendarDays, MapPin, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

interface PublicEvent {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  venue?: string;
  bannerImage?: string;
  eventStart: string;
  eventEnd: string;
  status: string;
}

const statusLabels: Record<string, string> = {
  registration_open: "Registrations Open",
  registration_closed: "Registrations Closed",
  ongoing: "Ongoing",
};

async function getEvents(): Promise<PublicEvent[]> {
  try {
    const res = await fetch(`${API_URL}/api/events/public`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.events || [];
  } catch {
    return [];
  }
}

export default async function PublicEventsPage() {
  const events = await getEvents();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
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

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <div className="mb-8 text-center">
          <p className="mb-2 text-lg font-medium text-primary">
            Festivals & Seva Programs
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Upcoming Events
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Register as a volunteer for upcoming festivals and seva programs.
            Your seva makes a difference.
          </p>
        </div>

        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed py-20 text-center">
            <p className="text-lg font-medium">No upcoming events right now</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Please check back soon for new programs.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {events.map((event) => (
              <Link
                key={event._id}
                href={`/events/${event.slug}`}
                className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
              >
                {event.bannerImage && (
                  <div className="relative h-36 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={event.bannerImage}
                      alt={event.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-bold group-hover:text-primary">
                      {event.name}
                    </h3>
                    <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {statusLabels[event.status] || event.status}
                    </span>
                  </div>
                  {event.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {event.description}
                    </p>
                  )}
                  <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      <span>
                        {format(new Date(event.eventStart), "EEE, MMM d, yyyy")}
                        {event.eventEnd &&
                          new Date(event.eventEnd).toDateString() !==
                            new Date(event.eventStart).toDateString() &&
                          ` – ${format(new Date(event.eventEnd), "MMM d")}`}
                      </span>
                    </div>
                    {event.venue && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{event.venue}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    View details
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Hare Krishna Movement Visakhapatnam &mdash; Volunteer Care Cell
      </footer>
    </div>
  );
}
