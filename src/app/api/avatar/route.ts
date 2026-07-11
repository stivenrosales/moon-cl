import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await getSession();
        if (!session?.user?.id) {
          throw new Error("No autorizado");
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
      // NOTA: este callback NO se dispara en localhost — Vercel Blob solo
      // llama al webhook de onUploadCompleted contra despliegues públicos
      // (necesita alcanzar la URL de vuelta). En dev, profile-edit-dialog.tsx
      // persiste la URL llamando a setAvatar() explícitamente tras el
      // upload, así el flujo funciona en ambos entornos.
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) return;
        const { userId } = JSON.parse(tokenPayload) as { userId: string };
        await db.user.update({
          where: { id: userId },
          data: { image: blob.url },
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al subir el avatar";
    const status = message === "No autorizado" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
