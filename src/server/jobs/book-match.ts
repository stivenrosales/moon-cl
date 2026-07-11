import { Resend } from "resend";
import { db } from "@/lib/db";
import { buildBookMatchHtml, buildBookMatchText } from "@/lib/email";
import { computeAffinity, loadAffinityData, type AffinityResult } from "@/server/services/affinity";

const MATCH_TIMEZONE = "America/Lima";
const RECENT_WEEKS = 4;
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function limaDateParts(now: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: MATCH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}

function limaWeekday(now: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: MATCH_TIMEZONE, weekday: "short" });
  return WEEKDAY_INDEX[formatter.format(now)];
}

/**
 * ¿"now" cae en lunes según la hora de pared en America/Lima? Mismo patrón
 * que limaDayMonth en jobs/birthdays.ts: Intl con timeZone en vez de
 * aritmética manual con getUTC*, para no depender de date-fns-tz (no está
 * instalado y el paquete pide no sumar dependencias nuevas).
 */
export function isMondayInLima(now: Date): boolean {
  return limaWeekday(now) === 1;
}

/**
 * Lunes de la semana de "now" en America/Lima, como fecha "flotante" a
 * medianoche UTC (mismo formato que usa la columna @db.Date de
 * Match.weekOf). Sirve tanto al job (now siempre es lunes cuando corre,
 * así que retorna el mismo día) como a cualquier lector que necesite
 * ubicar "la semana de match actual" en otro día — p.ej. la card de
 * /comunidad, que se renderiza cualquier día de la semana.
 */
export function currentMatchWeekOf(now: Date): Date {
  const { year, month, day } = limaDateParts(now);
  const today = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (limaWeekday(now) + 6) % 7; // lunes=0 … domingo=6
  today.setUTCDate(today.getUTCDate() - daysSinceMonday);
  return today;
}

/** Clave normalizada de un par de usuarios: (a,b) y (b,a) son la misma pareja. */
export function pairKey(userAId: string, userBId: string): string {
  return [userAId, userBId].sort().join("::");
}

export interface ScoredPair {
  userAId: string;
  userBId: string;
  score: number;
}

/**
 * Empareja usuarios de forma greedy: ordena los pares candidatos de mayor a
 * menor afinidad y va confirmando el de mayor score cuyos dos integrantes
 * sigan libres y cuya pareja no se haya repetido en las últimas
 * RECENT_WEEKS semanas (recentPairs, claves normalizadas con pairKey).
 * Quien queda sin pareja (cantidad impar de candidatos, o ya se agotaron
 * sus combinaciones válidas) simplemente no recibe Match esta semana —
 * nunca se fuerza una pareja de relleno.
 *
 * Función pura y testeable — no toca la base de datos.
 */
export function pairUsers(scores: ScoredPair[], recentPairs: ReadonlySet<string> = new Set()): ScoredPair[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const taken = new Set<string>();
  const matches: ScoredPair[] = [];

  for (const candidate of sorted) {
    if (taken.has(candidate.userAId) || taken.has(candidate.userBId)) continue;
    if (recentPairs.has(pairKey(candidate.userAId, candidate.userBId))) continue;
    taken.add(candidate.userAId);
    taken.add(candidate.userBId);
    matches.push(candidate);
  }

  return matches;
}

type MatchUser = { id: string; name: string | null; email: string | null };

/**
 * Book Match semanal: SOLO corre los lunes en America/Lima (guard de zona
 * horaria en vez de un cron nuevo — Vercel Hobby permite máx. 2 crons y ya
 * están ocupados; ver src/app/api/cron/daily/route.ts, que llama a este job
 * todos los días pero aquí se descarta si no es lunes). Toma a quienes
 * activaron isMatchOptIn, calcula la afinidad honesta de cada par posible
 * (computeAffinity — los pares sin ninguna señal quedan fuera, la afinidad
 * jamás se inventa), empareja greedy evitando repetir pareja de las
 * últimas 4 semanas, guarda un Match por pareja confirmada y le avisa a
 * ambos por correo. Sin pareja esta semana (impar, o afinidad nula con
 * todo el resto): no recibe nada, no se fuerza.
 *
 * Pensado para ser invocado desde el cron dispatcher diario. Recibe `now`
 * para tests deterministas.
 */
export async function runBookMatch(now: Date = new Date()) {
  if (!isMondayInLima(now)) {
    return { skipped: true as const, reason: "no es lunes en America/Lima" };
  }

  const optedIn: MatchUser[] = await db.user.findMany({
    where: { isMatchOptIn: true },
    select: { id: true, name: true, email: true },
  });

  if (optedIn.length < 2) {
    return { skipped: true as const, reason: "menos de dos personas con Book Match activo" };
  }

  const weekOf = currentMatchWeekOf(now);
  const recentSince = new Date(weekOf);
  recentSince.setUTCDate(recentSince.getUTCDate() - RECENT_WEEKS * 7);

  const userIds = optedIn.map((u) => u.id);

  const [affinityData, recentMatches] = await Promise.all([
    loadAffinityData(userIds),
    db.match.findMany({
      where: { weekOf: { gte: recentSince, lt: weekOf } },
      select: { userAId: true, userBId: true },
    }),
  ]);

  const recentPairs = new Set(recentMatches.map((m) => pairKey(m.userAId, m.userBId)));

  const scores: ScoredPair[] = [];
  const affinityByPair = new Map<string, AffinityResult>();

  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      const a = affinityData.get(userIds[i]);
      const b = affinityData.get(userIds[j]);
      if (!a || !b) continue;

      const affinity = computeAffinity(a, b);
      if (!affinity) continue; // sin ninguna señal: no se fuerza el match

      scores.push({ userAId: userIds[i], userBId: userIds[j], score: affinity.score });
      affinityByPair.set(pairKey(userIds[i], userIds[j]), affinity);
    }
  }

  const matches = pairUsers(scores, recentPairs);
  const usersById = new Map(optedIn.map((u) => [u.id, u]));

  let emailsSent = 0;
  for (const match of matches) {
    await db.match.create({
      data: { userAId: match.userAId, userBId: match.userBId, weekOf, score: match.score },
    });

    const affinity = affinityByPair.get(pairKey(match.userAId, match.userBId));
    const userA = usersById.get(match.userAId);
    const userB = usersById.get(match.userBId);
    if (!affinity || !userA || !userB) continue;

    emailsSent += await sendMatchEmails(userA, userB, affinity);
  }

  return { skipped: false as const, weekOf, matched: matches.length, emailsSent };
}

async function sendMatchEmails(userA: MatchUser, userB: MatchUser, affinity: AffinityResult) {
  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) return 0; // sin key configurada (dev/local): no rompe el job, solo no envía

  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM ?? "Moon Club <onboarding@resend.dev>";
  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";

  const payloads = [
    { to: userA, other: userB },
    { to: userB, other: userA },
  ]
    .filter((pair): pair is { to: MatchUser & { email: string }; other: MatchUser } => !!pair.to.email)
    .map(({ to, other }) => ({
      from,
      to: to.email,
      subject: `Tu Book Match de esta semana: ${other.name ?? "alguien del club"}`,
      html: buildBookMatchHtml({ otherName: other.name, affinity, ctaUrl: `${baseUrl}/mensajes/${other.id}` }),
      text: buildBookMatchText({ otherName: other.name, affinity, ctaUrl: `${baseUrl}/mensajes/${other.id}` }),
    }));

  if (payloads.length === 0) return 0;
  if (payloads.length === 1) {
    await resend.emails.send(payloads[0]);
    return 1;
  }
  await resend.batch.send(payloads);
  return payloads.length;
}
