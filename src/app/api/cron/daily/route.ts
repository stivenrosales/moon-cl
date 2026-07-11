import { NextResponse } from "next/server";
import { closeExpiredRounds } from "@/server/jobs/close-expired-rounds";
import { sendMeetingReminders } from "@/server/jobs/meeting-reminders";
import { sendBirthdayGreetings } from "@/server/jobs/birthdays";
import { runBookMatch } from "@/server/jobs/book-match";

export const dynamic = "force-dynamic";

/**
 * Dispatcher diario único para todos los cron jobs del club.
 *
 * Vercel Hobby permite máximo 2 cron jobs con 1 ejecución/día, así que en
 * lugar de un route por job (cierre de rondas, cumpleaños, recordatorios de
 * reuniones, etc.) todos cuelgan de este único endpoint. Agregar un job
 * nuevo es agregar una entrada al array `jobs` de abajo.
 */
type JobDefinition = {
  name: string;
  run: () => Promise<unknown>;
};

const jobs: JobDefinition[] = [
  { name: "closeExpiredRounds", run: closeExpiredRounds },
  { name: "sendMeetingReminders", run: sendMeetingReminders },
  { name: "sendBirthdayGreetings", run: sendBirthdayGreetings },
  // Book Match semanal: se auto-descarta salvo que "hoy" sea lunes en
  // America/Lima (ver isMondayInLima en jobs/book-match.ts) — cero crons
  // nuevos, Vercel Hobby permite máx. 2 y ambos ya están ocupados.
  { name: "runBookMatch", run: runBookMatch },
];

type JobResult =
  | { name: string; ok: true; result: unknown }
  | { name: string; ok: false; error: string };

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET no está configurada en el entorno del servidor" },
      { status: 500 },
    );
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const results: JobResult[] = [];

  for (const job of jobs) {
    try {
      const result = await job.run();
      results.push({ name: job.name, ok: true, result });
    } catch (error) {
      results.push({
        name: job.name,
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  return NextResponse.json({ results });
}
