import { describe, expect, it } from "vitest";
import { gateComment, hasFinishedBook } from "@/server/services/comment-gating";

describe("hasFinishedBook", () => {
  it("true si el UserBook está en FINISHED, sin importar el progreso", () => {
    expect(
      hasFinishedBook({ userBookStatus: "FINISHED", latestProgressPage: null, bookPageCount: null }),
    ).toBe(true);
  });

  it("true si el último ReadingProgress alcanza el total de páginas", () => {
    expect(
      hasFinishedBook({ userBookStatus: "READING", latestProgressPage: 300, bookPageCount: 300 }),
    ).toBe(true);
  });

  it("true si el último ReadingProgress supera el total de páginas", () => {
    expect(
      hasFinishedBook({ userBookStatus: null, latestProgressPage: 310, bookPageCount: 300 }),
    ).toBe(true);
  });

  it("false si el progreso no alcanza el total de páginas", () => {
    expect(
      hasFinishedBook({ userBookStatus: "READING", latestProgressPage: 150, bookPageCount: 300 }),
    ).toBe(false);
  });

  it("false sin pageCount conocido y sin UserBook FINISHED", () => {
    expect(
      hasFinishedBook({ userBookStatus: "READING", latestProgressPage: 500, bookPageCount: null }),
    ).toBe(false);
  });

  it("false sin ningún dato (el usuario nunca marcó avance)", () => {
    expect(
      hasFinishedBook({ userBookStatus: null, latestProgressPage: null, bookPageCount: null }),
    ).toBe(false);
  });

  it("WANT_TO_READ no cuenta como terminado por sí solo", () => {
    expect(
      hasFinishedBook({ userBookStatus: "WANT_TO_READ", latestProgressPage: null, bookPageCount: 300 }),
    ).toBe(false);
  });
});

describe("gateComment", () => {
  const baseCtx = {
    currentUserId: "user-1",
    myChapter: 5,
    isModerator: false,
    hasFinishedBook: false,
  };

  it("bloquea un comentario de un capítulo posterior al mío", () => {
    const decision = gateComment(
      { authorId: "user-2", chapter: 6, isSpoiler: false, isReflection: false },
      baseCtx,
    );
    expect(decision).toEqual({ locked: true, reason: "chapter" });
  });

  it("no bloquea un comentario del mismo capítulo en el que voy", () => {
    const decision = gateComment(
      { authorId: "user-2", chapter: 5, isSpoiler: false, isReflection: false },
      baseCtx,
    );
    expect(decision).toEqual({ locked: false });
  });

  it("no bloquea un comentario de un capítulo anterior al mío", () => {
    const decision = gateComment(
      { authorId: "user-2", chapter: 1, isSpoiler: false, isReflection: false },
      baseCtx,
    );
    expect(decision).toEqual({ locked: false });
  });

  it("no bloquea un comentario sin capítulo declarado (sala general)", () => {
    const decision = gateComment(
      { authorId: "user-2", chapter: null, isSpoiler: false, isReflection: false },
      baseCtx,
    );
    expect(decision).toEqual({ locked: false });
  });

  it("el moderador ve todo: capítulos futuros, spoilers y la sala de reflexión sin terminar", () => {
    const decision = gateComment(
      { authorId: "user-2", chapter: 999, isSpoiler: true, isReflection: true },
      { ...baseCtx, isModerator: true },
    );
    expect(decision).toEqual({ locked: false });
  });

  it("la sala de reflexión requiere haber terminado el libro", () => {
    const decision = gateComment(
      { authorId: "user-2", chapter: null, isSpoiler: false, isReflection: true },
      baseCtx,
    );
    expect(decision).toEqual({ locked: true, reason: "reflection" });
  });

  it("la sala de reflexión se abre si el usuario ya terminó el libro", () => {
    const decision = gateComment(
      { authorId: "user-2", chapter: null, isSpoiler: false, isReflection: true },
      { ...baseCtx, hasFinishedBook: true },
    );
    expect(decision).toEqual({ locked: false });
  });

  it("oculta el contenido de un comentario marcado como spoiler", () => {
    const decision = gateComment(
      { authorId: "user-2", chapter: 1, isSpoiler: true, isReflection: false },
      baseCtx,
    );
    expect(decision).toEqual({ locked: true, reason: "spoiler" });
  });

  it("el autor siempre ve su propio comentario aunque esté marcado como spoiler", () => {
    const decision = gateComment(
      { authorId: "user-1", chapter: 1, isSpoiler: true, isReflection: false },
      baseCtx,
    );
    expect(decision).toEqual({ locked: false });
  });
});
