import type { NextConfig } from "next";

import { getLegacyRedirects } from "./src/lib/legacy-redirects";

const nextConfig: NextConfig = {
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
      // Avatares de usuario (Vercel Blob). Comodín porque el store id aún
      // no existe (se crea junto con BLOB_READ_WRITE_TOKEN) — acotar a
      // "<store-id>.public.blob.vercel-storage.com" cuando exista.
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
