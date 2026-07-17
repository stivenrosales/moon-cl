import { describe, expect, it } from "vitest";
import { buildToday, computeRacha, type RawTodayInput, type TodayBook } from "@/server/services/today";

const BOOK_CIRCE: TodayBook = {
  id: "book-circe",
  title: "Circe",
  authors: ["Madeline Miller"],
  coverUrl: null,
  pageCount: 400,
};

function baseInput(overrides: Partial<RawTodayInput> = {}): RawTodayInput {
  return {
    resolved: null,
    myProgressDates: [],
    ...overrides,
  };
}

describe("buildToday — estado A: sin-libro", () => {
  it("retorna sin-libro cuando no hay libro resuelto", () => {
    const result = buildToday(baseInput());
    expect(result).toEqual({ estado: "sin-libro" });
  });
});

describe("buildToday — estado B: sin-empezar", () => {
  it("arma sin-empezar con medianaClub (impar) y cuantosLeyendo cuando el usuario no tiene UserBook", () => {
    const result = buildToday(
      baseInput({
        resolved: {
          book: BOOK_CIRCE,
          isClubBook: true,
          myUserBook: null,
          myLastProgressAt: null,
          otrosLectores: [
            { userId: "u1", nombre: "Ana", currentPage: 100 },
            { userId: "u2", nombre: "Bruno", currentPage: 150 },
            { userId: "u3", nombre: "Caro", currentPage: 200 },
          ],
          salaComments: [],
        },
      }),
    );

    expect(result).toMatchObject({
      estado: "sin-empezar",
      libro: BOOK_CIRCE,
      kicker: "Libro del club",
      medianaClub: 150,
      cuantosLeyendo: 3,
    });
  });

  it("calcula la mediana par como el promedio de los dos valores centrales", () => {
    const result = buildToday(
      baseInput({
        resolved: {
          book: BOOK_CIRCE,
          isClubBook: true,
          myUserBook: null,
          myLastProgressAt: null,
          otrosLectores: [
            { userId: "u1", nombre: "Ana", currentPage: 100 },
            { userId: "u2", nombre: "Bruno", currentPage: 200 },
          ],
          salaComments: [],
        },
      }),
    );

    expect(result).toMatchObject({ estado: "sin-empezar", medianaClub: 150, cuantosLeyendo: 2 });
  });

  it("medianaClub es null y cuantosLeyendo es 0 cuando nadie más tiene progreso", () => {
    const result = buildToday(
      baseInput({
        resolved: {
          book: BOOK_CIRCE,
          isClubBook: true,
          myUserBook: null,
          myLastProgressAt: null,
          otrosLectores: [],
          salaComments: [],
        },
      }),
    );

    expect(result).toMatchObject({ estado: "sin-empezar", medianaClub: null, cuantosLeyendo: 0 });
  });

  it("usa kicker 'Tu lectura' cuando el libro resuelto no es el del club", () => {
    const result = buildToday(
      baseInput({
        resolved: {
          book: BOOK_CIRCE,
          isClubBook: false,
          myUserBook: null,
          myLastProgressAt: null,
          otrosLectores: [],
          salaComments: [],
        },
      }),
    );

    expect(result).toMatchObject({ estado: "sin-empezar", kicker: "Tu lectura" });
  });

  it("sin-empezar exige !myUserBook: un UserBook existente (aunque currentPage sea null) no cae aquí", () => {
    // Antes de este fix la condición era "!myUserBook || currentPage == null",
    // lo cual ensanchaba sin-empezar de más y creaba un deadlock real: startReading()
    // crea el UserBook con currentPage null, así que tras tocar "Lo voy a leer" el
    // usuario JAMÁS salía de este estado — el botón seguía diciendo "Lo voy a leer"
    // para siempre. Ver estado C: leyendo para el caso currentPage null correcto.
    const result = buildToday(
      baseInput({
        resolved: {
          book: BOOK_CIRCE,
          isClubBook: true,
          myUserBook: { status: "READING", currentPage: null, currentChapter: null },
          myLastProgressAt: null,
          otrosLectores: [{ userId: "u1", nombre: "Ana", currentPage: 120 }],
          salaComments: [],
        },
      }),
    );

    expect(result.estado).not.toBe("sin-empezar");
  });
});

