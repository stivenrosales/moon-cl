export interface BookCandidate {
  /** ID externo (prefijo `gb:` para Google Books, `ol:` para Open Library). */
  googleBooksId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  description: string | null;
  pageCount: number | null;
  publishedYear: number | null;
  isbn: string | null;
}

/**
 * Resultado de una búsqueda de libros. "sin resultados" (`ok` con
 * `books: []`) y "la búsqueda falló" (`error`) son estados DISTINTOS a
 * propósito.
 *
 * Antes searchBooks devolvía `BookCandidate[]` a secas: un 429 de Google
 * Books (la cuota anónima se quema rápido sin GOOGLE_BOOKS_API_KEY), un
 * timeout o un JSON inválido colapsaban al mismo array vacío que "no existe
 * ese libro", y la usuaria se iba pensando que el libro no existía cuando
 * en realidad la búsqueda se había caído.
 *
 * `degradado` marca el caso intermedio: una fuente respondió y la otra no.
 * Eso NO es un fallo — sigue siendo `ok`, solo que con menos cobertura de
 * catálogo — así que nunca se confunde con `error`. Solo es `error` cuando
 * NINGUNA de las dos fuentes pudo responder.
 */
export type BookSearchResult =
  | { status: "ok"; books: BookCandidate[]; degradado: boolean }
  | { status: "error" };

const OL_ENDPOINT = "https://openlibrary.org/search.json";
const GB_ENDPOINT = "https://www.googleapis.com/books/v1/volumes";

// Límites espejo de bookInputSchema (src/lib/validators.ts). Si allá cambian,
// acá también: este archivo es el borde por donde entran los datos externos.
const MAX_TITULO = 280;
const MAX_AUTOR = 120;
const MAX_DESCRIPCION = 8000;
const MAX_ISBN = 20;
const MAX_ID_EXTERNO = 60;
const MAX_PAGINAS = 20000;
const MAX_ANIO = 2100;

/**
 * Ajusta un candidato crudo a lo que exige bookInputSchema.
 *
 * Google Books y Open Library devuelven registros incompletos y sucios con
 * total normalidad: pageCount 0 en los volúmenes sin portada, descripciones
 * de más de 8000 caracteres, ISBN concatenados, coverUrl vacía. Nada de eso
 * pasa el schema, y como las TRES puertas de entrada de libros —crear desde
 * /admin, agregar a la estantería y sugerir en una ronda— parsean con él, un
 * candidato sucio hacía lanzar la action y la usuaria solo veía el error
 * genérico de producción, sin ninguna pista.
 *
 * El saneo va acá, en el borde, y no relajando el schema: bajarle las
 * exigencias al schema sería aceptar basura dentro de la base para siempre.
 */
export function sanearCandidato(raw: BookCandidate): BookCandidate {
  return {
    googleBooksId: raw.googleBooksId.slice(0, MAX_ID_EXTERNO),
    title: raw.title.trim().slice(0, MAX_TITULO),
    authors: raw.authors
      .map((a) => a.trim())
      .filter(Boolean)
      .map((a) => a.slice(0, MAX_AUTOR)),
    coverUrl: urlHttpValida(raw.coverUrl),
    description: textoAcotado(raw.description, MAX_DESCRIPCION),
    // 0 páginas no es un dato, es ausencia de dato: por eso colapsa a null.
    // Ojo, NO es el caso de currentPage en el progreso de lectura, donde la
    // página 0 sí es un valor legítimo y distinto de "nunca marcó avance".
    pageCount: enteroEnRango(raw.pageCount, 1, MAX_PAGINAS),
    publishedYear: enteroEnRango(raw.publishedYear, 0, MAX_ANIO),
    // Un ISBN recortado sería un identificador falso, así que se descarta
    // entero en vez de truncarlo.
    isbn: textoAcotado(raw.isbn, MAX_ISBN, { descartarSiExcede: true }),
  };
}

function urlHttpValida(valor: string | null): string | null {
  if (!valor) return null;
  try {
    const { protocol } = new URL(valor);
    return protocol === "https:" || protocol === "http:" ? valor : null;
  } catch {
    return null;
  }
}

function textoAcotado(
  valor: string | null,
  max: number,
  opts: { descartarSiExcede?: boolean } = {},
): string | null {
  if (!valor) return null;
  const limpio = valor.trim();
  if (!limpio) return null;
  if (limpio.length <= max) return limpio;
  return opts.descartarSiExcede ? null : limpio.slice(0, max);
}

function enteroEnRango(valor: number | null, min: number, max: number): number | null {
  if (valor == null || !Number.isInteger(valor) || valor < min || valor > max) return null;
  return valor;
}

