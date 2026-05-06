"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { roundSchema } from "@/lib/validators";
import { requireAdmin, requireUser } from "@/server/auth-helpers";

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
  await db.round.update({ where: { id }, data: { status: "OPEN" } });
  revalidatePath(`/rondas/${id}`);
  revalidatePath("/rondas");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function closeRound(id: string) {
  await requireAdmin();
  // Calcula ganador con más votos.
  const suggestions = await db.bookSuggestion.findMany({
    where: { roundId: id },
    include: { _count: { select: { votes: true } } },
    orderBy: [{ votes: { _count: "desc" } }, { createdAt: "asc" }],
  });

  const winnerSuggestion = suggestions[0];
  await db.round.update({
    where: { id },
    data: {
      status: "CLOSED",
      winnerBookId: winnerSuggestion?.bookId ?? null,
    },
  });

  revalidatePath(`/rondas/${id}`);
  revalidatePath("/rondas");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function deleteRound(id: string) {
  await requireAdmin();
  await db.round.delete({ where: { id } });
  revalidatePath("/rondas");
  revalidatePath("/admin");
}

export async function getActiveRound() {
  await requireUser();
  return db.round.findFirst({
    where: { status: "OPEN" },
    orderBy: { endsAt: "asc" },
  });
}
