/**
 * Backfill de UserNudge — marca como ya-descartadas las invitaciones de
 * cualquier usuario que YA cumple el disparador antes de que la fila
 * exista en la tabla.
 *
 * Por qué existe este script (y no una migración): el proyecto usa
 * `prisma db push`, no tiene historial de migraciones, y sincroniza contra
 * una base Neon que podría ser producción. Este script lo corre el usuario
 * a mano, cuando decida tocar su base:
 *
 *   npm run db:backfill-nudges
 *
 * Es idempotente: se apoya en @@unique([userId, key]) + skipDuplicates,
 * así que correrlo dos veces no duplica filas.
 *
 * Ejecutar con: tsx prisma/backfill-nudges.ts
 */
import { PrismaClient } from "@prisma/client";
import { computeNudgeBackfillRows, type NudgeKey } from "../src/server/services/nudge-backfill";

const db = new PrismaClient();

async function main() {
  const [userBooks, ratings, follows] = await Promise.all([
    db.userBook.findMany({ where: { status: "FINISHED" }, select: { userId: true, status: true } }),
    db.rating.findMany({ select: { userId: true } }),
    db.follow.findMany({ select: { followerId: true } }),
  ]);

  const rows = computeNudgeBackfillRows({ userBooks, ratings, follows });

  const now = new Date();
  const data = rows.map((row) => ({
    userId: row.userId,
    key: row.key,
    dismissedAt: now,
    reason: "pre-existing",
  }));

  const result = await db.userNudge.createMany({ data, skipDuplicates: true });

  const countByKey = rows.reduce<Record<NudgeKey, number>>(
    (acc, row) => {
      acc[row.key] = (acc[row.key] ?? 0) + 1;
      return acc;
    },
    {} as Record<NudgeKey, number>,
  );

  console.log(`✅ Backfill de nudges: ${result.count} filas insertadas (de ${rows.length} candidatas).`);
  for (const [key, count] of Object.entries(countByKey)) {
    console.log(`  · ${key}: ${count}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
