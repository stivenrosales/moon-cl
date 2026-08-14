/**
 * Resultado de validar un archivo de avatar antes de autorizar la subida.
 * Discriminated union en vez de lanzar: quien llama (la route) decide cómo
 * responder (400 con el mensaje) sin necesitar try/catch.
 */
export type ValidacionArchivoAvatar = { valido: true } | { valido: false; razon: string };

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
export const TAMANO_MAXIMO_AVATAR_BYTES = 4 * 1024 * 1024; // 4MB

export function validarArchivoAvatar(input: { contentType: string; size: number }): ValidacionArchivoAvatar {
  if (!TIPOS_PERMITIDOS.includes(input.contentType)) {
    return { valido: false, razon: `Tipo de archivo no permitido: ${input.contentType}` };
  }
  if (input.size <= 0) {
    return { valido: false, razon: "El archivo está vacío" };
  }
  if (input.size > TAMANO_MAXIMO_AVATAR_BYTES) {
    return { valido: false, razon: "El archivo supera el máximo de 4MB" };
  }
  return { valido: true };
}
