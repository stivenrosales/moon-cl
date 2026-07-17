import Link from "next/link";
import type { RsvpStatus } from "@prisma/client";
import { ArrowRight, CalendarDays, MessageSquare, Sparkles, Vote } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HeroCard } from "@/components/hero-card";
import { RsvpButtons } from "@/components/rsvp-buttons";
import { QuoteCard } from "@/components/quote-card";
import { NudgeCard } from "@/components/nudge-card";
import { ActivityFeed } from "@/app/(app)/club/activity-feed";
import { formatDateTime, relativeTime } from "@/lib/utils";
import { isModeratorOrAbove } from "@/lib/permissions";
import { routes } from "@/lib/routes";
import { shouldSuppressHeroNudge } from "@/lib/hero-nudge";
import { loadToday } from "@/server/services/today";
import { loadUrgency, type UrgencySlot } from "@/server/services/urgency-queue";
import { loadFeed } from "@/server/services/feed";
import { nextNudge, type Nudge } from "@/server/services/nudge-queue";

export const dynamic = "force-dynamic";

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
const FEED_PREVIEW = 3;

/** "Jueves 16 de julio · 21:04", en minúscula-a-mayúscula manual porque
 * Intl.DateTimeFormat siempre devuelve el día de la semana en minúscula. */
