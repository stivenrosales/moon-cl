import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mezclarCandidatos,
  sanearCandidato,
  searchBooks,
  type BookCandidate,
} from "@/lib/google-books";
import { bookInputSchema } from "@/lib/validators";

/**
 * Estos tests existen porque un candidato crudo de Google Books u Open
 * Library NO cumple bookInputSchema por sí solo, y las tres puertas de
 * entrada de libros (crear desde /admin, agregar a la estantería y sugerir
 * en una ronda) parsean con ese schema. Cuando la API devolvía basura —un
 * pageCount 0, una descripción larguísima— el parse lanzaba y la usuaria
 * solo veía "An error occurred in the Server Components render", sin pista
 * de qué había pasado.
 */

const base: BookCandidate = {
  googleBooksId: "gb:abc123",
  title: "El cuento de la criada",
  authors: ["Margaret Atwood"],
  coverUrl: "https://books.google.com/books/content?id=abc&img=1&zoom=2",
  description: "Una distopía.",
  pageCount: 352,
  publishedYear: 2021,
  isbn: "9788466346127",
};

/** Lo que de verdad importa: que el resultado pase el schema que usan las actions. */
function pasaElSchema(c: BookCandidate) {
  return bookInputSchema.safeParse(c).success;
}

describe("sanearCandidato", () => {
  it("deja intacto un candidato que ya viene bien", () => {
    expect(sanearCandidato(base)).toEqual(base);
  });

  // Google Books devuelve pageCount 0 en registros pobres (los mismos que
  // vienen sin portada). Cero páginas no es un dato: es ausencia de dato, y
  // el schema exige positivo. Colapsarlo a null es lo correcto acá — ojo que
  // NO es el caso de currentPage en progreso de lectura, donde la página 0
  // sí es un valor legítimo y distinto de null.
  it("convierte pageCount 0 en null porque cero páginas es ausencia de dato", () => {
    const saneado = sanearCandidato({ ...base, pageCount: 0 });
    expect(saneado.pageCount).toBeNull();
    expect(pasaElSchema(saneado)).toBe(true);
  });

  it("descarta un pageCount negativo o absurdo", () => {
    expect(sanearCandidato({ ...base, pageCount: -5 }).pageCount).toBeNull();
    expect(sanearCandidato({ ...base, pageCount: 99999 }).pageCount).toBeNull();
  });

  it("trunca una descripción más larga que el máximo del schema", () => {
    const saneado = sanearCandidato({ ...base, description: "x".repeat(9000) });
    expect(saneado.description).toHaveLength(8000);
    expect(pasaElSchema(saneado)).toBe(true);
  });

  // Un ISBN recortado a la fuerza sería un identificador falso, así que se
  // descarta entero en vez de truncarlo.
  it("descarta un isbn más largo que el máximo en vez de truncarlo", () => {
    const saneado = sanearCandidato({ ...base, isbn: "978-84-663-XXXX-1234567" });
    expect(saneado.isbn).toBeNull();
    expect(pasaElSchema(saneado)).toBe(true);
  });

  it("descarta una coverUrl vacía o que no es una URL", () => {
    expect(sanearCandidato({ ...base, coverUrl: "" }).coverUrl).toBeNull();
    expect(sanearCandidato({ ...base, coverUrl: "no-soy-una-url" }).coverUrl).toBeNull();
    expect(pasaElSchema(sanearCandidato({ ...base, coverUrl: "" }))).toBe(true);
  });

  it("trunca un título más largo que el máximo del schema", () => {
    const saneado = sanearCandidato({ ...base, title: "x".repeat(400) });
    expect(saneado.title).toHaveLength(280);
    expect(pasaElSchema(saneado)).toBe(true);
  });

  it("trunca los nombres de autores largos y descarta los vacíos", () => {
    const saneado = sanearCandidato({ ...base, authors: ["y".repeat(200), "   ", "Ana"] });
    expect(saneado.authors).toEqual(["y".repeat(120), "Ana"]);
    expect(pasaElSchema(saneado)).toBe(true);
  });

  it("descarta un publishedYear fuera de rango", () => {
    expect(sanearCandidato({ ...base, publishedYear: 3200 }).publishedYear).toBeNull();
    expect(sanearCandidato({ ...base, publishedYear: -50 }).publishedYear).toBeNull();
  });

  it("deja pasar el candidato más pobre posible: solo título", () => {
    const pobre: BookCandidate = {
      googleBooksId: "gb:x",
      title: "Sin metadata",
      authors: [],
      coverUrl: null,
      description: null,
      pageCount: 0,
      publishedYear: null,
      isbn: null,
    };
    expect(pasaElSchema(sanearCandidato(pobre))).toBe(true);
  });
});

