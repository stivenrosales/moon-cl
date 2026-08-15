// Núcleo puro de ubicación (ciudad + país) de una usuaria. Sin Postgres, sin
// mocks: toda la lógica vive acá y se testea sin tocar la base. Ver
// docs/superpowers/specs/2026-08-14-ciudad-pais-usuaria-design.md.

/**
 * La ubicación de una usuaria modelada como unión discriminada, no como tres
 * opcionales sueltos. Con esta forma "ciudad sin país" es imposible de
 * escribir, no algo que se detecta después — misma doctrina que
 * EstadoBusqueda separando "resultados" de "sin-resultados" en
 * book-search-state.ts.
 */
export type Ubicacion =
  | { tipo: "sin-ubicacion" }
  | { tipo: "solo-pais"; countryCode: string }
  | { tipo: "completa"; countryCode: string; city: string; citySlug: string };

/**
 * Normaliza un nombre de ciudad a un slug para agrupar y filtrar: trim ->
 * minúsculas -> NFD sin diacríticos -> separadores colapsados en un solo
 * guion -> descarta lo que no sea [a-z0-9-] -> recorta guiones de los
 * extremos. Devuelve null si no queda nada (entrada vacía, solo espacios, o
 * solo caracteres descartados).
 */
export function slugCiudad(entrada: string | null | undefined): string | null {
  if (entrada == null) return null;

  const sinDiacriticos = entrada
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (sinDiacriticos.length === 0) return null;

  const conGuiones = sinDiacriticos.replace(/[\s_]+/g, "-");
  const soloValidos = conGuiones.replace(/[^a-z0-9-]/g, "");
  // Descartar caracteres inválidos puede dejar guiones consecutivos cuando
  // el original ya traía un guion literal junto a un espacio ("San -
  // Isidro"): se colapsan otra vez para que el separador sea siempre uno.
  const guionUnico = soloValidos.replace(/-+/g, "-");
  const recortado = guionUnico.replace(/^-+|-+$/g, "");

  return recortado.length > 0 ? recortado : null;
}

interface InputUbicacion {
  countryCode?: string | null;
  city?: string | null;
}

/**
 * Construye la Ubicacion a partir de lo que llega del formulario
 * (onboarding o edición de perfil). Sin país no hay ubicación posible: una
 * ciudad sin país no se puede agrupar, así que ese caso se colapsa a
 * "sin-ubicacion" en vez de modelar un estado inválido.
 */
export function construirUbicacion(input: InputUbicacion): Ubicacion {
  const countryCode = input.countryCode?.trim().toUpperCase() || null;
  if (countryCode == null) return { tipo: "sin-ubicacion" };

  const cityTrimmed = input.city?.trim() ?? "";
  const citySlug = slugCiudad(cityTrimmed);
  if (citySlug == null) return { tipo: "solo-pais", countryCode };

  // La ciudad se guarda tal como la escribió ella (con tildes), nunca el
  // slug: el slug es interno, solo para agrupar y filtrar.
  return { tipo: "completa", countryCode, city: cityTrimmed, citySlug };
}

/**
 * Única forma de producir el objeto que va al db.user.update. Nadie arma
 * estos tres campos a mano en ningún otro lugar del código. Preserva la
 * invariante: nunca city sin citySlug, y nunca una ciudad sin countryCode.
 * Preserva null vs "": null significa "nunca lo dijo", jamás cadena vacía.
 */
export function camposUbicacion(u: Ubicacion): {
  countryCode: string | null;
  city: string | null;
  citySlug: string | null;
} {
  switch (u.tipo) {
    case "sin-ubicacion":
      return { countryCode: null, city: null, citySlug: null };
    case "solo-pais":
      return { countryCode: u.countryCode, city: null, citySlug: null };
    case "completa":
      return { countryCode: u.countryCode, city: u.city, citySlug: u.citySlug };
  }
}
