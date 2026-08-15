// Conteo de socias por país para la sección #miembros de /admin. Reduce en
// memoria sobre el array `users` que la página ya carga — mismo patrón
// inline que hayRondaAbierta ahí mismo, sin query nueva. Ver
// docs/superpowers/specs/2026-08-14-ciudad-pais-usuaria-design.md.

import { nombrePais } from "@/lib/paises";

export interface ConteoPais {
  codigo: string;
  nombre: string;
  cantidad: number;
}

export interface ConteoSociasPorPais {
  paises: ConteoPais[];
  /** Socias sin countryCode: cuánto falta por llenar, no un país más. */
  sinEspecificar: number;
}

/**
 * Cuenta cuántas socias hay por país. Ordena de mayor a menor cantidad y,
 * ante empate, alfabéticamente por nombre en español — para que la fila de
 * arriba sea siempre la más numerosa, no un orden arbitrario de inserción.
 */
export function contarSociasPorPais(users: { countryCode: string | null }[]): ConteoSociasPorPais {
  const conteos = new Map<string, number>();
  let sinEspecificar = 0;

  for (const { countryCode } of users) {
    if (countryCode == null) {
      sinEspecificar++;
      continue;
    }
    conteos.set(countryCode, (conteos.get(countryCode) ?? 0) + 1);
  }

  const paises = [...conteos.entries()]
    .map(([codigo, cantidad]) => ({ codigo, nombre: nombrePais(codigo) ?? codigo, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, "es"));

  return { paises, sinEspecificar };
}
