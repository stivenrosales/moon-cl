"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { onboardingSchema, profileUpdateSchema } from "@/lib/validators";
import { camposUbicacion, construirUbicacion } from "@/lib/ubicacion";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth-helpers";
import { extraerKeyDeUrl } from "@/lib/storage/public-url";
import { keyPerteneceAUsuario } from "@/lib/storage/avatar-key";
import { s3StorageAdapter } from "@/lib/storage/s3-adapter";

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

  // camposUbicacion() es la ÚNICA forma de producir estos tres campos:
  // nunca se arman a mano (misma doctrina que ReadingProgress + UserBook
  // en updateProgress). data.ubicacion es obligatoria acá (onboardingSchema
  // lo exige), así que siempre llega { countryCode, city }.
  const ubicacion = camposUbicacion(construirUbicacion(data.ubicacion));

  await db.user.update({
    where: { id: user.id },
    data: {
      ageConfirmedAt: new Date(),
      onboardedAt: new Date(),
      favoriteGenres: data.favoriteGenres,
      ...ubicacion,
      ...(data.name ? { name: data.name } : {}),
    },
  });

  revalidatePath(routes.hoy());
  revalidatePath(routes.perfil());
}

export async function updateProfile(input: unknown) {
  const user = await requireUser();
  const data = profileUpdateSchema.parse(input);

  // A diferencia del onboarding, acá la ubicación es opcional y nullable:
  // undefined (no se tocó el campo) y null (se borró a propósito) caen los
  // dos en construirUbicacion({}) -> "sin-ubicacion" -> los tres campos en
  // null. El formulario de perfil siempre manda el estado completo (no es
  // una escritura parcial), así que esto es correcto y no un "olvido".
  const ubicacion = camposUbicacion(construirUbicacion(data.ubicacion ?? {}));

  await db.user.update({
    where: { id: user.id },
    data: {
      name: data.name,
      bio: data.bio ?? null,
      birthday: data.birthday ?? null,
      favoriteGenres: data.favoriteGenres,
      ...ubicacion,
    },
  });

  revalidatePath(routes.perfil());
  // El directorio de /club ahora muestra la ciudad de cada socia.
  revalidatePath(routes.club());
}

export async function setAvatar(url: string) {
  const user = await requireUser();
  const parsedUrl = z.string().url().parse(url);
  const publicUrlBase = process.env.STORAGE_PUBLIC_URL;

  // Las URLs de avatar son públicas y cualquiera las ve en el HTML de un
  // perfil, así que el cliente puede mandar acá la de otra persona. Si la
  // URL cuelga de NUESTRO storage, la key tiene que ser suya; si no cuelga
  // (avatar externo de OAuth) se deja pasar como siempre.
  const keyNueva = publicUrlBase ? extraerKeyDeUrl(publicUrlBase, parsedUrl) : null;
  if (keyNueva && !keyPerteneceAUsuario(keyNueva, user.id)) {
    throw new Error("Ese avatar no te pertenece");
  }

  const previous = await db.user.findUnique({
    where: { id: user.id },
    select: { image: true },
  });

  await db.user.update({
    where: { id: user.id },
    data: { image: parsedUrl },
  });

  if (previous?.image && previous.image !== parsedUrl) {
    // extraerKeyDeUrl devuelve null si el avatar anterior no vive en
    // nuestro storage (p.ej. una URL externa de OAuth de Google) — no hay
    // key que borrar y eso no es un error. s3StorageAdapter.borrar() ya
    // absorbe el caso de que el objeto tampoco exista en el bucket.
    //
    // La comprobación de pertenencia se repite acá a propósito: filas
    // guardadas ANTES de que existiera la validación de arriba pueden
    // apuntar al archivo de otra persona, y este borrado es irreversible.
    const previousKey = publicUrlBase ? extraerKeyDeUrl(publicUrlBase, previous.image) : null;
    if (previousKey && keyPerteneceAUsuario(previousKey, user.id)) {
      await s3StorageAdapter.borrar(previousKey);
    }
  }

  revalidatePath(routes.perfil());
  return parsedUrl;
}
