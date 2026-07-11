import { Resend } from "resend";
import { db } from "@/lib/db";
import { buildMeetingReminderHtml, buildMeetingReminderText } from "@/lib/email";

const WINDOW_MS = 24 * 60 * 60 * 1000;

type ReminderMeeting = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  meetingUrl: string | null;
  isVirtual: boolean;
  rsvps: Array<{ user: { email: string | null; name: string | null } }>;
};

/**
 * Recordatorio de reunión: busca Meetings cuyo startsAt cae dentro de las
 * próximas 24h y que todavía no fueron recordadas (remindedAt null), junta
 * los RSVP con status YES y les envía un email (batch si hay más de uno).
 * Marca remindedAt SOLO tras enviar con éxito (o si no había a quién avisar),
 * así una reunión cuyo envío falla se reintenta en el próximo cron.
 *
 * Una reunión reprogramada (updateMeeting resetea remindedAt a null cuando
 * cambia startsAt) es indistinguible aquí de una nunca recordada: si su
 * nueva fecha cae en la ventana, se vuelve a procesar con normalidad.
 *
 * Pensado para ser invocado desde el cron dispatcher diario
 * (src/app/api/cron/daily/route.ts). Recibe `now` para tests deterministas.
 */
export async function sendMeetingReminders(now: Date = new Date()) {
  const windowEnd = new Date(now.getTime() + WINDOW_MS);

  const meetings: ReminderMeeting[] = await db.meeting.findMany({
    where: {
      startsAt: { gte: now, lte: windowEnd },
      remindedAt: null,
    },
    include: {
      rsvps: {
        where: { status: "YES" },
        include: { user: { select: { email: true, name: true } } },
      },
    },
  });

  let reminded = 0;
  let emailsSent = 0;

  for (const meeting of meetings) {
    const recipients = meeting.rsvps
      .map((r) => r.user.email)
      .filter((email): email is string => !!email);

    if (recipients.length > 0) {
      await sendReminderEmails(meeting, recipients);
      emailsSent += recipients.length;
    }

    await db.meeting.update({
      where: { id: meeting.id },
      data: { remindedAt: now },
    });
    reminded++;
  }

  return { reminded, emailsSent };
}

async function sendReminderEmails(meeting: ReminderMeeting, recipients: string[]) {
  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) return; // sin key configurada (dev/local): no rompe el job, solo no envía

  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM ?? "Moon Club <onboarding@resend.dev>";
  const subject = `Recordatorio: "${meeting.title}" es en menos de 24h`;
  const html = buildMeetingReminderHtml({ meeting });
  const text = buildMeetingReminderText({ meeting });

  if (recipients.length === 1) {
    await resend.emails.send({ from, to: recipients[0], subject, html, text });
  } else {
    await resend.batch.send(
      recipients.map((to) => ({ from, to, subject, html, text })),
    );
  }
}
