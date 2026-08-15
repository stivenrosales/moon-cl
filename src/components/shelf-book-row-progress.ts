import { pageProgress } from "@/lib/utils";

/**
 * Qué texto mostrar y si pintar la barra de Progress en la fila de
 * estantería (vista "Leyendo" de /leer) según el avance de la usuaria.
 *
 * Mismo bug que ya se dio en hero-card.tsx / today.ts: "nunca marcó avance"
 * (currentPage null) y "marcó explícitamente la página 0" (0, legítimo:
 * portada o prólogo) son estados DISTINTOS. `item.currentPage ?? 0` los
 * colapsaba acá y mostraba "pág. 0" + una barra al 0% para alguien que
 * nunca abrió el diálogo de avance. Discrimina por `=== null`, nunca por
 * falsy — ver reading-progress-copy.ts para el mismo criterio en /hoy.
 *
 * Igual que en hero-card: la barra solo se pinta cuando hay avance real
 * (currentPage > 0). Pintarla al 0% para "arranque" o "sin-marcar" sería
 * una promesa vacía.
 */
export type FilaProgreso =
  | { tipo: "sin-marcar"; texto: string; mostrarBarra: false }
  | { tipo: "arranque"; texto: string; mostrarBarra: false }
  | { tipo: "con-progreso"; texto: string; pct: number; mostrarBarra: true };

export function resolverFilaProgreso(
  currentPage: number | null,
  currentChapter: number | null,
  pageCount: number | null,
): FilaProgreso {
  if (currentPage === null) {
    return { tipo: "sin-marcar", texto: "Sin avance marcado", mostrarBarra: false };
  }

  const capituloTexto = currentChapter ? `cap. ${currentChapter}` : null;

  if (currentPage === 0) {
    const paginaTexto = pageCount ? `pág. 0/${pageCount}` : null;
    const detalle = [paginaTexto, capituloTexto].filter(Boolean).join(" · ");
    return { tipo: "arranque", texto: detalle || "Recién empiezas", mostrarBarra: false };
  }

  // currentPage > 0: hay avance real, se calcula el porcentaje y se pinta
  // la barra (nunca al 0%, ver comentario de arriba).
  const pct = pageProgress(currentPage, pageCount);
  const paginaTexto = pageCount ? `pág. ${currentPage}/${pageCount}` : null;
  const texto = [`${pct}%`, paginaTexto, capituloTexto].filter(Boolean).join(" · ");
  return { tipo: "con-progreso", texto, pct, mostrarBarra: true };
}
