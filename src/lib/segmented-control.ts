export type Segmento = { valor: string; label: string };

// Máximo 3 segmentos por diseño: la tupla no compila con un 4to elemento.
export type Segmentos = readonly [Segmento, Segmento] | readonly [Segmento, Segmento, Segmento];

/**
 * Resuelve cuál segmento debe marcarse como activo.
 * Si `activo` no coincide con ningún valor de `segmentos` (param ausente,
 * corrupto o manipulado a mano en la URL), cae al primer segmento para
 * que la navegación nunca quede sin un estado activo visible.
 */
export function resolverSegmentoActivo(segmentos: Segmentos, activo: string): string {
  const coincide = segmentos.some((segmento) => segmento.valor === activo);
  return coincide ? activo : segmentos[0].valor;
}

export type AlineacionSegmento = "start" | "center" | "end";

/**
 * Alineación pixel-perfect del control segmentado con el contenedor de la
 * página: el primer segmento alinea su texto a la izquierda con el padding
 * del container, el último a la derecha, y los del medio (solo existen en
 * tuplas de 3) se centran. Sin esto, cada segmento centra su texto dentro
 * de su propio tercio y el borde izquierdo de la primera etiqueta NUNCA
 * coincide con el borde izquierdo del contenido de la página.
 */
export function alineacionSegmento(indice: number, total: number): AlineacionSegmento {
  if (indice === 0) return "start";
  if (indice === total - 1) return "end";
  return "center";
}
