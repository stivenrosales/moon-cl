import Link from "next/link";
import { CalendarDays, CalendarRange, Globe, List as ListIcon, MapPin } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MeetingsCalendar, type CalendarMeeting } from "@/components/meetings-calendar";
import { MEETING_TYPE_BADGE_VARIANT, MEETING_TYPE_LABELS } from "@/lib/meeting-types";
import { formatDateTime, relativeTime } from "@/lib/utils";

export const metadata = { title: "Reuniones" };

export default async function ReunionesPage() {
  const session = await getSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const userId = session?.user?.id ?? null;

  const now = new Date();
  const [upcoming, past, all] = await Promise.all([
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
    db.meeting.findMany({
      orderBy: { startsAt: "asc" },
      take: 500,
      // userId ?? "" nunca matchea un cuid real: si no hay sesión, rsvps
      // siempre viene vacío pero el shape del tipo se mantiene consistente.
      include: { rsvps: { where: { userId: userId ?? "" }, select: { status: true } } },
    }),
  ]);

  const calendarMeetings: CalendarMeeting[] = all.map((m) => ({
    id: m.id,
    title: m.title,
    type: m.type,
    startsAt: m.startsAt,
    myRsvp: m.rsvps[0]?.status ?? null,
  }));

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.32em] text-accent-text">El club se reúne</span>
          <h1 className="display text-3xl md:text-4xl leading-[1.05] tracking-tight mt-1.5">
            Reuniones <span className="hand-script italic text-primary">del club</span>
          </h1>
        </div>
        {isAdmin ? (
          <Link
            href="/admin#reuniones"
            className="text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Gestionar →
          </Link>
        ) : null}
      </header>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">
            <ListIcon className="mr-1.5 h-3.5 w-3.5" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="mes">
            <CalendarRange className="mr-1.5 h-3.5 w-3.5" />
            Mes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-6 md:space-y-8">
          {upcoming.length > 0 ? (
            <Section title="Próximas">
              {upcoming.map((m) => (
                <MeetingCard key={m.id} meeting={m} />
              ))}
            </Section>
          ) : (
            <Card className="p-8 text-center">
              <CalendarDays className="mx-auto h-7 w-7 text-primary/60" />
              <p className="mt-3 hand-script text-2xl">Sin reuniones programadas</p>
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
        </TabsContent>

        <TabsContent value="mes">
          <MeetingsCalendar meetings={calendarMeetings} />
        </TabsContent>
      </Tabs>
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
      <Card className="p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground flex-wrap">
          {past ? <Badge variant="secondary">Pasada</Badge> : <Badge variant="success">Próxima</Badge>}
          <Badge variant={MEETING_TYPE_BADGE_VARIANT[meeting.type]}>
            {MEETING_TYPE_LABELS[meeting.type]}
          </Badge>
          <span className="tabular-nums">{formatDateTime(meeting.startsAt)}</span>
          <span>· {relativeTime(meeting.startsAt)}</span>
        </div>
        <h3 className="display mt-2.5 text-xl md:text-2xl leading-tight">{meeting.title}</h3>
        {meeting.book ? (
          <p className="mt-1 text-sm text-muted-foreground italic">
            sobre <em>{meeting.book.title}</em>
          </p>
        ) : null}
        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
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
