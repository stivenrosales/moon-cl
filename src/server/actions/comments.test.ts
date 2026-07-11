import { beforeEach, describe, expect, it, vi } from "vitest";

const commentFindUniqueMock = vi.fn();
const commentCreateMock = vi.fn();
const commentUpdateMock = vi.fn();
const userBookFindUniqueMock = vi.fn();
const bookFindUniqueMock = vi.fn();
const readingProgressFindFirstMock = vi.fn();
const requireUserMock = vi.fn();
const requireModeratorMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    comment: {
      findUnique: (...args: unknown[]) => commentFindUniqueMock(...args),
      create: (...args: unknown[]) => commentCreateMock(...args),
      update: (...args: unknown[]) => commentUpdateMock(...args),
    },
    userBook: {
      findUnique: (...args: unknown[]) => userBookFindUniqueMock(...args),
    },
    book: {
      findUnique: (...args: unknown[]) => bookFindUniqueMock(...args),
    },
    readingProgress: {
      findFirst: (...args: unknown[]) => readingProgressFindFirstMock(...args),
    },
  },
}));

vi.mock("@/server/auth-helpers", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
  requireModerator: (...args: unknown[]) => requireModeratorMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { postComment, revealComment } from "@/server/actions/comments";

const USER = { id: "user-1", role: "MEMBER" };
const MODERATOR = { id: "mod-1", role: "MODERATOR" };

const VALID_CUID = "cluid1234567890abcdefghi";

beforeEach(() => {
  commentFindUniqueMock.mockReset();
  commentCreateMock.mockReset();
  commentUpdateMock.mockReset();
  userBookFindUniqueMock.mockReset();
  bookFindUniqueMock.mockReset();
  readingProgressFindFirstMock.mockReset();
  requireUserMock.mockReset();
  requireModeratorMock.mockReset();
  revalidatePathMock.mockReset();
  requireUserMock.mockResolvedValue(USER);
});

describe("postComment", () => {
  it("persiste isReflection junto con el resto de campos", async () => {
    commentCreateMock.mockResolvedValue({ id: "c-1" });

    await postComment({ bookId: "book-1", content: "Impresión", isSpoiler: true });

    expect(commentCreateMock).toHaveBeenCalledWith({
      data: {
        bookId: "book-1",
        userId: "user-1",
        parentId: null,
        content: "Impresión",
        isSpoiler: true,
        isReflection: false,
        chapter: null,
      },
    });
  });

  it("rechaza un comentario de reflexión si el usuario no terminó el libro", async () => {
    userBookFindUniqueMock.mockResolvedValue({ status: "READING" });
    bookFindUniqueMock.mockResolvedValue({ pageCount: 300 });
    readingProgressFindFirstMock.mockResolvedValue({ currentPage: 100 });

    await expect(
      postComment({ bookId: "book-1", content: "Final del libro...", isReflection: true }),
    ).rejects.toThrow("Debes terminar el libro para publicar en la sala de reflexión");
    expect(commentCreateMock).not.toHaveBeenCalled();
  });

  it("permite un comentario de reflexión si el UserBook está FINISHED", async () => {
    userBookFindUniqueMock.mockResolvedValue({ status: "FINISHED" });
    bookFindUniqueMock.mockResolvedValue({ pageCount: 300 });
    readingProgressFindFirstMock.mockResolvedValue(null);
    commentCreateMock.mockResolvedValue({ id: "c-2" });

    await postComment({ bookId: "book-1", content: "Final del libro...", isReflection: true });

    expect(commentCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isReflection: true }),
      }),
    );
  });

  it("permite un comentario de reflexión si el último progreso alcanzó el total de páginas", async () => {
    userBookFindUniqueMock.mockResolvedValue({ status: "READING" });
    bookFindUniqueMock.mockResolvedValue({ pageCount: 300 });
    readingProgressFindFirstMock.mockResolvedValue({ currentPage: 300 });
    commentCreateMock.mockResolvedValue({ id: "c-3" });

    await postComment({ bookId: "book-1", content: "Final del libro...", isReflection: true });

    expect(commentCreateMock).toHaveBeenCalled();
  });

  it("lanza error si el parentId referencia una respuesta anidada (más de un nivel)", async () => {
    commentFindUniqueMock.mockResolvedValue({ id: "p-1", bookId: "book-1", parentId: "root-1" });

    await expect(
      postComment({ bookId: "book-1", parentId: "p-1", content: "Respuesta" }),
    ).rejects.toThrow("Respuesta no válida (solo un nivel de hilo)");
  });
});

describe("revealComment", () => {
  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(revealComment(VALID_CUID)).rejects.toThrow("Debes iniciar sesión");
  });

  it("lanza error si el comentario no existe", async () => {
    commentFindUniqueMock.mockResolvedValue(null);

    await expect(revealComment(VALID_CUID)).rejects.toThrow("Comentario no encontrado");
  });

  it("devuelve el content bajo demanda para un comentario spoiler o de capítulo futuro", async () => {
    commentFindUniqueMock.mockResolvedValue({
      id: VALID_CUID,
      bookId: "book-1",
      content: "El final es...",
      isReflection: false,
    });

    const result = await revealComment(VALID_CUID);

    expect(result).toEqual({ id: VALID_CUID, content: "El final es..." });
  });

  it("bloquea revelar un comentario de la sala de reflexión si el usuario no terminó el libro", async () => {
    commentFindUniqueMock.mockResolvedValue({
      id: VALID_CUID,
      bookId: "book-1",
      content: "El final es...",
      isReflection: true,
    });
    userBookFindUniqueMock.mockResolvedValue({ status: "READING" });
    bookFindUniqueMock.mockResolvedValue({ pageCount: 300 });
    readingProgressFindFirstMock.mockResolvedValue({ currentPage: 50 });

    await expect(revealComment(VALID_CUID)).rejects.toThrow(
      "Debes terminar el libro para entrar a la sala de reflexión",
    );
  });

  it("un moderador puede revelar la sala de reflexión sin haber terminado el libro", async () => {
    requireUserMock.mockResolvedValue(MODERATOR);
    commentFindUniqueMock.mockResolvedValue({
      id: VALID_CUID,
      bookId: "book-1",
      content: "El final es...",
      isReflection: true,
    });

    const result = await revealComment(VALID_CUID);

    expect(result).toEqual({ id: VALID_CUID, content: "El final es..." });
    expect(userBookFindUniqueMock).not.toHaveBeenCalled();
  });
});
