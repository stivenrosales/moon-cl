import { describe, expect, it, vi } from "vitest";
import {
  NUDGE_EPOCH,
  buildNudgeQueue,
  nextNudge,
  type NudgeClient,
  type NudgeQueueInput,
} from "@/server/services/nudge-queue";

const NOW = new Date("2026-07-20T12:00:00.000Z"); // 4 días después del epoch

const DAY_MS = 24 * 60 * 60 * 1000;

/** Insumo base: nadie cumple ningún disparador. Cada test sobreescribe lo suyo. */
function baseInput(overrides: Partial<NudgeQueueInput> = {}): NudgeQueueInput {
  return {
    now: NOW,
    dismissedKeys: new Set(),
    onboardedAt: null,
    accountCreatedAt: new Date("2020-01-01T00:00:00.000Z"),
    userBookCount: 0,
    readingProgressCount: 0,
    hasFinishedFirstBook: false,
    firstFinishedAt: null,
    ratingCount: 0,
    latestRatingAt: null,
    isMatchOptIn: false,
    followCount: 0,
    latestFollowAt: null,
    openRound: null,
    hasSuggestionInOpenRound: false,
    ...overrides,
  };
}

describe("buildNudgeQueue — la peor amenaza: Camila la veterana", () => {
  it("un veterano con cuenta anterior al epoch, 3 ratings y 2 follows recibe null", () => {
    const preEpoch = new Date(NUDGE_EPOCH.getTime() - 200 * DAY_MS);

    const result = buildNudgeQueue(
      baseInput({
        onboardedAt: preEpoch,
        accountCreatedAt: preEpoch,
        hasFinishedFirstBook: true,
        firstFinishedAt: preEpoch,
        ratingCount: 3,
        latestRatingAt: preEpoch,
        followCount: 2,
        latestFollowAt: preEpoch,
      }),
    );

    expect(result).toBeNull();
  });

  it("aunque el veterano NUNCA haya calificado ni terminado nada (sin backfill), bienvenida y primer-progreso siguen bloqueados por onboardedAt anterior al epoch", () => {
    const preEpoch = new Date(NUDGE_EPOCH.getTime() - 200 * DAY_MS);

    const result = buildNudgeQueue(
      baseInput({
        onboardedAt: preEpoch,
        accountCreatedAt: preEpoch,
        userBookCount: 0,
        readingProgressCount: 0,
      }),
    );

    expect(result).toBeNull();
  });
});

describe("buildNudgeQueue — bienvenida", () => {
  it("un usuario nuevo sin libros recibe bienvenida", () => {
    const onboardedAt = new Date(NOW.getTime() - 2 * DAY_MS);

    const result = buildNudgeQueue(
      baseInput({ onboardedAt, accountCreatedAt: onboardedAt, userBookCount: 0 }),
    );

    expect(result).toEqual({ key: "bienvenida", screen: "hoy", inline: false });
  });

  it("no aplica si onboardedAt es anterior al epoch aunque falten menos de 7 días de query", () => {
    const onboardedAt = new Date(NUDGE_EPOCH.getTime() - DAY_MS);

    const result = buildNudgeQueue(baseInput({ onboardedAt, userBookCount: 0, now: NUDGE_EPOCH }));

    expect(result).toBeNull();
  });

  it("no aplica pasados los 7 días de onboarding aunque no tenga libros", () => {
    const onboardedAt = new Date(NOW.getTime() - 8 * DAY_MS);

    const result = buildNudgeQueue(baseInput({ onboardedAt, userBookCount: 0 }));

    expect(result).toBeNull();
  });

  it("no aplica si ya tiene al menos un UserBook (cede el paso a primer-progreso, no a null)", () => {
    const onboardedAt = new Date(NOW.getTime() - DAY_MS);

    const result = buildNudgeQueue(
      baseInput({ onboardedAt, userBookCount: 1, readingProgressCount: 0 }),
    );

    expect(result?.key).not.toBe("bienvenida");
    expect(result?.key).toBe("primer-progreso");
  });
});