describe("buildToday — estado C: leyendo", () => {
  it("arma leyendo con miPagina/miCapitulo/porcentaje desde el UserBook", () => {
    const result = buildToday(
      baseInput({
        resolved: {
          book: BOOK_CIRCE,
          isClubBook: true,
          myUserBook: { status: "READING", currentPage: 100, currentChapter: 5 },
          myLastProgressAt: new Date("2026-07-10T10:00:00.000Z"),
          otrosLectores: [],
          salaComments: [],
        },
      }),
    );

    expect(result).toMatchObject({
      estado: "leyendo",
      libro: BOOK_CIRCE,
      kicker: "Libro del club",
      miPagina: 100,
      miCapitulo: 5,
      porcentaje: 25,
      comentariosNuevos: 0,
    });
  });

  it("miPagina 0 declarada explícitamente (no ausente) mantiene estado leyendo con porcentaje 0", () => {
    // Distinto del caso "nunca registró progreso" (ver describe de sin-empezar
    // más arriba): acá SÍ hubo un ReadingProgress real con página 0 — currentPage
    // no es null, es 0 a propósito. Ese 0% sale del dato real, no de un
    // default por ausencia de UserBook.
    const result = buildToday(
      baseInput({
        resolved: {
          book: BOOK_CIRCE,
          isClubBook: false,
          myUserBook: { status: "READING", currentPage: 0, currentChapter: null },
          myLastProgressAt: new Date("2026-07-10T10:00:00.000Z"),
          otrosLectores: [],
          salaComments: [],
        },
      }),
    );

    expect(result).toMatchObject({ estado: "leyendo", miPagina: 0, miCapitulo: null, porcentaje: 0 });
  });

  it("un UserBook recién creado por startReading (currentPage null) cae en estado leyendo, no en sin-empezar", () => {
    // Reproduce el estado exacto que deja startReading(): status READING pero
    // currentPage/currentChapter todavía en null porque nadie marcó avance. Este
    // es el caso que causaba el deadlock en producción: el botón "Lo voy a leer"
    // debe desaparecer apenas el UserBook existe, sin importar si currentPage es null.
    const result = buildToday(
      baseInput({
        resolved: {
          book: BOOK_CIRCE,
          isClubBook: true,
          myUserBook: { status: "READING", currentPage: null, currentChapter: null },
          myLastProgressAt: null,
          otrosLectores: [{ userId: "u1", nombre: "Ana", currentPage: 120 }],
          salaComments: [],
        },
      }),
    );

    expect(result.estado).toBe("leyendo");
  });

  it("el estado leyendo con currentPage null no expone porcentaje (la barra Progress no debe pintarse en 0%)", () => {
    // La barra Progress solo se renderiza cuando currentPage > 0 (hero-card.tsx).
    // Modelamos esto como porcentaje: null en vez de 0 para que la card pueda
    // distinguir "nunca marcó avance" de "marcó avance real en la página 0".
    const result = buildToday(
      baseInput({
        resolved: {
          book: BOOK_CIRCE,
          isClubBook: true,
          myUserBook: { status: "READING", currentPage: null, currentChapter: null },
          myLastProgressAt: null,
          otrosLectores: [],
          salaComments: [],
        },
      }),
    );

    expect(result).toMatchObject({ estado: "leyendo", miPagina: null, porcentaje: null });
  });

  it("marca alguienAdelante con el miembro más avanzado y la diferencia de páginas", () => {
    const result = buildToday(
      baseInput({
        resolved: {
          book: BOOK_CIRCE,
          isClubBook: true,
          myUserBook: { status: "READING", currentPage: 100, currentChapter: 5 },
          myLastProgressAt: new Date("2026-07-10T10:00:00.000Z"),
          otrosLectores: [
            { userId: "u1", nombre: "Ana", currentPage: 90 },
            { userId: "u2", nombre: "Bruno", currentPage: 180 },
          ],
          salaComments: [],
        },
      }),
    );

    expect(result).toMatchObject({
      estado: "leyendo",
      alguienAdelante: { nombre: "Bruno", paginasDiferencia: 80 },
    });
  });

  it("alguienAdelante queda undefined cuando nadie va más adelante", () => {
    const result = buildToday(
      baseInput({
        resolved: {
          book: BOOK_CIRCE,
          isClubBook: true,
          myUserBook: { status: "READING", currentPage: 300, currentChapter: 10 },
          myLastProgressAt: new Date("2026-07-10T10:00:00.000Z"),
          otrosLectores: [{ userId: "u1", nombre: "Ana", currentPage: 90 }],
          salaComments: [],
        },
      }),
    );

    expect(result).toMatchObject({ estado: "leyendo" });
    expect((result as { alguienAdelante?: unknown }).alguienAdelante).toBeUndefined();
  });

  it("cuenta comentariosNuevos: chapter <= miCapitulo y creados después de mi último progreso", () => {
    const result = buildToday(
      baseInput({
        resolved: {
          book: BOOK_CIRCE,
          isClubBook: true,
          myUserBook: { status: "READING", currentPage: 100, currentChapter: 5 },
          myLastProgressAt: new Date("2026-07-10T10:00:00.000Z"),
          otrosLectores: [],
          salaComments: [
            // dentro de la sala abierta (chapter <= 5) y después de mi progreso: cuenta
            { chapter: 3, createdAt: new Date("2026-07-11T10:00:00.000Z"), deletedAt: null },
            // sala todavía cerrada (chapter > miCapitulo): no cuenta
            { chapter: 8, createdAt: new Date("2026-07-11T10:00:00.000Z"), deletedAt: null },
            // sala abierta pero anterior a mi último progreso: no cuenta
            { chapter: 2, createdAt: new Date("2026-07-05T10:00:00.000Z"), deletedAt: null },
            // sala abierta, después de mi progreso, pero borrado: no cuenta
            { chapter: 1, createdAt: new Date("2026-07-12T10:00:00.000Z"), deletedAt: new Date("2026-07-12T11:00:00.000Z") },
            // comentario sin capítulo (sala general), después de mi progreso: cuenta
            { chapter: null, createdAt: new Date("2026-07-13T10:00:00.000Z"), deletedAt: null },
          ],
        },
      }),
    );

    expect(result).toMatchObject({ estado: "leyendo", comentariosNuevos: 2 });
  });

  it("comentariosNuevos es 0 cuando no hay myLastProgressAt (sin baseline), aun con página ya declarada", () => {
    const result = buildToday(
      baseInput({
        resolved: {
          book: BOOK_CIRCE,
          isClubBook: true,
          myUserBook: { status: "READING", currentPage: 50, currentChapter: null },
          myLastProgressAt: null,
          otrosLectores: [],
          salaComments: [
            { chapter: null, createdAt: new Date("2026-07-13T10:00:00.000Z"), deletedAt: null },
          ],
        },
      }),
    );

    expect(result).toMatchObject({ estado: "leyendo", comentariosNuevos: 0 });
  });
});

