export interface BookCandidate {
  googleBooksId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  description: string | null;
  pageCount: number | null;
  publishedYear: number | null;
  isbn: string | null;
}

interface VolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  description?: string;
  pageCount?: number;
  publishedDate?: string;
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  industryIdentifiers?: Array<{ type: string; identifier: string }>;
  language?: string;
}

interface VolumeItem {
  id: string;
  volumeInfo: VolumeInfo;
}

const ENDPOINT = "https://www.googleapis.com/books/v1/volumes";

export async function searchBooks(query: string, max = 8): Promise<BookCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    q: trimmed,
    maxResults: String(Math.min(40, Math.max(1, max))),
    printType: "books",
    langRestrict: "es",
  });
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    params.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  }

  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { items?: VolumeItem[] };
  if (!data.items) return [];

  return data.items.map(toCandidate).filter((b): b is BookCandidate => Boolean(b.title));
}

function toCandidate(item: VolumeItem): BookCandidate {
  const v = item.volumeInfo ?? {};
  const isbn = (v.industryIdentifiers ?? []).find(
    (i) => i.type === "ISBN_13" || i.type === "ISBN_10",
  )?.identifier ?? null;

  const cover = (v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? null)
    ?.replace(/^http:\/\//, "https://")
    ?.replace(/&edge=curl/, "")
    ?? null;

  const year = v.publishedDate ? Number(v.publishedDate.slice(0, 4)) : null;

  return {
    googleBooksId: item.id,
    title: [v.title, v.subtitle].filter(Boolean).join(": "),
    authors: v.authors ?? [],
    coverUrl: cover,
    description: v.description ?? null,
    pageCount: v.pageCount ?? null,
    publishedYear: Number.isFinite(year) ? (year as number) : null,
    isbn,
  };
}