describe("buildNudgeQueue — primer-progreso", () => {
  it("aplica con >=1 UserBook y cero ReadingProgress, para una cuenta post-epoch", () => {
    const onboardedAt = new Date(NOW.getTime() - 3 * DAY_MS);

    const result = buildNudgeQueue(
      baseInput({ onboardedAt, userBookCount: 1, readingProgressCount: 0 }),
    );

    expect(result).toEqual({ key: "primer-progreso", screen: "leer-mios", inline: false });
  });

  it("no aplica si ya registró progreso", () => {
    const onboardedAt = new Date(NOW.getTime() - 3 * DAY_MS);

    const result = buildNudgeQueue(
      baseInput({ onboardedAt, userBookCount: 1, readingProgressCount: 1 }),
    );

    expect(result).toBeNull();
  });

  it("no aplica si onboardedAt es anterior al epoch, sin importar cuánto tiempo lleve sin progreso", () => {
    const preEpoch = new Date(NUDGE_EPOCH.getTime() - 30 * DAY_MS);

    const result = buildNudgeQueue(
      baseInput({ onboardedAt: preEpoch, userBookCount: 1, readingProgressCount: 0 }),
    );

    expect(result).toBeNull();
  });
});

describe("buildNudgeQueue — primer-rating", () => {
  it("aplica cuando un UserBook pasó a FINISHED por primera vez después del epoch", () => {
    const finishedAt = new Date(NUDGE_EPOCH.getTime() + DAY_MS);

    const result = buildNudgeQueue(
      baseInput({ hasFinishedFirstBook: true, firstFinishedAt: finishedAt }),
    );

    expect(result).toEqual({ key: "primer-rating", screen: "leer-mios", inline: false });
  });

  it("no aplica si el primer FINISHED ocurrió antes del epoch", () => {
    const finishedAt = new Date(NUDGE_EPOCH.getTime() - DAY_MS);

    const result = buildNudgeQueue(
      baseInput({ hasFinishedFirstBook: true, firstFinishedAt: finishedAt }),
    );

    expect(result).toBeNull();
  });
});

describe("buildNudgeQueue — book-match", () => {
  it("aplica con exactamente 3 ratings, sin isMatchOptIn, tercer rating post-epoch", () => {
    const latestRatingAt = new Date(NUDGE_EPOCH.getTime() + DAY_MS);

    const result = buildNudgeQueue(
      baseInput({ ratingCount: 3, latestRatingAt, isMatchOptIn: false }),
    );

    expect(result).toEqual({ key: "book-match", screen: "club-actividad", inline: false });
  });

  it("no aplica si ya tiene isMatchOptIn activado", () => {
    const latestRatingAt = new Date(NUDGE_EPOCH.getTime() + DAY_MS);

    const result = buildNudgeQueue(
      baseInput({ ratingCount: 3, latestRatingAt, isMatchOptIn: true }),
    );

    expect(result).toBeNull();
  });

  it("no aplica con 2 ni con 4 ratings (el disparador es exactamente 3)", () => {
    const latestRatingAt = new Date(NUDGE_EPOCH.getTime() + DAY_MS);

    expect(buildNudgeQueue(baseInput({ ratingCount: 2, latestRatingAt }))).toBeNull();
    expect(buildNudgeQueue(baseInput({ ratingCount: 4, latestRatingAt }))).toBeNull();
  });

  it("no aplica si el rating que completó las 3 calificaciones es anterior al epoch", () => {
    const latestRatingAt = new Date(NUDGE_EPOCH.getTime() - DAY_MS);

    const result = buildNudgeQueue(baseInput({ ratingCount: 3, latestRatingAt }));

    expect(result).toBeNull();
  });
});

describe("buildNudgeQueue — primer-mensaje", () => {
  it("aplica con exactamente 2 follows como seguidor, segundo follow post-epoch", () => {
    const latestFollowAt = new Date(NUDGE_EPOCH.getTime() + DAY_MS);

    const result = buildNudgeQueue(baseInput({ followCount: 2, latestFollowAt }));

    expect(result).toEqual({ key: "primer-mensaje", screen: "club-personas", inline: false });
  });

  it("no aplica si el segundo follow es anterior al epoch", () => {
    const latestFollowAt = new Date(NUDGE_EPOCH.getTime() - DAY_MS);

    const result = buildNudgeQueue(baseInput({ followCount: 2, latestFollowAt }));

    expect(result).toBeNull();
  });
});

