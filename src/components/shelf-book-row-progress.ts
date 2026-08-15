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
 *
 * Mismo espejo del bug de arriba pero con `pageCount`: sin total de páginas
 * no hay proporción que calcular. `pageProgress(45, null)` cae a 0 porque
 * `pageProgress` no distingue "no hay total" de "el total es 0" — ambos
 * devuelven 0 — y eso volvía a mostrar "0%" + barra vacía, esta vez para
 * alguien que SÍ iba en la página 45. Catálogo externo (Google Books, Open
 * Library) omite pageCount seguido, y el saneo del repo convierte
 * `pageCount: 0` en `null` a propósito, así que no es un caso raro.
 * `avance-sin-total` modela ese estado real: hay página, no hay pct.
 */
export type FilaProgreso =
  | { tipo: "sin-marcar"; texto: string; mostrarBarra: false }
  | { tipo: "arranque"; texto: string; mostrarBarra: false }
  | { tipo: "avance-sin-total"; texto: string; mostrarBarra: false }
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

  // currentPage > 0 sin total real: no hay proporción que calcular, así que
  // no se inventa un pct (pageProgress volvería 0, el mismo espejo del bug
  // de arriba). Se muestra el avance tal como existe — página y capítulo —
  // sin barra y sin porcentaje.
  if (!pageCount || pageCount <= 0) {
    const paginaTexto = `pág. ${currentPage}`;
    const texto = [paginaTexto, capituloTexto].filter(Boolean).join(" · ");
    return { tipo: "avance-sin-total", texto, mostrarBarra: false };
  }

  // currentPage > 0 con total real: hay avance real, se calcula el
  // porcentaje y se pinta la barra (nunca al 0%, ver comentario de arriba).
  const pct = pageProgress(currentPage, pageCount);
  const paginaTexto = `pág. ${currentPage}/${pageCount}`;
  const texto = [`${pct}%`, paginaTexto, capituloTexto].filter(Boolean).join(" · ");
  return { tipo: "con-progreso", texto, pct, mostrarBarra: true };
}
