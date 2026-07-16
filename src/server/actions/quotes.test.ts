import { beforeEach, describe, expect, it, vi } from "vitest";

const bookFindUniqueMock = vi.fn();
const quoteFindUniqueMock = vi.fn();
const quoteCreateMock = vi.fn();
const quoteDeleteMock = vi.fn();
const quoteLikeFindUniqueMock = vi.fn();
const quoteLikeCreateMock = vi.fn();
const quoteLikeDeleteMock = vi.fn();
const requireUserMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    book: {
      findUnique: (...args: unknown[]) => bookFindUniqueMock(...args),
    },
    quote: {
      findUnique: (...args: unknown[]) => quoteFindUniqueMock(...args),
      create: (...args: unknown[]) => quoteCreateMock(...args),
      delete: (...args: unknown[]) => quoteDeleteMock(...args),
    },
    quoteLike: {
      findUnique: (...args: unknown[]) => quoteLikeFindUniqueMock(...args),
      create: (...args: unknown[]) => quoteLikeCreateMock(...args),
      delete: (...args: unknown[]) => quoteLikeDeleteMock(...args),
    },
  },
}));

vi.mock("@/server/auth-helpers", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { createQuote, deleteQuote, toggleQuoteLike } from "@/server/actions/quotes";

const MEMBER = { id: "user-1", role: "MEMBER" };
const OTHER_MEMBER = { id: "user-2", role: "MEMBER" };
const MODERATOR = { id: "mod-1", role: "MODERATOR" };

const VALID_CUID = "cluid1234567890abcdefghi";

beforeEach(() => {
  bookFindUniqueMock.mockReset();
  quoteFindUniqueMock.mockReset();
  quoteCreateMock.mockReset();
  quoteDeleteMock.mockReset();
  quoteLikeFindUniqueMock.mockReset();
  quoteLikeCreateMock.mockReset();
  quoteLikeDeleteMock.mockReset();
  requireUserMock.mockReset();
  revalidatePathMock.mockReset();
  requireUserMock.mockResolvedValue(MEMBER);
});

describe("createQuote", () => {
  it("crea la frase asociada al usuario y al libro", async () => {
    bookFindUniqueMock.mockResolvedValue({ id: "book-1" });
    quoteCreateMock.mockResolvedValue({ id: "quote-1" });

    await createQuote({ bookId: "book-1", content: "Una frase memorable" });

    expect(quoteCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookId: "book-1",
          userId: "user-1",
          content: "Una frase memorable",
          page: null,
          chapter: null,
        }),
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/club");
    expect(revalidatePathMock).toHaveBeenCalledWith("/leer/libro/book-1");
  });

  it("lanza error si el libro no existe", async () => {
    bookFindUniqueMock.mockResolvedValue(null);

    await expect(
      createQuote({ bookId: "book-1", content: "Una frase memorable" }),
    ).rejects.toThrow("Libro no encontrado");
    expect(quoteCreateMock).not.toHaveBeenCalled();
  });

  it("rechaza contenido inválido antes de tocar la base de datos", async () => {
    await expect(createQuote({ bookId: "book-1", content: "Ho" })).rejects.toThrow();
    expect(bookFindUniqueMock).not.toHaveBeenCalled();
  });

  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(
      createQuote({ bookId: "book-1", content: "Una frase memorable" }),
    ).rejects.toThrow("Debes iniciar sesión");
  });
});

describe("deleteQuote", () => {
  it("lanza error si la frase no existe", async () => {
    quoteFindUniqueMock.mockResolvedValue(null);

    await expect(deleteQuote(VALID_CUID)).rejects.toThrow("Frase no encontrada");
    expect(quoteDeleteMock).not.toHaveBeenCalled();
  });

  it("permite borrar al autor de la frase", async () => {
    quoteFindUniqueMock.mockResolvedValue({ id: VALID_CUID, userId: "user-1", bookId: "book-1" });
    quoteDeleteMock.mockResolvedValue({ id: VALID_CUID });

    await deleteQuote(VALID_CUID);

    expect(quoteDeleteMock).toHaveBeenCalledWith({ where: { id: VALID_CUID } });
    expect(revalidatePathMock).toHaveBeenCalledWith("/club");
    expect(revalidatePathMock).toHaveBeenCalledWith("/leer/libro/book-1");
  });

  it("permite borrar a un moderador aunque no sea el autor", async () => {
    requireUserMock.mockResolvedValue(MODERATOR);
    quoteFindUniqueMock.mockResolvedValue({ id: VALID_CUID, userId: "user-1", bookId: "book-1" });
    quoteDeleteMock.mockResolvedValue({ id: VALID_CUID });

    await deleteQuote(VALID_CUID);

    expect(quoteDeleteMock).toHaveBeenCalledWith({ where: { id: VALID_CUID } });
  });

  it("rechaza a un miembro que no es el autor ni moderador", async () => {
    requireUserMock.mockResolvedValue(OTHER_MEMBER);
    quoteFindUniqueMock.mockResolvedValue({ id: VALID_CUID, userId: "user-1", bookId: "book-1" });

    await expect(deleteQuote(VALID_CUID)).rejects.toThrow("No autorizado");
    expect(quoteDeleteMock).not.toHaveBeenCalled();
  });
});

describe("toggleQuoteLike", () => {
  it("lanza error si la frase no existe", async () => {
    quoteFindUniqueMock.mockResolvedValue(null);

    await expect(toggleQuoteLike(VALID_CUID)).rejects.toThrow("Frase no encontrada");
  });

  it("crea el like cuando el usuario no había dado like (toggle a true)", async () => {
    quoteFindUniqueMock.mockResolvedValue({ id: VALID_CUID, bookId: "book-1" });
    quoteLikeFindUniqueMock.mockResolvedValue(null);

    const result = await toggleQuoteLike(VALID_CUID);

    expect(quoteLikeCreateMock).toHaveBeenCalledWith({
      data: { quoteId: VALID_CUID, userId: "user-1" },
    });
    expect(quoteLikeDeleteMock).not.toHaveBeenCalled();
    expect(result).toEqual({ liked: true });
  });

  it("borra el like cuando el usuario ya lo había dado (toggle a false)", async () => {
    quoteFindUniqueMock.mockResolvedValue({ id: VALID_CUID, bookId: "book-1" });
    quoteLikeFindUniqueMock.mockResolvedValue({ id: "like-1" });

    const result = await toggleQuoteLike(VALID_CUID);

    expect(quoteLikeDeleteMock).toHaveBeenCalledWith({ where: { id: "like-1" } });
    expect(quoteLikeCreateMock).not.toHaveBeenCalled();
    expect(result).toEqual({ liked: false });
  });
});