function candidato(over: Partial<BookCandidate>): BookCandidate {
  return { ...base, ...over };
}

describe("mezclarCandidatos", () => {
  it("prioriza Google Books sobre Open Library cuando hay el mismo isbn", () => {
    const gb = [candidato({ googleBooksId: "gb:1", isbn: "111", title: "De Google" })];
    const ol = [candidato({ googleBooksId: "ol:1", isbn: "111", title: "De Open Library" })];
    const resultado = mezclarCandidatos(gb, ol, 8);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].googleBooksId).toBe("gb:1");
  });

  it("deduplica por título+autor cuando no hay isbn", () => {
    const gb = [
      candidato({ googleBooksId: "gb:1", isbn: null, title: "Rayuela", authors: ["Cortázar"] }),
    ];
    const ol = [
      candidato({ googleBooksId: "ol:1", isbn: null, title: "Rayuela", authors: ["Cortázar"] }),
    ];
    expect(mezclarCandidatos(gb, ol, 8)).toHaveLength(1);
  });

  it("conserva candidatos distintos de ambas fuentes", () => {
    const gb = [candidato({ googleBooksId: "gb:1", isbn: "111" })];
    const ol = [candidato({ googleBooksId: "ol:1", isbn: "222" })];
    const resultado = mezclarCandidatos(gb, ol, 8);
    expect(resultado.map((b) => b.googleBooksId)).toEqual(["gb:1", "ol:1"]);
  });

  it("respeta el máximo aunque haya más candidatos disponibles", () => {
    const gb = [
      candidato({ googleBooksId: "gb:1", isbn: "1" }),
      candidato({ googleBooksId: "gb:2", isbn: "2" }),
    ];
    const ol = [candidato({ googleBooksId: "ol:1", isbn: "3" })];
    expect(mezclarCandidatos(gb, ol, 2)).toHaveLength(2);
  });
});

/**
 * searchBooks combina dos fuentes externas por HTTP. Antes, un 429 de
 * Google Books o un timeout de cualquiera de las dos hacía `return []` — el
 * mismo resultado que "no existe ese libro". Estos tests mockean `fetch`
 * para verificar que ahora "sin resultados" (ambas fuentes respondieron
 * vacío) y "la búsqueda falló" (ninguna fuente respondió) sean estados
 * DISTINGUIBLES, y que el caso parcial (una fuente cae, la otra responde)
 * quede marcado como degradado sin convertirse en un error.
 */
describe("searchBooks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function respuestaOk(body: unknown) {
    return { ok: true, status: 200, json: async () => body };
  }

  function respuestaFallida(status: number) {
    return { ok: false, status, json: async () => ({}) };
  }

  it("devuelve status ok con books vacío cuando ambas fuentes responden sin resultados: eso NO es un fallo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("googleapis.com")) return respuestaOk({ items: [] });
        return respuestaOk({ docs: [] });
      }),
    );

    const resultado = await searchBooks("un libro que no existe");

    expect(resultado).toEqual({ status: "ok", books: [], degradado: false });
  });

  it("devuelve status error cuando las dos fuentes fallan, en vez de disfrazarlo de 'sin resultados'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("googleapis.com")) return respuestaFallida(429);
        return Promise.reject(new Error("timeout"));
      }),
    );

    const resultado = await searchBooks("cien años de soledad");

    expect(resultado).toEqual({ status: "error" });
  });

  it("marca degradado (no error) cuando una fuente falla pero la otra trae resultados", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("googleapis.com")) return respuestaFallida(429);
        return respuestaOk({
          docs: [{ key: "/works/OL1W", title: "Dune", author_name: ["Frank Herbert"] }],
        });
      }),
    );

    const resultado = await searchBooks("dune");

    expect(resultado.status).toBe("ok");
    if (resultado.status === "ok") {
      expect(resultado.degradado).toBe(true);
      expect(resultado.books).toHaveLength(1);
    }
  });

  it("registra el fallo con console.error incluso en producción, para que no vuelva a pasar desapercibido", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respuestaFallida(429)),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await searchBooks("dune");

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
