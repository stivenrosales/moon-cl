// ─────────────────────────────────────────────────────────────────────────
// Lógica pura para el hilo de mensajes (Paquete B2): agrupar por día para
// pintar los divisores de fecha (pill neutral del contrato visual). Se
// ejecuta en el cliente (thread-view.tsx), así que usa Date en hora LOCAL
// a propósito — "Hoy"/"Ayer" deben reflejar el día del lector, no UTC.
// `now` es parametrizable para que los tests sean deterministas, mismo
// patrón que countRecentMessages en services/messaging.ts.
// ─────────────────────────────────────────────────────────────────────────

export interface DayGroup<T> {
  label: string;
  messages: T[];
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function capitalize(text: string): string {
  return text.length ? text[0].toUpperCase() + text.slice(1) : text;
}

/**
 * Etiqueta de un divisor de fecha: "Hoy" / "Ayer" / fecha corta ("5 de
 * enero"), con año solo si la fecha no es del año actual ("24 de
 * diciembre de 2025").
 */
export function dayLabel(date: Date, now: Date = new Date()): string {
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";

  const sameYear = date.getFullYear() === now.getFullYear();
  const formatted = new Intl.DateTimeFormat(
    "es-ES",
    sameYear
      ? { day: "numeric", month: "long" }
      : { day: "numeric", month: "long", year: "numeric" },
  ).format(date);
  return capitalize(formatted);
}

/**
 * Agrupa mensajes YA ordenados ascendentemente por createdAt (como los
 * devuelve el hilo) en bloques consecutivos por día. Si llegaran mensajes
 * fuera de orden, cada cambio de etiqueta abre un bloque nuevo — nunca se
 * re-fusiona con uno anterior ya cerrado.
 */
export function groupMessagesByDay<T extends { createdAt: Date | string }>(
  messages: T[],
  now: Date = new Date(),
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];

  for (const message of messages) {
    const date =
      typeof message.createdAt === "string" ? new Date(message.createdAt) : message.createdAt;
    const label = dayLabel(date, now);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.label === label) {
      lastGroup.messages.push(message);
    } else {
      groups.push({ label, messages: [message] });
    }
  }

  return groups;
}