/**
 * Busca libros combinando Google Books y Open Library.
 * Prioriza Google Books (metadata más rica y limpia) y rellena con Open
 * Library para mejorar cobertura de catálogo en español y libros menos
 * comerciales.
 *
 * Ver BookSearchResult: "sin resultados" y "la búsqueda falló" viajan como
 * estados distintos hasta la usuaria, y el fallo se loguea siempre —
 * también en producción, que es justo donde antes nadie se enteraba.
 */
export async function searchBooks(query: string, max = 8): Promise<BookSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { status: "ok", books: [], degradado: false };

  const [gbSettled, olSettled] = await Promise.allSettled([
    searchGoogleBooks(trimmed, max),
    searchOpenLibrary(trimmed, max),
  ]);

  const gb = resolverFuente(gbSettled, "Google Books");
  const ol = resolverFuente(olSettled, "Open Library");

  // Ninguna fuente pudo responder: esto es un fallo de la búsqueda, no
  // ausencia del libro en el catálogo. Confundir los dos es el bug original.
  if (!gb.ok && !ol.ok) {
    return { status: "error" };
  }

  const books = mezclarCandidatos(gb.ok ? gb.books : [], ol.ok ? ol.books : [], max);
  return { status: "ok", books, degradado: !gb.ok || !ol.ok };
}

/** Resultado interno de UNA fuente: no distingue "sin datos" de "falló". */
type ResultadoFuente = { ok: true; books: BookCandidate[] } | { ok: false };

function resolverFuente(
  settled: PromiseSettledResult<ResultadoFuente>,
  fuente: string,
): ResultadoFuente {
  if (settled.status === "fulfilled") return settled.value;
  // La promesa se rechazó antes de llegar a un status HTTP: timeout, DNS,
  // JSON inválido en la respuesta. Se loguea siempre, también en
  // producción — antes este aviso estaba condicionado a
  // NODE_ENV !== "production" y por eso nadie se enteraba nunca.
  // eslint-disable-next-line no-console
  console.error(`[google-books] ${fuente} falló: ${String(settled.reason)}`);
  return { ok: false };
}

/**
 * Combina resultados de ambas fuentes con dedup por ISBN (o por
 * título+autor si no hay ISBN), priorizando Google Books. Pura y
 * testeable: no toca red, solo decide sobre listas ya cargadas.
 */
export function mezclarCandidatos(
  gb: BookCandidate[],
  ol: BookCandidate[],
  max: number,
): BookCandidate[] {
  const seen = new Set<string>();
  const merged: BookCandidate[] = [];
  for (const list of [gb, ol]) {
    for (const book of list) {
      const key = (book.isbn ?? `${book.title}|${book.authors[0] ?? ""}`).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(book);
      if (merged.length >= max) return merged;
    }
  }
  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Books — fuente primaria
// ─────────────────────────────────────────────────────────────────────────────

interface GBVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  description?: string;
  pageCount?: number;
  publishedDate?: string;
  imageLinks?: {
    thumbnail?: string;
    smallThumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
    extraLarge?: string;
  };
  industryIdentifiers?: Array<{ type: string; identifier: string }>;
  language?: string;
}

interface GBVolumeItem {
  id: string;
  volumeInfo: GBVolumeInfo;
}

