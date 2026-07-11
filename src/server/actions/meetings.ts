"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { idSchema, meetingSchema, rsvpSchema } from "@/lib/validators";
import { requireAdmin, requireUser } from "@/server/auth-helpers";

export async function createMeeting(input: unknown) {
  const user = await requireAdmin();
  const data = meetingSchema.parse(input);

  const meeting = await db.meeting.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      bookId: data.bookId ?? null,
      type: data.type,
      startsAt: data.startsAt,
      endsAt: data.endsAt ?? null,
      location: data.location ?? null,
      meetingUrl: (data.meetingUrl || null) as string | null,
      isVirtual: data.isVirtual,
      creatorId: user.id,
    },
  });

  revalidatePath("/reuniones");
  revalidatePath("/dashboard");
  if (data.bookId) revalidatePath(`/libros/${data.bookId}`);
  return meeting;
}

export async function updateMeeting(id: string, input: unknown) {
  await requireAdmin();
  const data = meetingSchema.parse(input);

  // Si la fecha de inicio cambia (reunión reprogramada), reseteamos
  // remindedAt para que el cron de recordatorios vuelva a avisar dentro
  // de las 24h previas a la nueva fecha.
  const existing = await db.meeting.findUnique({
    where: { id },
    select: { startsAt: true },
  });
  const startsAtChanged =
    !!existing && existing.startsAt.getTime() !== data.startsAt.getTime();

  await db.meeting.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description ?? null,
      bookId: data.bookId ?? null,
      type: data.type,
      startsAt: data.startsAt,
      endsAt: data.endsAt ?? null,
      location: data.location ?? null,
      meetingUrl: (data.meetingUrl || null) as string | null,
      isVirtual: data.isVirtual,
      ...(startsAtChanged ? { remindedAt: null } : {}),
    },
  });

  revalidatePath("/reuniones");
  revalidatePath(`/reuniones/${id}`);
}

export async function deleteMeeting(id: string) {
  await requireAdmin();
  const parsedId = idSchema.parse(id);

  const meeting = await db.meeting.findUnique({
    where: { id: parsedId },
    select: { bookId: true },
  });

  await db.meeting.delete({ where: { id: parsedId } });

  revalidatePath("/reuniones");
  revalidatePath("/dashboard");
  if (meeting?.bookId) revalidatePath(`/libros/${meeting.bookId}`);
}

export async function setRsvp(input: unknown) {
  const user = await requireUser();
  const data = rsvpSchema.parse(input);

  await db.rsvp.upsert({
    where: { meetingId_userId: { meetingId: data.meetingId, userId: user.id } },
    create: { meetingId: data.meetingId, userId: user.id, status: data.status },
    update: { status: data.status },
  });

  revalidatePath(`/reuniones/${data.meetingId}`);
  revalidatePath("/reuniones");
  revalidatePath("/dashboard");
}
