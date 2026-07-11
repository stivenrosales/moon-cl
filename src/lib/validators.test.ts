import { describe, expect, it } from "vitest";
import {
  addToShelfSchema,
  bookInputSchema,
  commentSchema,
  idSchema,
  meetingSchema,
  moveShelfSchema,
  onboardingSchema,
  profileUpdateSchema,
  progressSchema,
  ratingSchema,
  roundSchema,
  shelfStatusSchema,
  updateMyBookSchema,
} from "@/lib/validators";

describe("bookInputSchema", () => {
  it("acepta un libro válido con solo el título", () => {
    const result = bookInputSchema.safeParse({ title: "Cien años de soledad" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.authors).toEqual([]);
    }
  });

  it("acepta un libro válido con todos los campos", () => {
    const result = bookInputSchema.safeParse({
      title: "Cien años de soledad",
      authors: ["Gabriel García Márquez"],
      coverUrl: "https://example.com/cover.jpg",
      description: "Una novela.",
      pageCount: 471,
      publishedYear: 1967,
      googleBooksId: "abc123",
      isbn: "9780307474728",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza un título vacío", () => {
    const result = bookInputSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza un título de más de 280 caracteres", () => {
    const result = bookInputSchema.safeParse({ title: "a".repeat(281) });
    expect(result.success).toBe(false);
  });

  it("rechaza cuando falta el título", () => {
    const result = bookInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rechaza un coverUrl que no es una URL válida", () => {
    const result = bookInputSchema.safeParse({
      title: "Libro",
      coverUrl: "no-es-una-url",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un pageCount igual a 0 (no positivo)", () => {
    const result = bookInputSchema.safeParse({ title: "Libro", pageCount: 0 });
    expect(result.success).toBe(false);
  });

  it("rechaza un pageCount negativo", () => {
    const result = bookInputSchema.safeParse({
      title: "Libro",
      pageCount: -10,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un publishedYear negativo", () => {
    const result = bookInputSchema.safeParse({
      title: "Libro",
      publishedYear: -1,
    });
    expect(result.success).toBe(false);
  });

  it("acepta coverUrl y description como null", () => {
    const result = bookInputSchema.safeParse({
      title: "Libro",
      coverUrl: null,
      description: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("roundSchema", () => {
  it("acepta una ronda válida con fecha de cierre posterior a la apertura", () => {
    const result = roundSchema.safeParse({
      title: "Ronda de enero",
      description: "Lectura del mes",
      startsAt: "2026-01-01",
      endsAt: "2026-01-31",
    });
    expect(result.success).toBe(true);
  });

  it("coacciona fechas en formato string a instancias de Date", () => {
    const result = roundSchema.safeParse({
      title: "Ronda de enero",
      startsAt: "2026-01-01",
      endsAt: "2026-01-31",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startsAt).toBeInstanceOf(Date);
      expect(result.data.endsAt).toBeInstanceOf(Date);
    }
  });

  it("rechaza cuando endsAt es anterior a startsAt", () => {
    const result = roundSchema.safeParse({
      title: "Ronda de enero",
      startsAt: "2026-01-31",
      endsAt: "2026-01-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["endsAt"]);
    }
  });

  it("rechaza cuando endsAt es igual a startsAt", () => {
    const result = roundSchema.safeParse({
      title: "Ronda de enero",
      startsAt: "2026-01-01",
      endsAt: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un título de menos de 2 caracteres", () => {
    const result = roundSchema.safeParse({
      title: "A",
      startsAt: "2026-01-01",
      endsAt: "2026-01-31",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza cuando falta startsAt", () => {
    const result = roundSchema.safeParse({
      title: "Ronda de enero",
      endsAt: "2026-01-31",
    });
    expect(result.success).toBe(false);
  });
});

describe("commentSchema", () => {
  it("acepta un comentario válido mínimo", () => {
    const result = commentSchema.safeParse({
      bookId: "book-1",
      content: "Muy buen libro",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isSpoiler).toBe(false);
    }
  });

  it("acepta un comentario válido con todos los campos", () => {
    const result = commentSchema.safeParse({
      bookId: "book-1",
      parentId: "comment-1",
      content: "Muy buen libro",
      isSpoiler: true,
      chapter: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza contenido vacío", () => {
    const result = commentSchema.safeParse({ bookId: "book-1", content: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza cuando falta bookId", () => {
    const result = commentSchema.safeParse({ content: "Muy buen libro" });
    expect(result.success).toBe(false);
  });

  it("rechaza contenido de más de 4000 caracteres", () => {
    const result = commentSchema.safeParse({
      bookId: "book-1",
      content: "a".repeat(4001),
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un chapter igual a 0 (no positivo)", () => {
    const result = commentSchema.safeParse({
      bookId: "book-1",
      content: "Muy buen libro",
      chapter: 0,
    });
    expect(result.success).toBe(false);
  });

  it("acepta parentId nulo", () => {
    const result = commentSchema.safeParse({
      bookId: "book-1",
      content: "Muy buen libro",
      parentId: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("ratingSchema", () => {
  it("acepta una calificación válida", () => {
    const result = ratingSchema.safeParse({ bookId: "book-1", stars: 5 });
    expect(result.success).toBe(true);
  });

  it("acepta una calificación válida con reseña", () => {
    const result = ratingSchema.safeParse({
      bookId: "book-1",
      stars: 3,
      review: "Me gustó bastante.",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza stars igual a 0", () => {
    const result = ratingSchema.safeParse({ bookId: "book-1", stars: 0 });
    expect(result.success).toBe(false);
  });

  it("rechaza stars mayor a 5", () => {
    const result = ratingSchema.safeParse({ bookId: "book-1", stars: 6 });
    expect(result.success).toBe(false);
  });

  it("rechaza stars no enteros", () => {
    const result = ratingSchema.safeParse({ bookId: "book-1", stars: 2.5 });
    expect(result.success).toBe(false);
  });

  it("rechaza cuando falta bookId", () => {
    const result = ratingSchema.safeParse({ stars: 4 });
    expect(result.success).toBe(false);
  });
});

describe("progressSchema", () => {
  it("acepta currentPage en 0", () => {
    const result = progressSchema.safeParse({
      bookId: "book-1",
      currentPage: 0,
    });
    expect(result.success).toBe(true);
  });

  it("acepta un progreso válido con nota", () => {
    const result = progressSchema.safeParse({
      bookId: "book-1",
      currentPage: 120,
      note: "Voy avanzando",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza currentPage negativo", () => {
    const result = progressSchema.safeParse({
      bookId: "book-1",
      currentPage: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza currentPage mayor a 20000", () => {
    const result = progressSchema.safeParse({
      bookId: "book-1",
      currentPage: 20001,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza currentPage no entero", () => {
    const result = progressSchema.safeParse({
      bookId: "book-1",
      currentPage: 12.5,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza cuando falta bookId", () => {
    const result = progressSchema.safeParse({ currentPage: 10 });
    expect(result.success).toBe(false);
  });
});

describe("meetingSchema (casos estables)", () => {
  it("acepta una reunión presencial válida con location", () => {
    const result = meetingSchema.safeParse({
      title: "Reunión mensual",
      startsAt: "2026-02-01T18:00:00.000Z",
      location: "Biblioteca central",
      isVirtual: false,
    });
    expect(result.success).toBe(true);
  });

  it("acepta una reunión virtual válida con meetingUrl", () => {
    const result = meetingSchema.safeParse({
      title: "Reunión mensual",
      startsAt: "2026-02-01T18:00:00.000Z",
      meetingUrl: "https://meet.example.com/sala",
      isVirtual: true,
    });
    expect(result.success).toBe(true);
  });

  it("coacciona startsAt en formato string a Date", () => {
    const result = meetingSchema.safeParse({
      title: "Reunión mensual",
      startsAt: "2026-02-01T18:00:00.000Z",
      location: "Biblioteca central",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startsAt).toBeInstanceOf(Date);
    }
  });

  it("coacciona endsAt en formato string a Date cuando está presente", () => {
    const result = meetingSchema.safeParse({
      title: "Reunión mensual",
      startsAt: "2026-02-01T18:00:00.000Z",
      endsAt: "2026-02-01T20:00:00.000Z",
      location: "Biblioteca central",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.endsAt).toBeInstanceOf(Date);
    }
  });

  it("aplica isVirtual=false por defecto", () => {
    const result = meetingSchema.safeParse({
      title: "Reunión mensual",
      startsAt: "2026-02-01T18:00:00.000Z",
      location: "Biblioteca central",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isVirtual).toBe(false);
    }
  });

  it("acepta meetingUrl como cadena vacía", () => {
    const result = meetingSchema.safeParse({
      title: "Reunión mensual",
      startsAt: "2026-02-01T18:00:00.000Z",
      location: "Biblioteca central",
      meetingUrl: "",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza cuando falta startsAt", () => {
    const result = meetingSchema.safeParse({
      title: "Reunión mensual",
      location: "Biblioteca central",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un título de menos de 2 caracteres", () => {
    const result = meetingSchema.safeParse({
      title: "A",
      startsAt: "2026-02-01T18:00:00.000Z",
      location: "Biblioteca central",
    });
    expect(result.success).toBe(false);
  });

  it("aplica type=REUNION por defecto cuando no se envía", () => {
    const result = meetingSchema.safeParse({
      title: "Reunión mensual",
      startsAt: "2026-02-01T18:00:00.000Z",
      location: "Biblioteca central",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("REUNION");
    }
  });

  it("acepta explícitamente los cuatro tipos válidos (REUNION, CINE, POESIA, OTRO)", () => {
    for (const type of ["REUNION", "CINE", "POESIA", "OTRO"] as const) {
      const result = meetingSchema.safeParse({
        title: "Reunión mensual",
        startsAt: "2026-02-01T18:00:00.000Z",
        location: "Biblioteca central",
        type,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe(type);
      }
    }
  });

  it("rechaza un type que no está en el enum", () => {
    const result = meetingSchema.safeParse({
      title: "Reunión mensual",
      startsAt: "2026-02-01T18:00:00.000Z",
      location: "Biblioteca central",
      type: "FIESTA",
    });
    expect(result.success).toBe(false);
  });
});

describe("meetingSchema (validación cruzada isVirtual/location/meetingUrl)", () => {
  it("rechaza una reunión virtual sin meetingUrl con el error en el campo meetingUrl", () => {
    const result = meetingSchema.safeParse({
      title: "Reunión mensual",
      startsAt: "2026-02-01T18:00:00.000Z",
      isVirtual: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["meetingUrl"]);
    }
  });

  it("rechaza una reunión virtual con meetingUrl vacío con el error en el campo meetingUrl", () => {
    const result = meetingSchema.safeParse({
      title: "Reunión mensual",
      startsAt: "2026-02-01T18:00:00.000Z",
      isVirtual: true,
      meetingUrl: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["meetingUrl"]);
    }
  });

  it("rechaza una reunión presencial sin location ni meetingUrl con el error en el campo location", () => {
    const result = meetingSchema.safeParse({
      title: "Reunión mensual",
      startsAt: "2026-02-01T18:00:00.000Z",
      isVirtual: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["location"]);
    }
  });

  it("acepta una reunión presencial con meetingUrl pero sin location", () => {
    const result = meetingSchema.safeParse({
      title: "Reunión mensual",
      startsAt: "2026-02-01T18:00:00.000Z",
      isVirtual: false,
      meetingUrl: "https://meet.example.com/sala",
    });
    expect(result.success).toBe(true);
  });
});

describe("idSchema", () => {
  it("acepta un cuid válido", () => {
    const result = idSchema.safeParse("cluid1234567890abcdefghi");
    expect(result.success).toBe(true);
  });

  it("rechaza una cadena que no es un cuid", () => {
    const result = idSchema.safeParse("no-es-un-cuid");
    expect(result.success).toBe(false);
  });

  it("rechaza un valor vacío", () => {
    const result = idSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("onboardingSchema", () => {
  it("acepta ageConfirmed=true sin géneros (default [])", () => {
    const result = onboardingSchema.safeParse({ ageConfirmed: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.favoriteGenres).toEqual([]);
    }
  });

  it("acepta ageConfirmed=true con géneros válidos", () => {
    const result = onboardingSchema.safeParse({
      ageConfirmed: true,
      favoriteGenres: ["Novela", "Terror", "Ciencia ficción"],
    });
    expect(result.success).toBe(true);
  });

  it("rechaza ageConfirmed=false", () => {
    const result = onboardingSchema.safeParse({ ageConfirmed: false });
    expect(result.success).toBe(false);
  });

  it("rechaza cuando falta ageConfirmed", () => {
    const result = onboardingSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rechaza un género que no está en la lista", () => {
    const result = onboardingSchema.safeParse({
      ageConfirmed: true,
      favoriteGenres: ["Ciencia ficción", "Manga"],
    });
    expect(result.success).toBe(false);
  });

  it("rechaza más de 10 géneros", () => {
    const result = onboardingSchema.safeParse({
      ageConfirmed: true,
      favoriteGenres: [
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
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("profileUpdateSchema", () => {
  it("acepta un perfil válido con solo el nombre", () => {
    const result = profileUpdateSchema.safeParse({ name: "María Pérez" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.favoriteGenres).toEqual([]);
    }
  });

  it("acepta un perfil válido con todos los campos", () => {
    const result = profileUpdateSchema.safeParse({
      name: "María Pérez",
      bio: "Lectora empedernida.",
      birthday: "2000-03-15",
      favoriteGenres: ["Fantasía", "Terror"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.birthday).toBeInstanceOf(Date);
    }
  });

  it("acepta bio y birthday como null", () => {
    const result = profileUpdateSchema.safeParse({
      name: "María Pérez",
      bio: null,
      birthday: null,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza un nombre de menos de 2 caracteres", () => {
    const result = profileUpdateSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("rechaza cuando falta el nombre", () => {
    const result = profileUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rechaza una bio de más de 280 caracteres", () => {
    const result = profileUpdateSchema.safeParse({
      name: "María Pérez",
      bio: "a".repeat(281),
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un género que no está en la lista", () => {
    const result = profileUpdateSchema.safeParse({
      name: "María Pérez",
      favoriteGenres: ["Manga"],
    });
    expect(result.success).toBe(false);
  });
});

describe("shelfStatusSchema", () => {
  it("acepta los tres estados válidos (READING, WANT_TO_READ, FINISHED)", () => {
    for (const status of ["READING", "WANT_TO_READ", "FINISHED"] as const) {
      const result = shelfStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    }
  });

  it("rechaza un estado que no está en el enum", () => {
    const result = shelfStatusSchema.safeParse("ARCHIVED");
    expect(result.success).toBe(false);
  });

  it("rechaza un valor vacío", () => {
    const result = shelfStatusSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("addToShelfSchema", () => {
  it("acepta un libro válido con solo título y status", () => {
    const result = addToShelfSchema.safeParse({
      title: "Cien años de soledad",
      status: "WANT_TO_READ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.authors).toEqual([]);
    }
  });

  it("acepta un libro válido con todos los campos de bookInputSchema + status", () => {
    const result = addToShelfSchema.safeParse({
      title: "Cien años de soledad",
      authors: ["Gabriel García Márquez"],
      coverUrl: "https://example.com/cover.jpg",
      description: "Una novela.",
      pageCount: 471,
      publishedYear: 1967,
      googleBooksId: "abc123",
      isbn: "9780307474728",
      status: "READING",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza cuando falta status", () => {
    const result = addToShelfSchema.safeParse({ title: "Libro" });
    expect(result.success).toBe(false);
  });

  it("rechaza un status que no está en el enum", () => {
    const result = addToShelfSchema.safeParse({ title: "Libro", status: "LEYENDO" });
    expect(result.success).toBe(false);
  });

  it("rechaza cuando falta el título (hereda bookInputSchema)", () => {
    const result = addToShelfSchema.safeParse({ status: "READING" });
    expect(result.success).toBe(false);
  });
});

describe("moveShelfSchema", () => {
  it("acepta un movimiento válido", () => {
    const result = moveShelfSchema.safeParse({ bookId: "book-1", status: "FINISHED" });
    expect(result.success).toBe(true);
  });

  it("rechaza cuando falta bookId", () => {
    const result = moveShelfSchema.safeParse({ status: "FINISHED" });
    expect(result.success).toBe(false);
  });

  it("rechaza cuando falta status", () => {
    const result = moveShelfSchema.safeParse({ bookId: "book-1" });
    expect(result.success).toBe(false);
  });
});

describe("updateMyBookSchema", () => {
  it("acepta solo bookId, sin página ni capítulo", () => {
    const result = updateMyBookSchema.safeParse({ bookId: "book-1" });
    expect(result.success).toBe(true);
  });

  it("acepta bookId con currentPage y currentChapter positivos", () => {
    const result = updateMyBookSchema.safeParse({
      bookId: "book-1",
      currentPage: 120,
      currentChapter: 5,
    });
    expect(result.success).toBe(true);
  });

  it("acepta currentPage y currentChapter como null", () => {
    const result = updateMyBookSchema.safeParse({
      bookId: "book-1",
      currentPage: null,
      currentChapter: null,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza currentPage igual a 0 (no positivo)", () => {
    const result = updateMyBookSchema.safeParse({ bookId: "book-1", currentPage: 0 });
    expect(result.success).toBe(false);
  });

  it("rechaza currentChapter negativo", () => {
    const result = updateMyBookSchema.safeParse({ bookId: "book-1", currentChapter: -1 });
    expect(result.success).toBe(false);
  });

  it("rechaza currentPage no entero", () => {
    const result = updateMyBookSchema.safeParse({ bookId: "book-1", currentPage: 12.5 });
    expect(result.success).toBe(false);
  });

  it("rechaza cuando falta bookId", () => {
    const result = updateMyBookSchema.safeParse({ currentPage: 10 });
    expect(result.success).toBe(false);
  });
});
