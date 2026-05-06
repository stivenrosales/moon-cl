"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";
import { requireAdmin } from "@/server/auth-helpers";

export async function setUserRole(userId: string, role: Role) {
  const admin = await requireAdmin();
  if (admin.id === userId && role !== "ADMIN") {
    throw new Error("No puedes degradarte a ti mismo");
  }
  await db.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin");
}

export async function setBookAsCurrent(bookId: string) {
  await requireAdmin();
  await db.$transaction([
    db.book.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false, status: "FINISHED", finishedAt: new Date() },
    }),
    db.book.update({
      where: { id: bookId },
      data: {
        isCurrent: true,
        status: "CURRENT",
        startedAt: new Date(),
        finishedAt: null,
      },
    }),
  ]);
  revalidatePath("/dashboard");
  revalidatePath(`/libros/${bookId}`);
  revalidatePath("/biblioteca");
  revalidatePath("/admin");
}

export async function markBookAsFinished(bookId: string) {
  await requireAdmin();
  await db.book.update({
    where: { id: bookId },
    data: { isCurrent: false, status: "FINISHED", finishedAt: new Date() },
  });
  revalidatePath("/dashboard");
  revalidatePath(`/libros/${bookId}`);
  revalidatePath("/biblioteca");
  revalidatePath("/admin");
}
