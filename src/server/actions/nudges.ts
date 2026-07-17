"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { pathForScreen } from "@/lib/nudge-paths";
import { NUDGE_KEYS, NUDGE_SCREENS, type NudgeKey, type NudgeScreen } from "@/server/services/nudge-queue";
import { requireUser } from "@/server/auth-helpers";

const nudgeKeySchema = z.enum(NUDGE_KEYS);

function revalidateNudgeScreen(key: NudgeKey) {
  revalidatePath(pathForScreen(NUDGE_SCREENS[key]));
}

/**
 * Descarta una invitación: no vuelve a mostrarse. Upsert sobre
 * @@unique([userId, key]) — mismo patrón que upsertRating.
 */
export async function dismissNudge(key: NudgeKey) {
  const user = await requireUser();
  const parsedKey = nudgeKeySchema.parse(key);

  await db.userNudge.upsert({
    where: { userId_key: { userId: user.id, key: parsedKey } },
    create: { userId: user.id, key: parsedKey, dismissedAt: new Date() },
    update: { dismissedAt: new Date() },
  });

  revalidateNudgeScreen(parsedKey);
}

/**
 * Marca una invitación como ya-actuada (el usuario tomó la acción que
 * proponía): tampoco vuelve a mostrarse. Mismo upsert que dismissNudge.
 */
export async function markNudgeActed(key: NudgeKey) {
  const user = await requireUser();
  const parsedKey = nudgeKeySchema.parse(key);

  await db.userNudge.upsert({
    where: { userId_key: { userId: user.id, key: parsedKey } },
    create: { userId: user.id, key: parsedKey, actedAt: new Date() },
    update: { actedAt: new Date() },
  });

  revalidateNudgeScreen(parsedKey);
}
