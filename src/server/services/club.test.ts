import { describe, expect, it, vi } from "vitest";
import { closeRoundTx, setCurrentBookTx } from "@/server/services/club";

function createFakeTx(overrides: {
  round?: Partial<{ findUnique: unknown; update: unknown }>;
  bookSuggestion?: Partial<{ findMany: unknown }>;
  book?: Partial<{ updateMany: unknown; update: unknown }>;
} = {}) {
  return {
    round: {
      findUnique: vi.fn(),
      update: vi.fn(),
      ...overrides.round,
    },
    bookSuggestion: {
      findMany: vi.fn(),
      ...overrides.bookSuggestion,
    },
    book: {
      updateMany: vi.fn(),
      update: vi.fn(),
      ...overrides.book,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("setCurrentBookTx", () => {
  it("marca el libro anterior en curso como FINISHED y el nuevo como CURRENT", async () => {
    const tx = createFakeTx();

    await setCurrentBookTx(tx, "book-new");

    expect(tx.book.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isCurrent: true, NOT: { id: "book-new" } },
        data: expect.objectContaining({ isCurrent: false, status: "FINISHED" }),
      }),
    );
    expect(tx.book.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "book-new" },
        data: expect.objectContaining({
          isCurrent: true,
          status: "CURRENT",
          finishedAt: null,
        }),
      }),
    );
  });
});

describe("closeRoundTx", () => {
  it("lanza error cuando la ronda no existe", async () => {
    const tx = createFakeTx();
    tx.round.findUnique.mockResolvedValue(null);

    await expect(closeRoundTx(tx, "missing-round")).rejects.toThrow(
      "Ronda no encontrada",
    );
  });

  it("cierra la ronda sin ganador cuando no hay sugerencias", async () => {
    const tx = createFakeTx();
    tx.round.findUnique.mockResolvedValue({ id: "r1", status: "OPEN" });
    tx.bookSuggestion.findMany.mockResolvedValue([]);

    const winner = await closeRoundTx(tx, "r1");

    expect(winner).toBeNull();
    expect(tx.book.update).not.toHaveBeenCalled();
    expect(tx.book.updateMany).not.toHaveBeenCalled();
    expect(tx.round.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { status: "CLOSED", winnerBookId: null },
    });
  });

  it("elige al ganador por votos, lo pone como libro actual y archiva a los perdedores SUGGESTED", async () => {
    const tx = createFakeTx();
    tx.round.findUnique.mockResolvedValue({ id: "r1", status: "OPEN" });
    tx.bookSuggestion.findMany.mockResolvedValue([
      {
        id: "s1",
        bookId: "loser-book",
        createdAt: new Date("2026-01-01"),
        _count: { votes: 1 },
      },
      {
        id: "s2",
        bookId: "winner-book",
        createdAt: new Date("2026-01-02"),
        _count: { votes: 5 },
      },
    ]);

    const winner = await closeRoundTx(tx, "r1");

    expect(winner).toMatchObject({ bookId: "winner-book" });
    // setCurrentBookTx fue invocado para el ganador
    expect(tx.book.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "winner-book" } }),
    );
    // libros perdedores archivados, solo si estaban SUGGESTED
    expect(tx.book.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["loser-book"] }, status: "SUGGESTED" },
        data: { status: "ARCHIVED" },
      }),
    );
    expect(tx.round.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { status: "CLOSED", winnerBookId: "winner-book" },
    });
  });

  it("permite forzar un ganador específico (elección manual del admin)", async () => {
    const tx = createFakeTx();
    tx.round.findUnique.mockResolvedValue({ id: "r1", status: "OPEN" });
    tx.bookSuggestion.findMany.mockResolvedValue([
      {
        id: "s1",
        bookId: "most-voted",
        createdAt: new Date("2026-01-01"),
        _count: { votes: 10 },
      },
      {
        id: "s2",
        bookId: "manually-chosen",
        createdAt: new Date("2026-01-02"),
        _count: { votes: 0 },
      },
    ]);

    const winner = await closeRoundTx(tx, "r1", "manually-chosen");

    expect(winner).toMatchObject({ bookId: "manually-chosen" });
    expect(tx.round.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { status: "CLOSED", winnerBookId: "manually-chosen" },
    });
  });
});
