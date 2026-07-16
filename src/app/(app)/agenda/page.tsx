import Link from "next/link";
import { CalendarDays, CalendarRange, Globe, List as ListIcon, MapPin, Vote } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MeetingsCalendar, type CalendarMeeting } from "@/components/meetings-calendar";
import { RoundStatusBadge } from "@/components/round-status-badge";
import { MEETING_TYPE_BADGE_VARIANT, MEETING_TYPE_LABELS } from "@/lib/meeting-types";
import { formatDate, formatDateTime, relativeTime } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { rankByPoints } from "@/server/services/kahoot-ranking";
import { SegmentedControl } from "@/components/segmented-control";
import { KahootLeaderboard, type LeaderboardEntry, type ActivityLeaderboard } from "./kahoot-leaderboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Agenda" };

const SEGMENTOS = [
  { valor: "reuniones", label: "Reuniones" },
  { valor: "votaciones", label: "Votaciones" },
  { valor: "trivia", label: "Trivia" },
] as const;

function memberName(user: { name: string | null; email: string | null } | null) {
  return user?.name ?? user?.email?.split("@")[0] ?? "Miembro";
}

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const { vista: vistaRaw } = await searchParams;
  const vista = vistaRaw === "votaciones" || vistaRaw === "trivia" ? vistaRaw : "reuniones";

  return (
    <div className="space-y-6 md:space-y-8">
      <header>
        <span className="text-xs uppercase tracking-[0.32em] text-accent-text">
          {vista === "votaciones" ? "El club elige" : vista === "trivia" ? "Trivias del club" : "El club se reúne"}
        </span>
        <h1 className="display text-3xl md:text-4xl leading-[1.05] tracking-tight mt-1.5">
          {vista === "votaciones" ? (
            <>
              Rondas de <span className="hand-script italic text-primary">votación</span>
            </>
          ) : vista === "trivia" ? (
            <>
              <span className="hand-script italic text-primary">Puntajes</span> de Kahoot
            </>
          ) : (
            <>
              Reuniones <span className="hand-script italic text-primary">del club</span>
            </>
          )}
        </h1>
      </header>

      <SegmentedControl segmentos={SEGMENTOS} activo={vista} />

      {vista === "votaciones" ? (
        <VotacionesView />
      ) : vista === "trivia" ? (
        <TriviaView />
      ) : (
        <ReunionesView />
      )}
    </div>
  );
}

async function ReunionesView() {
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
      {isAdmin ? (
        <div className="flex justify-end">
          <Link
            href={routes.admin("reuniones")}
            className="text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Gestionar →
          </Link>
        </div>
      ) : null}

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
    <Link href={routes.reunion(meeting.id)} className="block focus-ring rounded-2xl">
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

async function VotacionesView() {
  const session = await getSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const rounds = await db.round.findMany({
    orderBy: [{ status: "asc" }, { startsAt: "desc" }],
    include: {
      _count: { select: { suggestions: true } },
      winner: true,
    },
  });

  const open = rounds.filter((r) => r.status === "OPEN");
  const upcoming = rounds.filter((r) => r.status === "SCHEDULED");
  const closed = rounds.filter((r) => r.status === "CLOSED");

  return (
    <div className="space-y-6 md:space-y-8">
      {isAdmin ? (
        <div className="flex justify-end">
          <Link
            href={routes.admin("rondas")}
            className="text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Gestionar →
          </Link>
        </div>
      ) : null}

      {open.length > 0 ? (
        <RoundSection title="Activa ahora">
          {open.map((r) => (
            <RoundCard key={r.id} round={r} />
          ))}
        </RoundSection>
      ) : (
        <Card className="p-8 text-center">
          <Vote className="mx-auto h-7 w-7 text-primary/60" />
          <p className="mt-3 hand-script text-2xl text-foreground">No hay ronda activa</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando un admin abra una ronda, aparecerá aquí.
          </p>
        </Card>
      )}

      {upcoming.length > 0 ? (
        <RoundSection title="Próximas">
          {upcoming.map((r) => (
            <RoundCard key={r.id} round={r} />
          ))}
        </RoundSection>
      ) : null}

      {closed.length > 0 ? (
        <RoundSection title="Anteriores">
          {closed.map((r) => (
            <RoundCard key={r.id} round={r} />
          ))}
        </RoundSection>
      ) : null}
    </div>
  );
}

function RoundSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">{children}</div>
    </section>
  );
}

