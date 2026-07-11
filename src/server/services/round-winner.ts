export interface WinnerCandidate {
  id: string;
  bookId: string;
  voteCount: number;
  createdAt: Date;
}

/**
 * Elige el ganador de una ronda: más votos gana; en caso de empate,
 * gana la sugerencia más antigua (createdAt menor). Si hay empate total
 * de votos y createdAt, se conserva el orden de entrada (estable).
 * Retorna null si no hay sugerencias.
 */
export function pickWinner<T extends WinnerCandidate>(
  suggestions: T[],
): T | null {
  if (suggestions.length === 0) return null;

  return suggestions.reduce((best, current) => {
    if (current.voteCount > best.voteCount) return current;
    if (
      current.voteCount === best.voteCount &&
      current.createdAt.getTime() < best.createdAt.getTime()
    ) {
      return current;
    }
    return best;
  });
}
