import type { ShelfStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentClubBook } from "@/server/services/books";
import { pageProgress } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────
// Card héroe de /hoy — resuelve QUÉ libro mostrar y en qué estado, para que
// actualizar el avance de lectura deje de costar tres navegaciones.
//
// buildToday() es una función pura sobre datos ya cargados (testeable sin
// tocar la base de datos). loadToday() hace las queries (condicionadas por
// el estado resuelto) y le delega el armado. Mismo patrón que feed.ts:
// buildFeed() puro + loadFeed() con queries.
//
// El input de capítulo NO es opcional en el resultado: miCapitulo viaja
// siempre (aunque sea null) porque el foro por salas gatea por capítulo
// (comment-gating.ts). Si esta función solo devolviera página, myChapter se
// quedaría en null para siempre y las salas se convertirían en candados.
// ─────────────────────────────────────────────────────────────────────────

const LIMA_TIMEZONE = "America/Lima";

export interface TodayBook {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  pageCount: number | null;
}

export type TodayKicker = "Libro del club" | "Tu lectura";

export interface AlguienAdelante {
  nombre: string;
  paginasDiferencia: number;
}

export interface TodayUserBookInfo {
  status: ShelfStatus;
  currentPage: number | null;
  currentChapter: number | null;
}

/** Progreso más reciente de OTRO miembro sobre el libro resuelto. */
export interface RawOtroLector {
  userId: string;
  nombre: string;
  currentPage: number;
}