function fechaDiscreta(date: Date): string {
  const weekday = new Intl.DateTimeFormat("es-PE", { weekday: "long" }).format(date);
  const dayMonth = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long" }).format(date);
  const time = new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${dayMonth} · ${time}`;
}

export default async function HoyPage() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const isModerator = isModeratorOrAbove(session.user.role);
  const now = new Date();

  const sevenDaysAgo = new Date(now.getTime() - SEMANA_MS);

  // weeklyQuotesRaw/upcomingMeetings/activeRounds no dependen de nada del
  // resto de la página: antes esperaban a que loadToday/loadUrgency/etc.
  // terminaran para recién dispararse en un segundo Promise.all — un
  // round-trip evitable. Ahora corren en el mismo batch inicial.
  const [hero, urgency, feedEntries, nudge, weeklyQuotesRaw, upcomingMeetings, activeRounds] =
    await Promise.all([
      loadToday(userId),
      loadUrgency(userId, db, now),
      loadFeed(userId),
      nextNudge(userId, db, now),
      db.quote.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          book: { select: { id: true, title: true, coverUrl: true } },
          likes: { select: { userId: true } },
          _count: { select: { likes: true } },
        },
      }),
      db.meeting.findMany({
        where: { startsAt: { gte: now } },
        orderBy: { startsAt: "asc" },
        take: 5,
        select: { id: true, title: true, startsAt: true },
      }),
      db.round.findMany({
        where: { status: { in: ["OPEN", "SCHEDULED"] } },
        orderBy: { startsAt: "asc" },
        take: 5,
        select: { id: true, title: true, startsAt: true, endsAt: true, status: true },
      }),
    ]);

  // "bienvenida" pinta como card propia bajo la héroe; "sugerir" es inline
  // (inline: true) y se pasa a la card de votación de abajo — no gasta slot.
  //
  // Cuando hero.estado === "sin-empezar", HeroCard YA pinta su propio botón
  // "Lo voy a leer" para el mismo libro (ver hero-card.tsx, SinEmpezar) —
  // exactamente la misma acción que el nudge "bienvenida". Sin suprimirlo
  // acá, las dos cards salían apiladas ofreciendo lo mismo dos veces. Ver
  // shouldSuppressHeroNudge en @/lib/hero-nudge.ts.
  const heroNudge =
    nudge &&
    nudge.screen === "hoy" &&
    !nudge.inline &&
    !shouldSuppressHeroNudge({ heroEstado: hero.estado, nudgeKey: nudge.key })
      ? nudge
      : null;
  const inlineSugerirNudge = nudge && nudge.screen === "hoy" && nudge.inline ? nudge : null;
  const libroActual = hero.estado !== "sin-libro" ? hero.libro : null;

  // Los slots de la fila de urgencia solo traen id + deadline (buildUrgency
  // es puro): acá se resuelve el título/estado real para pintarlos. Estas sí
  // dependen de urgency (batch anterior), por eso quedan en un segundo batch.
  const roundIds = urgency.slots.flatMap((s) => (s.tipo === "ronda" ? [s.id] : []));
  const meetingIds = urgency.slots.flatMap((s) => (s.tipo === "reunion" ? [s.id] : []));

  const [rounds, meetings] = await Promise.all([
    roundIds.length
      ? db.round.findMany({ where: { id: { in: roundIds } }, select: { id: true, title: true } })
      : Promise.resolve([]),
    meetingIds.length
      ? db.meeting.findMany({
          where: { id: { in: meetingIds } },
          select: {
            id: true,
            title: true,
            rsvps: { where: { userId }, select: { status: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const roundMap = new Map(rounds.map((r) => [r.id, r]));
  const meetingMap = new Map(meetings.map((m) => [m.id, m]));

  const weeklyQuote =
    [...weeklyQuotesRaw].sort((a, b) => b._count.likes - a._count.likes)[0] ?? null;

  interface TimelineItem {
    key: string;
    date: Date;
    label: string;
    caption: string;
    href: string;
  }

  const timelineItems: TimelineItem[] = [
    ...upcomingMeetings.map((m) => ({
      key: `reunion-${m.id}`,
      date: m.startsAt,
      label: m.title,
      caption: `Reunión · ${formatDateTime(m.startsAt)}`,
      href: routes.reunion(m.id),
    })),
    ...activeRounds.map((r) => ({
      key: `ronda-${r.id}`,
      date: r.status === "OPEN" ? r.endsAt : r.startsAt,
      label: r.title,
      caption: r.status === "OPEN" ? `Ronda · cierra ${relativeTime(r.endsAt)}` : `Ronda · ${formatDateTime(r.startsAt)}`,
      href: routes.ronda(r.id),
    })),
  ]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 2);

  return (
    <div className="space-y-5 md:space-y-7">
      <p className="text-sm text-muted-foreground">{fechaDiscreta(now)}</p>

      <HeroCard hero={hero} />

      {heroNudge ? (
        <NudgeCard
          nudge={heroNudge}
          context={{ libro: libroActual?.title, libroId: libroActual?.id }}
        />
      ) : null}

      {urgency.franja ? (
        <Link href={routes.agenda({ vista: "trivia" })} className="block focus-ring rounded-2xl">
          <Card className="flex h-[72px] items-center justify-between gap-3 px-5">
            <span className="inline-flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-accent-text" />
              Jugaste trivia {relativeTime(urgency.franja.playedAt)}
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Ver resultados →
            </span>
          </Card>
        </Link>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {urgency.slots.map((slot) => (
          <UrgencySlotCard
            key={slotKey(slot)}
            slot={slot}
            roundTitle={slot.tipo === "ronda" ? roundMap.get(slot.id)?.title : undefined}
            meetingTitle={slot.tipo === "reunion" ? meetingMap.get(slot.id)?.title : undefined}
            myRsvp={slot.tipo === "reunion" ? meetingMap.get(slot.id)?.rsvps[0]?.status ?? null : null}
            inlineNudge={slot.tipo === "ronda" ? inlineSugerirNudge : null}
          />
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Mientras no estabas
          </h2>
          <Link
            href={routes.club()}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todo en el Club <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <ActivityFeed entries={feedEntries.slice(0, FEED_PREVIEW)} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Frase de la semana
          </h2>
          <Link
            href={routes.club({ vista: "frases" })}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Más frases <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {weeklyQuote ? (
          <QuoteCard
            quote={{
              id: weeklyQuote.id,
              content: weeklyQuote.content,
              page: weeklyQuote.page,
              chapter: weeklyQuote.chapter,
              createdAt: weeklyQuote.createdAt,
              likeCount: weeklyQuote._count.likes,
              likedByViewer: weeklyQuote.likes.some((l) => l.userId === userId),
              book: weeklyQuote.book,
              user: weeklyQuote.user,
            }}
            currentUserId={userId}
            isModerator={isModerator}
          />
        ) : (
          <Card className="p-5 text-center">
            <p className="text-sm text-muted-foreground">
              Nadie ha citado nada esta semana. Sé la primera ✦
            </p>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Lo que viene
          </h2>
          <Link
            href={routes.agenda()}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Abrir agenda <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {timelineItems.length === 0 ? (
          <Card className="p-5 text-center">
            <p className="text-sm text-muted-foreground">Nada agendado todavía.</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {timelineItems.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className="block focus-ring rounded-2xl">
                  <Card className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.caption}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function slotKey(slot: UrgencySlot): string {
  if (slot.tipo === "reposo") return "reposo";
  return `${slot.tipo}-${slot.id}`;
}

function UrgencySlotCard({
  slot,
  roundTitle,
  meetingTitle,
  myRsvp,
  inlineNudge,
}: {
  slot: UrgencySlot;
  roundTitle?: string;
  meetingTitle?: string;
  myRsvp: RsvpStatus | null;
  /** Nudge "sugerir" (inline: true) — no gasta slot propio, se pinta dentro
   * de esta misma card cuando el slot es una ronda abierta. */
  inlineNudge?: Nudge | null;
}) {
  if (slot.tipo === "ronda") {
    return (
      <Card className="space-y-2.5 p-5">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
          <Vote className="h-4 w-4" /> Ronda de votación
        </span>
        <p className="text-sm tabular-nums text-accent-text">cierra {relativeTime(slot.deadline)}</p>
        <h3 className="display text-xl leading-tight">{roundTitle ?? "Ronda"}</h3>
        <div className="flex gap-2 pt-1">
          <Button asChild size="sm">
            <Link href={routes.ronda(slot.id)}>Votar</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={routes.ronda(slot.id)}>Sugerir</Link>
          </Button>
        </div>
        {inlineNudge ? (
          <div className="mt-1 border-t border-border/50 pt-3">
            <NudgeCard nudge={inlineNudge} context={{ roundId: slot.id }} />
          </div>
        ) : null}
      </Card>
    );
  }

  if (slot.tipo === "reunion") {
    return (
      <Card className="space-y-2.5 p-5">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
          <CalendarDays className="h-4 w-4" /> Próxima reunión
        </span>
        <p className="text-sm tabular-nums text-muted-foreground">
          {formatDateTime(slot.deadline)} · {relativeTime(slot.deadline)}
        </p>
        <h3 className="display text-xl leading-tight">{meetingTitle ?? "Reunión"}</h3>
        <RsvpButtons meetingId={slot.id} initial={myRsvp} />
      </Card>
    );
  }

  return (
    <Card className="space-y-2 p-5">
      <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
        Sin pendientes urgentes
      </span>
      {slot.libro ? (
        <>
          <p className="text-sm text-muted-foreground">¿Un respiro? Podrías empezar con:</p>
          <Link
            href={routes.libro(slot.libro.id)}
            className="display italic text-lg hover:text-primary transition-colors inline-flex items-center gap-1.5"
          >
            <MessageSquare className="h-4 w-4" /> {slot.libro.title} →
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Todo tranquilo por ahora. Buen momento para leer sin culpa ✦
        </p>
      )}
    </Card>
  );
}
