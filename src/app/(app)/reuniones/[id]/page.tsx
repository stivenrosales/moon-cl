import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CalendarPlus, Globe, MapPin } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RsvpButtons } from "@/components/rsvp-buttons";
import { MeetingEditDialog } from "@/components/admin/meeting-edit-dialog";
import { MEETING_TYPE_BADGE_VARIANT, MEETING_TYPE_LABELS } from "@/lib/meeting-types";
import { formatDate, formatDateTime, getInitials, relativeTime } from "@/lib/utils";

const labels = { YES: "Voy", MAYBE: "Quizás", NO: "No puedo" } as const;
const variants = {
  YES: "success",
  MAYBE: "default",
  NO: "secondary",
} as const;

function toGoogleDateUTC(d: Date) {
  return `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function buildGoogleCalendarUrl(meeting: {
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  isVirtual: boolean;
  meetingUrl: string | null;
}) {
  const start = meeting.startsAt;
  const end = meeting.endsAt ?? new Date(start.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: meeting.title,
    dates: `${toGoogleDateUTC(start)}/${toGoogleDateUTC(end)}`,
    details: meeting.description ?? "",
    location: meeting.isVirtual ? meeting.meetingUrl ?? "" : meeting.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user?.id) return null;
  const isAdmin = session.user.role === "ADMIN";

  const [meeting, bookOptions] = await Promise.all([
    db.meeting.findUnique({
      where: { id },
      include: {
        book: true,
        rsvps: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        },
      },
    }),
    isAdmin
      ? db.book.findMany({ select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 100 })
      : Promise.resolve([]),
  ]);

  if (!meeting) notFound();

  const myRsvp = meeting.rsvps.find((r) => r.userId === session.user!.id);
  const googleCalendarUrl = buildGoogleCalendarUrl(meeting);
  const grouped = {
    YES: meeting.rsvps.filter((r) => r.status === "YES"),
    MAYBE: meeting.rsvps.filter((r) => r.status === "MAYBE"),
    NO: meeting.rsvps.filter((r) => r.status === "NO"),
  };

  return (
    <div className="space-y-7">
      <Link
        href="/reuniones"
        className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.24em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Reuniones
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">
          <Badge variant={MEETING_TYPE_BADGE_VARIANT[meeting.type]}>
            {MEETING_TYPE_LABELS[meeting.type]}
          </Badge>
          <CalendarDays className="h-4 w-4 text-primary" />
          <span>{formatDateTime(meeting.startsAt)}</span>
          <span>·</span>
          <span>{relativeTime(meeting.startsAt)}</span>
          {isAdmin ? (
            <div className="ml-auto normal-case tracking-normal">
              <MeetingEditDialog meeting={meeting} books={bookOptions} redirectOnDeleteTo="/reuniones" />
            </div>
          ) : null}
        </div>
        <h1 className="h1-display display">{meeting.title}</h1>
        {meeting.book ? (
          <p className="text-muted-foreground italic">
            sobre <em>{meeting.book.title}</em>
          </p>
        ) : null}
        {meeting.description ? (
          <p className="max-w-2xl text-muted-foreground leading-relaxed whitespace-pre-line">
            {meeting.description}
          </p>
        ) : null}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        <Card className="p-6 space-y-5">
          <h2 className="display text-2xl">Detalles</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Detail label="Inicio" value={formatDateTime(meeting.startsAt)} />
            {meeting.endsAt ? <Detail label="Fin" value={formatDateTime(meeting.endsAt)} /> : null}
            {meeting.location ? (
              <Detail
                label="Lugar"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {meeting.location}
                  </span>
                }
              />
            ) : null}
            {meeting.meetingUrl ? (
              <Detail
                label="Enlace"
                value={
                  <a
                    href={meeting.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary hover:underline truncate max-w-[260px]"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Abrir reunión
                  </a>
                }
              />
            ) : null}
          </dl>

          <div className="pt-2">
            <p className="mb-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
              ¿Asistirás?
            </p>
            <RsvpButtons meetingId={meeting.id} initial={myRsvp?.status ?? null} />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/reuniones/${meeting.id}/ics`} download>
                <CalendarPlus className="h-3.5 w-3.5" />
                Agregar a mi calendario
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer">
                Google Calendar
              </a>
            </Button>
            {meeting.book ? (
              <Button asChild variant="outline" size="sm" className="ml-auto">
                <Link href={`/libros/${meeting.book.id}`}>Ver libro</Link>
              </Button>
            ) : null}
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <h2 className="display text-2xl">Confirmaciones</h2>
          {meeting.rsvps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún nadie ha confirmado.</p>
          ) : (
            (["YES", "MAYBE", "NO"] as const).map((s) =>
              grouped[s].length === 0 ? null : (
                <div key={s} className="space-y-2">
                  <Badge variant={variants[s]}>
                    {labels[s]} · {grouped[s].length}
                  </Badge>
                  <ul className="space-y-2">
                    {grouped[s].map((r) => (
                      <li key={r.id} className="flex items-center gap-3 text-sm">
                        <Avatar className="h-7 w-7">
                          {r.user.image ? <AvatarImage src={r.user.image} alt="" /> : null}
                          <AvatarFallback className="text-[10px]">
                            {getInitials(r.user.name, r.user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">
                          {r.user.name ?? r.user.email?.split("@")[0]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )
          )}
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