/** Comentario crudo del foro, ya acotado al libro resuelto. */
export interface RawSalaComment {
  chapter: number | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface RawResolvedHero {
  book: TodayBook;
  /** true si `book` es el mismo que el Book con isCurrent: true del club. */
  isClubBook: boolean;
  /** null si el usuario NO tiene UserBook para este libro (estado B). */
  myUserBook: TodayUserBookInfo | null;
  /** Último ReadingProgress del usuario PARA ESTE libro (baseline de "nuevo"). */
  myLastProgressAt: Date | null;
  otrosLectores: RawOtroLector[];
  salaComments: RawSalaComment[];
}

export interface RawTodayInput {
  resolved: RawResolvedHero | null;
  /** createdAt de TODOS los ReadingProgress del usuario (cualquier libro), para la racha. */
  myProgressDates: Date[];
}

export type TodayHero =
  | { estado: "sin-libro" }
  | {
      estado: "sin-empezar";
      libro: TodayBook;
      kicker: TodayKicker;
      medianaClub: number | null;
      cuantosLeyendo: number;
      racha?: number;
    }
  | {
      estado: "leyendo";
      libro: TodayBook;
      kicker: TodayKicker;
      userBook: TodayUserBookInfo;
      /** null si el UserBook existe pero nadie marcó avance todavía (recién creado por startReading()). */
      miPagina: number | null;
      miCapitulo: number | null;
      /** null junto con miPagina null: nunca hubo avance, así que no hay porcentaje que mostrar (la barra no se pinta). */
      porcentaje: number | null;
      alguienAdelante?: AlguienAdelante;
      comentariosNuevos: number;
      racha?: number;
    };

/** Clave de día calendario en America/Lima (no UTC: evita romper la racha cerca de medianoche). */
function limaDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Días distintos consecutivos con ReadingProgress, contando hacia atrás desde
 * el más reciente. Una racha de 1 no es una racha: retorna undefined en ese
 * caso (y también con lista vacía).
 */
export function computeRacha(progressDates: Date[]): number | undefined {
  if (progressDates.length === 0) return undefined;

  const dayKeys = Array.from(new Set(progressDates.map(limaDayKey))).sort();

  let streak = 1;
  for (let i = dayKeys.length - 1; i > 0; i--) {
    const curr = new Date(`${dayKeys[i]}T00:00:00.000Z`);
    const prev = new Date(`${dayKeys[i - 1]}T00:00:00.000Z`);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
    if (diffDays === 1) streak++;
    else break;
  }

  return streak >= 2 ? streak : undefined;
}

/** Mediana de una lista de números. null si la lista está vacía. */
function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** El miembro más avanzado entre quienes van MÁS lejos que yo, o undefined si nadie. */
function pickAlguienAdelante(miPagina: number, otros: RawOtroLector[]): AlguienAdelante | undefined {
  const adelante = otros.filter((o) => o.currentPage > miPagina);
  if (adelante.length === 0) return undefined;

  const masAdelante = adelante.reduce((best, o) => (o.currentPage > best.currentPage ? o : best));
  return { nombre: masAdelante.nombre, paginasDiferencia: masAdelante.currentPage - miPagina };
}

/**
 * Comentarios en salas que el usuario YA tiene abiertas (chapter <= miCapitulo,
 * o sin capítulo) creados después de su último progreso en el libro. Sin
 * baseline (nunca registró progreso) no hay forma de saber qué es "nuevo": 0.
 */
function countComentariosNuevos(
  comments: RawSalaComment[],
  miCapitulo: number | null,
  desde: Date | null,
): number {
  if (!desde) return 0;
  const capituloEfectivo = miCapitulo ?? 0;

  return comments.filter(
    (c) =>
      !c.deletedAt &&
      (c.chapter == null || c.chapter <= capituloEfectivo) &&
      c.createdAt.getTime() > desde.getTime(),
  ).length;
}

/**
 * Arma el estado de la card héroe a partir de datos ya resueltos. Función
 * pura — no toca la base de datos. Ver loadToday() para las queries.
 */
export function buildToday(input: RawTodayInput): TodayHero {
  const { resolved, myProgressDates } = input;

  if (!resolved) return { estado: "sin-libro" };

  const kicker: TodayKicker = resolved.isClubBook ? "Libro del club" : "Tu lectura";
  const racha = computeRacha(myProgressDates);

  // Estado B ("sin-empezar") = el libro NO está en tu estantería, punto.
  // No condicionar por currentPage: un UserBook recién creado por
  // startReading() trae currentPage null a propósito (nadie marcó avance
  // todavía) y AUN ASÍ es estado "leyendo" — ensanchar esta condición con
  // "|| currentPage == null" fue el bug: creaba un deadlock donde "Lo voy
  // a leer" nunca hacía desaparecer su propio botón, porque el UserBook que
  // creaba seguía cayendo aquí. La ausencia de barra en 0% es un detalle de
  // RENDERIZADO del estado C (ver más abajo y hero-card.tsx), no un estado
  // distinto.
  if (!resolved.myUserBook) {
    const pages = resolved.otrosLectores.map((o) => o.currentPage);
    return {
      estado: "sin-empezar",
      libro: resolved.book,
      kicker,
      medianaClub: median(pages),
      cuantosLeyendo: resolved.otrosLectores.length,
      ...(racha !== undefined ? { racha } : {}),
    };
  }

  // Estado C ("leyendo"): el UserBook existe, aunque currentPage sea null.
  // Preservamos la distinción null (nunca marcó avance) vs 0 (marcó avance
  // real en la página 0) en vez de colapsarla con `?? 0` — así la card
  // puede omitir la barra Progress solo cuando corresponde, sin tener que
  // fingir que el usuario nunca empezó a leer el libro.
  const miPagina = resolved.myUserBook.currentPage;
  const miCapitulo = resolved.myUserBook.currentChapter ?? null;
  const porcentaje = miPagina != null ? pageProgress(miPagina, resolved.book.pageCount) : null;
  const alguienAdelante = pickAlguienAdelante(miPagina ?? 0, resolved.otrosLectores);
  const comentariosNuevos = countComentariosNuevos(
    resolved.salaComments,
    miCapitulo,
    resolved.myLastProgressAt,
  );

  return {
    estado: "leyendo",
    libro: resolved.book,
    kicker,
    userBook: resolved.myUserBook,
    miPagina,
    miCapitulo,
    porcentaje,
    ...(alguienAdelante ? { alguienAdelante } : {}),
    comentariosNuevos,
    ...(racha !== undefined ? { racha } : {}),
  };
}

const bookSelect = {
  id: true,
  title: true,
  authors: true,
  coverUrl: true,
  pageCount: true,
} as const;

/**
 * Resuelve el héroe de /hoy, en orden: (1) el ReadingProgress más reciente
 * del usuario (cualquier libro — si está leyendo otra cosa, ESA es su
 * lectura, no basta con mirar isCurrent), (2) el Book con isCurrent, (3) el
 * UserBook READING más reciente, (4) estado "sin-libro".
 */
export async function loadToday(userId: string): Promise<TodayHero> {
  const [myLatestProgress, clubBook, myLatestReadingUserBook, myProgressRows] = await Promise.all([
    db.readingProgress.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { book: { select: bookSelect } },
    }),
    getCurrentClubBook(),
    db.userBook.findFirst({
      where: { userId, status: "READING" },
      orderBy: { updatedAt: "desc" },
      select: { book: { select: bookSelect } },
    }),
    db.readingProgress.findMany({ where: { userId }, select: { createdAt: true } }),
  ]);

  const resolvedBook: TodayBook | null =
    myLatestProgress?.book ?? clubBook ?? myLatestReadingUserBook?.book ?? null;

  const myProgressDates = myProgressRows.map((r) => r.createdAt);

  if (!resolvedBook) {
    return buildToday({ resolved: null, myProgressDates });
  }

  const isClubBook = clubBook?.id === resolvedBook.id;

  const myUserBookRow = await db.userBook.findUnique({
    where: { userId_bookId: { userId, bookId: resolvedBook.id } },
    select: { status: true, currentPage: true, currentChapter: true },
  });

  const myUserBook: TodayUserBookInfo | null = myUserBookRow ?? null;

  const otrosLectores: RawOtroLector[] = [];
  let salaComments: RawSalaComment[] = [];
  let myLastProgressAt: Date | null = null;

  if (!myUserBook) {
    // Estado B: nadie más que "otros" tiene progreso (por invariante de
    // updateProgress, si el usuario tuviera ReadingProgress también tendría
    // UserBook — igual filtramos userId por si esa invariante se rompe).
    const allProgress = await db.readingProgress.findMany({
      where: { bookId: resolvedBook.id, userId: { not: userId } },
      orderBy: { createdAt: "desc" },
      select: { userId: true, currentPage: true },
    });

    const seen = new Set<string>();
    for (const p of allProgress) {
      if (seen.has(p.userId)) continue;
      seen.add(p.userId);
      otrosLectores.push({ userId: p.userId, nombre: "", currentPage: p.currentPage });
    }
  } else {
    const [myProgressForBook, othersProgress, comments] = await Promise.all([
      db.readingProgress.findFirst({
        where: { userId, bookId: resolvedBook.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      db.readingProgress.findMany({
        where: { bookId: resolvedBook.id, userId: { not: userId } },
        orderBy: { createdAt: "desc" },
        select: {
          userId: true,
          currentPage: true,
          user: { select: { name: true, email: true } },
        },
      }),
      db.comment.findMany({
        where: { bookId: resolvedBook.id },
        select: { chapter: true, createdAt: true, deletedAt: true },
      }),
    ]);

    myLastProgressAt = myProgressForBook?.createdAt ?? null;

    const seenUsers = new Set<string>();
    for (const p of othersProgress) {
      if (seenUsers.has(p.userId)) continue;
      seenUsers.add(p.userId);
      otrosLectores.push({
        userId: p.userId,
        nombre: p.user.name ?? p.user.email?.split("@")[0] ?? "Alguien",
        currentPage: p.currentPage,
      });
    }
    salaComments = comments;
  }

  return buildToday({
    resolved: {
      book: resolvedBook,
      isClubBook,
      myUserBook,
      myLastProgressAt,
      otrosLectores,
      salaComments,
    },
    myProgressDates,
  });
}
