export interface BookCandidate {
  /** ID externo (prefijo `ol:` para Open Library, `gb:` para Google Books). */
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
 * Busca libros usando Open Library como fuente primaria (gratis, sin rate limit)
 * y Google Books como complemento si Open Library devuelve poco.
 */
export async function searchBooks(query: string, max = 8): Promise<BookCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const [olResults, gbResults] = await Promise.allSettled([
    searchOpenLibrary(trimmed, max),
    searchGoogleBooks(trimmed, max),
  ]);

  const ol = olResults.status === "fulfilled" ? olResults.value : [];
  const gb = gbResults.status === "fulfilled" ? gbResults.value : [];

  // Mezcla: prioriza Open Library (mejor cobertura libre), luego rellena con Google Books.
  const seen = new Set<string>();
  const merged: BookCandidate[] = [];
  for (const list of [ol, gb]) {
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
// Open Library
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
    headers: { "User-Agent": "MoonClubDeLectura/1.0 (+https://github.com/stivenrosales/moon-cl)" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { docs?: OLDoc[] };
  if (!data.docs) return [];

  return data.docs
    .filter((d) => d.title)
    .map<BookCandidate>((d) => ({
      googleBooksId: `ol:${d.key.replace(/^\/works\//, "")}`,
      title: d.title!,
      authors: d.author_name ?? [],
      coverUrl: d.cover_i
        ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`
        : d.isbn?.[0]
        ? `https://covers.openlibrary.org/b/isbn/${d.isbn[0]}-M.jpg`
        : null,
      description: null,
      pageCount: d.number_of_pages_median ?? null,
      publishedYear: d.first_publish_year ?? null,
      isbn: d.isbn?.[0] ?? null,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Books (fallback / complemento)
// ─────────────────────────────────────────────────────────────────────────────

interface GBVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  description?: string;
  pageCount?: number;
  publishedDate?: string;
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  industryIdentifiers?: Array<{ type: string; identifier: string }>;
}

interface GBVolumeItem {
  id: string;
  volumeInfo: GBVolumeInfo;
}

async function searchGoogleBooks(query: string, max: number): Promise<BookCandidate[]> {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(Math.min(40, Math.max(1, max))),
    printType: "books",
  });
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    params.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  }

  const res = await fetch(`${GB_ENDPOINT}?${params.toString()}`, {
    next: { revalidate: 3600 },
  });
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
      const cover =
        (v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? null)
          ?.replace(/^http:\/\//, "https://")
          ?.replace(/&edge=curl/, "") ?? null;
      const year = v.publishedDate ? Number(v.publishedDate.slice(0, 4)) : null;
      return {
        googleBooksId: `gb:${item.id}`,
        title: [v.title, v.subtitle].filter(Boolean).join(": "),
        authors: v.authors ?? [],
        coverUrl: cover,
        description: v.description ?? null,
        pageCount: v.pageCount ?? null,
        publishedYear: Number.isFinite(year) ? (year as number) : null,
        isbn,
      };
    });
}
