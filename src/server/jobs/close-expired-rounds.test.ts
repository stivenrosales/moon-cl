import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const transactionMock = vi.fn();
const closeRoundTxMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    round: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

vi.mock("@/server/services/club", () => ({
  closeRoundTx: (...args: unknown[]) => closeRoundTxMock(...args),
}));

import { closeExpiredRounds } from "@/server/jobs/close-expired-rounds";

describe("closeExpiredRounds", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    transactionMock.mockReset();
    closeRoundTxMock.mockReset();
    // simula db.$transaction ejecutando el callback con un tx "fake"
    transactionMock.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb({}),
    );
  });

  it("no cierra nada cuando no hay rondas OPEN vencidas", async () => {
    findManyMock.mockResolvedValue([]);

    const result = await closeExpiredRounds();

    expect(result).toEqual({ closed: 0 });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("busca rondas OPEN con endsAt vencido y las cierra dentro de una transacción", async () => {
    findManyMock.mockResolvedValue([{ id: "round-1" }, { id: "round-2" }]);
    closeRoundTxMock.mockResolvedValue({ bookId: "book-1" });
    const now = new Date("2026-07-10T12:00:00.000Z");

    const result = await closeExpiredRounds(now);

    expect(findManyMock).toHaveBeenCalledWith({
      where: { status: "OPEN", endsAt: { lte: now } },
      select: { id: true },
    });
    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(closeRoundTxMock).toHaveBeenNthCalledWith(1, {}, "round-1");
    expect(closeRoundTxMock).toHaveBeenNthCalledWith(2, {}, "round-2");
    expect(result).toEqual({ closed: 2 });
  });

  it("cierra sin romper una ronda sin sugerencias (closeRoundTx resuelve null)", async () => {
    findManyMock.mockResolvedValue([{ id: "round-sin-sugerencias" }]);
    closeRoundTxMock.mockResolvedValue(null);

    const result = await closeExpiredRounds();

    expect(result).toEqual({ closed: 1 });
  });

  it("usa new Date() por defecto cuando no se pasa 'now'", async () => {
    findManyMock.mockResolvedValue([]);

    await closeExpiredRounds();

    const call = findManyMock.mock.calls[0][0];
    expect(call.where.endsAt.lte).toBeInstanceOf(Date);
  });
});
