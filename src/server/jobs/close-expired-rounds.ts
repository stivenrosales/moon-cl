import { db } from "@/lib/db";
import { closeRoundTx } from "@/server/services/club";

/**
 * Cierra automáticamente toda ronda OPEN cuya fecha de fin (endsAt) ya pasó.
 * Reusa el mismo cierre atómico que usa el admin (closeRoundTx dentro de
 * db.$transaction) para elegir ganador por votos, poner el libro como
 * lectura en curso y archivar a los perdedores. Si una ronda no tiene
 * sugerencias, closeRoundTx la cierra igual, sin ganador (winnerBookId null).
 *
 * Pensado para ser invocado desde el cron dispatcher diario
 * (src/app/api/cron/daily/route.ts).
 */
export async function closeExpiredRounds(now: Date = new Date()) {
  const expiredRounds = await db.round.findMany({
    where: { status: "OPEN", endsAt: { lte: now } },
    select: { id: true },
  });

  let closed = 0;
  for (const round of expiredRounds) {
    await db.$transaction((tx) => closeRoundTx(tx, round.id));
    closed++;
  }

  return { closed };
}
