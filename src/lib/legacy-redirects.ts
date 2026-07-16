/**
 * Redirects de la reestructuración de rutas (Fase 1). Todas van con 307
 * (permanent: false) a propósito: un 308 lo cachea el navegador para
 * siempre y si la hipótesis de nomenclatura sale mal en Fase 4 no hay
 * marcha atrás. Se promueven a 308 cuando los datos lo confirmen.
 *
 * Estáticas antes que sus hijas dinámicas (/reuniones antes de
 * /reuniones/:id, /rondas antes de /rondas/:id): no cambia la resolución
 * de Next (los patrones no se solapan porque exigen un segmento propio),
 * pero deja la tabla legible en el mismo orden en que se recorre.
 *
 * /perfil (exacto) y /admin NO están acá: ninguno cambió de ruta.
 */

export interface LegacyRedirect {
  source: string;
  destination: string;
  permanent: false;
}

export function getLegacyRedirects(): LegacyRedirect[] {
  return [
    { source: "/dashboard", destination: "/hoy", permanent: false },
    { source: "/mi-biblioteca", destination: "/leer", permanent: false },
    { source: "/biblioteca", destination: "/leer?vista=club", permanent: false },
    { source: "/comunidad", destination: "/club", permanent: false },
    { source: "/miembros", destination: "/club?vista=personas", permanent: false },
    { source: "/mensajes", destination: "/club/mensajes", permanent: false },
    { source: "/reuniones", destination: "/agenda", permanent: false },
    { source: "/rondas", destination: "/agenda?vista=votaciones", permanent: false },
    { source: "/puntajes", destination: "/agenda?vista=trivia", permanent: false },
    { source: "/libros/:id", destination: "/leer/libro/:id", permanent: false },
    { source: "/mensajes/:userId", destination: "/club/mensajes/:userId", permanent: false },
    { source: "/perfil/:id", destination: "/club/persona/:id", permanent: false },
    { source: "/reuniones/:id", destination: "/agenda/reunion/:id", permanent: false },
    { source: "/rondas/:id", destination: "/agenda/ronda/:id", permanent: false },
  ];
}
