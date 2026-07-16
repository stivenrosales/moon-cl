/**
 * Lógica pura de "¿qué usuarios cumplen cada disparador de nudge?".
 *
 * Se extrae de prisma/backfill-nudges.ts para poder testearla sin tocar la DB.
 * Los disparadores son estados acumulados (no eventos), así que esta función
 * solo decide QUIÉN ya cumple cada uno hoy — el script que la invoca es quien
 * decide qué hacer con eso (marcar la invitación como ya-descartada).
 *
 * Las keys DEBEN coincidir exactamente con las de nudge-queue.ts: nextNudge()
 * arma dismissedKeys filtrando UserNudge.key contra ese mismo catálogo, así
 * que una key distinta aquí insertaría filas invisibles para la cola — el
 * backfill "correría" sin bloquear nada. Se importan en vez de redeclararse
 * para que un typo o un rename en nudge-queue.ts rompa la compilación acá.
 */
import type { NudgeKey as QueueNudgeKey } from "@/server/services/nudge-queue";

export const NUDGE_KEYS = {
  PRIMER_RATING: "primer-rating",
  BOOK_MATCH: "book-match",
  PRIMER_MENSAJE: "primer-mensaje",
} as const satisfies Record<string, QueueNudgeKey>;

export type NudgeKey = (typeof NUDGE_KEYS)[keyof typeof NUDGE_KEYS];

export interface NudgeBackfillRow {
  userId: string;
  key: NudgeKey;
}

/** userId con al menos un UserBook en status FINISHED. */
export function usersWithAtLeastOneFinishedBook(
  userBooks: { userId: string; status: string }[],
): string[] {
  const ids = new Set<string>();
  for (const ub of userBooks) {
    if (ub.status === "FINISHED") ids.add(ub.userId);
  }
  return [...ids];
}

/** userId con >= min filas en Rating (default 3). */
export function usersWithMinRatings(ratings: { userId: string }[], min = 3): string[] {
  const counts = new Map<string, number>();
  for (const r of ratings) counts.set(r.userId, (counts.get(r.userId) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count >= min).map(([userId]) => userId);
}

/** followerId con >= min filas en Follow como seguidor (default 2). */
export function usersWithMinFollows(follows: { followerId: string }[], min = 2): string[] {
  const counts = new Map<string, number>();
  for (const f of follows) counts.set(f.followerId, (counts.get(f.followerId) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count >= min).map(([userId]) => userId);
}

export interface NudgeBackfillData {
  userBooks: { userId: string; status: string }[];
  ratings: { userId: string }[];
  follows: { followerId: string }[];
}

/**
 * Une los tres disparadores en las filas que el backfill debe insertar
 * (userId + key), ya "ya-descartadas" desde el punto de vista del caller.
 */
export function computeNudgeBackfillRows(data: NudgeBackfillData): NudgeBackfillRow[] {
  const rows: NudgeBackfillRow[] = [];

  for (const userId of usersWithAtLeastOneFinishedBook(data.userBooks)) {
    rows.push({ userId, key: NUDGE_KEYS.PRIMER_RATING });
  }
  for (const userId of usersWithMinRatings(data.ratings)) {
    rows.push({ userId, key: NUDGE_KEYS.BOOK_MATCH });
  }
  for (const userId of usersWithMinFollows(data.follows)) {
    rows.push({ userId, key: NUDGE_KEYS.PRIMER_MENSAJE });
  }

  return rows;
}
