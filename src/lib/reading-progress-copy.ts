/**
 * Qué copy y qué control mostrar en la card "leyendo" de /hoy según el
 * avance de página del usuario. `miPagina` distingue "nunca marcó nada"
 * (null) de "marcó avance real en la página 0" (0) — ver today.ts. Discrimina
 * por `=== null`, NUNCA por falsy: `hero.miPagina ? ... : ...` colapsaba
 * ambos casos en el mismo texto ("Aún no has marcado tu avance."), lo que
 * era mentira para quien sí guardó su avance en la página 0.
 */
export type AvanceCopy =
  | { tipo: "sin-marcar"; texto: string }
  | { tipo: "arranque"; texto: string }
  | { tipo: "con-progreso" };

export function resolverAvanceCopy(miPagina: number | null): AvanceCopy {
  if (miPagina === null) {
    return { tipo: "sin-marcar", texto: "Aún no has marcado tu avance." };
  }
  if (miPagina === 0) {
    return { tipo: "arranque", texto: "Vas en la página 0 — recién empiezas." };
  }
  // miPagina > 0: hay avance real, se pinta la barra Progress (nunca en 0%,
  // eso sería una promesa vacía).
  return { tipo: "con-progreso" };
}
