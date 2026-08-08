import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    default: "My Seva",
    template: "%s | My Seva",
  },
  description: "View and manage your seva assignments",
};

export default function MySevaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/my-seva" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-4.5 w-4.5 text-primary"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Lotus icon */}
                <path d="M12 2C12 2 8 6 8 10c0 2.2 1.8 4 4 4s4-1.8 4-4c0-4-4-8-4-8z" />
                <path d="M12 14c-2.2 0-4-1.8-4-4 0-1.5-2.5-4-5-5 0 5 3 9 9 13" />
                <path d="M12 14c2.2 0 4-1.8 4-4 0-1.5 2.5-4 5-5 0 5-3 9-9 13" />
                <path d="M12 22v-4" />
              </svg>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-primary">
                Hare Krishna Movement
              </p>
              <p className="text-[11px] text-muted-foreground">My Seva</p>
            </div>
          </Link>
          <Link
            href="/events"
            className="text-xs font-medium text-muted-foreground hover:text-primary"
          >
            Events
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t py-5 text-center text-xs text-muted-foreground">
        <p>Hare Krishna Movement Visakhapatnam</p>
        <p className="mt-0.5">Volunteer Care Cell</p>
      </footer>
    </div>
  );
}
