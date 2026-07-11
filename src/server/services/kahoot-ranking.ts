/**
 * Asigna posiciones (rank) a una lista de entradas según sus puntos, de
 * mayor a menor. Ranking tipo competición: los empates comparten el mismo
 * puesto y el siguiente puesto salta el número de empatados (1, 1, 3 —
 * nunca 1, 1, 2). Sirve tanto para el acumulado del club como para el
 * detalle de una sola actividad: quien llama decide de dónde salen los
 * puntos con `getPoints`.
 *
 * El orden de entrada se conserva de forma estable entre elementos
 * empatados (Array.prototype.sort es estable en motores modernos).
 */
export function rankByPoints<T>(
  entries: T[],
  getPoints: (entry: T) => number,
): Array<T & { rank: number }> {
  const sorted = [...entries].sort((a, b) => getPoints(b) - getPoints(a));

  let rank = 0;
  let previousPoints: number | null = null;

  return sorted.map((entry, index) => {
    const points = getPoints(entry);
    if (previousPoints === null || points !== previousPoints) {
      rank = index + 1;
      previousPoints = points;
    }
    return { ...entry, rank };
  });
}