async function searchGoogleBooks(query: string, max: number): Promise<ResultadoFuente> {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(Math.min(40, Math.max(1, max + 4))),
    printType: "books",
  });
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    params.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  }

  const res = await fetch(`${GB_ENDPOINT}?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    // Se loguea SIEMPRE, también en producción — antes esto estaba
    // condicionado a NODE_ENV !== "production" (y encima solo para 429), así
    // que nadie se enteraba de que la cuota anónima de Google Books se había
    // quemado hasta que una usuaria reportaba "no encuentro ningún libro".
    // eslint-disable-next-line no-console
    console.error(
      `[google-books] Google Books respondió ${res.status} — la fuente se descarta de la búsqueda (configura GOOGLE_BOOKS_API_KEY si es 429)`,
    );
    return { ok: false };
  }

  const data = (await res.json()) as { items?: GBVolumeItem[] };
  if (!data.items) return { ok: true, books: [] };

  const books = data.items
    .filter((it) => it.volumeInfo?.title)
    .map<BookCandidate>((item) => {
      const v = item.volumeInfo;
      const isbn =
        (v.industryIdentifiers ?? []).find(
          (i) => i.type === "ISBN_13" || i.type === "ISBN_10",
        )?.identifier ?? null;

      // Google Books ofrece miniaturas pequeñas en la API estándar, pero
      // construimos la URL "zoom=3" (medium-large, ~512px) que sí existe
      // aunque no esté listada en imageLinks. Más nítido que el thumbnail.
      const cover = pickGoogleCover(item.id, v.imageLinks);
      const year = v.publishedDate ? Number(v.publishedDate.slice(0, 4)) : null;

      return sanearCandidato({
        googleBooksId: `gb:${item.id}`,
        title: [v.title, v.subtitle].filter(Boolean).join(": "),
        authors: cleanAuthors(v.authors ?? []),
        coverUrl: cover,
        description: v.description ?? null,
        pageCount: v.pageCount ?? null,
        publishedYear: Number.isFinite(year) ? (year as number) : null,
        isbn,
      });
    });
  return { ok: true, books };
}

function pickGoogleCover(volumeId: string, links?: GBVolumeInfo["imageLinks"]): string | null {
  if (!links) {
    return `https://books.google.com/books/content?id=${volumeId}&printsec=frontcover&img=1&zoom=2`;
  }
  // Endpoint zoom=2 ≈ 480-512px; zoom=3 ≈ 720px. Forzamos zoom=2 para nitidez.
  const base =
    links.thumbnail ?? links.smallThumbnail ?? links.small ?? links.medium ?? null;
  if (!base) return null;
  return base
    .replace(/^http:\/\//, "https://")
    .replace(/&edge=curl/, "")
    .replace(/&zoom=\d+/, "&zoom=2")
    .replace(/&img=\d+/, "&img=1");
}

// ─────────────────────────────────────────────────────────────────────────────
// Open Library — fallback / complemento
// ─────────────────────────────────────────────────────────────────────────────

interface OLDoc {
  key: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  cover_i?: number;
  isbn?: string[];
  edition_key?: string[];
}

async function searchOpenLibrary(query: string, max: number): Promise<ResultadoFuente> {
  const params = new URLSearchParams({
    q: query,
    limit: String(Math.min(20, max + 4)),
    fields: "key,title,author_name,first_publish_year,number_of_pages_median,cover_i,isbn,edition_key",
  });

  const res = await fetch(`${OL_ENDPOINT}?${params.toString()}`, {
    headers: {
      "User-Agent": "MoonClubDeLectura/1.0 (+https://github.com/stivenrosales/moon-cl)",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    // Mismo criterio que Google Books: se loguea siempre, también en
    // producción, para que un fallo de esta fuente no se disfrace de "el
    // libro no existe".
    // eslint-disable-next-line no-console
    console.error(
      `[google-books] Open Library respondió ${res.status} — la fuente se descarta de la búsqueda`,
    );
    return { ok: false };
  }

  const data = (await res.json()) as { docs?: OLDoc[] };
  if (!data.docs) return { ok: true, books: [] };

  const books = data.docs
    .filter((d) => d.title)
    .map<BookCandidate>((d) => sanearCandidato({
      googleBooksId: `ol:${d.key.replace(/^\/works\//, "")}`,
      title: d.title!,
      authors: cleanAuthors(d.author_name ?? []),
      coverUrl: d.cover_i
        ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`
        : d.isbn?.[0]
        ? `https://covers.openlibrary.org/b/isbn/${d.isbn[0]}-L.jpg`
        : null,
      description: null,
      pageCount: d.number_of_pages_median ?? null,
      publishedYear: d.first_publish_year ?? null,
      isbn: d.isbn?.[0] ?? null,
    }));
  return { ok: true, books };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TRANSLATOR_HINTS = /\btraducc?ion|trad\.|translator|tr\.|edición|edición de|prólogo|prologo|illustrator|ilustrador/i;

function cleanAuthors(raw: string[]): string[] {
  if (!raw.length) return [];

  // 1. Elimina duplicados (case-insensitive) preservando orden.
  const seen = new Set<string>();
  const dedup: string[] = [];
  for (const name of raw) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    dedup.push(trimmed);
  }

  // 2. Filtra hints obvios de traductor / editor.
  const noHints = dedup.filter((n) => !TRANSLATOR_HINTS.test(n));
  const list = noHints.length ? noHints : dedup;

  // 3. Si hay nombres en alfabeto latino y otros (CJK, cirílico, árabe…),
  //    quédate solo con los latinos.
  const latin = list.filter((n) => /[A-Za-zÀ-ÿ]/.test(n) && !/[぀-ヿ㐀-鿿Ѐ-ӿ؀-ۿ]/.test(n));
  const final = latin.length ? latin : list;

  // 4. Máximo 2 autores en pantalla (los demás suman ruido).
  return final.slice(0, 2);
}
