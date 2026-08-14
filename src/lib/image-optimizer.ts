/**
 * Optimiza en el navegador la portada de un libro antes de subirla al
 * storage: una foto de celular de varios MB no debería viajar tal cual a
 * R2. Se hace en el cliente y no en el servidor porque el VPS ya corre
 * ~19 contenedores y no tiene RAM de sobra para procesar imágenes.
 */

/** Ancho máximo de una portada: no hace falta más para mostrarla en la UI. */
export const ANCHO_MAXIMO_PORTADA = 600;

const CALIDAD_WEBP = 0.82;

/** ¿Es un número usable para calcular una dimensión (finito y mayor que cero)? */
function esNumeroPositivo(valor: number): boolean {
  return Number.isFinite(valor) && valor > 0;
}

/**
 * Calcula las dimensiones finales de una portada dado un ancho máximo.
 *
 * Pura y sin DOM a propósito: es la parte testeable de este módulo.
 */
export function calcularDimensiones(
  anchoOriginal: number,
  altoOriginal: number,
  anchoMaximo: number,
): { ancho: number; alto: number } {
  // Sin un ancho/alto original válido no hay proporción de la que partir.
  // En la práctica esto no debería pasar (anchoOriginal/altoOriginal salen
  // de un createImageBitmap real, que siempre da enteros positivos), pero
  // la función es pura y debe responder algo dibujable en vez de propagar
  // NaN hacia canvas.width/height. El mínimo coherente es 1x1: un pixel es
  // peor que nada, pero no rompe el dibujado ni el toBlob posterior.
  if (!esNumeroPositivo(anchoOriginal) || !esNumeroPositivo(altoOriginal)) {
    return { ancho: 1, alto: 1 };
  }

  // Un anchoMaximo inválido no es un límite utilizable: se interpreta como
  // "sin límite" y se devuelve la imagen tal cual, igual que cuando ya es
  // más chica que el máximo.
  if (!esNumeroPositivo(anchoMaximo) || anchoOriginal <= anchoMaximo) {
    return { ancho: Math.round(anchoOriginal), alto: Math.round(altoOriginal) };
  }

  const proporcion = altoOriginal / anchoOriginal;
  const altoEscalado = Math.round(anchoMaximo * proporcion);

  return {
    ancho: Math.round(anchoMaximo),
    // Una imagen extremadamente apaisada puede redondear el alto a 0, y un
    // canvas de alto 0 no es dibujable (toBlob no produce nada usable).
    alto: Math.max(1, altoEscalado),
  };
}

/** Arma el nombre final sin arrastrar la extensión original ni duplicarla. */
function renombrarConExtension(nombreOriginal: string, extension: "webp" | "jpg"): string {
  const nombreSinExtension = nombreOriginal.replace(/\.[^./\\]+$/, "");
  return `${nombreSinExtension}.${extension}`;
}

/**
 * Optimiza la portada en el navegador: la redimensiona a un ancho máximo y
 * la recodifica a WebP (o JPEG si el navegador no puede producir WebP).
 *
 * Si por lo que sea no se puede optimizar, devuelve el archivo original sin
 * lanzar: es preferible subir una imagen pesada a bloquearle a la
 * moderadora la carga del libro.
 */
export async function optimizarPortada(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    // "from-image" no es opcional: sin él, el canvas ignora la orientación
    // EXIF y las fotos tomadas con celular en vertical salen acostadas,
    // porque el sensor guarda el pixel data en landscape y delega la
    // rotación al tag EXIF que este flag es el que respeta.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const { ancho, alto } = calcularDimensiones(bitmap.width, bitmap.height, ANCHO_MAXIMO_PORTADA);

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;

    const contexto = canvas.getContext("2d");
    if (!contexto) return file;

    contexto.drawImage(bitmap, 0, 0, ancho, alto);

    const blobWebp = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", CALIDAD_WEBP);
    });
    if (blobWebp && blobWebp.type === "image/webp") {
      return new File([blobWebp], renombrarConExtension(file.name, "webp"), { type: blobWebp.type });
    }

    // El navegador no soporta codificar WebP (toBlob devolvió null o cayó
    // a otro tipo): probamos JPEG antes de rendirnos.
    const blobJpeg = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", CALIDAD_WEBP);
    });
    if (blobJpeg && blobJpeg.type === "image/jpeg") {
      return new File([blobJpeg], renombrarConExtension(file.name, "jpg"), { type: blobJpeg.type });
    }

    return file;
  } finally {
    bitmap.close();
  }
}
