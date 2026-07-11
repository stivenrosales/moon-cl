import { describe, expect, it } from "vitest";
import { buildFeed, joinVerbs, type RawFeedEvent } from "@/server/services/feed";

const DIEGO = { id: "user-diego", name: "Diego", email: "diego@test.com", image: null };
const ANA = { id: "user-ana", name: "Ana", email: "ana@test.com", image: null };

const BOOK_CIRCE = { id: "book-circe", title: "Circe", coverUrl: null };
const BOOK_BELOVED = { id: "book-beloved", title: "Beloved", coverUrl: null };

function event(overrides: Partial<RawFeedEvent> & Pick<RawFeedEvent, "type" | "occurredAt">): RawFeedEvent {
  return {
    userId: DIEGO.id,
    user: DIEGO,
    bookId: BOOK_CIRCE.id,
    book: BOOK_CIRCE,
    ...overrides,
  };
}

describe("buildFeed — agrupación de verbos coordinados", () => {
  it("agrupa en una sola entrada las acciones del mismo usuario+libro ocurridas el mismo día", () => {
    const events: RawFeedEvent[] = [
      event({ type: "termino", occurredAt: new Date("2026-07-01T10:00:00.000Z") }),
      event({ type: "califico", occurredAt: new Date("2026-07-01T18:00:00.000Z"), stars: 5 }),
    ];

    const feed = buildFeed(events, []);

    expect(feed).toHaveLength(1);
    expect(feed[0].verbs).toEqual(["termino", "califico"]);
    expect(feed[0].stars).toBe(5);
    expect(joinVerbs(feed[0].verbs)).toBe("terminó y calificó");
  });

  it("separa en entradas distintas las acciones del mismo usuario+libro en días distintos", () => {
    const events: RawFeedEvent[] = [
      event({ type: "termino", occurredAt: new Date("2026-07-01T10:00:00.000Z") }),
      event({ type: "califico", occurredAt: new Date("2026-07-05T10:00:00.000Z"), stars: 4 }),
    ];

    const feed = buildFeed(events, []);

    expect(feed).toHaveLength(2);
    expect(feed.map((f) => f.verbs)).toEqual([["califico"], ["termino"]]);
  });

  it("no agrupa acciones del mismo día si son de libros distintos", () => {
    const events: RawFeedEvent[] = [
      event({ type: "termino", occurredAt: new Date("2026-07-01T10:00:00.000Z") }),
      event({
        type: "califico",
        occurredAt: new Date("2026-07-01T11:00:00.000Z"),
        bookId: BOOK_BELOVED.id,
        book: BOOK_BELOVED,
        stars: 3,
      }),
    ];

    const feed = buildFeed(events, []);

    expect(feed).toHaveLength(2);
  });

  it("no agrupa acciones del mismo día si son de usuarios distintos", () => {
    const events: RawFeedEvent[] = [
      event({ type: "termino", occurredAt: new Date("2026-07-01T10:00:00.000Z") }),
      event({
        type: "califico",
        occurredAt: new Date("2026-07-01T11:00:00.000Z"),
        userId: ANA.id,
        user: ANA,
        stars: 3,
      }),
    ];

    const feed = buildFeed(events, []);

    expect(feed).toHaveLength(2);
  });

  it("no duplica un verbo repetido dentro del mismo grupo (dos citas el mismo día)", () => {
    const events: RawFeedEvent[] = [
      event({
        type: "cito",
        occurredAt: new Date("2026-07-01T10:00:00.000Z"),
        quote: { id: "q1", content: "Frase 1", page: null, chapter: null, likeCount: 0, likedByViewer: false },
      }),
      event({
        type: "cito",
        occurredAt: new Date("2026-07-01T12:00:00.000Z"),
        quote: { id: "q2", content: "Frase 2", page: null, chapter: null, likeCount: 0, likedByViewer: false },
      }),
    ];

    const feed = buildFeed(events, []);

    expect(feed).toHaveLength(1);
    expect(feed[0].verbs).toEqual(["cito"]);
    expect(feed[0].quotes).toHaveLength(2);
    expect(feed[0].quotes.map((q) => q.id)).toEqual(["q1", "q2"]);
  });

  it("ordena los verbos coordinados cronológicamente dentro del grupo", () => {
    const events: RawFeedEvent[] = [
      event({ type: "califico", occurredAt: new Date("2026-07-01T18:00:00.000Z"), stars: 5 }),
      event({ type: "termino", occurredAt: new Date("2026-07-01T10:00:00.000Z") }),
    ];

    const feed = buildFeed(events, []);

    expect(feed[0].verbs).toEqual(["termino", "califico"]);
  });

  it("usa la ocurrencia más reciente del grupo para ordenar el feed (descendente)", () => {
    const events: RawFeedEvent[] = [
      event({ type: "termino", occurredAt: new Date("2026-07-01T10:00:00.000Z") }),
      event({
        type: "empezo",
        occurredAt: new Date("2026-07-03T10:00:00.000Z"),
        bookId: BOOK_BELOVED.id,
        book: BOOK_BELOVED,
      }),
    ];

    const feed = buildFeed(events, []);

    expect(feed[0].book.id).toBe(BOOK_BELOVED.id);
    expect(feed[1].book.id).toBe(BOOK_CIRCE.id);
  });
});

describe("buildFeed — transparencia algorítmica (razon)", () => {
  it("marca razon='club' cuando el libro es la lectura actual del club", () => {
    const events: RawFeedEvent[] = [
      event({ type: "termino", occurredAt: new Date("2026-07-01T10:00:00.000Z") }),
    ];

    const feed = buildFeed(events, [], BOOK_CIRCE.id);

    expect(feed[0].razon).toBe("club");
  });

  it("marca razon='sigues' cuando el autor está en followingIds y el libro no es el del club", () => {
    const events: RawFeedEvent[] = [
      event({ type: "termino", occurredAt: new Date("2026-07-01T10:00:00.000Z") }),
    ];

    const feed = buildFeed(events, [DIEGO.id], null);

    expect(feed[0].razon).toBe("sigues");
  });

  it("prioriza razon='club' sobre 'sigues' cuando ambas condiciones aplican", () => {
    const events: RawFeedEvent[] = [
      event({ type: "termino", occurredAt: new Date("2026-07-01T10:00:00.000Z") }),
    ];

    const feed = buildFeed(events, [DIEGO.id], BOOK_CIRCE.id);

    expect(feed[0].razon).toBe("club");
  });

  it("razon es null cuando no se sigue al autor y el libro no es el del club", () => {
    const events: RawFeedEvent[] = [
      event({ type: "termino", occurredAt: new Date("2026-07-01T10:00:00.000Z") }),
    ];

    const feed = buildFeed(events, [], BOOK_BELOVED.id);

    expect(feed[0].razon).toBeNull();
  });
});

describe("joinVerbs", () => {
  it("retorna un solo verbo sin coordinar", () => {
    expect(joinVerbs(["termino"])).toBe("terminó");
  });

  it("coordina dos verbos con 'y'", () => {
    expect(joinVerbs(["termino", "califico"])).toBe("terminó y calificó");
  });

  it("coordina tres verbos con comas y 'y' antes del último", () => {
    expect(joinVerbs(["empezo", "termino", "califico"])).toBe(
      "empezó a leer, terminó y calificó",
    );
  });

  it("retorna cadena vacía para una lista vacía", () => {
    expect(joinVerbs([])).toBe("");
  });
});
