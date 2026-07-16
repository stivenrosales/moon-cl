import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────
// Fila de urgencia de /hoy — qué necesita atención YA.
//
// buildUrgency() es puro sobre candidatos ya cargados (testeable sin tocar
// la base de datos). loadUrgency() hace las queries y le delega el armado.
// Mismo patrón buildFeed/loadFeed de services/feed.ts.
// ─────────────────────────────────────────────────────────────────────────

export type UrgencyClient =
  | Pick<Prisma.TransactionClient, "round" | "meeting" | "kahootScore" | "userBook">
  | typeof db;

// 48h: la ventana de expiración del resultado de trivia, no una fecha límite.
// Una ronda que cierra en 3 días tolera esperar; un resultado que se evapora
// en 48h no — por eso preempta una franja propia y no compite por slot.
const FRANJA_WINDOW_MS = 48 * 60 * 60 * 1000;
const MAX_SLOTS = 2;

export interface UrgencyRoundCandidate {
  id: string;
  endsAt: Date;
}

export interface UrgencyMeetingCandidate {
  id: string;
  startsAt: Date;
}

export interface UrgencyTriviaCandidate {
  activityId: string;
  playedAt: Date;
}

export interface UrgencyRecommendedBook {
  id: string;
  title: string;
}

export interface BuildUrgencyInput {
  /** Momento de referencia, inyectado para que los tests no dependan del reloj real. */
  now: Date;
  /** Ronda con status OPEN más próxima a cerrar (endsAt más cercano). */
  openRound?: UrgencyRoundCandidate | null;
  /** Próxima reunión agendada (startsAt más cercano, ya filtrada a futuro). */
  nextMeeting?: UrgencyMeetingCandidate | null;
  /** Resultado de trivia más reciente del usuario. */
  triviaResult?: UrgencyTriviaCandidate | null;
  /** Libro más reciente de la estantería "Quiero leer", para la recomendación de reposo. */
  wantToReadBook?: UrgencyRecommendedBook | null;
}

export type UrgencySlot =
  | { tipo: "ronda"; id: string; deadline: Date }
  | { tipo: "reunion"; id: string; deadline: Date }
  | { tipo: "reposo"; libro: UrgencyRecommendedBook | null };

export interface UrgencyFranja {
  tipo: "trivia";
  activityId: string;
  playedAt: Date;
  expiresAt: Date;
}

export interface UrgencyResult {
  /** Excepción que NO compite por slot: presente solo si hay trivia dentro de las últimas 48h. */
  franja?: UrgencyFranja;
  /** Máximo 2, ordenados por fecha límite más cercana. Nunca vacío (ver slot "reposo"). */
  slots: UrgencySlot[];
}

/**
 * Arma la fila de urgencia de /hoy a partir de candidatos ya cargados:
 * - ronda OPEN y próxima reunión compiten por hasta 2 slots, ordenados por
 *   fecha límite más cercana (endsAt / startsAt).
 * - un resultado de trivia jugado en las últimas 48h NO compite por slot:
 *   se devuelve aparte en `franja`, porque su criterio real es la ventana
 *   de expiración (48h), no una fecha límite comparable con las otras dos.
 * - si no queda ningún slot con fecha, se rellena con un slot de reposo
 *   (nunca vacío) que trae una recomendación de la estantería "Quiero leer".
 *
 * Función pura — no toca la base de datos. Ver loadUrgency() más abajo
 * para las queries.
 */
export function buildUrgency(input: BuildUrgencyInput): UrgencyResult {
  const franja = buildFranja(input.triviaResult, input.now);

  const deadlineSlots: Array<Extract<UrgencySlot, { deadline: Date }>> = [];
  if (input.openRound) {
    deadlineSlots.push({ tipo: "ronda", id: input.openRound.id, deadline: input.openRound.endsAt });
  }
  if (input.nextMeeting) {
    deadlineSlots.push({ tipo: "reunion", id: input.nextMeeting.id, deadline: input.nextMeeting.startsAt });
  }

  deadlineSlots.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const slots: UrgencySlot[] = deadlineSlots.slice(0, MAX_SLOTS);

  if (slots.length === 0) {
    slots.push({ tipo: "reposo", libro: input.wantToReadBook ?? null });
  }

  return franja ? { franja, slots } : { slots };
}

function buildFranja(
  trivia: UrgencyTriviaCandidate | null | undefined,
  now: Date,
): UrgencyFranja | undefined {
  if (!trivia) return undefined;

  const elapsed = now.getTime() - trivia.playedAt.getTime();
  // Ventana [playedAt, playedAt + 48h): en el borde exacto ya expiró.
  if (elapsed < 0 || elapsed >= FRANJA_WINDOW_MS) return undefined;

  return {
    tipo: "trivia",
    activityId: trivia.activityId,
    playedAt: trivia.playedAt,
    expiresAt: new Date(trivia.playedAt.getTime() + FRANJA_WINDOW_MS),
  };
}

/**
 * Carga los candidatos reales de la DB y delega el armado a buildUrgency():
 * ronda OPEN con endsAt más cercano, próxima reunión futura, último
 * resultado de trivia del usuario (por playedAt de su KahootActivity) y el
 * libro más reciente de su estantería "Quiero leer" (WANT_TO_READ) como
 * recomendación de reposo. 4 queries en paralelo, sin N+1.
 */
export async function loadUrgency(
  userId: string,
  client: UrgencyClient = db,
  now: Date = new Date(),
): Promise<UrgencyResult> {
  const [openRound, nextMeeting, lastScore, wantToReadRow] = await Promise.all([
    client.round.findFirst({
      where: { status: "OPEN" },
      orderBy: { endsAt: "asc" },
      select: { id: true, endsAt: true },
    }),
    client.meeting.findFirst({
      where: { startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true },
    }),
    client.kahootScore.findFirst({
      where: { userId },
      orderBy: { activity: { playedAt: "desc" } },
      select: { activityId: true, activity: { select: { playedAt: true } } },
    }),
    client.userBook.findFirst({
      where: { userId, status: "WANT_TO_READ" },
      orderBy: { createdAt: "desc" },
      select: { book: { select: { id: true, title: true } } },
    }),
  ]);

  return buildUrgency({
    now,
    openRound: openRound ? { id: openRound.id, endsAt: openRound.endsAt } : null,
    nextMeeting: nextMeeting ? { id: nextMeeting.id, startsAt: nextMeeting.startsAt } : null,
    triviaResult: lastScore ? { activityId: lastScore.activityId, playedAt: lastScore.activity.playedAt } : null,
    wantToReadBook: wantToReadRow?.book ?? null,
  });
}
