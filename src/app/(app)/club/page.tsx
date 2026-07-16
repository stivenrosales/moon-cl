import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { isModeratorOrAbove } from "@/lib/permissions";
import { loadFeed } from "@/server/services/feed";
import { computeAffinity, labelForScore, loadAffinityData } from "@/server/services/affinity";
import { currentMatchWeekOf } from "@/server/jobs/book-match";
import { MatchCard, type MatchCardMatch } from "@/components/match-card";
import { MemberList, type MemberRow } from "@/components/member-list";
import { SegmentedControl } from "@/components/segmented-control";
import { NudgeCard } from "@/components/nudge-card";
import { nextNudge } from "@/server/services/nudge-queue";
import { ActivityFeed } from "./activity-feed";
import { QuotesPanel } from "./quotes-panel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Club" };

const SEGMENTOS = [
  { valor: "actividad", label: "Actividad" },
  { valor: "personas", label: "Personas" },
  { valor: "frases", label: "Frases" },
] as const;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function ClubPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const { vista: vistaRaw } = await searchParams;
  const vista = vistaRaw === "personas" || vistaRaw === "frases" ? vistaRaw : "actividad";

  return (
    <div className="space-y-6 md:space-y-8">
      <SegmentedControl segmentos={SEGMENTOS} activo={vista} />

      {vista === "personas" ? (
        <PersonasView />
      ) : vista === "frases" ? (
        <FrasesView />
      ) : (
        <ActividadView />
      )}
    </div>
  );
}

async function ActividadView() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const [feed, viewerMatchSettings, weeklyMatch, nudge] = await Promise.all([
    loadFeed(userId),
    db.user.findUnique({ where: { id: userId }, select: { isMatchOptIn: true } }),
    db.match.findFirst({
      where: { weekOf: currentMatchWeekOf(new Date()), OR: [{ userAId: userId }, { userBId: userId }] },
    }),
    nextNudge(userId),
  ]);

  const clubActividadNudge = nudge && nudge.screen === "club-actividad" ? nudge : null;

  // Afinidad recalculada al vuelo (nunca se cachea el detalle): el score
  // guardado en Match es fijo desde el emparejamiento, pero la evidencia
  // (libros/géneros en común) se recompone en base a los datos actuales —
  // si evapora del todo, la card cae al estado "sin match" en vez de
  // mostrar un porcentaje sin nada real detrás (contrato: la afinidad
  // jamás se muestra con datos vacíos).
  let weeklyMatchCard: MatchCardMatch | null = null;
  if (weeklyMatch) {
    const otherId = weeklyMatch.userAId === userId ? weeklyMatch.userBId : weeklyMatch.userAId;
    const [otherUser, affinityData] = await Promise.all([
      db.user.findUnique({
        where: { id: otherId },
        select: { id: true, name: true, email: true, image: true },
      }),
      loadAffinityData([userId, otherId]),
    ]);
    const viewerData = affinityData.get(userId);
    const otherData = affinityData.get(otherId);
    const affinity = viewerData && otherData ? computeAffinity(viewerData, otherData) : null;

    if (otherUser && affinity) {
      weeklyMatchCard = {
        otherUserId: otherUser.id,
        otherUserName: otherUser.name,
        otherUserEmail: otherUser.email,
        otherUserImage: otherUser.image,
        score: weeklyMatch.score,
        label: labelForScore(weeklyMatch.score),
        evidence: affinity.evidence,
      };
    }
  }

  return (
    <div className="space-y-4">
      {clubActividadNudge ? <NudgeCard nudge={clubActividadNudge} /> : null}
      <MatchCard isOptedIn={viewerMatchSettings?.isMatchOptIn ?? false} match={weeklyMatchCard} />
      <ActivityFeed entries={feed} />
    </div>
  );
}

