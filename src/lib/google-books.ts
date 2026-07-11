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

const OL_ENDPOINT = "https://openlibrary.org/search.json";
const GB_ENDPOINT = "https://www.googleapis.com/books/v1/volumes";

/**
 * Busca libros combinando Google Books y Open Library.
 * Prioriza Google Books (metadata más rica y limpia) y rellena con Open
 * Library para mejorar cobertura de catálogo en español y libros menos
 * comerciales.
 */
export async function searchBooks(query: string, max = 8): Promise<BookCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const [gbResults, olResults] = await Promise.allSettled([
    searchGoogleBooks(trimmed, max),
    searchOpenLibrary(trimmed, max),
  ]);

  const gb = gbResults.status === "fulfilled" ? gbResults.value : [];
  const ol = olResults.status === "fulfilled" ? olResults.value : [];

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

async function searchGoogleBooks(query: string, max: number): Promise<BookCandidate[]> {
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
  if (res.status === 429 && process.env.NODE_ENV !== "production") {
    // Quota anónima de Google Books quemada — configura GOOGLE_BOOKS_API_KEY.
    // eslint-disable-next-line no-console
    console.warn("[google-books] 429 quota exceeded — set GOOGLE_BOOKS_API_KEY");
  }
  if (!res.ok) return [];

  const data = (await res.json()) as { items?: GBVolumeItem[] };
  if (!data.items) return [];

  return data.items
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

      return {
        googleBooksId: `gb:${item.id}`,
        title: [v.title, v.subtitle].filter(Boolean).join(": "),
        authors: cleanAuthors(v.authors ?? []),
        coverUrl: cover,
        description: v.description ?? null,
        pageCount: v.pageCount ?? null,
        publishedYear: Number.isFinite(year) ? (year as number) : null,
        isbn,
      };
    });
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

async function searchOpenLibrary(query: string, max: number): Promise<BookCandidate[]> {
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
  if (!res.ok) return [];

  const data = (await res.json()) as { docs?: OLDoc[] };
  if (!data.docs) return [];

  return data.docs
    .filter((d) => d.title)
    .map<BookCandidate>((d) => ({
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
