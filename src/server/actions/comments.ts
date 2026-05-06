"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { commentSchema } from "@/lib/validators";
import { requireUser, requireModerator } from "@/server/auth-helpers";

export async function postComment(input: unknown) {
  const user = await requireUser();
  const data = commentSchema.parse(input);

  if (data.parentId) {
    const parent = await db.comment.findUnique({ where: { id: data.parentId } });
    if (!parent || parent.bookId !== data.bookId || parent.parentId) {
      throw new Error("Respuesta no válida (solo un nivel de hilo)");
    }
  }

  const comment = await db.comment.create({
    data: {
      bookId: data.bookId,
      userId: user.id,
      parentId: data.parentId ?? null,
      content: data.content,
      isSpoiler: data.isSpoiler,
      chapter: data.chapter ?? null,
    },
  });

  revalidatePath(`/libros/${data.bookId}`);
  return comment;
}

export async function deleteComment(id: string) {
  const user = await requireUser();
  const comment = await db.comment.findUnique({ where: { id } });
  if (!comment) throw new Error("Comentario no encontrado");

  const canDelete =
    comment.userId === user.id ||
    user.role === "ADMIN" ||
    user.role === "MODERATOR";
  if (!canDelete) throw new Error("No autorizado");

  await db.comment.update({
    where: { id },
    data: { deletedAt: new Date(), content: "[eliminado]" },
  });
  revalidatePath(`/libros/${comment.bookId}`);
}

export async function moderateComment(id: string, action: "delete" | "unspoiler" | "spoiler") {
  await requireModerator();
  const comment = await db.comment.findUnique({ where: { id } });
  if (!comment) throw new Error("Comentario no encontrado");

  if (action === "delete") {
    await db.comment.update({
      where: { id },
      data: { deletedAt: new Date(), content: "[moderado]" },
    });
  } else {
    await db.comment.update({
      where: { id },
      data: { isSpoiler: action === "spoiler" },
    });
  }
  revalidatePath(`/libros/${comment.bookId}`);
}
