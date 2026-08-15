import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { LIMA_TIMEZONE } from "@/lib/lima-date";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Las tres funciones de abajo formatean en America/Lima por defecto, no en
// el huso del proceso: el contenedor corre en UTC (ningún Dockerfile,
// docker-compose ni workflow de CI fija TZ) y sin timeZone explícito
// Intl.DateTimeFormat usa ese UTC del proceso, adelantando fecha/hora entre
// las 19:00 y las 23:59 hora Lima. `opts` se aplica DESPUÉS del default a
// propósito: quien necesite otro huso (p. ej. perfil/page.tsx con el
// cumpleaños, que es @db.Date y no un instante) lo pisa pasando su propio
// `timeZone` en `opts`.

export function formatDate(date: Date | string, opts?: Intl.DateTimeFormatOptions) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: LIMA_TIMEZONE,
    ...opts,
  }).format(d);
}

export function formatDateTime(date: Date | string, opts?: Intl.DateTimeFormatOptions) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: LIMA_TIMEZONE,
    ...opts,
  }).format(d);
}

export function formatTime(date: Date | string, opts?: Intl.DateTimeFormatOptions) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: LIMA_TIMEZONE,
    ...opts,
  }).format(d);
}

export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = Date.now();
  const diff = (d.getTime() - now) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(diff / 2592000), "month");
  return rtf.format(Math.round(diff / 31536000), "year");
}

export function pageProgress(currentPage?: number | null, totalPages?: number | null) {
  if (!currentPage || !totalPages || totalPages <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100)));
}
