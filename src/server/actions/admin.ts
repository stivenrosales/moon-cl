"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";
import { routes } from "@/lib/routes";
import { requireAdmin } from "@/server/auth-helpers";
import { setCurrentBookTx } from "@/server/services/club";

export async function setUserRole(userId: string, role: Role) {
  const admin = await requireAdmin();
  const parsedUserId = z.string().cuid().parse(userId);
  if (admin.id === parsedUserId && role !== "ADMIN") {
    throw new Error("No puedes degradarte a ti mismo");
  }
  await db.user.update({ where: { id: parsedUserId }, data: { role } });
  revalidatePath(routes.admin());
}

export async function setBookAsCurrent(bookId: string) {
  await requireAdmin();
  const parsedBookId = z.string().cuid().parse(bookId);
  await db.$transaction((tx) => setCurrentBookTx(tx, parsedBookId));
  revalidatePath(routes.hoy());
  revalidatePath(routes.libro(parsedBookId));
  revalidatePath(routes.leer());
  revalidatePath(routes.admin());
}

export async function markBookAsFinished(bookId: string) {
  await requireAdmin();
  await db.book.update({
    where: { id: bookId },
    data: { isCurrent: false, status: "FINISHED", finishedAt: new Date() },
  });
  revalidatePath(routes.hoy());
  revalidatePath(routes.libro(bookId));
  revalidatePath(routes.leer());
  revalidatePath(routes.admin());
}
