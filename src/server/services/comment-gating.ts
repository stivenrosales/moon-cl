import type { ShelfStatus } from "@prisma/client";

export interface HasFinishedBookInput {
  userBookStatus: ShelfStatus | null;
  latestProgressPage: number | null;
  bookPageCount: number | null;
}

/**
 * Determina si el usuario declaró haber TERMINADO el libro: o bien su
 * estantería personal (UserBook) está en FINISHED, o bien su último
 * ReadingProgress alcanzó (o superó) el total de páginas del libro. Sin
 * pageCount conocido no hay forma de inferirlo por progreso, así que en ese
 * caso solo cuenta el UserBook en FINISHED.
 */
export function hasFinishedBook(input: HasFinishedBookInput): boolean {
  if (input.userBookStatus === "FINISHED") return true;
  if (input.bookPageCount != null && input.latestProgressPage != null) {
    return input.latestProgressPage >= input.bookPageCount;
  }
  return false;
}

export interface GatableComment {
  authorId: string;
  chapter: number | null;
  isSpoiler: boolean;
  isReflection: boolean;
}

export interface GateContext {
  currentUserId: string;
  myChapter: number;
  isModerator: boolean;
  hasFinishedBook: boolean;
}

export type GateReason = "chapter" | "reflection" | "spoiler";

export type GateDecision = { locked: false } | { locked: true; reason: GateReason };

/**
 * Decide si el CONTENIDO de un comentario debe viajar hacia el cliente (fix
 * del leak verificado: antes el blur de spoilers era solo CSS y el content
 * viajaba igual en el HTML). Reglas, en orden:
 *  1. Los moderadores ven todo (bypass, necesitan poder moderar).
 *  2. La sala de reflexión (isReflection) solo se abre si el usuario
 *     terminó el libro.
 *  3. Un comentario de un capítulo posterior al mío queda bloqueado
 *     (spoiler de avance).
 *  4. Un comentario marcado como spoiler se oculta salvo para su propio
 *     autor.
 */
export function gateComment(comment: GatableComment, ctx: GateContext): GateDecision {
  if (ctx.isModerator) return { locked: false };

  if (comment.isReflection && !ctx.hasFinishedBook) {
    return { locked: true, reason: "reflection" };
  }

  if (comment.chapter != null && comment.chapter > ctx.myChapter) {
    return { locked: true, reason: "chapter" };
  }

  const isAuthor = comment.authorId === ctx.currentUserId;
  if (comment.isSpoiler && !isAuthor) {
    return { locked: true, reason: "spoiler" };
  }

  return { locked: false };
}
