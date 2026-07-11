import { describe, expect, it } from "vitest";
import { GENEROS } from "@/lib/genres";

describe("GENEROS", () => {
  it("contiene exactamente los 20 géneros del mockup, en orden", () => {
    expect(GENEROS).toEqual([
      "Novela",
      "Cuento",
      "Poesía",
      "Ensayo",
      "Ciencia ficción",
      "Fantasía",
      "Realismo mágico",
      "Romance",
      "Terror",
      "Policial",
      "Thriller",
      "Biografía",
      "Historia",
      "Filosofía",
      "Teatro",
      "Novela gráfica",
      "Juvenil",
      "Clásicos",
      "Crónica",
      "Divulgación",
    ]);
  });

  it("no tiene géneros duplicados", () => {
    expect(new Set(GENEROS).size).toBe(GENEROS.length);
  });
});
