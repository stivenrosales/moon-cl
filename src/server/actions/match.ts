"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth-helpers";

/**
 * Activa/desactiva el Book Match semanal del usuario actual. No recibe el
 * valor deseado del cliente: lee el estado actual y lo invierte, así el
 * switch en profile-edit-dialog (o la card de /comunidad) no necesita
 * mantener el estado del servidor sincronizado a mano — solo llama y
 * refleja el valor que retorna.
 */
export async function toggleMatchOptIn() {
  const user = await requireUser();

  const current = await db.user.findUnique({
    where: { id: user.id },
    select: { isMatchOptIn: true },
  });

  const isMatchOptIn = !(current?.isMatchOptIn ?? false);

  await db.user.update({
    where: { id: user.id },
    data: { isMatchOptIn },
  });

  revalidatePath(routes.perfil());
  revalidatePath(routes.club());

  return { isMatchOptIn };
}
