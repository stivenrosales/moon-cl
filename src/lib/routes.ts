/**
 * Fuente única de rutas. Fase 1: los builders devuelven las rutas NUEVAS,
 * post-reestructuración (ver tabla de rutas del contrato de Fase 1).
 *
 * Un builder llamado SIN argumentos siempre devuelve un path pelado, porque
 * revalidatePath necesita un path: revalidatePath("/leer?vista=club") no
 * invalida "/leer". El objeto { vista } es exclusivo para el href de <Link>.
 */

type VistaLeer = "mios" | "club";
type VistaClub = "actividad" | "personas" | "frases";
type VistaAgenda = "reuniones" | "votaciones" | "trivia";

export const routes = {
  hoy: () => "/hoy",
  leer: (o?: { vista?: VistaLeer }) => (o?.vista === "club" ? "/leer?vista=club" : "/leer"),
  libro: (id: string) => `/leer/libro/${id}`,
  club: (o?: { vista?: VistaClub }) =>
    o?.vista && o.vista !== "actividad" ? `/club?vista=${o.vista}` : "/club",
  mensajes: () => "/club/mensajes",
  mensajeCon: (userId: string) => `/club/mensajes/${userId}`,
  persona: (id: string) => `/club/persona/${id}`,
  agenda: (o?: { vista?: VistaAgenda }) =>
    o?.vista && o.vista !== "reuniones" ? `/agenda?vista=${o.vista}` : "/agenda",
  reunion: (id: string) => `/agenda/reunion/${id}`,
  ronda: (id: string) => `/agenda/ronda/${id}`,
  perfil: () => "/perfil",
  admin: (ancla?: string) => (ancla ? `/admin#${ancla}` : "/admin"),
  onboarding: () => "/onboarding",
  login: () => "/login",
} as const;
