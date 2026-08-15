import { describe, expect, it, vi } from "vitest";
import { ejecutarBusqueda, estadoDesdeResultado } from "@/lib/book-search-state";
import type { BookCandidate, BookSearchResult } from "@/lib/google-books";

/**
 * Este módulo existe porque book-search.tsx, add-to-shelf-dialog.tsx,
 * book-edit-dialog.tsx y admin/add-book-dialog.tsx tenían el mismo
 * discriminated union EstadoBusqueda y el mismo callback `buscar` copiados
 * LITERALMENTE cuatro veces. La traducción de BookSearchResult a estado de
 * UI es la parte con lógica real (y la que un cambio futuro rompería en
 * cuatro lugares a la vez si seguía duplicada), así que es la que se
 * testea acá.
 */

const candidato: BookCandidate = {
  googleBooksId: "gb:abc123",
  title: "Dune",
  authors: ["Frank Herbert"],
  coverUrl: null,
  description: null,
  pageCount: 412,
  publishedYear: 1965,
  isbn: null,
};

describe("estadoDesdeResultado", () => {
  it("traduce status ok con resultados a tipo resultados, preservando degradado", () => {
    const resultado: BookSearchResult = { status: "ok", books: [candidato], degradado: false };
    expect(estadoDesdeResultado(resultado)).toEqual({
      tipo: "resultados",
      books: [candidato],
      degradado: false,
    });
  });

  it("propaga degradado: true con resultados — es la señal de que una fuente no respondió", () => {
    const resultado: BookSearchResult = { status: "ok", books: [candidato], degradado: true };
    expect(estadoDesdeResultado(resultado)).toEqual({
      tipo: "resultados",
      books: [candidato],
      degradado: true,
    });
  });

  it("traduce status ok con books vacío a tipo sin-resultados, no a error", () => {
    const resultado: BookSearchResult = { status: "ok", books: [], degradado: false };
    expect(estadoDesdeResultado(resultado)).toEqual({ tipo: "sin-resultados", degradado: false });
  });

  // El bug original: una fuente cae, la otra responde vacío. El resultado
  // sigue siendo "ok" con degradado: true y books: [] — pero los cuatro
  // componentes anidaban el aviso de degradado DENTRO de la condición de
  // "hay resultados", así que la usuaria caía derecho al "no existe ese
  // libro" sin enterarse de que la búsqueda quedó incompleta. El tipo
  // "sin-resultados" (separado de "resultados") existe para que sea
  // IMPOSIBLE volver a anidar mal: cada rama del discriminated union se
  // maneja aparte.
  it("traduce degradado con lista vacía a tipo sin-resultados con degradado true — el caso que antes se perdía", () => {
    const resultado: BookSearchResult = { status: "ok", books: [], degradado: true };
    expect(estadoDesdeResultado(resultado)).toEqual({ tipo: "sin-resultados", degradado: true });
  });

  it("traduce status error a tipo error", () => {
    const resultado: BookSearchResult = { status: "error" };
    expect(estadoDesdeResultado(resultado)).toEqual({ tipo: "error" });
  });
});

describe("ejecutarBusqueda", () => {
  it("devuelve el estado ok cuando la búsqueda resuelve con resultados", async () => {
    const buscar = vi.fn(async (): Promise<BookSearchResult> => ({
      status: "ok",
      books: [candidato],
      degradado: false,
    }));

    const estado = await ejecutarBusqueda("dune", buscar);

    expect(buscar).toHaveBeenCalledWith("dune");
    expect(estado).toEqual({ tipo: "resultados", books: [candidato], degradado: false });
  });

  it("devuelve tipo error cuando la búsqueda resuelve con status error", async () => {
    const buscar = vi.fn(async (): Promise<BookSearchResult> => ({ status: "error" }));

    const estado = await ejecutarBusqueda("dune", buscar);

    expect(estado).toEqual({ tipo: "error" });
  });

  // searchBooks (services/google-books.ts) nunca lanza, pero si la propia
  // llamada RPC de la Server Action falla (sin red, por ejemplo) es el
  // mismo caso para la usuaria: la búsqueda falló, no que no haya
  // resultados. Antes este catch vivía copiado en cada componente con un
  // `err` sin usar.
  it("devuelve tipo error cuando la llamada RPC rechaza, sin filtrar el error sin usar", async () => {
    const buscar = vi.fn(async (): Promise<BookSearchResult> => {
      throw new Error("sin red");
    });

    const estado = await ejecutarBusqueda("dune", buscar);

    expect(estado).toEqual({ tipo: "error" });
  });
});
