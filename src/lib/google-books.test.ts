import { describe, expect, it } from "vitest";
import { sanearCandidato, type BookCandidate } from "@/lib/google-books";
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
