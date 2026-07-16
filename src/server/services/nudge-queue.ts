import { db } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────
// Cola de nudges — UN solo servicio server-side. La cola NO se reparte por
// página: nextNudge() devuelve como máximo una invitación para toda la app,
// y cada pantalla renderiza la que le corresponde según `screen`.
//
// buildNudgeQueue() es puro sobre datos ya cargados (testeable sin tocar la
// base de datos). nextNudge() hace las queries y le delega la selección.
// Mismo patrón buildFeed/loadFeed de services/feed.ts.
//
// El peligro que define esta fase: los disparadores son ESTADOS ACUMULADOS
// ("3 calificaciones", "2 seguidos", "primer libro terminado"), no eventos.
// Un usuario veterano puede cumplirlos todos desde hace meses. Por eso cada
// disparador se ancla a la fecha real en que se volvió cierto (finishedAt,
// createdAt del rating/follow que completó el umbral, onboardedAt) y se
// exige que esa fecha sea POSTERIOR a NUDGE_EPOCH — la fecha del deploy de
// esta fase. Antes de esa fecha, el estado no cuenta: ninguna invitación se
// muestra por algo alcanzado antes de que la invitación existiera.
// ─────────────────────────────────────────────────────────────────────────

/** Fecha del deploy de la fase de nudges. Ver prisma/backfill-nudges.ts. */
export const NUDGE_EPOCH = new Date("2026-07-16T00:00:00.000Z");

export const NUDGE_KEYS = [
  "bienvenida",
  "primer-progreso",
  "primer-rating",
  "book-match",
  "primer-mensaje",
  "sugerir",
] as const;

export type NudgeKey = (typeof NUDGE_KEYS)[number];

/** Dónde debe pintarse la invitación. No es una URL: la página resuelve el
 * href real vía src/lib/routes.ts. */
export type NudgeScreen = "hoy" | "leer-mios" | "club-actividad" | "club-personas";

export const NUDGE_SCREENS: Record<NudgeKey, NudgeScreen> = {
  bienvenida: "hoy",
  "primer-progreso": "leer-mios",
  "primer-rating": "leer-mios",
  "book-match": "club-actividad",
  "primer-mensaje": "club-personas",
  sugerir: "hoy",
};

export interface Nudge {
  key: NudgeKey;
  screen: NudgeScreen;
  /** true solo para "sugerir": no gasta slot propio, va dentro de la card de votación. */
  inline: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WELCOME_WINDOW_MS = 7 * DAY_MS;
const MIN_ACCOUNT_AGE_MS = 7 * DAY_MS;
const SUGGEST_ROUND_OPEN_MS = 48 * 60 * 60 * 1000;

export interface OpenRoundCandidate {
  /** Se usa como ancla tanto para "lleva >48h abierta" como para el epoch. */
  startsAt: Date;
}

/** Insumo puro de buildNudgeQueue(): todo ya resuelto por el caller, sin tocar la DB. */
export interface NudgeQueueInput {
  now: Date;
  /** Keys con UserNudge.dismissedAt o .actedAt no nulo para este usuario. */
  dismissedKeys: ReadonlySet<NudgeKey>;

  onboardedAt: Date | null;
  accountCreatedAt: Date;

  userBookCount: number;
  readingProgressCount: number;

  /** Al menos un UserBook del usuario pasó a FINISHED alguna vez. */
  hasFinishedFirstBook: boolean;
  /** finishedAt del primer UserBook que llegó a FINISHED (ancla de epoch). */
  firstFinishedAt: Date | null;

  ratingCount: number;
  /** createdAt del rating más reciente (ancla de epoch cuando ratingCount === 3). */
  latestRatingAt: Date | null;
  isMatchOptIn: boolean;

  followCount: number;
  /** createdAt del follow más reciente como seguidor (ancla de epoch cuando followCount === 2). */
  latestFollowAt: Date | null;

