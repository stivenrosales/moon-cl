import type { NudgeKey } from "@/server/services/nudge-queue";
import { routes } from "@/lib/routes";

// ─────────────────────────────────────────────────────────────────────────
// Copy + resolución de acción de cada nudge, separado de nudge-card.tsx
// para que sea puro y testeable sin DOM ni Prisma — mismo patrón que
// buildNudgeQueue en services/nudge-queue.ts. nudge-card.tsx importa esto
// y solo se encarga de la mecánica (Card, botones, llamadas a las actions).
// ─────────────────────────────────────────────────────────────────────────

/** Datos dinámicos para interpolar el copy y resolver el destino del CTA.
 * Todo opcional: si la página no puede resolver algo, se cae a un fallback
 * genérico en vez de romper el render. */
export interface NudgeCardContext {
  /** Título del libro actual del club — bienvenida. */
  libro?: string;
  /** id de ese libro — bienvenida (crea el UserBook READING inline). */
  libroId?: string;
  /** id del primer libro que el usuario terminó — primer-rating. */
  libroTerminadoId?: string;
  /** Nombre de la persona a la que escribirle — primer-mensaje. */
  persona?: string;
  /** id de esa persona — primer-mensaje. */
  personaId?: string;
  /** Título del libro que ambos leyeron — primer-mensaje. */
  libroEnComun?: string;
  /** id de la ronda abierta — sugerir. */
  roundId?: string;
}

export interface NudgeCopy {
  kicker: string | null;
  /** null solo para "sugerir": va inline, sin título propio. */
  title: string | null;
  /** true cuando el título va en hand-script (bienvenida, primer-rating). */
  titleScript: boolean;
  body: string;
  cta: string;
}

export function resolveNudgeCopy(key: NudgeKey, ctx: NudgeCardContext = {}): NudgeCopy {
  switch (key) {
    case "bienvenida":
      return {
        kicker: "BIENVENIDA AL CLUB",
        title: "Empieza por un libro",
        titleScript: true,
        body: `El club está leyendo ${ctx.libro ?? "el libro del club"}. Ponlo en tu estantería y te vamos siguiendo el paso.`,
        cta: "Lo voy a leer",
      };
    case "primer-progreso":
      return {
        kicker: "UN NÚMERO Y YA",
        title: "Cuéntanos por dónde vas",
        titleScript: false,
        body: "La página y el capítulo son lo que mueve todo: tu barra, tu racha, y las salas del foro que se te abren.",
        cta: "Marcar mi avance",
      };
    case "primer-rating":
      return {
        kicker: "TU PRIMER LIBRO CERRADO",
        title: "¿Qué te pareció?",
        titleScript: true,
        body: "Ponle estrellas y queda en la memoria del club — otros lo van a leer por lo que tú digas.",
        cta: "Calificarlo",
      };
    case "book-match":
      return {
        kicker: "YA SABEMOS QUÉ TE GUSTA",
        title: "Hay gente leyendo lo mismo que tú",
        titleScript: false,
        body: "Con tres libros calificados podemos cruzarte con quien tiene tu mismo gusto. Los viernes te presentamos a alguien.",
        cta: "Activar Book Match",
      };
    case "primer-mensaje":
      return {
        kicker: "SEGUIR ES POCO",
        title: `Escríbele a ${ctx.persona ?? "esa persona"}`,
        titleScript: false,
        body: `Los dos leyeron ${ctx.libroEnComun ?? "el mismo libro"}. Eso ya es tema de conversación.`,
        cta: "Mandar mensaje",
      };
    case "sugerir":
      return {
        kicker: null,
        title: null,
        titleScript: false,
        body: "Todavía no sugieres nada. Un libro tuyo puede terminar en la mesa de todos.",
        cta: "Sugerir un libro",
      };
  }
}

export type NudgeAction =
  | { type: "start-reading"; libroId?: string }
  | { type: "navigate"; href: string }
  | { type: "toggle-match" };

/** A qué destino/efecto lleva el CTA de cada nudge. Pura: la página resuelve
 * los ids reales (libroId, personaId, roundId) y esto solo decide el
 * comportamiento — igual que routes.ts decide el string, nunca el componente. */
export function resolveNudgeAction(key: NudgeKey, ctx: NudgeCardContext = {}): NudgeAction {
  switch (key) {
    case "bienvenida":
      return { type: "start-reading", libroId: ctx.libroId };
    case "primer-progreso":
      return { type: "navigate", href: routes.hoy() };
    case "primer-rating":
      return {
        type: "navigate",
        href: ctx.libroTerminadoId ? routes.libro(ctx.libroTerminadoId) : routes.leer(),
      };
    case "book-match":
      return { type: "toggle-match" };
    case "primer-mensaje":
      return {
        type: "navigate",
        href: ctx.personaId ? routes.mensajeCon(ctx.personaId) : routes.club({ vista: "personas" }),
      };
    case "sugerir":
      return {
        type: "navigate",
        href: ctx.roundId ? routes.ronda(ctx.roundId) : routes.agenda({ vista: "votaciones" }),
      };
  }
}