describe("buildToday — racha", () => {
  it("no incluye racha cuando hay menos de 2 días distintos", () => {
    const result = buildToday(
      baseInput({
        resolved: {
          book: BOOK_CIRCE,
          isClubBook: true,
          myUserBook: { status: "READING", currentPage: 100, currentChapter: 5 },
          myLastProgressAt: new Date("2026-07-16T15:00:00.000Z"),
          otrosLectores: [],
          salaComments: [],
        },
        myProgressDates: [new Date("2026-07-16T15:00:00.000Z")],
      }),
    );

    expect((result as { racha?: number }).racha).toBeUndefined();
  });

  it("cuenta 3 días consecutivos en hora Lima (America/Lima, UTC-5)", () => {
    const result = buildToday(
      baseInput({
        resolved: {
          book: BOOK_CIRCE,
          isClubBook: true,
          myUserBook: { status: "READING", currentPage: 100, currentChapter: 5 },
          myLastProgressAt: new Date("2026-07-16T15:00:00.000Z"),
          otrosLectores: [],
          salaComments: [],
        },
        myProgressDates: [
          new Date("2026-07-14T15:00:00.000Z"),
          new Date("2026-07-15T15:00:00.000Z"),
          new Date("2026-07-16T15:00:00.000Z"),
        ],
      }),
    );

    expect((result as { racha?: number }).racha).toBe(3);
  });

  it("corta la racha si hay un día salteado, quedándose solo con la cola consecutiva", () => {
    const result = buildToday(
      baseInput({
        resolved: {
          book: BOOK_CIRCE,
          isClubBook: true,
          myUserBook: { status: "READING", currentPage: 100, currentChapter: 5 },
          myLastProgressAt: new Date("2026-07-16T15:00:00.000Z"),
          otrosLectores: [],
          salaComments: [],
        },
        myProgressDates: [
          new Date("2026-07-14T15:00:00.000Z"),
          // se salta 07-15
          new Date("2026-07-16T15:00:00.000Z"),
        ],
      }),
    );

    expect((result as { racha?: number }).racha).toBeUndefined();
  });
});

describe("computeRacha", () => {
  it("retorna undefined para lista vacía", () => {
    expect(computeRacha([])).toBeUndefined();
  });

  it("respeta el corte de zona horaria de Lima cerca de medianoche UTC", () => {
    // 2026-07-16T04:00:00Z = 2026-07-15 23:00 hora Lima (día 15)
    // 2026-07-16T05:00:00Z = 2026-07-16 00:00 hora Lima (día 16, recién cambió)
    const dates = [new Date("2026-07-16T04:00:00.000Z"), new Date("2026-07-16T05:00:00.000Z")];
    expect(computeRacha(dates)).toBe(2);
  });

  it("deduplica progresos del mismo día Lima antes de contar la racha", () => {
    const dates = [
      new Date("2026-07-15T15:00:00.000Z"),
      new Date("2026-07-15T18:00:00.000Z"),
      new Date("2026-07-16T15:00:00.000Z"),
    ];
    expect(computeRacha(dates)).toBe(2);
  });
});
