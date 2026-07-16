import { db } from "@/lib/db";
import { getCurrentClubBook } from "@/server/services/books";

// ─────────────────────────────────────────────────────────────────────────
// Feed de comunidad — agregación ON-READ (a esta escala no hay Redis).
//
// buildFeed() es una función pura sobre eventos ya cargados (testeable sin
// tocar la base de datos). loadFeed() hace las queries y le delega el
// armado del feed.
// ─────────────────────────────────────────────────────────────────────────

export type FeedEventType = "empezo" | "termino" | "califico" | "cito";

export interface FeedUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface FeedBook {
  id: string;
  title: string;
  coverUrl: string | null;
}

export interface FeedQuoteMeta {
  id: string;
  content: string;
  page: number | null;
  chapter: number | null;
  likeCount: number;
  likedByViewer: boolean;
}

export interface RawFeedEvent {
  type: FeedEventType;
  userId: string;
  user: FeedUser;
  bookId: string;
  book: FeedBook;
  occurredAt: Date;
  stars?: number;
  quote?: FeedQuoteMeta;
}

/** Razón de transparencia algorítmica: por qué aparece este ítem en el feed. */
export type FeedRazon = "sigues" | "club" | null;

export interface FeedEntry {
  key: string;
  user: FeedUser;
  book: FeedBook;
  /** Verbos coordinados en orden cronológico, sin repetir (ej: ["termino", "califico"]). */
  verbs: FeedEventType[];
  /** Momento más reciente entre los eventos agrupados (para ordenar y mostrar fecha relativa). */
  occurredAt: Date;
  stars: number | null;
  quotes: FeedQuoteMeta[];
  razon: FeedRazon;
}

export const VERB_LABELS: Record<FeedEventType, string> = {
  empezo: "empezó a leer",
  termino: "terminó",
  califico: "calificó",
  cito: "citó",
};

/** Une los verbos de una entrada en una frase coordinada: "terminó y calificó". */
export function joinVerbs(verbs: FeedEventType[]): string {
  const labels = verbs.map((v) => VERB_LABELS[v]);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Agrega eventos crudos ya cargados en entradas de feed: agrupa las
 * acciones del mismo usuario sobre el mismo libro ocurridas el mismo día
 * en una sola entrada con verbos coordinados ("terminó y calificó").
 * Eventos del mismo user+libro en días distintos quedan en entradas
 * separadas. Ordena descendente por la ocurrencia más reciente de cada
 * grupo.
 *
 * Función pura — no toca la base de datos. Ver loadFeed() para las queries.
 */
export function buildFeed(
  events: RawFeedEvent[],
  followingIds: Iterable<string>,
  clubBookId: string | null = null,
): FeedEntry[] {
  const following = new Set(followingIds);
  const groups = new Map<string, RawFeedEvent[]>();

  for (const event of events) {
    const key = `${event.userId}::${event.bookId}::${dayKey(event.occurredAt)}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(event);
    else groups.set(key, [event]);
  }

  const entries: FeedEntry[] = Array.from(groups.entries()).map(([key, group]) => {
    const sorted = [...group].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    const verbs: FeedEventType[] = [];
    for (const e of sorted) {
      if (!verbs.includes(e.type)) verbs.push(e.type);
    }

    const latest = sorted.reduce(
      (max, e) => (e.occurredAt.getTime() > max.getTime() ? e.occurredAt : max),
      sorted[0].occurredAt,
    );
    const stars = sorted.find((e) => e.stars != null)?.stars ?? null;
    const quotes = sorted
      .filter((e): e is RawFeedEvent & { quote: FeedQuoteMeta } => !!e.quote)
      .map((e) => e.quote);

    const first = sorted[0];
    const razon: FeedRazon =
      clubBookId && first.bookId === clubBookId
        ? "club"
        : following.has(first.userId)
          ? "sigues"
          : null;

    return {
      key,
      user: first.user,
      book: first.book,
      verbs,
      occurredAt: latest,
      stars,
      quotes,
      razon,
    };
  });

  entries.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  return entries;
}

const FEED_TAKE = 30;
const userSelect = { select: { id: true, name: true, email: true, image: true } } as const;
const bookSelect = { select: { id: true, title: true, coverUrl: true } } as const;

/**
 * Carga el feed de comunidad para viewerId: junta eventos recientes de
 * UserBook (empezó=startedAt, terminó=finishedAt), Rating (calificó) y
 * Quote (citó) de las personas que sigue + del libro actual del club, y
 * los agrega con buildFeed(). Consultas acotadas (take ~30 por fuente).
 */
export async function loadFeed(viewerId: string): Promise<FeedEntry[]> {
  const [followRows, clubBook] = await Promise.all([
    db.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } }),
    getCurrentClubBook(),
  ]);

  const followingIds = followRows.map((f) => f.followingId);
  const clubBookId = clubBook?.id ?? null;

  if (followingIds.length === 0 && !clubBookId) return [];

  const visibilityWhere =
    followingIds.length > 0 && clubBookId
      ? { OR: [{ userId: { in: followingIds } }, { bookId: clubBookId }] }
      : followingIds.length > 0
        ? { userId: { in: followingIds } }
        : { bookId: clubBookId as string };

  const [userBooks, ratings, quotes] = await Promise.all([
    db.userBook.findMany({
      where: {
        AND: [visibilityWhere, { OR: [{ startedAt: { not: null } }, { finishedAt: { not: null } }] }],
      },
      orderBy: { updatedAt: "desc" },
      take: FEED_TAKE,
      include: { user: userSelect, book: bookSelect },
    }),
    db.rating.findMany({
      where: visibilityWhere,
      orderBy: { createdAt: "desc" },
      take: FEED_TAKE,
      include: { user: userSelect, book: bookSelect },
    }),
    db.quote.findMany({
      where: visibilityWhere,
      orderBy: { createdAt: "desc" },
      take: FEED_TAKE,
      include: {
        user: userSelect,
        book: bookSelect,
        likes: { select: { userId: true } },
        _count: { select: { likes: true } },
      },
    }),
  ]);

  const events: RawFeedEvent[] = [];

  for (const ub of userBooks) {
    if (ub.startedAt) {
      events.push({
        type: "empezo",
        userId: ub.userId,
        user: ub.user,
        bookId: ub.bookId,
        book: ub.book,
        occurredAt: ub.startedAt,
      });
    }
    if (ub.finishedAt) {
      events.push({
        type: "termino",
        userId: ub.userId,
        user: ub.user,
        bookId: ub.bookId,
        book: ub.book,
        occurredAt: ub.finishedAt,
      });
    }
  }

  for (const r of ratings) {
    events.push({
      type: "califico",
      userId: r.userId,
      user: r.user,
      bookId: r.bookId,
      book: r.book,
      occurredAt: r.createdAt,
      stars: r.stars,
    });
  }

  for (const q of quotes) {
    events.push({
      type: "cito",
      userId: q.userId,
      user: q.user,
      bookId: q.bookId,
      book: q.book,
      occurredAt: q.createdAt,
      quote: {
        id: q.id,
        content: q.content,
        page: q.page,
        chapter: q.chapter,
        likeCount: q._count.likes,
        likedByViewer: q.likes.some((l) => l.userId === viewerId),
      },
    });
  }

  events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const bounded = events.slice(0, FEED_TAKE);

  return buildFeed(bounded, followingIds, clubBookId);
}
