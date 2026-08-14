import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { solicitudSubidaAvatarSchema } from "@/lib/validators";
import { construirKeyAvatar } from "@/lib/storage/avatar-key";
import { validarArchivoAvatar } from "@/lib/storage/avatar-validation";
import { s3StorageAdapter } from "@/lib/storage/s3-adapter";

// Subida directa a storage (R2 hoy, MinIO después) vía URL firmada: el
// archivo nunca pasa por este endpoint ni por un server action. Esto
// también evita el límite de experimental.serverActions.bodySizeLimit
// (2mb en next.config.ts) para un avatar de hasta 4MB. El cliente
// (profile-edit-dialog.tsx) pide acá la URL firmada, hace el PUT directo
// contra el storage, y recién después persiste la URL pública llamando a
// setAvatar().
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // request.json() lanza si el body no es JSON válido, y schema.parse()
  // lanza ZodError si el shape no calza (p.ej. `size` ausente o como
  // string) — ambos casos son 400, entrada de usuario mal formada, no un
  // 500 sin controlar.
  let body: ReturnType<typeof solicitudSubidaAvatarSchema.parse>;
  try {
    const json = await request.json();
    body = solicitudSubidaAvatarSchema.parse(json);
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const validacion = validarArchivoAvatar({ contentType: body.contentType, size: body.size });
  if (!validacion.valido) {
    return NextResponse.json({ error: validacion.razon }, { status: 400 });
  }

  const key = construirKeyAvatar(session.user.id, body.fileName);

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
    console.error("Error al preparar la subida del avatar", error);
    return NextResponse.json(
      { error: "No pudimos preparar la subida del avatar" },
      { status: 500 },
    );
  }
}
