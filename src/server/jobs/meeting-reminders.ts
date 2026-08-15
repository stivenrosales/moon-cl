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
 * Resultado de un intento de envío. Tres estados DISTINTOS a propósito:
 * "sin-credenciales" (dev/local sin AUTH_RESEND_KEY) no es un fallo de
 * envío y no debe ensuciar el reporte de errores del cron, pero tampoco es
 * un éxito — no se avisó a nadie.
 */
type ResultadoEnvio =
  | { estado: "enviado"; enviados: number }
  | { estado: "sin-credenciales" }
  | { estado: "fallido"; motivo: string };

/**
 * Recordatorio de reunión: busca Meetings cuyo startsAt cae dentro de las
 * próximas 24h y que todavía no fueron recordadas (remindedAt null), junta
 * los RSVP con status YES y les envía un email (batch si hay más de uno).
 * Marca remindedAt SOLO tras enviar con éxito (o si no había a quién avisar),
 * así una reunión cuyo envío falla se reintenta en el próximo cron.
 *
 * Ese "solo tras enviar con éxito" fue durante un tiempo mentira: el job
 * marcaba remindedAt pasara lo que pasara porque el SDK de Resend NO lanza
 * ante un error de la API (devuelve { data, error }) y nadie miraba `error`.
 * Una reunión cuyo correo rebotaba quedaba marcada como recordada para
 * siempre y jamás se reintentaba. No vuelvas a mover el update fuera del
 * chequeo de `estado`.
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
  const fallos: Array<{ meetingId: string; motivo: string }> = [];
  let sinCredenciales = false;

  for (const meeting of meetings) {
    const recipients = meeting.rsvps
      .map((r) => r.user.email)
      .filter((email): email is string => !!email);

    if (recipients.length > 0) {
      const envio = await sendReminderEmails(meeting, recipients);

      if (envio.estado === "fallido") {
        // No se marca remindedAt: la reunión queda pendiente y el cron de
        // mañana la reintenta (mientras siga dentro de la ventana de 24h).
        fallos.push({ meetingId: meeting.id, motivo: envio.motivo });
        continue;
      }

      if (envio.estado === "sin-credenciales") {
        // Tampoco se marca — no se avisó a nadie — pero no es un fallo de
        // envío: en dev/local es lo esperado y no debe reportarse como error.
        sinCredenciales = true;
        continue;
      }

      emailsSent += envio.enviados;
    }

    // Una reunión sin ningún RSVP YES sí se marca: no hay a quién avisar,
    // dejarla pendiente la haría reaparecer en cada corrida hasta que pase.
    await db.meeting.update({
      where: { id: meeting.id },
      data: { remindedAt: now },
    });
    reminded++;
  }

  return { reminded, emailsSent, fallos, sinCredenciales };
}

async function sendReminderEmails(
  meeting: ReminderMeeting,
  recipients: string[],
): Promise<ResultadoEnvio> {
  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) return { estado: "sin-credenciales" }; // dev/local: no rompe el job, solo no envía

  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM ?? "Moon Club <onboarding@resend.dev>";
  const subject = `Recordatorio: "${meeting.title}" es en menos de 24h`;
  const html = buildMeetingReminderHtml({ meeting });
  const text = buildMeetingReminderText({ meeting });

  try {
    // El SDK de Resend no lanza ante un error de la API: devuelve
    // { data, error } (CreateEmailResponse / CreateBatchResponse). Hay que
    // desestructurar `error` sí o sí — mismo patrón que sendMagicLinkEmail
    // en src/lib/email.ts. batch.send tampoco reporta fallos por
    // destinatario: su error es de la request entera, todo o nada.
    const { error } =
      recipients.length === 1
        ? await resend.emails.send({ from, to: recipients[0], subject, html, text })
        : await resend.batch.send(recipients.map((to) => ({ from, to, subject, html, text })));

    if (error) return { estado: "fallido", motivo: `${error.name}: ${error.message}` };
    return { estado: "enviado", enviados: recipients.length };
  } catch (error) {
    // Por red/timeout el SDK sí puede lanzar. Se traduce al mismo estado
    // para que una reunión con problemas no aborte el loop y deje sin
    // recordatorio a todas las demás de la corrida.
    return {
      estado: "fallido",
      motivo: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
