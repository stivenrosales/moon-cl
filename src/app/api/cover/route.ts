import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isModeratorOrAbove } from "@/lib/permissions";
import { solicitudSubidaPortadaSchema } from "@/lib/validators";
import { construirKeyPortada } from "@/lib/storage/cover-key";
import { validarArchivoPortada } from "@/lib/storage/cover-validation";
import { s3StorageAdapter } from "@/lib/storage/s3-adapter";

// Subida directa a storage (R2 hoy, MinIO después) vía URL firmada, mismo
// patrón que /api/avatar: el archivo nunca pasa por este endpoint ni por un
// server action, así que tampoco choca con el límite de
// experimental.serverActions.bodySizeLimit (2mb en next.config.ts). El
// cliente del flujo de /admin pide acá la URL firmada, hace el PUT directo
// contra el storage, y recién después manda publicUrl al formulario de
// creación del libro.
//
// A diferencia del avatar, esto no es "cualquier usuaria": una portada es
// del catálogo, no de una persona, así que el permiso es de moderación, no
// de sesión simple.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isModeratorOrAbove(session.user.role)) {
    return NextResponse.json({ error: "No tienes permisos para esta acción" }, { status: 403 });
  }

  // request.json() lanza si el body no es JSON válido, y schema.parse()
  // lanza ZodError si el shape no calza (p.ej. `size` ausente o como
  // string) — ambos casos son 400, entrada de usuario mal formada, no un
  // 500 sin controlar.
  let body: ReturnType<typeof solicitudSubidaPortadaSchema.parse>;
  try {
    const json = await request.json();
    body = solicitudSubidaPortadaSchema.parse(json);
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const validacion = validarArchivoPortada({ contentType: body.contentType, size: body.size });
  if (!validacion.valido) {
    return NextResponse.json({ error: validacion.razon }, { status: 400 });
  }

  const key = construirKeyPortada(body.fileName);

  try {
    const uploadUrl = await s3StorageAdapter.crearUrlDeSubida({
      key,
      contentType: body.contentType,
      // Firmado, no cosmético: ver el comentario en StorageAdapter.crearUrlDeSubida.
      contentLength: body.size,
    });
    const publicUrl = s3StorageAdapter.resolverUrlPublica(key);
    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (error) {
    // El detalle se queda en el log del servidor: los errores del SDK de S3
    // traen endpoint y bucket en el mensaje, y devolvérselos a quien golpea
    // el endpoint es entregarle el mapa del storage. Afuera va algo genérico.
    console.error("Error al preparar la subida de la portada", error);
    return NextResponse.json(
      { error: "No pudimos preparar la subida de la portada" },
      { status: 500 },
    );
  }
}