describe("buildNudgeQueue — sugerir (inline, no gasta slot propio)", () => {
  it("aplica cuando la ronda OPEN lleva más de 48h, sin sugerencia del usuario y cuenta >= 7 días", () => {
    const startsAt = new Date(NOW.getTime() - 49 * 60 * 60 * 1000);
    const accountCreatedAt = new Date(NOW.getTime() - 10 * DAY_MS);

    const result = buildNudgeQueue(
      baseInput({ openRound: { startsAt }, accountCreatedAt, hasSuggestionInOpenRound: false }),
    );

    expect(result).toEqual({ key: "sugerir", screen: "hoy", inline: true });
  });

  it("no aplica si la ronda OPEN lleva menos de 48h", () => {
    const startsAt = new Date(NOW.getTime() - 10 * 60 * 60 * 1000);
    const accountCreatedAt = new Date(NOW.getTime() - 10 * DAY_MS);

    const result = buildNudgeQueue(baseInput({ openRound: { startsAt }, accountCreatedAt }));

    expect(result).toBeNull();
  });

  it("no aplica si el usuario ya sugirió en la ronda abierta", () => {
    const startsAt = new Date(NOW.getTime() - 49 * 60 * 60 * 1000);
    const accountCreatedAt = new Date(NOW.getTime() - 10 * DAY_MS);

    const result = buildNudgeQueue(
      baseInput({ openRound: { startsAt }, accountCreatedAt, hasSuggestionInOpenRound: true }),
    );

    expect(result).toBeNull();
  });

  it("no aplica si la cuenta tiene menos de 7 días", () => {
    const startsAt = new Date(NOW.getTime() - 49 * 60 * 60 * 1000);
    const accountCreatedAt = new Date(NOW.getTime() - 2 * DAY_MS);

    const result = buildNudgeQueue(baseInput({ openRound: { startsAt }, accountCreatedAt }));

    expect(result).toBeNull();
  });
});

describe("buildNudgeQueue — cola única y prioridad", () => {
  it("jamás devuelve dos: cuando varios disparadores son elegibles a la vez, gana el de mayor prioridad y el resultado es un único Nudge", () => {
    const finishedAt = new Date(NUDGE_EPOCH.getTime() + DAY_MS);
    const latestRatingAt = new Date(NUDGE_EPOCH.getTime() + DAY_MS);
    const latestFollowAt = new Date(NUDGE_EPOCH.getTime() + DAY_MS);

    const result = buildNudgeQueue(
      baseInput({
        hasFinishedFirstBook: true,
        firstFinishedAt: finishedAt,
        ratingCount: 3,
        latestRatingAt,
        followCount: 2,
        latestFollowAt,
      }),
    );

    expect(Array.isArray(result)).toBe(false);
    expect(result).toEqual({ key: "primer-rating", screen: "leer-mios", inline: false });
  });

  it("la escalera va antes que el muro: bienvenida gana sobre primer-progreso si ambos fueran evaluados en el mismo input", () => {
    const onboardedAt = new Date(NOW.getTime() - DAY_MS);

    // userBookCount === 0 hace que bienvenida sea elegible y primer-progreso no
    // (mutuamente excluyentes por diseño), pero confirmamos que el orden de la
    // tabla efectivamente prioriza bienvenida cuando es candidata.
    const result = buildNudgeQueue(baseInput({ onboardedAt, userBookCount: 0 }));

    expect(result?.key).toBe("bienvenida");
  });
});