async function FrasesView() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const isModerator = isModeratorOrAbove(session.user.role);

  const [quotes, shelfBooks, clubBook] = await Promise.all([
    db.quote.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        book: { select: { id: true, title: true, coverUrl: true } },
        likes: { select: { userId: true } },
        _count: { select: { likes: true } },
      },
    }),
    db.userBook.findMany({
      where: { userId },
      select: { book: { select: { id: true, title: true, coverUrl: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.book.findFirst({
      where: { isCurrent: true },
      select: { id: true, title: true, coverUrl: true },
    }),
  ]);

  const quoteCards = quotes.map((q) => ({
    id: q.id,
    content: q.content,
    page: q.page,
    chapter: q.chapter,
    createdAt: q.createdAt,
    likeCount: q._count.likes,
    likedByViewer: q.likes.some((l) => l.userId === userId),
    book: q.book,
    user: q.user,
  }));

  const shareableBooks = dedupeById([
    ...(clubBook ? [clubBook] : []),
    ...shelfBooks.map((ub) => ub.book),
  ]);

  return (
    <QuotesPanel
      quotes={quoteCards}
      books={shareableBooks}
      currentUserId={userId}
      isModerator={isModerator}
    />
  );
}

/**
 * Contexto de "primer-mensaje": la persona a la que escribirle es la más
 * reciente que el usuario sigue (mismo latestFollow que usa el trigger en
 * nudge-queue.ts), y el libro en común se resuelve cruzando estantería +
 * valoraciones de ambos — mismo cruce que booksInCommon() en services/social.ts,
 * pero acá necesitamos el título, no solo el conteo.
 */
async function resolvePrimerMensajeContext(userId: string) {
  const latestFollow = await db.follow.findFirst({
    where: { followerId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      followingId: true,
      following: { select: { name: true, email: true } },
    },
  });
  if (!latestFollow) return null;

  const otherId = latestFollow.followingId;
  const [myBooks, myRatings, theirBooks, theirRatings] = await Promise.all([
    db.userBook.findMany({ where: { userId }, select: { bookId: true, book: { select: { title: true } } } }),
    db.rating.findMany({ where: { userId }, select: { bookId: true, book: { select: { title: true } } } }),
    db.userBook.findMany({ where: { userId: otherId }, select: { bookId: true } }),
    db.rating.findMany({ where: { userId: otherId }, select: { bookId: true } }),
  ]);

  const theirIds = new Set([...theirBooks.map((b) => b.bookId), ...theirRatings.map((r) => r.bookId)]);
  const commonMine = [...myBooks, ...myRatings].find((b) => theirIds.has(b.bookId));

  return {
    personaId: otherId,
    persona: latestFollow.following.name ?? latestFollow.following.email?.split("@")[0],
    libroEnComun: commonMine?.book.title,
  };
}

async function PersonasView() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  // nextNudge y el directorio de usuarios no dependen entre sí: se disparan
  // juntos en vez de esperar uno detrás del otro. Solo primerMensajeContext
  // depende del resultado del nudge, así que ese sí queda secuencial.
  const [nudge, users] = await Promise.all([
    nextNudge(userId),
    db.user.findMany({
      where: { id: { not: userId } },
      orderBy: { name: "asc" },
    }),
  ]);
  const clubPersonasNudge = nudge && nudge.screen === "club-personas" ? nudge : null;
  const primerMensajeContext = clubPersonasNudge ? await resolvePrimerMensajeContext(userId) : null;

  const [myFollowing, readingRows, affinityData] = await Promise.all([
    db.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
    db.userBook.findMany({
      where: { status: "READING" },
      orderBy: { updatedAt: "desc" },
      include: { book: { select: { title: true } } },
    }),
    // Bulk: una sola pasada de afinidad para todo el directorio, en vez de
    // N cálculos por fila — solo alimenta la insignia "Muy afín" de abajo.
    loadAffinityData([userId, ...users.map((u) => u.id)]),
  ]);

  const viewerAffinityData = affinityData.get(userId);
  const followingSet = new Set(myFollowing.map((f) => f.followingId));

  const readingByUser = new Map<string, string>();
  for (const ub of readingRows) {
    if (!readingByUser.has(ub.userId)) readingByUser.set(ub.userId, ub.book.title);
  }

  const weekAgo = new Date(Date.now() - WEEK_MS);

  // affinityData ya trae bookIds (estantería + valoraciones fusionadas, el
  // mismo criterio que booksInCommon en services/social.ts) para TODO el
  // directorio en 3 queries totales. Antes esta fila llamaba a
  // booksInCommon(userId, u.id) dentro del map: eso disparaba 4 queries por
  // miembro (y siempre volvía a pedir la estantería del propio viewer, que
  // no cambia entre iteraciones) — un N+1 real. El cruce ahora es en
  // memoria contra el Set ya cargado, cero queries adicionales.
  const rows: MemberRow[] = users.map((u) => {
    const memberAffinityData = affinityData.get(u.id);
    const affinity =
      viewerAffinityData && memberAffinityData ? computeAffinity(viewerAffinityData, memberAffinityData) : null;
    // Contrato visual: la insignia "Muy afín" solo aparece con score alto
    // Y evidencia real detrás — nunca con datos vacíos.
    const veryAffine =
      !!affinity &&
      affinity.score >= 70 &&
      (affinity.evidence.librosEnComun > 0 || affinity.evidence.generosEnComun.length > 0);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      isFollowing: followingSet.has(u.id),
      booksInCommon:
        viewerAffinityData && memberAffinityData
          ? countIntersection(viewerAffinityData.bookIds, memberAffinityData.bookIds)
          : 0,
      readingTitle: readingByUser.get(u.id) ?? null,
      isNew: u.createdAt >= weekAgo,
      veryAffine,
    };
  });

  return (
    <div className="space-y-4">
      {clubPersonasNudge ? (
        <NudgeCard nudge={clubPersonasNudge} context={primerMensajeContext ?? undefined} />
      ) : null}
      <MemberList rows={rows} />
    </div>
  );
}

/** Cantidad de elementos que dos Sets comparten — cruce en memoria, sin queries. */
function countIntersection(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let count = 0;
  for (const id of a) {
    if (b.has(id)) count++;
  }
  return count;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}
