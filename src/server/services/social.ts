import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type SocialClient =
  | Pick<Prisma.TransactionClient, "userBook" | "rating" | "follow">
  | typeof db;

/**
 * Libros "en común" entre dos usuarios: la unión de lo que cada uno tiene en
 * su estantería (UserBook, cualquier status) y lo que ha valorado (Rating),
 * intersectada entre ambos. Dos queries mínimas por usuario (estantería +
 * valoraciones) resueltas en paralelo; el cruce se hace en memoria con Set
 * para no depender de una query relacional más compleja a esta escala.
 */
export async function booksInCommon(
  userAId: string,
  userBId: string,
  client: SocialClient = db,
): Promise<number> {
  const [aBookIds, bBookIds] = await Promise.all([
    getEngagedBookIds(userAId, client),
    getEngagedBookIds(userBId, client),
  ]);

  let count = 0;
  for (const id of aBookIds) {
    if (bBookIds.has(id)) count++;
  }
  return count;
}

async function getEngagedBookIds(userId: string, client: SocialClient): Promise<Set<string>> {
  const [userBooks, ratings] = await Promise.all([
    client.userBook.findMany({ where: { userId }, select: { bookId: true } }),
    client.rating.findMany({ where: { userId }, select: { bookId: true } }),
  ]);

  const ids = new Set<string>();
  for (const ub of userBooks) ids.add(ub.bookId);
  for (const r of ratings) ids.add(r.bookId);
  return ids;
}

/**
 * Conteo de seguidores (te siguen) y seguidos (sigues) de un usuario, para
 * la fila de stats del perfil propio y del perfil público.
 */
export async function getFollowCounts(
  userId: string,
  client: SocialClient = db,
): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    client.follow.count({ where: { followingId: userId } }),
    client.follow.count({ where: { followerId: userId } }),
  ]);
  return { followers, following };
}
