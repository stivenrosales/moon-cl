import type { NudgeKey } from "@/server/services/nudge-queue";
import type { TodayHero } from "@/server/services/today";

// ─────────────────────────────────────────────────────────────────────────
// Decide si el nudge que apunta a la pantalla "hoy" (no-inline) debe
// suprimirse porque la card héroe YA ofrece la misma acción para el mismo
// libro. Hoy en día el único nudge no-inline de "hoy" es "bienvenida", y su
// CTA ("Lo voy a leer") es exactamente la misma acción que HeroCard pinta
// cuando hero.estado === "sin-empezar" (mismo libro siempre: el contexto del
// nudge en /hoy usa hero.libro como fuente). Sin esto, ambas cards se
// apilaban una debajo de la otra ofreciendo lo mismo dos veces.
//
// Función pura — /hoy/page.tsx solo la llama con el estado ya resuelto.
// ─────────────────────────────────────────────────────────────────────────

export function shouldSuppressHeroNudge(params: {
  heroEstado: TodayHero["estado"];
  nudgeKey: NudgeKey;
}): boolean {
  return params.heroEstado === "sin-empezar" && params.nudgeKey === "bienvenida";
}
