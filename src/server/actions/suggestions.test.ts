import { beforeEach, describe, expect, it, vi } from "vitest";

const roundFindUniqueMock = vi.fn();
const bookSuggestionFindUniqueMock = vi.fn();
const bookSuggestionCreateMock = vi.fn();
const bookSuggestionDeleteMock = vi.fn();
const findOrCreateBookMock = vi.fn();
const requireUserMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    round: {
      findUnique: (...args: unknown[]) => roundFindUniqueMock(...args),
    },
    bookSuggestion: {
      findUnique: (...args: unknown[]) => bookSuggestionFindUniqueMock(...args),
      create: (...args: unknown[]) => bookSuggestionCreateMock(...args),
      delete: (...args: unknown[]) => bookSuggestionDeleteMock(...args),
    },
  },
}));

vi.mock("@/server/auth-helpers", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("@/server/services/books", () => ({
  findOrCreateBook: (...args: unknown[]) => findOrCreateBookMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { deleteSuggestion, suggestBook } from "@/server/actions/suggestions";

const USER = { id: "user-1", role: "MEMBER" };
const MODERATOR = { id: "mod-1", role: "MODERATOR" };
const ADMIN = { id: "admin-1", role: "ADMIN" };
const VALID_ID = "cluid1234567890abcdefghi";

beforeEach(() => {
  roundFindUniqueMock.mockReset();
  bookSuggestionFindUniqueMock.mockReset();
  bookSuggestionCreateMock.mockReset();
  bookSuggestionDeleteMock.mockReset();
  findOrCreateBookMock.mockReset();
  requireUserMock.mockReset();
  revalidatePathMock.mockReset();
  requireUserMock.mockResolvedValue(USER);
});

describe("suggestBook", () => {
  it("lanza error si la ronda no existe", async () => {
    roundFindUniqueMock.mockResolvedValue(null);

    await expect(
      suggestBook({ roundId: "round-1", title: "Libro" }),
    ).rejects.toThrow("Ronda no encontrada");
    expect(findOrCreateBookMock).not.toHaveBeenCalled();
  });

  it("no deja sugerir en una ronda que no está OPEN", async () => {
    roundFindUniqueMock.mockResolvedValue({
      id: "round-1",
      status: "SCHEDULED",
      endsAt: new Date("2099-01-01"),
    });

    await expect(
      suggestBook({ roundId: "round-1", title: "Libro" }),
    ).rejects.toThrow("La ronda no está abierta");
    expect(findOrCreateBookMock).not.toHaveBeenCalled();
  });

  it("no deja sugerir tras el cierre (endsAt en el pasado) aunque la ronda siga marcada OPEN", async () => {
    roundFindUniqueMock.mockResolvedValue({
      id: "round-1",
      status: "OPEN",
      endsAt: new Date("2020-01-01"),
    });

    await expect(
      suggestBook({ roundId: "round-1", title: "Libro" }),
    ).rejects.toThrow("La ronda ya cerró, no se pueden sugerir libros");
    expect(findOrCreateBookMock).not.toHaveBeenCalled();
  });

  it("no deja sugerir el mismo libro dos veces en la misma ronda", async () => {
    roundFindUniqueMock.mockResolvedValue({
      id: "round-1",
      status: "OPEN",
      endsAt: new Date("2099-01-01"),
    });
    findOrCreateBookMock.mockResolvedValue({ id: "book-1" });
    bookSuggestionFindUniqueMock.mockResolvedValue({ id: "existing-suggestion" });

    await expect(
      suggestBook({ roundId: "round-1", title: "Libro", googleBooksId: "gb-1" }),
    ).rejects.toThrow("Ese libro ya fue sugerido en esta ronda");
    expect(bookSuggestionCreateMock).not.toHaveBeenCalled();
  });

  it("registra la sugerencia (camino feliz)", async () => {
    roundFindUniqueMock.mockResolvedValue({
      id: "round-1",
      status: "OPEN",
      endsAt: new Date("2099-01-01"),
    });
    findOrCreateBookMock.mockResolvedValue({ id: "book-1" });
    bookSuggestionFindUniqueMock.mockResolvedValue(null);
    bookSuggestionCreateMock.mockResolvedValue({ id: "suggestion-1" });

    const result = await suggestBook({
      roundId: "round-1",
      title: "Rayuela",
      pitch: "Un clásico",
    });

    expect(bookSuggestionCreateMock).toHaveBeenCalledWith({
      data: {
        roundId: "round-1",
        bookId: "book-1",
        userId: "user-1",
        pitch: "Un clásico",
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/agenda/ronda/round-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/hoy");
    expect(result).toEqual({ id: "suggestion-1" });
  });

  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(
      suggestBook({ roundId: "round-1", title: "Libro" }),
    ).rejects.toThrow("Debes iniciar sesión");
    expect(roundFindUniqueMock).not.toHaveBeenCalled();
  });
});

describe("deleteSuggestion", () => {
  it("lanza error si la sugerencia no existe", async () => {
    bookSuggestionFindUniqueMock.mockResolvedValue(null);

    await expect(deleteSuggestion(VALID_ID)).rejects.toThrow("Sugerencia no encontrada");
    expect(bookSuggestionDeleteMock).not.toHaveBeenCalled();
  });

  it("no deja borrar la sugerencia de otra persona si no eres admin ni moderador", async () => {
    bookSuggestionFindUniqueMock.mockResolvedValue({
      id: VALID_ID,
      userId: "otro-user",
      roundId: "round-1",
      round: { status: "OPEN" },
    });

    await expect(deleteSuggestion(VALID_ID)).rejects.toThrow(
      "Solo puedes borrar tus sugerencias",
    );
    expect(bookSuggestionDeleteMock).not.toHaveBeenCalled();
  });

  it("no deja al dueño borrar su sugerencia si la ronda ya no está OPEN", async () => {
    bookSuggestionFindUniqueMock.mockResolvedValue({
      id: VALID_ID,
      userId: "user-1",
      roundId: "round-1",
      round: { status: "CLOSED" },
    });

    await expect(deleteSuggestion(VALID_ID)).rejects.toThrow("La ronda ya no está abierta");
    expect(bookSuggestionDeleteMock).not.toHaveBeenCalled();
  });

  it("un moderador que no es dueño tampoco puede borrar si la ronda ya cerró (solo ADMIN pasa esa barrera)", async () => {
    requireUserMock.mockResolvedValue(MODERATOR);
    bookSuggestionFindUniqueMock.mockResolvedValue({
      id: VALID_ID,
      userId: "otro-user",
      roundId: "round-1",
      round: { status: "CLOSED" },
    });

    await expect(deleteSuggestion(VALID_ID)).rejects.toThrow("La ronda ya no está abierta");
    expect(bookSuggestionDeleteMock).not.toHaveBeenCalled();
  });

  it("un moderador puede borrar la sugerencia de otra persona mientras la ronda sigue OPEN", async () => {
    requireUserMock.mockResolvedValue(MODERATOR);
    bookSuggestionFindUniqueMock.mockResolvedValue({
      id: VALID_ID,
      userId: "otro-user",
      roundId: "round-1",
      round: { status: "OPEN" },
    });
    bookSuggestionDeleteMock.mockResolvedValue({ id: VALID_ID });

    await deleteSuggestion(VALID_ID);

    expect(bookSuggestionDeleteMock).toHaveBeenCalledWith({ where: { id: VALID_ID } });
  });

  it("un admin puede borrar cualquier sugerencia aunque la ronda ya haya cerrado", async () => {
    requireUserMock.mockResolvedValue(ADMIN);
    bookSuggestionFindUniqueMock.mockResolvedValue({
      id: VALID_ID,
      userId: "otro-user",
      roundId: "round-1",
      round: { status: "CLOSED" },
    });
    bookSuggestionDeleteMock.mockResolvedValue({ id: VALID_ID });

    await deleteSuggestion(VALID_ID);

    expect(bookSuggestionDeleteMock).toHaveBeenCalledWith({ where: { id: VALID_ID } });
  });

  it("el dueño puede borrar su propia sugerencia mientras la ronda sigue OPEN", async () => {
    bookSuggestionFindUniqueMock.mockResolvedValue({
      id: VALID_ID,
      userId: "user-1",
      roundId: "round-1",
      round: { status: "OPEN" },
    });
    bookSuggestionDeleteMock.mockResolvedValue({ id: VALID_ID });

    await deleteSuggestion(VALID_ID);

    expect(bookSuggestionDeleteMock).toHaveBeenCalledWith({ where: { id: VALID_ID } });
    expect(revalidatePathMock).toHaveBeenCalledWith("/agenda/ronda/round-1");
  });

  it("rechaza un id que no es un cuid válido", async () => {
    await expect(deleteSuggestion("no-es-un-cuid")).rejects.toThrow();
    expect(bookSuggestionFindUniqueMock).not.toHaveBeenCalled();
  });
});
