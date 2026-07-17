import { beforeEach, describe, expect, it, vi } from "vitest";

const bookSuggestionFindUniqueMock = vi.fn();
const voteFindUniqueMock = vi.fn();
const voteCreateMock = vi.fn();
const voteDeleteMock = vi.fn();
const requireUserMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    bookSuggestion: {
      findUnique: (...args: unknown[]) => bookSuggestionFindUniqueMock(...args),
    },
    vote: {
      findUnique: (...args: unknown[]) => voteFindUniqueMock(...args),
      create: (...args: unknown[]) => voteCreateMock(...args),
      delete: (...args: unknown[]) => voteDeleteMock(...args),
    },
  },
}));

vi.mock("@/server/auth-helpers", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { toggleVote } from "@/server/actions/votes";

const USER = { id: "user-1", role: "MEMBER" };
const VALID_ID = "cluid1234567890abcdefghi";

function suggestion(round: { status: string; endsAt: Date }) {
  return { id: VALID_ID, roundId: "round-1", round };
}

beforeEach(() => {
  bookSuggestionFindUniqueMock.mockReset();
  voteFindUniqueMock.mockReset();
  voteCreateMock.mockReset();
  voteDeleteMock.mockReset();
  requireUserMock.mockReset();
  revalidatePathMock.mockReset();
  requireUserMock.mockResolvedValue(USER);
});

describe("toggleVote", () => {
  it("lanza error si la sugerencia no existe", async () => {
    bookSuggestionFindUniqueMock.mockResolvedValue(null);

    await expect(toggleVote(VALID_ID)).rejects.toThrow("Sugerencia no encontrada");
    expect(voteCreateMock).not.toHaveBeenCalled();
    expect(voteFindUniqueMock).not.toHaveBeenCalled();
  });

  it("no deja votar en una ronda que no está OPEN", async () => {
    bookSuggestionFindUniqueMock.mockResolvedValue(
      suggestion({ status: "CLOSED", endsAt: new Date("2099-01-01") }),
    );

    await expect(toggleVote(VALID_ID)).rejects.toThrow("La ronda no está abierta para votar");
    expect(voteCreateMock).not.toHaveBeenCalled();
    expect(voteFindUniqueMock).not.toHaveBeenCalled();
  });

  it("no deja votar tras el cierre (endsAt en el pasado) aunque la ronda siga marcada OPEN", async () => {
    bookSuggestionFindUniqueMock.mockResolvedValue(
      suggestion({ status: "OPEN", endsAt: new Date("2020-01-01") }),
    );

    await expect(toggleVote(VALID_ID)).rejects.toThrow("La ronda ya cerró, no se puede votar");
    expect(voteCreateMock).not.toHaveBeenCalled();
  });

  it("registra el voto la primera vez que el usuario vota (camino feliz)", async () => {
    bookSuggestionFindUniqueMock.mockResolvedValue(
      suggestion({ status: "OPEN", endsAt: new Date("2099-01-01") }),
    );
    voteFindUniqueMock.mockResolvedValue(null);
    voteCreateMock.mockResolvedValue({ id: "vote-1" });

    const result = await toggleVote(VALID_ID);

    expect(voteCreateMock).toHaveBeenCalledWith({
      data: { suggestionId: VALID_ID, userId: "user-1" },
    });
    expect(voteDeleteMock).not.toHaveBeenCalled();
    expect(result).toEqual({ voted: true });
    expect(revalidatePathMock).toHaveBeenCalledWith("/agenda/ronda/round-1");
  });

  it("quita el voto si el usuario ya había votado (toggle apagado)", async () => {
    bookSuggestionFindUniqueMock.mockResolvedValue(
      suggestion({ status: "OPEN", endsAt: new Date("2099-01-01") }),
    );
    voteFindUniqueMock.mockResolvedValue({ id: "vote-existing" });
    voteDeleteMock.mockResolvedValue({ id: "vote-existing" });

    const result = await toggleVote(VALID_ID);

    expect(voteDeleteMock).toHaveBeenCalledWith({ where: { id: "vote-existing" } });
    expect(voteCreateMock).not.toHaveBeenCalled();
    expect(result).toEqual({ voted: false });
  });

  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(toggleVote(VALID_ID)).rejects.toThrow("Debes iniciar sesión");
    expect(bookSuggestionFindUniqueMock).not.toHaveBeenCalled();
  });

  it("rechaza un id que no es un cuid válido", async () => {
    await expect(toggleVote("no-es-un-cuid")).rejects.toThrow();
    expect(bookSuggestionFindUniqueMock).not.toHaveBeenCalled();
  });
});
