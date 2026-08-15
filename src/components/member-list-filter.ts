// Lógica pura del filtro por ciudad de MemberList. Sigue el mismo criterio
// que el buscador por nombre que ya vive ahí: decenas de filas ya cargadas,
// no justifica una query server-side. Ver
// docs/superpowers/specs/2026-08-14-ciudad-pais-usuaria-design.md.

interface FilaConCiudad {
  citySlug: string | null;
  ciudad: string | null;
}

export interface OpcionCiudad {
  citySlug: string;
  ciudad: string;
}

/**
 * Ciudades únicas presentes en las filas ya cargadas, para armar el
 * <Select> del filtro. NO viene de un catálogo fijo ni de un groupBy contra
 * la base: son las que las propias socias declararon, dedupe por citySlug y
 * etiquetadas con el `ciudad` legible. Si nadie declaró ciudad, devuelve
 * una lista vacía — el llamador decide no pintar el selector con eso.
 */
export function opcionesCiudad(rows: FilaConCiudad[]): OpcionCiudad[] {
  const vistos = new Map<string, string>();
  for (const { citySlug, ciudad } of rows) {
    if (citySlug && ciudad && !vistos.has(citySlug)) {
      vistos.set(citySlug, ciudad);
    }
  }

  return [...vistos.entries()]
    .map(([citySlug, ciudad]) => ({ citySlug, ciudad }))
    .sort((a, b) => a.ciudad.localeCompare(b.ciudad, "es"));
}

/**
 * Filtra las filas por citySlug seleccionado. null o "" = sin filtro (todas
 * las filas), mismo criterio que el <Select> nativo usa para su opción
 * "Todas las ciudades" (value=""). Compone con el buscador de nombre: ambos
 * se aplican sobre las mismas rows, uno independiente del otro.
 */
export function filtrarPorCiudad<T extends { citySlug: string | null }>(
  rows: T[],
  citySlugSeleccionado: string | null,
): T[] {
  if (!citySlugSeleccionado) return rows;
  return rows.filter((r) => r.citySlug === citySlugSeleccionado);
}
