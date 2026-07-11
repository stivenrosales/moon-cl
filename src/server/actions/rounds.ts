"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { roundSchema } from "@/lib/validators";
import { requireAdmin } from "@/server/auth-helpers";
import { closeRoundTx } from "@/server/services/club";

export async function createRound(input: unknown) {
  const user = await requireAdmin();
  const data = roundSchema.parse(input);

  const now = new Date();
  let status: "SCHEDULED" | "OPEN" | "CLOSED" = "SCHEDULED";
  if (data.startsAt <= now && data.endsAt > now) status = "OPEN";
  if (data.endsAt <= now) status = "CLOSED";

  const round = await db.round.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      status,
      creatorId: user.id,
    },
  });

  revalidatePath("/rondas");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return round;
}

export async function updateRound(id: string, input: unknown) {
  await requireAdmin();
  const data = roundSchema.parse(input);

  await db.round.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
    },
  });

  revalidatePath(`/rondas/${id}`);
  revalidatePath("/rondas");
  revalidatePath("/admin");
}

export async function openRound(id: string) {
  await requireAdmin();
  const parsedId = z.string().cuid().parse(id);
  await db.round.update({ where: { id: parsedId }, data: { status: "OPEN" } });
  revalidatePath(`/rondas/${parsedId}`);
  revalidatePath("/rondas");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

/**
 * Cierre atómico de la ronda: elige ganador por votos, lo pone como lectura
 * en curso del club y archiva a los perdedores. Toda la operación corre
 * dentro de una transacción para evitar condiciones de carrera con votos
 * o sugerencias de último momento.
 */
export async function closeRound(id: string) {
  await requireAdmin();
  const parsedId = z.string().cuid().parse(id);

  const winner = await db.$transaction((tx) => closeRoundTx(tx, parsedId));

  revalidatePath(`/rondas/${parsedId}`);
  revalidatePath("/rondas");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/biblioteca");
  if (winner) revalidatePath(`/libros/${winner.bookId}`);
}

export async function deleteRound(id: string) {
  await requireAdmin();
  const parsedId = z.string().cuid().parse(id);
  await db.round.delete({ where: { id: parsedId } });
  revalidatePath("/rondas");
  revalidatePath("/admin");
}

/**
 * Atomic: cierra la ronda (si no está cerrada), marca este libro como ganador
 * y lo pone como lectura en curso (FINISHing cualquier libro previo en curso).
 * Pensado para que el admin apruebe la lectura desde la propia vista de ronda.
 */
export async function chooseRoundWinner(suggestionId: string) {
  await requireAdmin();
  const parsedId = z.string().cuid().parse(suggestionId);

  const suggestion = await db.bookSuggestion.findUnique({
    where: { id: parsedId },
    select: { id: true, bookId: true, roundId: true },
  });
  if (!suggestion) throw new Error("Sugerencia no encontrada");

  await db.$transaction((tx) =>
    closeRoundTx(tx, suggestion.roundId, suggestion.bookId),
  );

  revalidatePath(`/rondas/${suggestion.roundId}`);
  revalidatePath("/rondas");
  revalidatePath("/dashboard");
  revalidatePath("/biblioteca");
  revalidatePath(`/libros/${suggestion.bookId}`);
  revalidatePath("/admin");
}
