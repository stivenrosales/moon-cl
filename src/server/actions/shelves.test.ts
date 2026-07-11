import { beforeEach, describe, expect, it, vi } from "vitest";

const userBookFindUniqueMock = vi.fn();
const userBookUpsertMock = vi.fn();
const userBookUpdateMock = vi.fn();
const userBookDeleteMock = vi.fn();
const bookFindUniqueMock = vi.fn();
const bookCreateMock = vi.fn();
const requireUserMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    userBook: {
      findUnique: (...args: unknown[]) => userBookFindUniqueMock(...args),
      upsert: (...args: unknown[]) => userBookUpsertMock(...args),
      update: (...args: unknown[]) => userBookUpdateMock(...args),
      delete: (...args: unknown[]) => userBookDeleteMock(...args),
    },
    book: {
      findUnique: (...args: unknown[]) => bookFindUniqueMock(...args),
      create: (...args: unknown[]) => bookCreateMock(...args),
    },
  },
}));

vi.mock("@/server/auth-helpers", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import {
  addBookToShelf,
  moveShelf,
  removeFromShelf,
  updateMyBook,
} from "@/server/actions/shelves";

const USER = { id: "user-1", role: "MEMBER" };

beforeEach(() => {
  userBookFindUniqueMock.mockReset();
  userBookUpsertMock.mockReset();
  userBookUpdateMock.mockReset();
  userBookDeleteMock.mockReset();
  bookFindUniqueMock.mockReset();
  bookCreateMock.mockReset();
  requireUserMock.mockReset();
  revalidatePathMock.mockReset();
  requireUserMock.mockResolvedValue(USER);
});

describe("addBookToShelf", () => {
  it("crea el libro si no existe y hace upsert del UserBook con status READING seteando startedAt", async () => {
    bookFindUniqueMock.mockResolvedValue(null);
    bookCreateMock.mockResolvedValue({ id: "book-1", googleBooksId: "gb-1" });
    userBookFindUniqueMock.mockResolvedValue(null);
    userBookUpsertMock.mockResolvedValue({ id: "ub-1" });

    await addBookToShelf({ title: "Libro", googleBooksId: "gb-1", status: "READING" });

    expect(bookCreateMock).toHaveBeenCalled();
    expect(userBookUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_bookId: { userId: "user-1", bookId: "book-1" } },
        create: expect.objectContaining({
          userId: "user-1",
          bookId: "book-1",
          status: "READING",
          startedAt: expect.any(Date),
          finishedAt: null,
        }),
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/mi-biblioteca");
  });

  it("reutiliza el libro existente por googleBooksId en lugar de crear uno nuevo", async () => {
    bookFindUniqueMock.mockResolvedValue({ id: "book-existing", googleBooksId: "gb-1" });
    userBookFindUniqueMock.mockResolvedValue(null);
    userBookUpsertMock.mockResolvedValue({ id: "ub-1" });

    await addBookToShelf({ title: "Libro", googleBooksId: "gb-1", status: "WANT_TO_READ" });

    expect(bookCreateMock).not.toHaveBeenCalled();
    expect(userBookUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_bookId: { userId: "user-1", bookId: "book-existing" } },
      }),
    );
  });

  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(
      addBookToShelf({ title: "Libro", status: "READING" }),
    ).rejects.toThrow("Debes iniciar sesión");
  });
});

describe("moveShelf", () => {
  it("lanza error si el libro no está en la estantería del usuario", async () => {
    userBookFindUniqueMock.mockResolvedValue(null);

    await expect(
      moveShelf({ bookId: "book-1", status: "FINISHED" }),
    ).rejects.toThrow("Ese libro no está en tu estantería");
    expect(userBookUpdateMock).not.toHaveBeenCalled();
  });

  it("mueve de READING a FINISHED seteando finishedAt", async () => {
    userBookFindUniqueMock.mockResolvedValue({
      id: "ub-1",
      status: "READING",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      finishedAt: null,
    });
    userBookUpdateMock.mockResolvedValue({ id: "ub-1", status: "FINISHED" });

    await moveShelf({ bookId: "book-1", status: "FINISHED" });

    expect(userBookUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ub-1" },
        data: expect.objectContaining({
          status: "FINISHED",
          finishedAt: expect.any(Date),
        }),
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/mi-biblioteca");
  });

  it("mueve de WANT_TO_READ a READING seteando startedAt", async () => {
    userBookFindUniqueMock.mockResolvedValue({
      id: "ub-2",
      status: "WANT_TO_READ",
      startedAt: null,
      finishedAt: null,
    });
    userBookUpdateMock.mockResolvedValue({ id: "ub-2", status: "READING" });

    await moveShelf({ bookId: "book-2", status: "READING" });

    expect(userBookUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "READING", startedAt: expect.any(Date) }),
      }),
    );
  });
});

describe("updateMyBook", () => {
  it("lanza error si el libro no está en la estantería del usuario", async () => {
    userBookFindUniqueMock.mockResolvedValue(null);

    await expect(
      updateMyBook({ bookId: "book-1", currentPage: 50 }),
    ).rejects.toThrow("Ese libro no está en tu estantería");
  });

  it("actualiza currentPage y currentChapter", async () => {
    userBookFindUniqueMock.mockResolvedValue({
      id: "ub-1",
      currentPage: 10,
      currentChapter: 1,
    });
    userBookUpdateMock.mockResolvedValue({ id: "ub-1" });

    await updateMyBook({ bookId: "book-1", currentPage: 80, currentChapter: 4 });

    expect(userBookUpdateMock).toHaveBeenCalledWith({
      where: { id: "ub-1" },
      data: { currentPage: 80, currentChapter: 4 },
    });
  });

  it("conserva los valores previos cuando no se envía el campo", async () => {
    userBookFindUniqueMock.mockResolvedValue({
      id: "ub-1",
      currentPage: 10,
      currentChapter: 1,
    });
    userBookUpdateMock.mockResolvedValue({ id: "ub-1" });

    await updateMyBook({ bookId: "book-1", currentPage: 25 });

    expect(userBookUpdateMock).toHaveBeenCalledWith({
      where: { id: "ub-1" },
      data: { currentPage: 25, currentChapter: 1 },
    });
  });
});

const VALID_CUID = "cluid1234567890abcdefghi";

describe("removeFromShelf", () => {
  it("lanza error si el libro no está en la estantería del usuario", async () => {
    userBookFindUniqueMock.mockResolvedValue(null);

    await expect(removeFromShelf(VALID_CUID)).rejects.toThrow(
      "Ese libro no está en tu estantería",
    );
    expect(userBookDeleteMock).not.toHaveBeenCalled();
  });

  it("borra el UserBook correspondiente", async () => {
    userBookFindUniqueMock.mockResolvedValue({ id: "ub-1" });
    userBookDeleteMock.mockResolvedValue({ id: "ub-1" });

    await removeFromShelf(VALID_CUID);

    expect(userBookDeleteMock).toHaveBeenCalledWith({ where: { id: "ub-1" } });
    expect(revalidatePathMock).toHaveBeenCalledWith("/mi-biblioteca");
  });

  it("rechaza un bookId que no es un cuid válido", async () => {
    await expect(removeFromShelf("no-es-un-cuid")).rejects.toThrow();
    expect(userBookFindUniqueMock).not.toHaveBeenCalled();
  });
});
