"use server";

import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { z } from "zod";
import { db } from "@/lib/db";
import { onboardingSchema, profileUpdateSchema } from "@/lib/validators";
import { requireUser } from "@/server/auth-helpers";

// El paso 1 del onboarding también captura el nombre, pero onboardingSchema
// (compartido en validators.ts) solo valida el consentimiento 18+ y los
// géneros — el nombre se compone acá localmente para no ensuciar el schema
// exportado con un campo que updateProfile ya cubre.
const completeOnboardingInputSchema = onboardingSchema.extend({
  name: z.string().min(2).max(60).optional(),
});

export async function completeOnboarding(input: unknown) {
  const user = await requireUser();
  const data = completeOnboardingInputSchema.parse(input);

  await db.user.update({
    where: { id: user.id },
    data: {
      ageConfirmedAt: new Date(),
      onboardedAt: new Date(),
      favoriteGenres: data.favoriteGenres,
      ...(data.name ? { name: data.name } : {}),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/perfil");
}

export async function updateProfile(input: unknown) {
  const user = await requireUser();
  const data = profileUpdateSchema.parse(input);

  await db.user.update({
    where: { id: user.id },
    data: {
      name: data.name,
      bio: data.bio ?? null,
      birthday: data.birthday ?? null,
      favoriteGenres: data.favoriteGenres,
    },
  });

  revalidatePath("/perfil");
}

export async function setAvatar(url: string) {
  const user = await requireUser();
  const parsedUrl = z.string().url().parse(url);

  const previous = await db.user.findUnique({
    where: { id: user.id },
    select: { image: true },
  });

  await db.user.update({
    where: { id: user.id },
    data: { image: parsedUrl },
  });

  if (previous?.image && previous.image !== parsedUrl) {
    try {
      await del(previous.image);
    } catch {
      // No-fatal: el avatar anterior puede no existir en Blob (p.ej. era
      // una URL externa de OAuth) o ya haber sido borrado. No bloquea el
      // guardado del nuevo avatar.
    }
  }

  revalidatePath("/perfil");
  return parsedUrl;
}
