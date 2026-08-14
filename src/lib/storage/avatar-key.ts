/**
 * Construye la key del objeto de storage para el avatar de un usuario.
 *
 * Sanitiza el nombre de archivo original: los proveedores S3-compatibles
 * (R2 hoy, MinIO en el VPS después) no garantizan un comportamiento
 * consistente con espacios, acentos o caracteres especiales dentro de una
 * key, así que solo se conservan alfanuméricos, punto y guion.
 */
export function construirKeyAvatar(userId: string, fileName: string, ahora = Date.now()): string {
  const nombreSanitizado = fileName.replace(/[^a-zA-Z0-9.-]/g, "-");
  return `avatars/${userId}-${ahora}-${nombreSanitizado}`;
}

/**
 * ¿Esta key fue generada para este usuario?
 *
 * Existe porque las URLs de avatar son públicas y viajan en el HTML de
 * cualquier perfil: el id de otra persona no es un secreto. Sin esta
 * comprobación, alguien podía guardarse la URL ajena vía setAvatar y
 * provocar que el borrado del avatar anterior se llevara el archivo de
 * otra persona.
 *
 * El guion final del prefijo no es decorativo: sin él, "user1" daría por
 * suya la key de "user10".
 */
export function keyPerteneceAUsuario(key: string, userId: string): boolean {
  return key.startsWith(`avatars/${userId}-`);
}
