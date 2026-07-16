"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { routes } from "@/lib/routes";
import { requireUser } from "@/server/auth-helpers";

export async function toggleVote(suggestionId: string) {
  const user = await requireUser();
  const parsedId = z.string().cuid().parse(suggestionId);

  const suggestion = await db.bookSuggestion.findUnique({
    where: { id: parsedId },
    include: { round: true },
  });
  if (!suggestion) throw new Error("Sugerencia no encontrada");
  if (suggestion.round.status !== "OPEN") {
    throw new Error("La ronda no está abierta para votar");
  }
  if (suggestion.round.endsAt < new Date()) {
    throw new Error("La ronda ya cerró, no se puede votar");
  }

  const existing = await db.vote.findUnique({
    where: { suggestionId_userId: { suggestionId: parsedId, userId: user.id } },
  });

  if (existing) {
    await db.vote.delete({ where: { id: existing.id } });
  } else {
    await db.vote.create({ data: { suggestionId: parsedId, userId: user.id } });
  }

  revalidatePath(routes.ronda(suggestion.roundId));
  return { voted: !existing };
}
