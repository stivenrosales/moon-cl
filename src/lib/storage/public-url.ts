/**
 * Resuelve la URL pública de un objeto a partir de su key, uniendo con el
 * host público del storage. Pura para poder testearla sin depender de env
 * ni del cliente S3 real.
 */
export function resolverUrlPublica(baseUrl: string, key: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const keyLimpia = key.replace(/^\/+/, "");
  return `${base}/${keyLimpia}`;
}

/**
 * Inversa de resolverUrlPublica: dada una URL pública, extrae la key si
 * pertenece a nuestro storage. Devuelve null si la URL no cuelga de
 * baseUrl (p.ej. viene de un avatar de OAuth de Google) — no hay key que
 * borrar y eso no es un error.
 */
export function extraerKeyDeUrl(baseUrl: string, url: string): string | null {
  const base = baseUrl.replace(/\/+$/, "");
  if (!url.startsWith(`${base}/`)) return null;
  return url.slice(base.length + 1);
}
