import { describe, expect, it } from "vitest";
import { pickWinner } from "@/server/services/round-winner";

describe("pickWinner", () => {
  it("retorna null cuando no hay sugerencias", () => {
    expect(pickWinner([])).toBeNull();
  });

  it("retorna el único candidato cuando solo hay uno", () => {
    const candidate = {
      id: "s1",
      bookId: "b1",
      voteCount: 0,
      createdAt: new Date("2026-01-01"),
    };
    expect(pickWinner([candidate])).toEqual(candidate);
  });

  it("retorna el candidato con más votos", () => {
    const loser = {
      id: "s1",
      bookId: "b1",
      voteCount: 2,
      createdAt: new Date("2026-01-01"),
    };
    const winner = {
      id: "s2",
      bookId: "b2",
      voteCount: 5,
      createdAt: new Date("2026-01-02"),
    };
    expect(pickWinner([loser, winner])).toEqual(winner);
  });

  it("en caso de empate de votos, desempata por createdAt más antiguo", () => {
    const older = {
      id: "s1",
      bookId: "b1",
      voteCount: 3,
      createdAt: new Date("2026-01-01"),
    };
    const newer = {
      id: "s2",
      bookId: "b2",
      voteCount: 3,
      createdAt: new Date("2026-01-05"),
    };
    expect(pickWinner([newer, older])).toEqual(older);
    expect(pickWinner([older, newer])).toEqual(older);
  });

  it("mantiene orden estable cuando hay empate total de votos y createdAt", () => {
    const first = {
      id: "s1",
      bookId: "b1",
      voteCount: 4,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    };
    const second = {
      id: "s2",
      bookId: "b2",
      voteCount: 4,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    };
    expect(pickWinner([first, second])).toEqual(first);
    expect(pickWinner([second, first])).toEqual(second);
  });
});
