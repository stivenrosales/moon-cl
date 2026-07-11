"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { commentSchema, idSchema } from "@/lib/validators";
import { requireUser, requireModerator } from "@/server/auth-helpers";
import { isModeratorOrAbove } from "@/lib/permissions";
import { hasFinishedBook } from "@/server/services/comment-gating";

/**
 * Determina si el usuario terminó el libro consultando su UserBook y su
 * último ReadingProgress (misma regla que en libros/[id]/page.tsx, ver
 * comment-gating.ts para la lógica pura). Usado para permitir publicar o
 * revelar comentarios de la sala de reflexión.
 */
async function userHasFinishedBook(userId: string, bookId: string) {
  const [userBook, book, latestProgress] = await Promise.all([
    db.userBook.findUnique({ where: { userId_bookId: { userId, bookId } } }),
    db.book.findUnique({ where: { id: bookId }, select: { pageCount: true } }),
    db.readingProgress.findFirst({ where: { userId, bookId }, orderBy: { createdAt: "desc" } }),
  ]);

  return hasFinishedBook({
    userBookStatus: userBook?.status ?? null,
    latestProgressPage: latestProgress?.currentPage ?? null,
    bookPageCount: book?.pageCount ?? null,
  });
}

export async function postComment(input: unknown) {
  const user = await requireUser();
  const data = commentSchema.parse(input);

  if (data.parentId) {
    const parent = await db.comment.findUnique({ where: { id: data.parentId } });
    if (!parent || parent.bookId !== data.bookId || parent.parentId) {
      throw new Error("Respuesta no válida (solo un nivel de hilo)");
    }
  }

  if (data.isReflection) {
    const finished = await userHasFinishedBook(user.id, data.bookId);
    if (!finished) {
      throw new Error("Debes terminar el libro para publicar en la sala de reflexión");
    }
  }

  const comment = await db.comment.create({
    data: {
      bookId: data.bookId,
      userId: user.id,
      parentId: data.parentId ?? null,
      content: data.content,
      isSpoiler: data.isSpoiler,
      isReflection: data.isReflection,
      chapter: data.chapter ?? null,
    },
  });

  revalidatePath(`/libros/${data.bookId}`);
  return comment;
}

/**
 * Revela el content de un comentario bajo demanda («Leer igual» para salas
 * de capítulos futuros, «Revelar spoiler» para comentarios marcados). El
 * gating real (qué se serializa al cliente) vive en libros/[id]/page.tsx +
 * comment-gating.ts; esta action es la puerta de salida explícita que el
 * usuario cruza a propósito. La sala de reflexión es la excepción: no tiene
 * escape hatch, solo se revela si el usuario ya terminó el libro (o es
 * moderador).
 */
export async function revealComment(id: string) {
  const user = await requireUser();
  const parsedId = idSchema.parse(id);
  const comment = await db.comment.findUnique({ where: { id: parsedId } });
  if (!comment) throw new Error("Comentario no encontrado");

  if (comment.isReflection && !isModeratorOrAbove(user.role)) {
    const finished = await userHasFinishedBook(user.id, comment.bookId);
    if (!finished) {
      throw new Error("Debes terminar el libro para entrar a la sala de reflexión");
    }
  }

  return { id: comment.id, content: comment.content };
}

export async function deleteComment(id: string) {
  const user = await requireUser();
  const parsedId = idSchema.parse(id);
  const comment = await db.comment.findUnique({ where: { id: parsedId } });
  if (!comment) throw new Error("Comentario no encontrado");

  const canDelete =
    comment.userId === user.id ||
    user.role === "ADMIN" ||
    user.role === "MODERATOR";
  if (!canDelete) throw new Error("No autorizado");

  await db.comment.update({
    where: { id: parsedId },
    data: { deletedAt: new Date(), content: "[eliminado]" },
  });
  revalidatePath(`/libros/${comment.bookId}`);
}

export async function moderateComment(id: string, action: "delete" | "unspoiler" | "spoiler") {
  await requireModerator();
  const parsedId = idSchema.parse(id);
  const comment = await db.comment.findUnique({ where: { id: parsedId } });
  if (!comment) throw new Error("Comentario no encontrado");

  if (action === "delete") {
    await db.comment.update({
      where: { id: parsedId },
      data: { deletedAt: new Date(), content: "[moderado]" },
    });
  } else {
    await db.comment.update({
      where: { id: parsedId },
      data: { isSpoiler: action === "spoiler" },
    });
  }
  revalidatePath(`/libros/${comment.bookId}`);
}
