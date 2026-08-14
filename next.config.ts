import type { NextConfig } from "next";

import { getLegacyRedirects } from "./src/lib/legacy-redirects";

/**
 * Host público del storage de avatares, leído de env en vez de hardcodeado.
 *
 * R2 es temporal (el plan es MinIO en el VPS), así que cambiar de proveedor
 * debe ser cambiar una variable de entorno, no editar este archivo. Si la
 * env no está, no se agrega patrón: mejor que <Image> falle en desarrollo a
 * que un `**` comodín permita cargar imágenes desde cualquier host.
 */
type RemotePatterns = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>;

function avatarRemotePatterns(): RemotePatterns {
  const publicUrl = process.env.STORAGE_PUBLIC_URL;
  if (!publicUrl) return [];

  try {
    const { protocol, hostname } = new URL(publicUrl);
    return [{ protocol: protocol.replace(":", "") as "http" | "https", hostname }];
  } catch {
    throw new Error(`STORAGE_PUBLIC_URL no es una URL válida: "${publicUrl}"`);
  }
}

const nextConfig: NextConfig = {
  // El deploy dejó de ser Vercel: la imagen de Docker copia .next/standalone,
  // que trae su propio server.js y solo las dependencias que el build detectó.
  // Sin esto habría que meter node_modules entero en la imagen.
  output: "standalone",
  async redirects() {
    return getLegacyRedirects();
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "books.google.com" },
      { protocol: "https", hostname: "books.googleusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "covers.openlibrary.org" },
      { protocol: "http", hostname: "books.google.com" },
      // Editores y minoristas comunes (admins pueden pegar URLs)
      { protocol: "https", hostname: "**.amazon.com" },
      { protocol: "https", hostname: "**.media-amazon.com" },
      { protocol: "https", hostname: "**.ssl-images-amazon.com" },
      { protocol: "https", hostname: "**.casadellibro.com" },
      { protocol: "https", hostname: "**.kobo.com" },
      { protocol: "https", hostname: "**.bookcover.longitood.com" },
      { protocol: "https", hostname: "imagessl.casadellibro.com" },
      { protocol: "https", hostname: "imagessl0.casadellibro.com" },
      { protocol: "https", hostname: "imagessl1.casadellibro.com" },
      { protocol: "https", hostname: "imagessl2.casadellibro.com" },
      { protocol: "https", hostname: "imagessl3.casadellibro.com" },
      { protocol: "https", hostname: "imagessl4.casadellibro.com" },
      { protocol: "https", hostname: "static.fnac-static.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "https", hostname: "i.gr-assets.com" },
      { protocol: "https", hostname: "images.gr-assets.com" },
      // Avatares de usuario. El storage vive detrás de una abstracción
      // (src/lib/storage/) porque R2 es temporal: el plan es mover a MinIO
      // en el VPS. Por eso el patrón se lee de env y no se hardcodea acá —
      // cambiar de proveedor no debe obligar a tocar next.config.ts.
      ...avatarRemotePatterns(),
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
