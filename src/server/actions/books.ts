"use server";

import { db } from "@/lib/db";
import { searchBooks, type BookCandidate } from "@/lib/google-books";
import { bookInputSchema } from "@/lib/validators";
import { requireUser } from "@/server/auth-helpers";

export async function searchBooksAction(query: string): Promise<BookCandidate[]> {
  await requireUser();
  return searchBooks(query, 8);
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
