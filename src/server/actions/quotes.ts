"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { routes } from "@/lib/routes";
import { quoteSchema, idSchema } from "@/lib/validators";
import { requireUser } from "@/server/auth-helpers";

export async function createQuote(input: unknown) {
  const user = await requireUser();
  const data = quoteSchema.parse(input);

  const book = await db.book.findUnique({ where: { id: data.bookId }, select: { id: true } });
  if (!book) throw new Error("Libro no encontrado");

  const quote = await db.quote.create({
    data: {
      bookId: data.bookId,
      userId: user.id,
      content: data.content,
      page: data.page ?? null,
      chapter: data.chapter ?? null,
    },
  });

  revalidatePath(routes.club());
  revalidatePath(routes.libro(data.bookId));
  return quote;
}

export async function deleteQuote(id: string) {
  const user = await requireUser();
  const parsedId = idSchema.parse(id);
  const quote = await db.quote.findUnique({ where: { id: parsedId } });
  if (!quote) throw new Error("Frase no encontrada");

  const canDelete =
    quote.userId === user.id || user.role === "ADMIN" || user.role === "MODERATOR";
  if (!canDelete) throw new Error("No autorizado");

  await db.quote.delete({ where: { id: parsedId } });

  revalidatePath(routes.club());
  revalidatePath(routes.libro(quote.bookId));
}

export async function toggleQuoteLike(quoteId: string) {
  const user = await requireUser();
  const parsedId = idSchema.parse(quoteId);

  const quote = await db.quote.findUnique({ where: { id: parsedId } });
  if (!quote) throw new Error("Frase no encontrada");

  const existing = await db.quoteLike.findUnique({
    where: { quoteId_userId: { quoteId: parsedId, userId: user.id } },
  });

  if (existing) {
    await db.quoteLike.delete({ where: { id: existing.id } });
  } else {
    await db.quoteLike.create({ data: { quoteId: parsedId, userId: user.id } });
  }

  revalidatePath(routes.club());
  revalidatePath(routes.libro(quote.bookId));
  return { liked: !existing };
}
