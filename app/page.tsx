import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-primary">
              Hare Krishna Movement
            </h1>
            <p className="text-sm text-muted-foreground">Visakhapatnam</p>
          </div>
          <Link
            href="/admin/login"
            className="text-sm font-medium text-muted-foreground hover:text-primary"
          >
            Admin
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-2 text-lg text-primary font-medium">
            Volunteer & Seva Management
          </p>
          <h2 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Serve with devotion
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Register as a volunteer for upcoming festivals and events at Hare
            Krishna Movement Visakhapatnam. Your seva makes a difference.
          </p>
          <Link
            href="/events"
            className="inline-flex h-11 items-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            View Upcoming Events
          </Link>
        </div>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Hare Krishna Movement Visakhapatnam &mdash; Volunteer Care Cell
      </footer>
    </div>
  );
}
