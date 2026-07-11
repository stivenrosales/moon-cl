import { describe, expect, it, vi } from "vitest";
import { findOrCreateBook } from "@/server/services/books";

function createFakeClient(overrides: {
  findUnique?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    book: {
      findUnique: overrides.findUnique ?? vi.fn(),
      create: overrides.create ?? vi.fn(),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const baseInput = {
  title: "Cien años de soledad",
  authors: ["Gabriel García Márquez"],
};

describe("findOrCreateBook", () => {
  it("retorna el libro existente cuando googleBooksId ya está en la base, sin crear uno nuevo", async () => {
    const existing = { id: "book-1", googleBooksId: "gb-1" };
    const findUnique = vi.fn().mockResolvedValue(existing);
    const create = vi.fn();
    const client = createFakeClient({ findUnique, create });

    const result = await findOrCreateBook({ ...baseInput, googleBooksId: "gb-1" }, client);

    expect(result).toBe(existing);
    expect(findUnique).toHaveBeenCalledWith({ where: { googleBooksId: "gb-1" } });
    expect(create).not.toHaveBeenCalled();
  });

  it("crea un libro nuevo cuando el googleBooksId no existe todavía", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const created = { id: "book-2", googleBooksId: "gb-2" };
    const create = vi.fn().mockResolvedValue(created);
    const client = createFakeClient({ findUnique, create });

    const result = await findOrCreateBook({ ...baseInput, googleBooksId: "gb-2" }, client);

    expect(result).toBe(created);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: baseInput.title,
          authors: baseInput.authors,
          googleBooksId: "gb-2",
        }),
      }),
    );
  });

  it("crea un libro nuevo directamente cuando no hay googleBooksId (no busca)", async () => {
    const findUnique = vi.fn();
    const created = { id: "book-3", googleBooksId: null };
    const create = vi.fn().mockResolvedValue(created);
    const client = createFakeClient({ findUnique, create });

    const result = await findOrCreateBook(baseInput, client);

    expect(result).toBe(created);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("normaliza campos opcionales ausentes a null al crear", async () => {
    const findUnique = vi.fn();
    const create = vi.fn().mockResolvedValue({ id: "book-4" });
    const client = createFakeClient({ findUnique, create });

    await findOrCreateBook({ title: "Solo título" }, client);

    expect(create).toHaveBeenCalledWith({
      data: {
        title: "Solo título",
        authors: [],
        coverUrl: null,
        description: null,
        pageCount: null,
        publishedYear: null,
        googleBooksId: null,
        isbn: null,
      },
    });
  });
});
