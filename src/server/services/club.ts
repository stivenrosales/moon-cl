import type { Prisma } from "@prisma/client";
import { pickWinner, type WinnerCandidate } from "@/server/services/round-winner";

export type Tx = Prisma.TransactionClient;

/**
 * Marca el libro actual del club (isCurrent) como bookId, dentro de una
 * transacción: el libro previamente en curso pasa a FINISHED y el nuevo
 * queda como CURRENT/isCurrent con startedAt = ahora.
 */
export async function setCurrentBookTx(tx: Tx, bookId: string) {
  const now = new Date();

  await tx.book.updateMany({
    where: { isCurrent: true, NOT: { id: bookId } },
    data: { isCurrent: false, status: "FINISHED", finishedAt: now },
  });

  await tx.book.update({
    where: { id: bookId },
    data: {
      isCurrent: true,
      status: "CURRENT",
      startedAt: now,
      finishedAt: null,
    },
  });
}

/**
 * Cierre completo y atómico de una ronda:
 * - Elige al ganador (por votos, o el forzado por el admin si se indica).
 * - Pone al libro ganador como lectura en curso del club.
 * - Archiva los libros perdedores de la ronda (solo si seguían en estado
 *   SUGGESTED, para no pisar libros ya FINISHED/CURRENT por otra vía).
 * - Cierra la ronda con su winnerBookId.
 *
 * Debe invocarse siempre dentro de db.$transaction para evitar condiciones
 * de carrera con votos/sugerencias tardías.
 */
export async function closeRoundTx(
  tx: Tx,
  roundId: string,
  forcedBookId?: string,
): Promise<WinnerCandidate | null> {
  const round = await tx.round.findUnique({ where: { id: roundId } });
  if (!round) throw new Error("Ronda no encontrada");

  const suggestions = await tx.bookSuggestion.findMany({
    where: { roundId },
    include: { _count: { select: { votes: true } } },
  });

  const candidates: WinnerCandidate[] = suggestions.map((s) => ({
    id: s.id,
    bookId: s.bookId,
    voteCount: s._count.votes,
    createdAt: s.createdAt,
  }));

  const winner = forcedBookId
    ? candidates.find((c) => c.bookId === forcedBookId) ?? null
    : pickWinner(candidates);

  if (winner) {
    await setCurrentBookTx(tx, winner.bookId);
  }

  const loserBookIds = suggestions
    .map((s) => s.bookId)
    .filter((bookId) => bookId !== winner?.bookId);

  if (loserBookIds.length > 0) {
    await tx.book.updateMany({
      where: { id: { in: loserBookIds }, status: "SUGGESTED" },
      data: { status: "ARCHIVED" },
    });
  }

  await tx.round.update({
    where: { id: roundId },
    data: { status: "CLOSED", winnerBookId: winner?.bookId ?? null },
  });

  return winner;
}
