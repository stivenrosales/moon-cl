"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { progressSchema } from "@/lib/validators";
import { requireUser } from "@/server/auth-helpers";

export async function updateProgress(input: unknown) {
  const user = await requireUser();
  const data = progressSchema.parse(input);

  const progress = await db.readingProgress.create({
    data: {
      bookId: data.bookId,
      userId: user.id,
      currentPage: data.currentPage,
      note: data.note ?? null,
    },
  });

  revalidatePath(`/libros/${data.bookId}`);
  revalidatePath("/dashboard");
  return progress;
}
