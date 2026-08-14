import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks del client "de afuera" (db) y del client "de adentro" de la
// transacción (tx) van SEPARADOS a propósito: es la única forma de que un
// test detecte si alguien saca findOrCreateBook o setCurrentBookTx de la
// transacción y los deja operando sobre `db` directo. Con un solo juego de
// mocks compartido entre ambos, ese bug pasaría el test igual.
const dbBookFindUniqueMock = vi.fn();
const dbBookCreateMock = vi.fn();
const dbBookUpdateManyMock = vi.fn();
const dbBookUpdateMock = vi.fn();
const txBookFindUniqueMock = vi.fn();
const txBookCreateMock = vi.fn();
const txBookUpdateManyMock = vi.fn();
const txBookUpdateMock = vi.fn();
const transactionMock = vi.fn();
const requireModeratorMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    book: {
      findUnique: (...args: unknown[]) => dbBookFindUniqueMock(...args),
      create: (...args: unknown[]) => dbBookCreateMock(...args),
      updateMany: (...args: unknown[]) => dbBookUpdateManyMock(...args),
      update: (...args: unknown[]) => dbBookUpdateMock(...args),
    },
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

vi.mock("@/server/auth-helpers", () => ({
  requireUser: vi.fn(),
  requireModerator: (...args: unknown[]) => requireModeratorMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { createBook } from "@/server/actions/books";

const MODERADORA = { id: "user-1", role: "MODERATOR" };

// tx "fake" que recibe el callback pasado a db.$transaction: mockeado con su
// PROPIO juego de mocks, distinto del de `db`.
const tx = {
  book: {
    findUnique: (...args: unknown[]) => txBookFindUniqueMock(...args),
    create: (...args: unknown[]) => txBookCreateMock(...args),
    updateMany: (...args: unknown[]) => txBookUpdateManyMock(...args),
    update: (...args: unknown[]) => txBookUpdateMock(...args),
  },
};

beforeEach(() => {
  dbBookFindUniqueMock.mockReset();
  dbBookCreateMock.mockReset();
  dbBookUpdateManyMock.mockReset();
  dbBookUpdateMock.mockReset();
  txBookFindUniqueMock.mockReset();
  txBookCreateMock.mockReset();
  txBookUpdateManyMock.mockReset();
  txBookUpdateMock.mockReset();
  transactionMock.mockReset();
  requireModeratorMock.mockReset();
  revalidatePathMock.mockReset();

  requireModeratorMock.mockResolvedValue(MODERADORA);
  transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));
  dbBookFindUniqueMock.mockResolvedValue(null);
  dbBookCreateMock.mockResolvedValue({ id: "book-1", title: "Cien años de soledad" });
  txBookFindUniqueMock.mockResolvedValue(null);
  txBookCreateMock.mockResolvedValue({ id: "book-1", title: "Cien años de soledad" });
  txBookUpdateManyMock.mockResolvedValue({ count: 1 });
  txBookUpdateMock.mockResolvedValue({ id: "book-1", isCurrent: true });
});

describe("createBook", () => {
  it("crea el libro y no toca el libro en curso cuando marcarComoActual es false", async () => {
    const resultado = await createBook({ title: "Cien años de soledad" });

    expect(resultado).toEqual({ id: "book-1", title: "Cien años de soledad" });
    expect(dbBookCreateMock).toHaveBeenCalledTimes(1);
    expect(transactionMock).not.toHaveBeenCalled();
    // Assert negativo sobre los mocks de tx: si alguien envolviera este
    // camino en una transacción "por las dudas", esto lo detecta.
    expect(txBookCreateMock).not.toHaveBeenCalled();
    expect(txBookUpdateManyMock).not.toHaveBeenCalled();
    expect(txBookUpdateMock).not.toHaveBeenCalled();
    expect(dbBookUpdateManyMock).not.toHaveBeenCalled();
    expect(dbBookUpdateMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin");
    expect(revalidatePathMock).toHaveBeenCalledWith("/leer");
    expect(revalidatePathMock).toHaveBeenCalledWith("/hoy");
    expect(revalidatePathMock).not.toHaveBeenCalledWith("/leer/libro/book-1");
  });

  it("crea el libro y lo deja como lectura en curso dentro de la misma transacción cuando marcarComoActual es true", async () => {
    const resultado = await createBook({
      title: "Cien años de soledad",
      marcarComoActual: true,
    });

    expect(resultado).toEqual({ id: "book-1", title: "Cien años de soledad" });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    // Las tres escrituras deben pasar por el `tx`, no por `db` directo:
    // eso es lo que garantiza que crear el libro y marcarlo como actual
    // ocurran de forma atómica.
    expect(txBookCreateMock).toHaveBeenCalledTimes(1);
    // setCurrentBookTx: archiva el libro anterior y marca el nuevo como actual,
    // ambas escrituras dentro del mismo tx que crea el libro.
    expect(txBookUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isCurrent: true, NOT: { id: "book-1" } },
        data: expect.objectContaining({ isCurrent: false, status: "FINISHED" }),
      }),
    );
    expect(txBookUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "book-1" },
        data: expect.objectContaining({ isCurrent: true, status: "CURRENT" }),
      }),
    );
    // Assert negativo: ninguna de estas escrituras debe haber ocurrido por
    // fuera de la transacción, contra `db` directo.
    expect(dbBookCreateMock).not.toHaveBeenCalled();
    expect(dbBookUpdateManyMock).not.toHaveBeenCalled();
    expect(dbBookUpdateMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/leer/libro/book-1");
  });

  it("rechaza a quien no es moderadora y no crea el libro", async () => {
    requireModeratorMock.mockRejectedValue(new Error("No tienes permisos para esta acción"));

    await expect(createBook({ title: "Cien años de soledad" })).rejects.toThrow(
      "No tienes permisos para esta acción",
    );
    expect(dbBookCreateMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rechaza título vacío", async () => {
    await expect(createBook({ title: "" })).rejects.toThrow();
    expect(dbBookCreateMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("persiste publisher cuando se lo pasa", async () => {
    await createBook({ title: "Cien años de soledad", publisher: "Editorial Sudamericana" });

    expect(dbBookCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ publisher: "Editorial Sudamericana" }),
      }),
    );
  });
});
