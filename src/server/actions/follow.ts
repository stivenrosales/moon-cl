"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validators";
import { requireUser } from "@/server/auth-helpers";

function isDuplicateFollowError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

function revalidateFollowPaths(targetUserId: string) {
  revalidatePath("/miembros");
  revalidatePath(`/perfil/${targetUserId}`);
  revalidatePath("/perfil");
}

/**
 * Sigue a otro usuario. Idempotente: si ya lo sigues, el create choca con el
 * índice único @@unique([followerId, followingId]) (P2002) y lo tratamos
 * como éxito silencioso en vez de propagar el error de Prisma al cliente.
 */
export async function followUser(targetUserId: string) {
  const user = await requireUser();
  const followingId = idSchema.parse(targetUserId);

  if (followingId === user.id) {
    throw new Error("No puedes seguirte a ti mismo");
  }

  try {
    await db.follow.create({
      data: { followerId: user.id, followingId },
    });
  } catch (err) {
    if (!isDuplicateFollowError(err)) throw err;
  }

  revalidateFollowPaths(followingId);
}

/**
 * Deja de seguir a otro usuario. deleteMany es idempotente por naturaleza:
 * si no existía el registro Follow, no lanza (a diferencia de delete con
 * una where única que exigiría hacer un findUnique primero).
 */
export async function unfollowUser(targetUserId: string) {
  const user = await requireUser();
  const followingId = idSchema.parse(targetUserId);

  await db.follow.deleteMany({
    where: { followerId: user.id, followingId },
  });

  revalidateFollowPaths(followingId);
}
