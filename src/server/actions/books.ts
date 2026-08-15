"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { searchBooks, type BookSearchResult } from "@/lib/google-books";
import { routes } from "@/lib/routes";
import { bookUpdateSchema, createBookSchema } from "@/lib/validators";
import { requireUser, requireModerator } from "@/server/auth-helpers";
import { findOrCreateBook } from "@/server/services/books";
import { setCurrentBookTx } from "@/server/services/club";

export async function searchBooksAction(query: string): Promise<BookSearchResult> {
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
      publisher: data.publisher ?? null,
    },
  });

  revalidatePath(routes.libro(updated.id));
  revalidatePath(routes.leer());
  revalidatePath(routes.hoy());
  return updated;
}

/**
 * Crea un libro directamente desde /admin (sin pasar por votación). Si
 * marcarComoActual es true, crear el libro y dejarlo como lectura en curso
 * del club van en UNA sola transacción: setCurrentBookTx no solo marca el
 * nuevo libro como actual, también archiva el anterior como FINISHED. Con
 * dos escrituras separadas, si la segunda fallara, el club quedaría sin
 * lectura en curso y con un libro huérfano recién creado.
 */
export async function createBook(input: unknown): Promise<{ id: string; title: string }> {
  await requireModerator();
  const data = createBookSchema.parse(input);

  const book = data.marcarComoActual
    ? await db.$transaction(async (tx) => {
        const created = await findOrCreateBook(data, tx);
        await setCurrentBookTx(tx, created.id);
        return created;
      })
    : await findOrCreateBook(data);

  revalidatePath(routes.admin());
  revalidatePath(routes.leer());
  revalidatePath(routes.hoy());
  if (data.marcarComoActual) {
    revalidatePath(routes.libro(book.id));
  }

  return { id: book.id, title: book.title };
}