  openRound: OpenRoundCandidate | null;
  hasSuggestionInOpenRound: boolean;
}

function afterEpoch(date: Date | null): boolean {
  return date != null && date.getTime() > NUDGE_EPOCH.getTime();
}

/**
 * bienvenida y primer-progreso no tienen una "fila" propia que dispare el
 * trigger (son ausencias: cero libros, cero progreso), así que se anclan a
 * onboardedAt del usuario, tal como pide el contrato: eso ya los protege de
 * cuentas viejas porque un veterano onboardeó mucho antes del epoch.
 */
function checkBienvenida(input: NudgeQueueInput): boolean {
  if (!afterEpoch(input.onboardedAt)) return false;
  const elapsed = input.now.getTime() - input.onboardedAt!.getTime();
  return elapsed >= 0 && elapsed < WELCOME_WINDOW_MS && input.userBookCount === 0;
}

function checkPrimerProgreso(input: NudgeQueueInput): boolean {
  if (!afterEpoch(input.onboardedAt)) return false;
  return input.userBookCount >= 1 && input.readingProgressCount === 0;
}

function checkPrimerRating(input: NudgeQueueInput): boolean {
  return input.hasFinishedFirstBook && afterEpoch(input.firstFinishedAt);
}

function checkBookMatch(input: NudgeQueueInput): boolean {
  return input.ratingCount === 3 && !input.isMatchOptIn && afterEpoch(input.latestRatingAt);
}

function checkPrimerMensaje(input: NudgeQueueInput): boolean {
  return input.followCount === 2 && afterEpoch(input.latestFollowAt);
}

function checkSugerir(input: NudgeQueueInput): boolean {
  const round = input.openRound;
  if (!round) return false;
  if (input.hasSuggestionInOpenRound) return false;
  if (!afterEpoch(round.startsAt)) return false;

  const accountAge = input.now.getTime() - input.accountCreatedAt.getTime();
  if (accountAge < MIN_ACCOUNT_AGE_MS) return false;

  const openElapsed = input.now.getTime() - round.startsAt.getTime();
  return openElapsed > SUGGEST_ROUND_OPEN_MS;
}

// Orden = prioridad fija = escalera de antigüedad de cuenta que describe el
// contrato: el usuario recién llegado ve primero el nudge de arranque, y
// solo cuando ya no aplica se evalúa el siguiente peldaño.
const NUDGE_CHECKS: ReadonlyArray<readonly [NudgeKey, (input: NudgeQueueInput) => boolean]> = [
  ["bienvenida", checkBienvenida],
  ["primer-progreso", checkPrimerProgreso],
  ["primer-rating", checkPrimerRating],
  ["book-match", checkBookMatch],
  ["primer-mensaje", checkPrimerMensaje],
  ["sugerir", checkSugerir],
];

/**
 * Selecciona la única invitación elegible (o ninguna) a partir de datos ya
 * cargados. Recorre la escalera de prioridad en orden y devuelve la primera
 * key que (a) no esté en dismissedKeys y (b) cumpla su disparador con la
 * fecha ancla posterior a NUDGE_EPOCH. Nunca devuelve más de una.
 *
 * Función pura — no toca la base de datos. Ver nextNudge() para las queries.
 */
export function buildNudgeQueue(input: NudgeQueueInput): Nudge | null {
  for (const [key, check] of NUDGE_CHECKS) {
    if (input.dismissedKeys.has(key)) continue;
    if (check(input)) {
      return { key, screen: NUDGE_SCREENS[key], inline: key === "sugerir" };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// nextNudge() — loader
// ─────────────────────────────────────────────────────────────────────────

type ModelClient<T> = { [K in keyof T]: T[K] };

export type NudgeClient = ModelClient<{
  user: Pick<typeof db.user, "findUnique">;
  userBook: Pick<typeof db.userBook, "count" | "findFirst">;
  readingProgress: Pick<typeof db.readingProgress, "count">;
  rating: Pick<typeof db.rating, "count" | "findFirst">;
  follow: Pick<typeof db.follow, "count" | "findFirst">;
  round: Pick<typeof db.round, "findFirst">;
  bookSuggestion: Pick<typeof db.bookSuggestion, "findFirst">;
  userNudge: Pick<typeof db.userNudge, "findMany">;
}>;

/**
 * Carga el estado real del usuario (cuenta, estanterías, ratings, follows,
 * ronda abierta y descartes previos) y delega en buildNudgeQueue() para
 * elegir cuál mostrar. Devuelve UNA invitación o ninguna — jamás dos.
 */
export async function nextNudge(
  userId: string,
  client: NudgeClient = db,
  now: Date = new Date(),
): Promise<Nudge | null> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { onboardedAt: true, createdAt: true, isMatchOptIn: true },
  });
  if (!user) return null;

  const [
    userBookCount,
    readingProgressCount,
    firstFinished,
    ratingCount,
    latestRating,
    followCount,
    latestFollow,
    openRound,
    dismissedRows,
  ] = await Promise.all([
    client.userBook.count({ where: { userId } }),
    client.readingProgress.count({ where: { userId } }),
    client.userBook.findFirst({
      where: { userId, status: "FINISHED" },
      orderBy: { finishedAt: "asc" },
      select: { finishedAt: true },
    }),
    client.rating.count({ where: { userId } }),
    client.rating.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    client.follow.count({ where: { followerId: userId } }),
    client.follow.findFirst({
      where: { followerId: userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    client.round.findFirst({
      where: { status: "OPEN" },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true },
    }),
    client.userNudge.findMany({
      where: {
        userId,
        OR: [{ dismissedAt: { not: null } }, { actedAt: { not: null } }],
      },
      select: { key: true },
    }),
  ]);

  let hasSuggestionInOpenRound = false;
  if (openRound) {
    const suggestion = await client.bookSuggestion.findFirst({
      where: { roundId: openRound.id, userId },
      select: { id: true },
    });
    hasSuggestionInOpenRound = !!suggestion;
  }

  const dismissedKeys = new Set<NudgeKey>(
    dismissedRows
      .map((row) => row.key)
      .filter((key): key is NudgeKey => (NUDGE_KEYS as readonly string[]).includes(key)),
  );

  return buildNudgeQueue({
    now,
    dismissedKeys,
    onboardedAt: user.onboardedAt,
    accountCreatedAt: user.createdAt,
    userBookCount,
    readingProgressCount,
    hasFinishedFirstBook: !!firstFinished?.finishedAt,
    firstFinishedAt: firstFinished?.finishedAt ?? null,
    ratingCount,
    latestRatingAt: latestRating?.createdAt ?? null,
    isMatchOptIn: user.isMatchOptIn,
    followCount,
    latestFollowAt: latestFollow?.createdAt ?? null,
    openRound: openRound ? { startsAt: openRound.startsAt } : null,
    hasSuggestionInOpenRound,
  });
}
