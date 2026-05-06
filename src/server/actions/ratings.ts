"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ratingSchema } from "@/lib/validators";
import { requireUser } from "@/server/auth-helpers";

export async function upsertRating(input: unknown) {
  const user = await requireUser();
  const data = ratingSchema.parse(input);

  const rating = await db.rating.upsert({
    where: { bookId_userId: { bookId: data.bookId, userId: user.id } },
    create: {
      bookId: data.bookId,
      userId: user.id,
      stars: data.stars,
      review: data.review ?? null,
    },
    update: {
      stars: data.stars,
      review: data.review ?? null,
    },
  });

  revalidatePath(`/libros/${data.bookId}`);
  return rating;
}

export async function deleteRating(bookId: string) {
  const user = await requireUser();
  await db.rating.delete({
    where: { bookId_userId: { bookId, userId: user.id } },
  });
  revalidatePath(`/libros/${bookId}`);
}
