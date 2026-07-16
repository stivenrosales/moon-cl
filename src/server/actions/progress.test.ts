import { beforeEach, describe, expect, it, vi } from "vitest";

const readingProgressCreateMock = vi.fn();
const userBookFindUniqueMock = vi.fn();
const userBookUpsertMock = vi.fn();
const transactionMock = vi.fn();
const requireUserMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

vi.mock("@/server/auth-helpers", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { updateProgress } from "@/server/actions/progress";

const USER = { id: "user-1", role: "MEMBER" };

// tx "fake" que recibe el callback pasado a db.$transaction
const tx = {
  readingProgress: {
    create: (...args: unknown[]) => readingProgressCreateMock(...args),
  },
  userBook: {
    findUnique: (...args: unknown[]) => userBookFindUniqueMock(...args),
    upsert: (...args: unknown[]) => userBookUpsertMock(...args),
  },
};

beforeEach(() => {
  readingProgressCreateMock.mockReset();
  userBookFindUniqueMock.mockReset();
  userBookUpsertMock.mockReset();
  transactionMock.mockReset();
  requireUserMock.mockReset();
  revalidatePathMock.mockReset();
  requireUserMock.mockResolvedValue(USER);
  transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));
  readingProgressCreateMock.mockResolvedValue({ id: "p-1" });
  userBookFindUniqueMock.mockResolvedValue(null);
  userBookUpsertMock.mockResolvedValue({ id: "ub-1", status: "READING" });
});

describe("updateProgress", () => {
  it("persiste el capítulo declarado junto con la página en la bitácora", async () => {
    await updateProgress({ bookId: "book-1", currentPage: 120, chapter: 8 });

    expect(readingProgressCreateMock).toHaveBeenCalledWith({
      data: {
        bookId: "book-1",
        userId: "user-1",
        currentPage: 120,
        chapter: 8,
        note: null,
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/leer/libro/book-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/hoy");
    expect(revalidatePathMock).toHaveBeenCalledWith("/leer");
  });

  it("guarda chapter como null en la bitácora cuando no se declara", async () => {
    await updateProgress({ bookId: "book-1", currentPage: 40 });

    expect(readingProgressCreateMock).toHaveBeenCalledWith({
      data: {
        bookId: "book-1",
        userId: "user-1",
        currentPage: 40,
        chapter: null,
        note: null,
      },
    });
  });

  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(updateProgress({ bookId: "book-1", currentPage: 10 })).rejects.toThrow(
      "Debes iniciar sesión",
    );
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("ejecuta la bitácora y la estantería dentro de la misma transacción", async () => {
    await updateProgress({ bookId: "book-1", currentPage: 10, chapter: 1 });

    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  it("crea el UserBook en READING con startedAt cuando no existía", async () => {
    userBookFindUniqueMock.mockResolvedValue(null);

    await updateProgress({ bookId: "book-1", currentPage: 15, chapter: 2 });

    expect(userBookUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_bookId: { userId: "user-1", bookId: "book-1" } },
        create: expect.objectContaining({
          userId: "user-1",
          bookId: "book-1",
          status: "READING",
          currentPage: 15,
          currentChapter: 2,
          startedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("pasa de WANT_TO_READ a READING y setea startedAt la primera vez", async () => {
    userBookFindUniqueMock.mockResolvedValue({
      id: "ub-2",
      status: "WANT_TO_READ",
      startedAt: null,
      currentChapter: null,
    });

    await updateProgress({ bookId: "book-1", currentPage: 5 });

    expect(userBookUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "READING",
          currentPage: 5,
          startedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("no degrada un UserBook FINISHED a READING", async () => {
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    userBookFindUniqueMock.mockResolvedValue({
      id: "ub-5",
      status: "FINISHED",
      startedAt,
      currentChapter: 10,
    });

    await updateProgress({ bookId: "book-1", currentPage: 300 });

    expect(userBookUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "FINISHED",
          currentPage: 300,
          startedAt,
        }),
      }),
    );
  });

  it("mantiene startedAt existente cuando ya venía seteado (no lo pisa)", async () => {
    const startedAt = new Date("2025-05-05T00:00:00.000Z");
    userBookFindUniqueMock.mockResolvedValue({
      id: "ub-6",
      status: "READING",
      startedAt,
      currentChapter: 3,
    });

    await updateProgress({ bookId: "book-1", currentPage: 90 });

    expect(userBookUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ startedAt }),
      }),
    );
  });

  it("conserva el capítulo previo del UserBook si esta actualización no declara uno", async () => {
    userBookFindUniqueMock.mockResolvedValue({
      id: "ub-7",
      status: "READING",
      startedAt: new Date("2025-01-01T00:00:00.000Z"),
      currentChapter: 6,
    });

    await updateProgress({ bookId: "book-1", currentPage: 200 });

    expect(userBookUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ currentChapter: 6 }),
      }),
    );
  });

  it("el capítulo declarado llega a UserBook.currentChapter", async () => {
    userBookFindUniqueMock.mockResolvedValue({
      id: "ub-8",
      status: "READING",
      startedAt: new Date("2025-01-01T00:00:00.000Z"),
      currentChapter: 6,
    });

    await updateProgress({ bookId: "book-1", currentPage: 210, chapter: 7 });

    expect(userBookUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ currentChapter: 7 }),
      }),
    );
  });
});
