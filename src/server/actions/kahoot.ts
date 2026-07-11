"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { idSchema, kahootActivitySchema, kahootScoresSchema } from "@/lib/validators";
import { requireAdmin, requireModerator } from "@/server/auth-helpers";

// Un solo puntaje suelto del roster de kahootScoresSchema: se reutiliza acá
// para no repetir la forma { userId, points, correctAnswers }.
const kahootScoreItemSchema = kahootScoresSchema.shape.scores.element;

// Un moderador puede registrar el resultado completo de una trivia de una
// sola vez: la actividad y los puntajes de quienes jugaron, sin obligar a
// cargar cada puntaje después uno por uno. A diferencia de kahootScoresSchema
// (pensado para el upsert individual, que exige al menos un puntaje), acá el
// arreglo es opcional: se puede crear la actividad y cargar puntajes después.
const createKahootActivityInputSchema = kahootActivitySchema.extend({
  scores: z.array(kahootScoreItemSchema).optional().default([]),
});

/**
 * Crea la actividad de Kahoot y, si vienen puntajes, los inserta con
 * createMany dentro de la misma transacción: la actividad nunca queda
 * huérfana de sus puntajes iniciales por un fallo a mitad de camino.
 */
export async function createKahootActivity(input: unknown) {
  const user = await requireModerator();
  const data = createKahootActivityInputSchema.parse(input);

  const activity = await db.$transaction(async (tx) => {
    const created = await tx.kahootActivity.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        playedAt: data.playedAt,
        meetingId: data.meetingId || null,
        creatorId: user.id,
      },
    });

    if (data.scores.length > 0) {
      await tx.kahootScore.createMany({
        data: data.scores.map((s) => ({
          activityId: created.id,
          userId: s.userId,
          points: s.points,
          correctAnswers: s.correctAnswers ?? null,
        })),
      });
    }

    return created;
  });

  revalidatePath("/puntajes");
  revalidatePath("/admin");
  return activity;
}

/**
 * Crea o corrige el puntaje de un miembro para una actividad ya existente
 * (upsert): permite tanto sumar a alguien que faltaba como corregir un
 * número mal tipeado, patrón "guarda al cambiar" igual que RoleSelect.
 */
export async function updateKahootScore(activityId: string, input: unknown) {
  await requireModerator();
  const parsedActivityId = idSchema.parse(activityId);
  const data = kahootScoresSchema.shape.scores.element.parse(input);

  await db.kahootScore.upsert({
    where: {
      activityId_userId: { activityId: parsedActivityId, userId: data.userId },
    },
    create: {
      activityId: parsedActivityId,
      userId: data.userId,
      points: data.points,
      correctAnswers: data.correctAnswers ?? null,
    },
    update: {
      points: data.points,
      correctAnswers: data.correctAnswers ?? null,
    },
  });

  revalidatePath("/puntajes");
  revalidatePath("/admin");
}

export async function deleteKahootActivity(id: string) {
  await requireAdmin();
  const parsedId = idSchema.parse(id);
  await db.kahootActivity.delete({ where: { id: parsedId } });
  revalidatePath("/puntajes");
  revalidatePath("/admin");
}
