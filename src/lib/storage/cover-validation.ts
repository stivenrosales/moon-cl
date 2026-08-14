/**
 * Resultado de validar un archivo de portada antes de autorizar la subida.
 * Discriminated union en vez de lanzar: quien llama (la route) decide cómo
 * responder (400 con el mensaje) sin necesitar try/catch.
 */
export type ValidacionArchivoPortada = { valido: true } | { valido: false; razon: string };

const TIPOS_PERMITIDOS = ["image/webp", "image/jpeg", "image/png"];
// La portada llega ya optimizada desde el navegador (ver image-optimizer.ts),
// así que 2MB es holgado: es el límite del archivo optimizado, no del
// original que la moderadora eligió.
export const TAMANO_MAXIMO_PORTADA_BYTES = 2 * 1024 * 1024; // 2MB

export function validarArchivoPortada(input: { contentType: string; size: number }): ValidacionArchivoPortada {
  if (!TIPOS_PERMITIDOS.includes(input.contentType)) {
    return { valido: false, razon: `Tipo de archivo no permitido: ${input.contentType}` };
  }
  if (input.size <= 0) {
    return { valido: false, razon: "El archivo está vacío" };
  }
  if (input.size > TAMANO_MAXIMO_PORTADA_BYTES) {
    return { valido: false, razon: "El archivo supera el máximo de 2MB" };
  }
  return { valido: true };
}
