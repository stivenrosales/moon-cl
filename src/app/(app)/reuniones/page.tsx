import Link from "next/link";
import { CalendarDays, Globe, MapPin } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, relativeTime } from "@/lib/utils";

export const metadata = { title: "Reuniones" };

export default async function ReunionesPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const now = new Date();
  const [upcoming, past] = await Promise.all([
    db.meeting.findMany({
      where: { startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      include: { book: true, _count: { select: { rsvps: true } } },
    }),
    db.meeting.findMany({
      where: { startsAt: { lt: now } },
      orderBy: { startsAt: "desc" },
      take: 12,
      include: { book: true, _count: { select: { rsvps: true } } },
    }),
  ]);

  return (
    <div className="space-y-8 md:space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.32em] text-accent">El club se reúne</span>
          <h1 className="h1-display display mt-2">
            Reuniones <span className="hand-script italic text-primary">del club</span>
          </h1>
        </div>
        {isAdmin ? (
          <Button asChild variant="gold">
            <Link href="/admin#reuniones">Programar reunión</Link>
          </Button>
        ) : null}
      </header>

      {upcoming.length > 0 ? (
        <Section title="Próximas">
          {upcoming.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </Section>
      ) : (
        <Card className="p-10 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-primary/60" />
          <p className="mt-4 hand-script text-2xl">Sin reuniones programadas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Aparecerán aquí cuando el admin las cree.
          </p>
        </Card>
      )}

      {past.length > 0 ? (
        <Section title="Pasadas">
          {past.map((m) => (
            <MeetingCard key={m.id} meeting={m} past />
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function MeetingCard({
  meeting,
  past,
}: {
  meeting: Awaited<ReturnType<typeof db.meeting.findMany>>[number] & {
    book?: { title: string } | null;
    _count: { rsvps: number };
  };
  past?: boolean;
}) {
  return (
    <Link href={`/reuniones/${meeting.id}`} className="block focus-ring rounded-2xl">
      <Card className="p-6 transition-all hover:-translate-y-0.5 hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {past ? <Badge variant="secondary">Pasada</Badge> : <Badge variant="success">Próxima</Badge>}
          <span className="tabular-nums">{formatDateTime(meeting.startsAt)}</span>
          <span>· {relativeTime(meeting.startsAt)}</span>
        </div>
        <h3 className="display mt-3 text-2xl leading-tight">{meeting.title}</h3>
        {meeting.book ? (
          <p className="mt-1 text-sm text-muted-foreground italic">
            sobre <em>{meeting.book.title}</em>
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {meeting.isVirtual && meeting.meetingUrl ? (
            <span className="inline-flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Virtual
            </span>
          ) : null}
          {meeting.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate max-w-[200px]">{meeting.location}</span>
            </span>
          ) : null}
          <span className="ml-auto text-xs">
            {meeting._count.rsvps} confirmacion{meeting._count.rsvps === 1 ? "" : "es"}
          </span>
        </div>
      </Card>
    </Link>
  );
}
