"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { routes } from "@/lib/routes";
import {
  addToShelfSchema,
  idSchema,
  moveShelfSchema,
  updateMyBookSchema,
} from "@/lib/validators";
import { requireUser } from "@/server/auth-helpers";
import { findOrCreateBook } from "@/server/services/books";
import { computeShelfTransition } from "@/server/services/shelf-transition";
import { updateProgress } from "@/server/actions/progress";

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

  revalidatePath(routes.leer());
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

  revalidatePath(routes.leer());
  return updated;
}

/**
 * Empieza a leer un libro que YA existe en el catálogo, sin exigir que el
 * usuario tenga un UserBook previo (a diferencia de moveShelf) y sin crear
 * un Book nuevo por título (a diferencia de addBookToShelf). Es la puerta de
 * "Lo voy a leer" en el estado "sin-empezar" de la card héroe de /hoy: el
 * libro resuelto por loadToday ya tiene id, así que solo hace falta el
 * upsert del UserBook a READING.
 */
export async function startReading(bookId: string) {
  const user = await requireUser();
  const parsedBookId = idSchema.parse(bookId);

  const book = await db.book.findUnique({ where: { id: parsedBookId } });
  if (!book) throw new Error("Libro no encontrado");

  const existing = await db.userBook.findUnique({
    where: { userId_bookId: { userId: user.id, bookId: parsedBookId } },
  });

  const transition = computeShelfTransition(
    {
      status: existing?.status ?? null,
      startedAt: existing?.startedAt ?? null,
      finishedAt: existing?.finishedAt ?? null,
    },
    "READING",
  );

  const userBook = await db.userBook.upsert({
    where: { userId_bookId: { userId: user.id, bookId: parsedBookId } },
    create: {
      userId: user.id,
      bookId: parsedBookId,
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

  revalidatePath(routes.hoy());
  revalidatePath(routes.leer());
  revalidatePath(routes.libro(parsedBookId));
  return userBook;
}

/**
 * Actualiza la página/capítulo propios del usuario para un libro de su
 * estantería. Si se declara currentPage, delega en updateProgress: es la
 * única puerta de escritura del avance, la que también registra la bitácora
 * ReadingProgress (append-only) dentro de su transacción, evitando que esta
 * estantería y esa bitácora diverjan. Si solo se declara currentChapter (sin
 * página), ajusta el UserBook directamente porque la bitácora exige página.
 */
export async function updateMyBook(input: unknown) {
  const user = await requireUser();
  const data = updateMyBookSchema.parse(input);

  const existing = await db.userBook.findUnique({
    where: { userId_bookId: { userId: user.id, bookId: data.bookId } },
  });
  if (!existing) throw new Error("Ese libro no está en tu estantería");

  if (data.currentPage != null) {
    const { userBook } = await updateProgress({
      bookId: data.bookId,
      currentPage: data.currentPage,
      chapter: data.currentChapter ?? null,
    });
    return userBook;
  }

  const updated = await db.userBook.update({
    where: { id: existing.id },
    data: { currentChapter: data.currentChapter ?? existing.currentChapter },
  });

  revalidatePath(routes.leer());
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
  revalidatePath(routes.leer());
}
