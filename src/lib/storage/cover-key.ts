/**
 * Construye la key del objeto de storage para la portada de un libro.
 *
 * Sanitiza el nombre de archivo original: los proveedores S3-compatibles
 * (R2 hoy, MinIO en el VPS después) no garantizan un comportamiento
 * consistente con espacios, acentos o caracteres especiales dentro de una
 * key, así que solo se conservan alfanuméricos, punto y guion.
 *
 * A propósito NO hay un `construirKeyPortada(userId, ...)` ni un
 * `keyPerteneceAUsuario` equivalente al de avatares: una portada no tiene
 * dueño, es del catálogo compartido (ver CLAUDE.md, sección Storage). Su
 * permiso se controla en el endpoint (moderadora o superior), no atando la
 * key a quién la subió.
 */
export function construirKeyPortada(fileName: string, ahora = Date.now()): string {
  const nombreSanitizado = fileName.replace(/[^a-zA-Z0-9.-]/g, "-");
  return `covers/${ahora}-${nombreSanitizado}`;
}
