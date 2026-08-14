import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { resolverUrlPublica as resolverUrlPublicaPura } from "./public-url";
import type { StorageAdapter } from "./types";

// I/O aislado a propósito: esta es la única pieza del módulo que sabe que
// hoy el proveedor es R2. La lógica de dominio (keys, validación, URL
// pública) es pura y vive en archivos hermanos sin importar el SDK de AWS.
// No se testea directamente por la misma razón que src/lib/db.ts no se
// testea: es el cliente real, no una decisión.

const SEGUNDOS_EXPIRACION_URL_SUBIDA = 5 * 60;

interface ConfigStorage {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
}

// Se lee en cada llamada (no al importar el módulo) para no exigir las
// envs en tiempo de build ni en tests que no ejercitan el adaptador.
function leerConfig(): ConfigStorage {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const bucket = process.env.STORAGE_BUCKET;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  const publicUrl = process.env.STORAGE_PUBLIC_URL;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicUrl) {
    throw new Error(
      "Faltan variables de entorno de storage: STORAGE_ENDPOINT, STORAGE_BUCKET, " +
        "STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, STORAGE_PUBLIC_URL",
    );
  }

  return { endpoint, bucket, accessKeyId, secretAccessKey, publicUrl };
}

let clienteCacheado: S3Client | null = null;

function obtenerCliente(config: ConfigStorage): S3Client {
  if (!clienteCacheado) {
    clienteCacheado = new S3Client({
      // R2 y MinIO son S3-compatibles pero no tienen regiones reales;
      // "auto" evita exigir una región que acá no significa nada.
      region: "auto",
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }
  return clienteCacheado;
}

export const s3StorageAdapter: StorageAdapter = {
  async crearUrlDeSubida({ key, contentType, contentLength }) {
    const config = leerConfig();
    const cliente = obtenerCliente(config);
    // ContentLength se firma junto con el resto del comando: SigV4 lo suma
    // a X-Amz-SignedHeaders, así que el PUT real tiene que declarar ese
    // mismo Content-Length exacto o la firma no valida. Es lo que convierte
    // el límite de tamaño en algo que el storage hace cumplir, no solo el
    // cliente.
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    return getSignedUrl(cliente, command, { expiresIn: SEGUNDOS_EXPIRACION_URL_SUBIDA });
  },

  async borrar(key) {
    const config = leerConfig();
    const cliente = obtenerCliente(config);
    try {
      await cliente.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    } catch {
      // No-fatal, igual que con Vercel Blob antes: el objeto puede no
      // existir (ya borrado, o la key no era nuestra) y no debe bloquear
      // la operación que disparó el borrado.
    }
  },

  resolverUrlPublica(key) {
    const config = leerConfig();
    return resolverUrlPublicaPura(config.publicUrl, key);
  },
};
