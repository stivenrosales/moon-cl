import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type AffinityClient =
  | Pick<Prisma.TransactionClient, "user" | "userBook" | "rating">
  | typeof db;

/** Datos crudos de un usuario ya cargados, listos para computeAffinity(). */
export interface AffinityUserData {
  userId: string;
  /** Unión de bookIds de UserBook (estantería) y Rating — mismo criterio que booksInCommon en services/social.ts. */
  bookIds: Set<string>;
  favoriteGenres: string[];
  /** bookId -> stars, solo de los libros que este usuario calificó. */
  ratings: Map<string, number>;
}

export interface AffinityEvidence {
  librosEnComun: number;
  generosEnComun: string[];
}

export interface AffinityResult {
  score: number;
  label: string;
  evidence: AffinityEvidence;
}

// Pesos base (Paquete D): libros 50%, géneros declarados 30%, calificaciones 20%.
// Cuando una señal no tiene datos se excluye y el resto se renormaliza para
// sumar 100% del peso disponible — ver computeAffinity().
const WEIGHTS = { books: 0.5, genres: 0.3, ratings: 0.2 } as const;

/**
 * Jaccard entre dos sets. null significa "sin datos" (ambos sets vacíos —
 * ninguno de los dos usuarios aportó nada a esta señal), a diferencia de un
 * jaccard de 0, que es un dato real: "tienen sets, pero no se cruzan".
 */
function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number | null {
  if (a.size === 0 && b.size === 0) return null;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  const unionSize = a.size + b.size - intersection;
  if (unionSize === 0) return null;
  return intersection / unionSize;
}

function intersect(a: ReadonlySet<string>, b: ReadonlySet<string>): string[] {
  const result: string[] = [];
  for (const item of a) if (b.has(item)) result.push(item);
  return result;
}

/**
 * 1 - (diferencia media absoluta de estrellas / 4), solo sobre los libros
 * que AMBOS calificaron. null si no hay ningún libro calificado por los dos
 * (no hay con qué comparar, no es que se parezcan "cero").
 */
function ratingSimilarity(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): number | null {
  const diffs: number[] = [];
  for (const [bookId, starsA] of a) {
    const starsB = b.get(bookId);
    if (starsB != null) diffs.push(Math.abs(starsA - starsB));
  }
  if (diffs.length === 0) return null;
  const meanDiff = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
  return 1 - meanDiff / 4; // estrellas 1-5 → la diferencia máxima posible es 4
}

export function labelForScore(score: number): string {
  if (score >= 70) return "Casi gemelos lectores";
  if (score >= 40) return "Buena química lectora";
  return "Recién se conocen";
}

/**
 * Afinidad honesta entre dos lectores (0-100). Combina tres señales —solape
 * de libros (Jaccard sobre UserBook+Rating, peso 50%), solape de géneros
 * favoritos declarados (Jaccard, peso 30%) y similitud de calificaciones en
 * los libros que ambos calificaron (peso 20%)— y redistribuye el peso entre
 * las señales que sí tienen datos cuando alguna no aporta nada (p.ej. nadie
 * declaró géneros favoritos). Si NINGUNA señal tiene datos, retorna null:
 * la afinidad jamás se inventa ni se muestra "a medias" con un score
 * fabricado sin evidencia real detrás.
 *
 * Función pura sobre datos ya cargados — ver loadAffinityData() más abajo
 * para las queries (mismo patrón buildFeed/loadFeed de services/feed.ts).
 */
export function computeAffinity(a: AffinityUserData, b: AffinityUserData): AffinityResult | null {
  const signals: Array<{ weight: number; value: number }> = [];

  const booksJaccard = jaccard(a.bookIds, b.bookIds);
  if (booksJaccard !== null) signals.push({ weight: WEIGHTS.books, value: booksJaccard });

  const genresJaccard = jaccard(new Set(a.favoriteGenres), new Set(b.favoriteGenres));
  if (genresJaccard !== null) signals.push({ weight: WEIGHTS.genres, value: genresJaccard });

  const ratingsSim = ratingSimilarity(a.ratings, b.ratings);
  if (ratingsSim !== null) signals.push({ weight: WEIGHTS.ratings, value: Math.max(0, ratingsSim) });

  if (signals.length === 0) return null;

  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const weighted = signals.reduce((sum, s) => sum + (s.weight / totalWeight) * s.value, 0);
  const score = Math.round(weighted * 100);

  return {
    score,
    label: labelForScore(score),
    evidence: {
      librosEnComun: intersect(a.bookIds, b.bookIds).length,
      generosEnComun: intersect(new Set(a.favoriteGenres), new Set(b.favoriteGenres)),
    },
  };
}

/**
 * Carga en bulk los datos crudos (estantería+valoraciones fusionadas como en
 * booksInCommon, géneros favoritos) de una lista de usuarios en 3 queries
 * totales — pensado para computar muchos pares de una sola vez (insignia de
 * /miembros, emparejamiento semanal del job) sin caer en N+1 por par.
 */
export async function loadAffinityData(
  userIds: string[],
  client: AffinityClient = db,
): Promise<Map<string, AffinityUserData>> {
  const [users, userBooks, ratings] = await Promise.all([
    client.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, favoriteGenres: true },
    }),
    client.userBook.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, bookId: true },
    }),
    client.rating.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, bookId: true, stars: true },
    }),
  ]);

  const data = new Map<string, AffinityUserData>();
  for (const u of users) {
    data.set(u.id, { userId: u.id, bookIds: new Set(), favoriteGenres: u.favoriteGenres, ratings: new Map() });
  }

  for (const ub of userBooks) {
    data.get(ub.userId)?.bookIds.add(ub.bookId);
  }

  for (const r of ratings) {
    const entry = data.get(r.userId);
    if (!entry) continue;
    entry.bookIds.add(r.bookId);
    entry.ratings.set(r.bookId, r.stars);
  }

  return data;
}

/** Afinidad entre exactamente dos usuarios, cargando sus datos on-demand. */
export async function getAffinity(
  userAId: string,
  userBId: string,
  client: AffinityClient = db,
): Promise<AffinityResult | null> {
  const data = await loadAffinityData([userAId, userBId], client);
  const a = data.get(userAId);
  const b = data.get(userBId);
  if (!a || !b) return null;
  return computeAffinity(a, b);
}
