"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { routes } from "@/lib/routes";
import { progressSchema } from "@/lib/validators";
import { requireUser } from "@/server/auth-helpers";

/**
 * Única puerta de escritura del avance de lectura. En una sola transacción:
 * 1. inserta el ReadingProgress (bitácora append-only, nunca se pisa), y
 * 2. hace upsert del UserBook (estado de la estantería) para que
 *    currentPage/currentChapter/status queden coherentes con la bitácora.
 *
 * No degrada un UserBook FINISHED a READING, y solo setea startedAt la
 * primera vez (si ya existía, se conserva). Si esta actualización no declara
 * capítulo, conserva el último capítulo conocido en vez de pisarlo con null:
 * el foro por salas gatea por capítulo (comment-gating.ts) y perder ese dato
 * deja las salas ancladas en null para siempre.
 */
export async function updateProgress(input: unknown) {
  const user = await requireUser();
  const data = progressSchema.parse(input);

  const { progress, userBook } = await db.$transaction(async (tx) => {
    const progress = await tx.readingProgress.create({
      data: {
        bookId: data.bookId,
        userId: user.id,
        currentPage: data.currentPage,
        chapter: data.chapter ?? null,
        note: data.note ?? null,
      },
    });

    const existing = await tx.userBook.findUnique({
      where: { userId_bookId: { userId: user.id, bookId: data.bookId } },
    });

    const status = existing?.status === "FINISHED" ? "FINISHED" : "READING";
    const startedAt = existing?.startedAt ?? new Date();
    const currentChapter = data.chapter ?? existing?.currentChapter ?? null;

    const userBook = await tx.userBook.upsert({
      where: { userId_bookId: { userId: user.id, bookId: data.bookId } },
      create: {
        userId: user.id,
        bookId: data.bookId,
        status,
        currentPage: data.currentPage,
        currentChapter,
        startedAt,
      },
      update: {
        status,
        currentPage: data.currentPage,
        currentChapter,
        startedAt,
      },
    });

    return { progress, userBook };
  });

  revalidatePath(routes.libro(data.bookId));
  revalidatePath(routes.hoy());
  revalidatePath(routes.leer());
  return { progress, userBook };
}
