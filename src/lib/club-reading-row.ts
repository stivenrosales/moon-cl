import type { ShelfStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────
// Resuelve qué versión de la fila del libro actual del club debe pintarse
// en la pestaña "Leyendo" de /leer. Función pura — sin tocar la base de
// datos — para que /leer/page.tsx solo tenga que llamarla con datos ya
// cargados.
//
// El bug que esto arregla: antes, /leer decidía "showClubRow" solo con
// `!!currentClubBook` — sin mirar si el usuario TIENE un UserBook para ese
// libro. Resultado: cualquier usuario nuevo veía "Leyendo · 1", una card con
// barra en 0% y un botón "Continuar" de un libro que nunca agregó a su
// estantería. Misma familia de bug que el deadlock de today.ts: confundir
// "el libro existe" con "el usuario lo empezó".
// ─────────────────────────────────────────────────────────────────────────

export type ClubRowMode = "progress" | "invite" | "none";

export interface ClubRowUserBook {
  bookId: string;
  status: ShelfStatus;
}

/**
 * - "progress": el usuario tiene UserBook READING para el libro del club —
 *   la fila muestra avance real (barra, "Continuar") y SÍ cuenta como
 *   "Leyendo".
 * - "invite": el usuario no tiene ningún UserBook para ese libro — la fila
 *   sigue apareciendo (es útil: es el libro del club) pero como invitación,
 *   sin barra ni "Continuar", y NO cuenta como "Leyendo".
 * - "none": no hay libro actual del club, o el usuario ya lo tiene en otra
 *   estantería (Quiero leer / Leído) donde ya aparece por su cuenta — no
 *   hace falta una fila extra en "Leyendo" para ese caso.
 */
export function resolveClubRowMode(
  clubBookId: string | undefined,
  userBooks: ClubRowUserBook[],
): ClubRowMode {
  if (!clubBookId) return "none";

  const match = userBooks.find((ub) => ub.bookId === clubBookId);
  if (match?.status === "READING") return "progress";
  if (!match) return "invite";
  return "none";
}
