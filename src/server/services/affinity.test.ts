import { describe, expect, it, vi } from "vitest";
import {
  computeAffinity,
  countBooksInCommon,
  getAffinity,
  labelForScore,
  loadAffinityData,
  type AffinityUserData,
} from "@/server/services/affinity";

function userData(overrides: Partial<AffinityUserData> = {}): AffinityUserData {
  return {
    userId: "u",
    bookIds: new Set(),
    favoriteGenres: [],
    ratings: new Map(),
    ...overrides,
  };
}

describe("labelForScore", () => {
  it("etiqueta >=70 como 'Casi gemelos lectores'", () => {
    expect(labelForScore(70)).toBe("Casi gemelos lectores");
    expect(labelForScore(100)).toBe("Casi gemelos lectores");
  });

  it("etiqueta >=40 y <70 como 'Buena química lectora'", () => {
    expect(labelForScore(40)).toBe("Buena química lectora");
    expect(labelForScore(69)).toBe("Buena química lectora");
  });

  it("etiqueta <40 como 'Recién se conocen'", () => {
    expect(labelForScore(0)).toBe("Recién se conocen");
    expect(labelForScore(39)).toBe("Recién se conocen");
  });
});

describe("computeAffinity", () => {
  it("retorna null cuando ninguno de los dos usuarios tiene ninguna señal (sin libros, sin géneros)", () => {
    const a = userData({ userId: "a" });
    const b = userData({ userId: "b" });

    expect(computeAffinity(a, b)).toBeNull();
  });

  it("nunca inventa afinidad: sin datos en absoluto, null, no un score en 0", () => {
    const result = computeAffinity(userData(), userData());
    expect(result).toBeNull();
  });

  it("calcula 100% cuando comparten todos los libros, todos los géneros y las mismas calificaciones", () => {
    const a = userData({
      bookIds: new Set(["b1", "b2"]),
      favoriteGenres: ["Novela", "Fantasía"],
      ratings: new Map([["b1", 5]]),
    });
    const b = userData({
      bookIds: new Set(["b1", "b2"]),
      favoriteGenres: ["Novela", "Fantasía"],
      ratings: new Map([["b1", 5]]),
    });

    const result = computeAffinity(a, b);

    expect(result).not.toBeNull();
    expect(result?.score).toBe(100);
    expect(result?.label).toBe("Casi gemelos lectores");
    expect(result?.evidence.librosEnComun).toBe(2);
    expect(result?.evidence.generosEnComun.sort()).toEqual(["Fantasía", "Novela"]);
  });

  it("redistribuye el peso de géneros cuando ninguno de los dos declaró favoriteGenres", () => {
    // Solo señal de libros (peso base 50%) disponible → se normaliza a 100%.
    const a = userData({ bookIds: new Set(["b1", "b2"]) });
    const b = userData({ bookIds: new Set(["b1", "b2"]) });

    const result = computeAffinity(a, b);

    expect(result).not.toBeNull();
    expect(result?.score).toBe(100); // Jaccard de libros = 1, único signal → 100%
    expect(result?.evidence.generosEnComun).toEqual([]);
  });

  it("redistribuye el peso de calificaciones cuando no hay libros calificados en común", () => {
    const a = userData({ bookIds: new Set(["b1"]), favoriteGenres: ["Novela"] });
    const b = userData({ bookIds: new Set(["b1"]), favoriteGenres: ["Novela"] });
    // Sin ratings en ninguno de los dos: la señal de calificaciones no aporta datos.

    const result = computeAffinity(a, b);

    expect(result).not.toBeNull();
    // libros (jaccard=1, peso 50) + géneros (jaccard=1, peso 30) renormalizados a 100% del peso disponible → 100
    expect(result?.score).toBe(100);
  });

  it("una señal con jaccard 0 (sin overlap) SÍ cuenta como dato disponible, no como ausente", () => {
    const a = userData({ bookIds: new Set(["b1"]), favoriteGenres: ["Novela"] });
    const b = userData({ bookIds: new Set(["b2"]), favoriteGenres: ["Terror"] });

    const result = computeAffinity(a, b);

    expect(result).not.toBeNull();
    expect(result?.score).toBe(0);
    expect(result?.label).toBe("Recién se conocen");
    expect(result?.evidence.librosEnComun).toBe(0);
    expect(result?.evidence.generosEnComun).toEqual([]);
  });

  it("la similitud de calificaciones solo considera libros que ambos calificaron", () => {
    const a = userData({
      bookIds: new Set(["b1", "b2"]),
      ratings: new Map([
        ["b1", 5],
        ["b2", 1],
      ]),
    });
    const b = userData({
      bookIds: new Set(["b1", "b2"]),
      ratings: new Map([["b1", 3]]), // b2 no calificado por b: no entra en la similitud
    });

    const result = computeAffinity(a, b);

    // libros: jaccard=1 (peso 50) + ratings: diff=|5-3|=2 → similitud=1-2/4=0.5 (peso 20)
    // total peso disponible=70 → score = (50*1 + 20*0.5)/70 = 60/70 ≈ 0.857 → 86%
    expect(result?.score).toBe(86);
  });

  it("evidencia nunca se fabrica: si no hay libros ni géneros en común, ambas listas quedan vacías aunque el score sea >0", () => {
    const a = userData({
      bookIds: new Set(["b1"]),
      favoriteGenres: ["Novela"],
      ratings: new Map([["b1", 4]]),
    });
    const b = userData({
      bookIds: new Set(["b1"]),
      favoriteGenres: ["Terror"],
      ratings: new Map([["b1", 4]]),
    });

    const result = computeAffinity(a, b);

    expect(result?.evidence.librosEnComun).toBe(1);
    expect(result?.evidence.generosEnComun).toEqual([]);
  });
});

