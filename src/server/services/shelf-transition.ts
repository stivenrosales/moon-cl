import type { ShelfStatus } from "@prisma/client";

export interface ShelfState {
  status: ShelfStatus | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface ShelfTransitionResult {
  status: ShelfStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
}

/**
 * Calcula startedAt/finishedAt al mover un libro entre estanterías:
 * - Entrar a READING (desde otro estado) marca startedAt = ahora y limpia finishedAt.
 * - Entrar a FINISHED (desde otro estado) marca finishedAt = ahora; si nunca
 *   se marcó startedAt, también lo setea a ahora.
 * - Mover a WANT_TO_READ limpia ambas fechas (vuelve a la pila de pendientes).
 * - Repetir el mismo estado (no-op) conserva las fechas existentes tal cual.
 */
export function computeShelfTransition(
  current: ShelfState,
  nextStatus: ShelfStatus,
  now: Date = new Date(),
): ShelfTransitionResult {
  let { startedAt, finishedAt } = current;

  if (nextStatus === "READING" && current.status !== "READING") {
    startedAt = now;
    finishedAt = null;
  }

  if (nextStatus === "FINISHED" && current.status !== "FINISHED") {
    finishedAt = now;
    if (!startedAt) startedAt = now;
  }

  if (nextStatus === "WANT_TO_READ" && current.status !== "WANT_TO_READ") {
    startedAt = null;
    finishedAt = null;
  }

  return { status: nextStatus, startedAt, finishedAt };
}
