"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { searchBooks, type BookCandidate } from "@/lib/google-books";
import { bookInputSchema, bookUpdateSchema } from "@/lib/validators";
import { requireUser, requireModerator } from "@/server/auth-helpers";

export async function searchBooksAction(query: string): Promise<BookCandidate[]> {
  await requireUser();
  return searchBooks(query, 8);
}

export async function updateBookAction(input: unknown) {
  await requireModerator();
  const data = bookUpdateSchema.parse(input);

  const updated = await db.book.update({
    where: { id: data.id },
    data: {
      title: data.title,
      authors: data.authors,
      coverUrl: data.coverUrl ? data.coverUrl : null,
      description: data.description ?? null,
      pageCount: data.pageCount ?? null,
      publishedYear: data.publishedYear ?? null,
      isbn: data.isbn ? data.isbn : null,
    },
  });

  revalidatePath(`/libros/${updated.id}`);
  revalidatePath("/biblioteca");
  revalidatePath("/dashboard");
  return updated;
}

export async function upsertBookFromInput(input: unknown) {
  await requireUser();
  const data = bookInputSchema.parse(input);

  if (data.googleBooksId) {
    const existing = await db.book.findUnique({
      where: { googleBooksId: data.googleBooksId },
    });
    if (existing) return existing;
  }

  return db.book.create({
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