function createFakeClient(overrides: {
  userFindMany?: ReturnType<typeof vi.fn>;
  userBookFindMany?: ReturnType<typeof vi.fn>;
  ratingFindMany?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    user: { findMany: overrides.userFindMany ?? vi.fn().mockResolvedValue([]) },
    userBook: { findMany: overrides.userBookFindMany ?? vi.fn().mockResolvedValue([]) },
    rating: { findMany: overrides.ratingFindMany ?? vi.fn().mockResolvedValue([]) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("loadAffinityData", () => {
  it("agrupa favoriteGenres, UserBook y Rating por usuario en un solo Map", async () => {
    const userFindMany = vi.fn().mockResolvedValue([
      { id: "a", favoriteGenres: ["Novela"] },
      { id: "b", favoriteGenres: ["Terror"] },
    ]);
    const userBookFindMany = vi.fn().mockResolvedValue([
      { userId: "a", bookId: "b1" },
      { userId: "b", bookId: "b1" },
    ]);
    const ratingFindMany = vi.fn().mockResolvedValue([{ userId: "a", bookId: "b2", stars: 4 }]);
    const client = createFakeClient({ userFindMany, userBookFindMany, ratingFindMany });

    const result = await loadAffinityData(["a", "b"], client);

    expect(result.get("a")?.bookIds).toEqual(new Set(["b1", "b2"]));
    expect(result.get("a")?.ratings).toEqual(new Map([["b2", 4]]));
    expect(result.get("b")?.bookIds).toEqual(new Set(["b1"]));
    expect(result.get("a")?.favoriteGenres).toEqual(["Novela"]);
    expect(userBookFindMany).toHaveBeenCalledWith({
      where: { userId: { in: ["a", "b"] } },
      select: { userId: true, bookId: true },
    });
  });
});

describe("getAffinity", () => {
  it("retorna null si alguno de los dos usuarios no existe", async () => {
    const client = createFakeClient({ userFindMany: vi.fn().mockResolvedValue([{ id: "a", favoriteGenres: [] }]) });

    const result = await getAffinity("a", "b-no-existe", client);

    expect(result).toBeNull();
  });

  it("carga los datos de ambos usuarios y delega en computeAffinity", async () => {
    const userFindMany = vi.fn().mockResolvedValue([
      { id: "a", favoriteGenres: ["Novela"] },
      { id: "b", favoriteGenres: ["Novela"] },
    ]);
    const userBookFindMany = vi.fn().mockResolvedValue([
      { userId: "a", bookId: "b1" },
      { userId: "b", bookId: "b1" },
    ]);
    const client = createFakeClient({ userFindMany, userBookFindMany });

    const result = await getAffinity("a", "b", client);

    expect(result).not.toBeNull();
    expect(result?.evidence.librosEnComun).toBe(1);
    expect(result?.evidence.generosEnComun).toEqual(["Novela"]);
  });
});

describe("countBooksInCommon", () => {
  it("cuenta la intersección de dos sets de bookIds ya cargados", () => {
    const mine = new Set(["b1", "b2", "b3"]);
    const theirs = new Set(["b2", "b3", "b4"]);

    expect(countBooksInCommon(mine, theirs)).toBe(2);
  });

  it("retorna 0 cuando ninguno de los sets es vacío pero no comparten libros", () => {
    expect(countBooksInCommon(new Set(["b1"]), new Set(["b2"]))).toBe(0);
  });

  it("retorna 0 cuando alguno de los dos sets está vacío", () => {
    expect(countBooksInCommon(new Set(), new Set(["b1"]))).toBe(0);
    expect(countBooksInCommon(new Set(["b1"]), new Set())).toBe(0);
  });

  it("da el mismo resultado que booksInCommon() para los mismos bookIds — misma semántica, sin queries", () => {
    // Reproduce el caso ya cubierto en social.test.ts (userA: {b1,b2,b3} · userB: {b1,b2,b4} → 2)
    // pero a partir de sets ya cargados en memoria, como los que produce loadAffinityData().
    const userA = new Set(["b1", "b2", "b3"]);
    const userB = new Set(["b1", "b2", "b4"]);

    expect(countBooksInCommon(userA, userB)).toBe(2);
  });
});
