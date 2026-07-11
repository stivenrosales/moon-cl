import { NextResponse } from "next/server";
import { createEvent, type DateArray } from "ics";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth-helpers";

export const dynamic = "force-dynamic";

/**
 * Descarga la reunión como .ics (RFC 5545) para agregarla a cualquier
 * calendario (Apple/Outlook/Thunderbird…). Requiere sesión: las reuniones
 * son contenido del club, no público.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
  }

  const { id } = await params;
  const meeting = await db.meeting.findUnique({ where: { id } });
  if (!meeting) {
    return NextResponse.json({ error: "Reunión no encontrada" }, { status: 404 });
  }

  const start = meeting.startsAt;
  const startArray: DateArray = [
    start.getUTCFullYear(),
    start.getUTCMonth() + 1,
    start.getUTCDate(),
    start.getUTCHours(),
    start.getUTCMinutes(),
  ];
  const durationMinutes = meeting.endsAt
    ? Math.max(15, Math.round((meeting.endsAt.getTime() - start.getTime()) / 60000))
    : 60;

  const { error, value } = createEvent({
    title: meeting.title,
    description: meeting.description ?? undefined,
    start: startArray,
    startInputType: "utc",
    startOutputType: "utc",
    duration: { minutes: durationMinutes },
    location: meeting.isVirtual ? meeting.meetingUrl ?? undefined : meeting.location ?? undefined,
    url: meeting.meetingUrl ?? undefined,
    productId: "Moon Club de Lectura",
    calName: "Moon Club de Lectura",
  });

  if (error || !value) {
    return NextResponse.json({ error: "No se pudo generar el archivo .ics" }, { status: 500 });
  }

  return new NextResponse(value, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${meeting.id}.ics"`,
    },
  });
}
