import { describe, expect, it } from "vitest";
import { rankByPoints } from "@/server/services/kahoot-ranking";

interface Entry {
  userId: string;
  points: number;
}

describe("rankByPoints", () => {
  it("retorna un arreglo vacío cuando no hay entradas", () => {
    expect(rankByPoints<Entry>([], (e) => e.points)).toEqual([]);
  });

  it("asigna el puesto 1 al único candidato", () => {
    const entries: Entry[] = [{ userId: "a", points: 40 }];
    const ranked = rankByPoints(entries, (e) => e.points);
    expect(ranked).toEqual([{ userId: "a", points: 40, rank: 1 }]);
  });

  it("ordena de mayor a menor puntaje y asigna rank consecutivo sin empates", () => {
    const entries: Entry[] = [
      { userId: "a", points: 50 },
      { userId: "b", points: 90 },
      { userId: "c", points: 70 },
    ];

    const ranked = rankByPoints(entries, (e) => e.points);

    expect(ranked.map((r) => r.userId)).toEqual(["b", "c", "a"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("los empates comparten el mismo puesto y el siguiente rank salta (1, 1, 3)", () => {
    const entries: Entry[] = [
      { userId: "a", points: 80 },
      { userId: "b", points: 80 },
      { userId: "c", points: 60 },
    ];

    const ranked = rankByPoints(entries, (e) => e.points);

    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("un triple empate en primer lugar deja al cuarto en el puesto 4", () => {
    const entries: Entry[] = [
      { userId: "a", points: 100 },
      { userId: "b", points: 100 },
      { userId: "c", points: 100 },
      { userId: "d", points: 40 },
    ];

    const ranked = rankByPoints(entries, (e) => e.points);

    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 1, 4]);
  });

  it("mantiene el orden de entrada de forma estable entre empatados", () => {
    const entries: Entry[] = [
      { userId: "first", points: 10 },
      { userId: "second", points: 10 },
    ];

    const ranked = rankByPoints(entries, (e) => e.points);

    expect(ranked.map((r) => r.userId)).toEqual(["first", "second"]);
  });

  it("no muta el arreglo original", () => {
    const entries: Entry[] = [
      { userId: "a", points: 10 },
      { userId: "b", points: 90 },
    ];
    const copy = [...entries];

    rankByPoints(entries, (e) => e.points);

    expect(entries).toEqual(copy);
  });

  it("funciona con puntos acumulados (totales de varias actividades)", () => {
    const totals = [
      { userId: "a", totalPoints: 250, activitiesPlayed: 3 },
      { userId: "b", totalPoints: 310, activitiesPlayed: 4 },
    ];

    const ranked = rankByPoints(totals, (e) => e.totalPoints);

    expect(ranked.map((r) => r.userId)).toEqual(["b", "a"]);
  });
});
