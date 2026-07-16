import { describe, expect, it } from "vitest";
import {
  NUDGE_KEYS,
  computeNudgeBackfillRows,
  usersWithAtLeastOneFinishedBook,
  usersWithMinFollows,
  usersWithMinRatings,
} from "@/server/services/nudge-backfill";
import { NUDGE_KEYS as QUEUE_NUDGE_KEYS } from "@/server/services/nudge-queue";

describe("NUDGE_KEYS — alineadas con el catálogo real de nudge-queue.ts", () => {
  it("cada key que el backfill escribe existe en el catálogo que nextNudge() reconoce", () => {
    // Si esta key no está en NUDGE_KEYS de nudge-queue.ts, nextNudge() la
    // descarta al armar dismissedKeys (filtra por ese catálogo) y la fila del
    // backfill queda invisible: el backfill "corre" pero no bloquea nada.
    for (const key of Object.values(NUDGE_KEYS)) {
      expect(QUEUE_NUDGE_KEYS as readonly string[]).toContain(key);
    }
  });
});

describe("usersWithAtLeastOneFinishedBook", () => {
  it("devuelve solo los userId con al menos un UserBook en status FINISHED", () => {
    const result = usersWithAtLeastOneFinishedBook([
      { userId: "u1", status: "FINISHED" },
      { userId: "u2", status: "READING" },
      { userId: "u3", status: "WANT_TO_READ" },
    ]);
    expect(result).toEqual(["u1"]);
  });

  it("no duplica userId con varios libros FINISHED", () => {
    const result = usersWithAtLeastOneFinishedBook([
      { userId: "u1", status: "FINISHED" },
      { userId: "u1", status: "FINISHED" },
    ]);
    expect(result).toEqual(["u1"]);
  });

  it("devuelve vacío si nadie ha terminado un libro", () => {
    expect(usersWithAtLeastOneFinishedBook([{ userId: "u1", status: "READING" }])).toEqual([]);
  });
});

describe("usersWithMinRatings", () => {
  it("devuelve userId con 3 o más ratings", () => {
    const ratings = [
      { userId: "u1" },
      { userId: "u1" },
      { userId: "u1" },
      { userId: "u2" },
      { userId: "u2" },
    ];
    expect(usersWithMinRatings(ratings)).toEqual(["u1"]);
  });

  it("excluye a quien tiene exactamente 2 ratings (el disparador es >= 3)", () => {
    const ratings = [{ userId: "u1" }, { userId: "u1" }];
    expect(usersWithMinRatings(ratings)).toEqual([]);
  });

  it("respeta un mínimo custom", () => {
    const ratings = [{ userId: "u1" }, { userId: "u1" }];
    expect(usersWithMinRatings(ratings, 2)).toEqual(["u1"]);
  });
});

describe("usersWithMinFollows", () => {
  it("devuelve followerId con 2 o más Follow como seguidor", () => {
    const follows = [
      { followerId: "u1" },
      { followerId: "u1" },
      { followerId: "u2" },
    ];
    expect(usersWithMinFollows(follows)).toEqual(["u1"]);
  });

  it("excluye a quien solo sigue a 1 persona (el disparador es >= 2)", () => {
    expect(usersWithMinFollows([{ followerId: "u1" }])).toEqual([]);
  });
});

describe("computeNudgeBackfillRows", () => {
  it("mapea cada disparador cumplido a su key de nudge, sin cruzar disparadores", () => {
    const rows = computeNudgeBackfillRows({
      userBooks: [{ userId: "camila", status: "FINISHED" }],
      ratings: [{ userId: "camila" }, { userId: "camila" }, { userId: "camila" }],
      follows: [{ followerId: "camila" }, { followerId: "camila" }],
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        { userId: "camila", key: NUDGE_KEYS.PRIMER_RATING },
        { userId: "camila", key: NUDGE_KEYS.BOOK_MATCH },
        { userId: "camila", key: NUDGE_KEYS.PRIMER_MENSAJE },
      ]),
    );
    expect(rows).toHaveLength(3);
  });

  it("un usuario que no cumple ningún disparador no genera filas", () => {
    const rows = computeNudgeBackfillRows({
      userBooks: [{ userId: "sofia", status: "READING" }],
      ratings: [{ userId: "sofia" }],
      follows: [{ followerId: "sofia" }],
    });
    expect(rows).toEqual([]);
  });

  it("usuarios distintos cumpliendo disparadores distintos no se mezclan", () => {
    const rows = computeNudgeBackfillRows({
      userBooks: [{ userId: "diego", status: "FINISHED" }],
      ratings: [{ userId: "lucia" }, { userId: "lucia" }, { userId: "lucia" }],
      follows: [{ followerId: "andres" }, { followerId: "andres" }],
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        { userId: "diego", key: NUDGE_KEYS.PRIMER_RATING },
        { userId: "lucia", key: NUDGE_KEYS.BOOK_MATCH },
        { userId: "andres", key: NUDGE_KEYS.PRIMER_MENSAJE },
      ]),
    );
    expect(rows).toHaveLength(3);
  });

  it("devuelve vacío cuando no hay datos de entrada", () => {
    expect(computeNudgeBackfillRows({ userBooks: [], ratings: [], follows: [] })).toEqual([]);
  });
});