describe("buildNudgeQueue — descartado o actuado no vuelve", () => {
  it("un dismissedKeys con la key ya no reaparece aunque el disparador siga cumpliéndose", () => {
    const onboardedAt = new Date(NOW.getTime() - 2 * DAY_MS);

    const result = buildNudgeQueue(
      baseInput({
        onboardedAt,
        userBookCount: 0,
        dismissedKeys: new Set(["bienvenida"]),
      }),
    );

    expect(result).toBeNull();
  });

  it("descarta solo la key marcada, dejando pasar la siguiente candidata elegible", () => {
    const finishedAt = new Date(NUDGE_EPOCH.getTime() + DAY_MS);
    const latestRatingAt = new Date(NUDGE_EPOCH.getTime() + DAY_MS);

    const result = buildNudgeQueue(
      baseInput({
        hasFinishedFirstBook: true,
        firstFinishedAt: finishedAt,
        ratingCount: 3,
        latestRatingAt,
        dismissedKeys: new Set(["primer-rating"]),
      }),
    );

    expect(result).toEqual({ key: "book-match", screen: "club-actividad", inline: false });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// nextNudge — loader: hace las queries y delega en buildNudgeQueue().
// ─────────────────────────────────────────────────────────────────────────

function createFakeClient(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}): NudgeClient {
  return {
    user: {
      findUnique: overrides.userFindUnique ?? vi.fn().mockResolvedValue({
        onboardedAt: null,
        createdAt: new Date("2020-01-01T00:00:00.000Z"),
        isMatchOptIn: false,
      }),
    },
    userBook: {
      count: overrides.userBookCount ?? vi.fn().mockResolvedValue(0),
      findFirst: overrides.userBookFindFirst ?? vi.fn().mockResolvedValue(null),
    },
    readingProgress: {
      count: overrides.readingProgressCount ?? vi.fn().mockResolvedValue(0),
    },
    rating: {
      count: overrides.ratingCount ?? vi.fn().mockResolvedValue(0),
      findFirst: overrides.ratingFindFirst ?? vi.fn().mockResolvedValue(null),
    },
    follow: {
      count: overrides.followCount ?? vi.fn().mockResolvedValue(0),
      findFirst: overrides.followFindFirst ?? vi.fn().mockResolvedValue(null),
    },
    round: {
      findFirst: overrides.roundFindFirst ?? vi.fn().mockResolvedValue(null),
    },
    bookSuggestion: {
      findFirst: overrides.suggestionFindFirst ?? vi.fn().mockResolvedValue(null),
    },
    userNudge: {
      findMany: overrides.userNudgeFindMany ?? vi.fn().mockResolvedValue([]),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("nextNudge", () => {
  it("devuelve null si el usuario no existe", async () => {
    const client = createFakeClient({ userFindUnique: vi.fn().mockResolvedValue(null) });

    const result = await nextNudge("user-fantasma", client, NOW);

    expect(result).toBeNull();
  });

  it("arma bienvenida a partir de las queries reales cuando el usuario recién onboardeó sin libros", async () => {
    const onboardedAt = new Date(NOW.getTime() - DAY_MS);
    const client = createFakeClient({
      userFindUnique: vi.fn().mockResolvedValue({
        onboardedAt,
        createdAt: onboardedAt,
        isMatchOptIn: false,
      }),
      userBookCount: vi.fn().mockResolvedValue(0),
    });

    const result = await nextNudge("user-1", client, NOW);

    expect(result).toEqual({ key: "bienvenida", screen: "hoy", inline: false });
  });

  it("excluye las keys con UserNudge dismissedAt o actedAt", async () => {
    const onboardedAt = new Date(NOW.getTime() - DAY_MS);
    const client = createFakeClient({
      userFindUnique: vi.fn().mockResolvedValue({
        onboardedAt,
        createdAt: onboardedAt,
        isMatchOptIn: false,
      }),
      userBookCount: vi.fn().mockResolvedValue(0),
      userNudgeFindMany: vi.fn().mockResolvedValue([{ key: "bienvenida" }]),
    });

    const result = await nextNudge("user-1", client, NOW);

    expect(client.userNudge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          OR: [{ dismissedAt: { not: null } }, { actedAt: { not: null } }],
        },
      }),
    );
    expect(result).toBeNull();
  });
});
