"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { suggestBookSchema } from "@/lib/validators";
import { requireUser } from "@/server/auth-helpers";

export async function suggestBook(input: unknown) {
  const user = await requireUser();
  const data = suggestBookSchema.parse(input);

  const round = await db.round.findUnique({ where: { id: data.roundId } });
  if (!round) throw new Error("Ronda no encontrada");
  if (round.status !== "OPEN") throw new Error("La ronda no está abierta");

  // Busca o crea libro
  let book = data.googleBooksId
    ? await db.book.findUnique({ where: { googleBooksId: data.googleBooksId } })
    : null;

  if (!book) {
    book = await db.book.create({
      data: {
        title: data.title,
        authors: data.authors,
        coverUrl: data.coverUrl ?? null,
        description: data.description ?? null,
        pageCount: data.pageCount ?? null,
        publishedYear: data.publishedYear ?? null,
        googleBooksId: data.googleBooksId ?? null,
        isbn: data.isbn ?? null,
      },
    });
  }

  // Evita duplicados en la misma ronda
  const existing = await db.bookSuggestion.findUnique({
    where: { roundId_bookId: { roundId: data.roundId, bookId: book.id } },
  });
  if (existing) {
    throw new Error("Ese libro ya fue sugerido en esta ronda");
  }

  const suggestion = await db.bookSuggestion.create({
    data: {
      roundId: data.roundId,
      bookId: book.id,
      userId: user.id,
      pitch: data.pitch ?? null,
    },
  });

  revalidatePath(`/rondas/${data.roundId}`);
  revalidatePath("/dashboard");
  return suggestion;
}

export async function deleteSuggestion(id: string) {
  const user = await requireUser();
  const suggestion = await db.bookSuggestion.findUnique({
    where: { id },
    include: { round: true },
  });
  if (!suggestion) throw new Error("Sugerencia no encontrada");
  if (suggestion.userId !== user.id && user.role !== "ADMIN" && user.role !== "MODERATOR") {
    throw new Error("Solo puedes borrar tus sugerencias");
  }
  if (suggestion.round.status !== "OPEN" && user.role !== "ADMIN") {
    throw new Error("La ronda ya no está abierta");
  }
  await db.bookSuggestion.delete({ where: { id } });
  revalidatePath(`/rondas/${suggestion.roundId}`);
}
