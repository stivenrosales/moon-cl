/**
 * Nombres de los doce meses en español, indexados como los espera
 * `Date.UTC(year, monthIndex, day)`: 0 = enero.
 *
 * `timeZone: "UTC"` no es opcional: las fechas de referencia son medianoche
 * UTC del día 1, y sin fijar la zona el formateo usa la del entorno. Con
 * cualquier offset negativo —toda América— esa medianoche cae en el último
 * día del mes ANTERIOR, así que la lista salía corrida un lugar y elegir
 * "Marzo" guardaba abril. El servidor corre en UTC y por eso el desfase solo
 * aparecía en el navegador, nunca en los tests ni en el HTML del servidor.
 */
export function nombresDeMeses(): string[] {
  const formato = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, i) => formato.format(new Date(Date.UTC(2000, i, 1))));
}
