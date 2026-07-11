import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type BookClient = Pick<Prisma.TransactionClient, "book"> | typeof db;

export interface FindOrCreateBookInput {
  title: string;
  authors?: string[] | null;
  coverUrl?: string | null;
  description?: string | null;
  pageCount?: number | null;
  publishedYear?: number | null;
  googleBooksId?: string | null;
  isbn?: string | null;
}

/**
 * Busca un libro por googleBooksId; si no existe (o no se envió
 * googleBooksId), lo crea. Punto único de "encuentra o crea libro" usado
 * tanto al sugerir un libro en una ronda como al agregarlo directamente a
 * la estantería personal, para no duplicar la lógica de creación.
 *
 * Acepta un client opcional (db o una tx de Prisma) para poder usarse
 * dentro de transacciones.
 */
export async function findOrCreateBook(data: FindOrCreateBookInput, client: BookClient = db) {
  if (data.googleBooksId) {
    const existing = await client.book.findUnique({
      where: { googleBooksId: data.googleBooksId },
    });
    if (existing) return existing;
  }

  return client.book.create({
    data: {
      title: data.title,
      authors: data.authors ?? [],
      coverUrl: data.coverUrl ?? null,
      description: data.description ?? null,
      pageCount: data.pageCount ?? null,
      publishedYear: data.publishedYear ?? null,
      googleBooksId: data.googleBooksId ?? null,
      isbn: data.isbn ?? null,
    },
  });
}
