import { beforeEach, describe, expect, it, vi } from "vitest";

const readingProgressCreateMock = vi.fn();
const requireUserMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    readingProgress: {
      create: (...args: unknown[]) => readingProgressCreateMock(...args),
    },
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

beforeEach(() => {
  readingProgressCreateMock.mockReset();
  requireUserMock.mockReset();
  revalidatePathMock.mockReset();
  requireUserMock.mockResolvedValue(USER);
});

describe("updateProgress", () => {
  it("persiste el capítulo declarado junto con la página", async () => {
    readingProgressCreateMock.mockResolvedValue({ id: "p-1" });

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
    expect(revalidatePathMock).toHaveBeenCalledWith("/libros/book-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
  });

  it("guarda chapter como null cuando no se declara", async () => {
    readingProgressCreateMock.mockResolvedValue({ id: "p-2" });

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
  });
});
