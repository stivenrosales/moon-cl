import { cache as reactCache } from "react";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type BookClient = Pick<Prisma.TransactionClient, "book"> | typeof db;

const currentClubBookSelect = {
  id: true,
  title: true,
  authors: true,
  coverUrl: true,
  pageCount: true,
} as const;

export interface CurrentClubBook {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  pageCount: number | null;
}

async function fetchCurrentClubBook(): Promise<CurrentClubBook | null> {
  return db.book.findFirst({ where: { isCurrent: true }, select: currentClubBookSelect });
}

/**
 * Libro actual del club (isCurrent: true), envuelto en React.cache() — mismo
 * patrón que getSession() en src/lib/session.ts. today.ts y feed.ts piden
 * este mismo dato de forma independiente y ambos corren dentro del mismo
 * Promise.all de /hoy (src/app/(app)/hoy/page.tsx): sin este cache, esa
 * carga dispara la query "isCurrent: true" dos veces en el mismo request.
 * Con cache(), la segunda llamada reusa la promesa de la primera.
 *
 * Guard necesario: react 18.3.1 estable (la versión instalada en
 * node_modules) no exporta `cache` — Next.js solo la resuelve vía su propio
 * build de React parcheado para RSC dentro del bundler de app/. Bajo vitest
 * (Node plano, sin ese bundler) `reactCache` llega undefined; sin el guard,
 * cargar este módulo rompía today.test.ts/feed.test.ts/books.test.ts con
 * "cache is not a function". Sin memoizar sigue siendo 100% correcto, solo
 * sin el dedupe de request.
 */
export const getCurrentClubBook: () => Promise<CurrentClubBook | null> =
  typeof reactCache === "function" ? reactCache(fetchCurrentClubBook) : fetchCurrentClubBook;

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
