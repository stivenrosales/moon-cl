"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  addToShelfSchema,
  idSchema,
  moveShelfSchema,
  updateMyBookSchema,
} from "@/lib/validators";
import { requireUser } from "@/server/auth-helpers";
import { findOrCreateBook } from "@/server/services/books";
import { computeShelfTransition } from "@/server/services/shelf-transition";

/**
 * Agrega un libro a la estantería del usuario. Busca o crea el Book (mismo
 * helper que usan las sugerencias de ronda) y hace upsert del UserBook con
 * el status recibido, ajustando startedAt/finishedAt según la transición.
 */
export async function addBookToShelf(input: unknown) {
  const user = await requireUser();
  const data = addToShelfSchema.parse(input);

  const book = await findOrCreateBook(data);

  const existing = await db.userBook.findUnique({
    where: { userId_bookId: { userId: user.id, bookId: book.id } },
  });

  const transition = computeShelfTransition(
    {
      status: existing?.status ?? null,
      startedAt: existing?.startedAt ?? null,
      finishedAt: existing?.finishedAt ?? null,
    },
    data.status,
  );

  const userBook = await db.userBook.upsert({
    where: { userId_bookId: { userId: user.id, bookId: book.id } },
    create: {
      userId: user.id,
      bookId: book.id,
      status: transition.status,
      startedAt: transition.startedAt,
      finishedAt: transition.finishedAt,
    },
    update: {
      status: transition.status,
      startedAt: transition.startedAt,
      finishedAt: transition.finishedAt,
    },
  });

  revalidatePath("/mi-biblioteca");
  return userBook;
}

/**
 * Mueve un libro entre estanterías (READING / WANT_TO_READ / FINISHED),
 * ajustando startedAt/finishedAt vía computeShelfTransition.
 */
export async function moveShelf(input: unknown) {
  const user = await requireUser();
  const data = moveShelfSchema.parse(input);

  const existing = await db.userBook.findUnique({
    where: { userId_bookId: { userId: user.id, bookId: data.bookId } },
  });
  if (!existing) throw new Error("Ese libro no está en tu estantería");

  const transition = computeShelfTransition(
    { status: existing.status, startedAt: existing.startedAt, finishedAt: existing.finishedAt },
    data.status,
  );

  const updated = await db.userBook.update({
    where: { id: existing.id },
    data: {
      status: transition.status,
      startedAt: transition.startedAt,
      finishedAt: transition.finishedAt,
    },
  });

  revalidatePath("/mi-biblioteca");
  return updated;
}

/**
 * Actualiza la página/capítulo propios del usuario para un libro de su
 * estantería. No confundir con updateProgress (avance compartido del libro
 * en curso del club, en src/server/actions/progress.ts).
 */
export async function updateMyBook(input: unknown) {
  const user = await requireUser();
  const data = updateMyBookSchema.parse(input);

  const existing = await db.userBook.findUnique({
    where: { userId_bookId: { userId: user.id, bookId: data.bookId } },
  });
  if (!existing) throw new Error("Ese libro no está en tu estantería");

  const updated = await db.userBook.update({
    where: { id: existing.id },
    data: {
      currentPage: data.currentPage ?? existing.currentPage,
      currentChapter: data.currentChapter ?? existing.currentChapter,
    },
  });

  revalidatePath("/mi-biblioteca");
  return updated;
}

export async function removeFromShelf(bookId: string) {
  const user = await requireUser();
  const parsedBookId = idSchema.parse(bookId);

  const existing = await db.userBook.findUnique({
    where: { userId_bookId: { userId: user.id, bookId: parsedBookId } },
  });
  if (!existing) throw new Error("Ese libro no está en tu estantería");

  await db.userBook.delete({ where: { id: existing.id } });
  revalidatePath("/mi-biblioteca");
}