type R = Awaited<ReturnType<typeof db.round.findMany>> extends (infer U)[] ? U : never;

function RoundCard({
  round,
}: {
  round: R & { _count: { suggestions: number }; winner?: { title: string } | null };
}) {
  return (
    <Link href={routes.ronda(round.id)} className="block focus-ring rounded-2xl">
      <Card className="p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3">
          <RoundStatusBadge status={round.status} />
          <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {formatDate(round.startsAt)} → {formatDate(round.endsAt)}
          </span>
        </div>
        <h3 className="display mt-2.5 text-xl md:text-2xl leading-tight">{round.title}</h3>
        {round.description ? (
          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{round.description}</p>
        ) : null}
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {round._count.suggestions} sugerencia{round._count.suggestions === 1 ? "" : "s"}
          </span>
          {round.winner ? (
            <span className="text-accent-text">
              ✦ {round.winner.title}
            </span>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}

async function TriviaView() {
  const [totals, activities] = await Promise.all([
    // Acumulado del club: total de puntos y cantidad de trivias jugadas por
    // persona, agregado en la base con groupBy (no en memoria).
    db.kahootScore.groupBy({
      by: ["userId"],
      _sum: { points: true },
      _count: true,
    }),
    db.kahootActivity.findMany({
      orderBy: { playedAt: "desc" },
      include: {
        scores: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
      },
    }),
  ]);

  const userIds = totals.map((t) => t.userId);
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, image: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const accumulatedRanked = rankByPoints(
    totals
      .map((t) => ({ ...t, user: userMap.get(t.userId) ?? null }))
      .filter((t) => t.user !== null),
    (t) => t._sum.points ?? 0,
  );

  const accumulated: LeaderboardEntry[] = accumulatedRanked.map((t) => {
    const played = t._count;
    return {
      rank: t.rank,
      userId: t.userId,
      name: memberName(t.user),
      image: t.user?.image ?? null,
      points: t._sum.points ?? 0,
      caption: `${played} ${pluralize(played, "kahoot jugado", "kahoots jugados")}`,
    };
  });

  const activityLeaderboards: ActivityLeaderboard[] = activities.map((a) => {
    const ranked = rankByPoints(a.scores, (s) => s.points);
    const entries: LeaderboardEntry[] = ranked.map((s) => ({
      rank: s.rank,
      userId: s.userId,
      name: memberName(s.user),
      image: s.user?.image ?? null,
      points: s.points,
      caption:
        s.correctAnswers != null
          ? `${s.correctAnswers} ${pluralize(s.correctAnswers, "respuesta correcta", "respuestas correctas")}`
          : "",
    }));
    return {
      id: a.id,
      title: a.title,
      playedAt: a.playedAt,
      entries,
    };
  });

  const lastActivity = activities[0] ?? null;

  return (
    <div className="space-y-4">
      <p className="max-w-xl text-sm text-muted-foreground">
        Quién ha jugado, cuánto ha sumado y qué se jugó en cada trivia. Nada de ligas ni descensos, solo el gusto de competir juntos.
      </p>

      {activities.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="hand-script text-2xl">Aún no hay trivias jugadas</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Cuando el club juegue su primer Kahoot, los puntajes aparecerán acá.
          </p>
        </Card>
      ) : (
        <KahootLeaderboard
          accumulated={accumulated}
          activities={activityLeaderboards}
          lastActivity={lastActivity ? { title: lastActivity.title, playedAt: lastActivity.playedAt } : null}
        />
      )}
    </div>
  );
}
