// ─────────────────────────────────────────────────────────────────────────
// Helpers de fecha en America/Lima para Server Components que formatean
// `new Date()` directo. El contenedor de producción corre en UTC (ningún
// Dockerfile, docker-compose ni workflow de CI fija TZ), así que cualquier
// Intl.DateTimeFormat o getFullYear()/getDate() SIN zona horaria explícita
// usa UTC — entre las 19:00 y las 23:59 hora Lima eso adelanta el día, la
// fecha y hasta el año al valor de "mañana" en UTC.
//
// Mismo patrón que ya usan src/server/services/today.ts (limaDayKey),
// src/server/jobs/book-match.ts (limaDateParts/limaWeekday) y
// src/server/jobs/birthdays.ts (limaDayMonth): Intl.DateTimeFormat con
// timeZone explícito, en vez de sumar date-fns-tz (no está instalado y el
// repo pide no agregar dependencias nuevas solo para esto).
// ─────────────────────────────────────────────────────────────────────────

export const LIMA_TIMEZONE = "America/Lima";

/**
 * Offset fijo de Lima respecto a UTC. Perú no usa horario de verano desde
 * 1994, así que -5 es constante los 365 días del año — mismo supuesto que
 * ya hace isBirthdayToday() en jobs/birthdays.ts para leer @db.Date sin
 * conversión. Si Perú alguna vez cambia de huso, este es el único lugar
 * que hay que tocar.
 */
const LIMA_OFFSET_HOURS = 5;

/** Año calendario según la hora de pared en Lima (no UTC). */
export function limaYear(date: Date): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: LIMA_TIMEZONE, year: "numeric" }).format(date));
}

/**
 * Instante UTC real que corresponde a la medianoche del 1 de enero en Lima
 * del año de `date` (según su hora de pared en Lima, vía limaYear()). Sirve
 * para acotar queries de Prisma sobre columnas DateTime reales (no
 * @db.Date) por "este año" sin que el corte salte al año siguiente cerca de
 * medianoche UTC — que es antes de medianoche en Lima, porque Lima va
 * detrás de UTC.
 */
export function inicioDeAnioLima(date: Date): Date {
  const year = limaYear(date);
  return new Date(Date.UTC(year, 0, 1, LIMA_OFFSET_HOURS, 0, 0, 0));
}

/**
 * "Jueves 16 de julio · 21:04" en hora de pared de Lima. La minúscula a
 * mayúscula del día de semana es manual porque Intl.DateTimeFormat siempre
 * devuelve el weekday en minúscula.
 */
export function fechaDiscretaLima(date: Date): string {
  const weekday = new Intl.DateTimeFormat("es-PE", { weekday: "long", timeZone: LIMA_TIMEZONE }).format(date);
  const dayMonth = new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "long",
    timeZone: LIMA_TIMEZONE,
  }).format(date);
  const time = new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: LIMA_TIMEZONE,
  }).format(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${dayMonth} · ${time}`;
}
