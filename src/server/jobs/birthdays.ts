import { Resend } from "resend";
import { db } from "@/lib/db";
import { buildBirthdayHtml, buildBirthdayText } from "@/lib/email";

const BIRTHDAY_TIMEZONE = "America/Lima";

/**
 * Día y mes de `date` según la hora de pared en America/Lima (UTC-5, sin
 * horario de verano). Usamos Intl.DateTimeFormat en vez de convertir a mano
 * con getUTC*: hacerlo a mano es la fuente #1 de bugs de "cumpleaños
 * anunciado un día tarde/temprano" porque el cron corre a las 12:00 UTC
 * (07:00 Lima), y cerca de la medianoche UTC el día calendario en Lima
 * puede ir un día detrás del día UTC. No se agregó date-fns-tz (no está
 * instalado y el paquete pide no sumar dependencias nuevas); Intl con
 * timeZone es nativo de Node/V8 y no requiere ninguna.
 */
export function limaDayMonth(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BIRTHDAY_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return { day, month };
}

/**
 * Compara el día/mes de `birthday` (columna @db.Date: fecha calendario
 * "flotante" guardada a medianoche UTC, sin hora real asociada — por eso
 * usamos sus componentes UTC directamente, NO una conversión de zona
 * horaria) contra el día/mes de "hoy" en America/Lima derivado de `now`.
 */
export function isBirthdayToday(birthday: Date, now: Date): boolean {
  const today = limaDayMonth(now);
  return birthday.getUTCDate() === today.day && birthday.getUTCMonth() + 1 === today.month;
}

type BirthdayUser = {
  id: string;
  name: string | null;
  email: string | null;
  birthday: Date | null;
};

/**
 * Saluda a quienes cumplen años hoy (America/Lima). El saludo es privado:
 * solo llega al cumpleañero, nunca se anuncia al resto del club — decisión
 * pendiente de confirmar con el cliente (ver docs/pendientes).
 *
 * Pensado para ser invocado desde el cron dispatcher diario
 * (src/app/api/cron/daily/route.ts). Recibe `now` para tests deterministas.
 */
export async function sendBirthdayGreetings(now: Date = new Date()) {
  const users: BirthdayUser[] = await db.user.findMany({
    where: { birthday: { not: null } },
    select: { id: true, name: true, email: true, birthday: true },
  });

  const celebrants = users.filter((u) => u.birthday && isBirthdayToday(u.birthday, now));

  let sent = 0;
  for (const user of celebrants) {
    if (!user.email) continue;
    await sendBirthdayEmail(user);
    sent++;
  }

  return { celebrants: celebrants.length, sent };
}

async function sendBirthdayEmail(user: { name: string | null; email: string | null }) {
  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey || !user.email) return; // sin key configurada (dev/local): no rompe el job, solo no envía

  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM ?? "Moon Club <onboarding@resend.dev>";

  await resend.emails.send({
    from,
    to: user.email,
    subject: "🎂 ¡Feliz cumpleaños!",
    html: buildBirthdayHtml({ name: user.name }),
    text: buildBirthdayText({ name: user.name }),
  });
}
