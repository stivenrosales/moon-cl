"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth-helpers";

export async function toggleVote(suggestionId: string) {
  const user = await requireUser();

  const suggestion = await db.bookSuggestion.findUnique({
    where: { id: suggestionId },
    include: { round: true },
  });
  if (!suggestion) throw new Error("Sugerencia no encontrada");
  if (suggestion.round.status !== "OPEN") {
    throw new Error("La ronda no está abierta para votar");
  }

  const existing = await db.vote.findUnique({
    where: { suggestionId_userId: { suggestionId, userId: user.id } },
  });

  if (existing) {
    await db.vote.delete({ where: { id: existing.id } });
  } else {
    await db.vote.create({ data: { suggestionId, userId: user.id } });
  }

  revalidatePath(`/rondas/${suggestion.roundId}`);
  return { voted: !existing };
}
