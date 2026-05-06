"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { meetingSchema, rsvpSchema } from "@/lib/validators";
import { requireAdmin, requireUser } from "@/server/auth-helpers";

export async function createMeeting(input: unknown) {
  const user = await requireAdmin();
  const data = meetingSchema.parse(input);

  const meeting = await db.meeting.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      bookId: data.bookId ?? null,
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

  await db.meeting.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description ?? null,
      bookId: data.bookId ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt ?? null,
      location: data.location ?? null,
      meetingUrl: (data.meetingUrl || null) as string | null,
      isVirtual: data.isVirtual,
    },
  });

  revalidatePath("/reuniones");
  revalidatePath(`/reuniones/${id}`);
}

export async function deleteMeeting(id: string) {
  await requireAdmin();
  await db.meeting.delete({ where: { id } });
  revalidatePath("/reuniones");
  revalidatePath("/dashboard");
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
