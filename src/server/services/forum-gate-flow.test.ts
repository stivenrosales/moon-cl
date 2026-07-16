import { beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────
// Test de integración punta a punta: card héroe → updateProgress → tablas →
// gateComment. Existe porque la trampa real de esta fase NO es que
// updateProgress falle sus propios tests unitarios (ya los tiene, ver
// progress.test.ts) ni que gateComment falle los suyos (comment-gating.test.ts):
// es que alguien, más adelante, rompa el ENGANCHE entre ambos — por ejemplo
// si el formulario deja de enviar `chapter`, o si el campo que se lee para
// `ctx.myChapter` deja de ser el que updateProgress efectivamente escribió.
// Ningún test unitario aislado detecta esa clase de regresión: los dos lados
// siguen "pasando" con datos fabricados a mano que ya no reflejan lo que la
// otra mitad del sistema produce. Este test usa una base de datos en
// memoria real (no mocks que solo graban llamadas) para que el capítulo que
// sale de updateProgress sea el mismo que efectivamente entra a gateComment.
// ─────────────────────────────────────────────────────────────────────────

const requireUserMock = vi.fn();
const revalidatePathMock = vi.fn();

interface FakeReadingProgress {
  id: string;
  bookId: string;
  userId: string;
  currentPage: number;
  chapter: number | null;
  note: string | null;
  createdAt: Date;
}

interface FakeUserBook {
  userId: string;
  bookId: string;
  status: "READING" | "WANT_TO_READ" | "FINISHED";
  currentPage: number | null;
  currentChapter: number | null;
  startedAt: Date | null;
}

// Estado real, mutado por las mismas operaciones que usa updateProgress
// (create / findUnique / upsert), no espías que solo registran argumentos.
let readingProgressRows: FakeReadingProgress[] = [];
let userBookRows: FakeUserBook[] = [];
let nextId = 0;

function key(userId: string, bookId: string) {
  return `${userId}::${bookId}`;
}

const fakeTx = {
  readingProgress: {
    create: async ({ data }: { data: Omit<FakeReadingProgress, "id" | "createdAt"> }) => {
      // +nextId ms garantiza createdAt estrictamente creciente entre envíos
      // sucesivos, igual que en producción (dos requests reales nunca caen
      // en el mismo milisegundo); evita timestamps empatados que harían el
      // "más reciente" ambiguo en este test.
      const row: FakeReadingProgress = {
        id: `p-${++nextId}`,
        createdAt: new Date(Date.now() + nextId),
        ...data,
      };
      readingProgressRows.push(row);
      return row;
    },
  },
  userBook: {
    findUnique: async ({ where }: { where: { userId_bookId: { userId: string; bookId: string } } }) => {
      const { userId, bookId } = where.userId_bookId;
      return userBookRows.find((r) => key(r.userId, r.bookId) === key(userId, bookId)) ?? null;
    },
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { userId_bookId: { userId: string; bookId: string } };
      create: FakeUserBook;
      update: Partial<FakeUserBook>;
    }) => {
      const { userId, bookId } = where.userId_bookId;
      const idx = userBookRows.findIndex((r) => key(r.userId, r.bookId) === key(userId, bookId));
      if (idx === -1) {
        userBookRows.push(create);
        return create;
      }
      userBookRows[idx] = { ...userBookRows[idx], ...update };
      return userBookRows[idx];
    },
  },
};

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (cb: (tx: typeof fakeTx) => unknown) => cb(fakeTx),
  },
}));

vi.mock("@/server/auth-helpers", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { updateProgress } from "@/server/actions/progress";
import { gateComment } from "@/server/services/comment-gating";

const READER = { id: "user-lectora", role: "MEMBER" };
const BOOK_ID = "book-circe";

/** Replica exacta de la derivación usada en leer/libro/[id]/page.tsx:141
 *  (myChapter = myLatest?.chapter ?? 0), leyendo del mismo store en memoria
 *  que updateProgress acaba de escribir. */
function myChapterDesdeBitacora(userId: string, bookId: string): number {
  const mine = readingProgressRows
    .filter((r) => r.userId === userId && r.bookId === bookId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return mine[0]?.chapter ?? 0;
}

beforeEach(() => {
  readingProgressRows = [];
  userBookRows = [];
  nextId = 0;
  requireUserMock.mockReset();
  revalidatePathMock.mockReset();
  requireUserMock.mockResolvedValue(READER);
});

describe("foro vivo: card héroe → updateProgress → myChapter → gateComment", () => {
  it("declarar capítulo en el input abre la sala de ese capítulo (camino feliz)", async () => {
    await updateProgress({ bookId: BOOK_ID, currentPage: 120, chapter: 5 });

    const myChapter = myChapterDesdeBitacora(READER.id, BOOK_ID);
    expect(myChapter).toBe(5); // llegó vivo hasta acá

    const miSala = gateComment(
      { authorId: "otra-lectora", chapter: 5, isSpoiler: false, isReflection: false },
      { currentUserId: READER.id, myChapter, isModerator: false, hasFinishedBook: false },
    );
    expect(miSala).toEqual({ locked: false });

    const salaFutura = gateComment(
      { authorId: "otra-lectora", chapter: 6, isSpoiler: false, isReflection: false },
      { currentUserId: READER.id, myChapter, isModerator: false, hasFinishedBook: false },
    );
    expect(salaFutura).toEqual({ locked: true, reason: "chapter" });
  });

  it("avanzar de capítulo en un segundo envío abre la sala nueva sin cerrar la anterior", async () => {
    await updateProgress({ bookId: BOOK_ID, currentPage: 120, chapter: 5 });
    await updateProgress({ bookId: BOOK_ID, currentPage: 140, chapter: 6 });

    const myChapter = myChapterDesdeBitacora(READER.id, BOOK_ID);
    expect(myChapter).toBe(6);

    for (const chapter of [1, 5, 6]) {
      const decision = gateComment(
        { authorId: "otra-lectora", chapter, isSpoiler: false, isReflection: false },
        { currentUserId: READER.id, myChapter, isModerator: false, hasFinishedBook: false },
      );
      expect(decision).toEqual({ locked: false });
    }

    const decision7 = gateComment(
      { authorId: "otra-lectora", chapter: 7, isSpoiler: false, isReflection: false },
      { currentUserId: READER.id, myChapter, isModerator: false, hasFinishedBook: false },
    );
    expect(decision7).toEqual({ locked: true, reason: "chapter" });
  });

  it("UserBook.currentChapter queda coherente con el capítulo recién declarado (misma transacción)", async () => {
    await updateProgress({ bookId: BOOK_ID, currentPage: 200, chapter: 9 });

    const userBook = userBookRows.find((r) => key(r.userId, r.bookId) === key(READER.id, BOOK_ID));
    expect(userBook?.currentChapter).toBe(9);
    expect(userBook?.currentPage).toBe(200);

    // ReadingProgress (bitácora) y UserBook (estantería) no divergen.
    const bitacoraChapter = myChapterDesdeBitacora(READER.id, BOOK_ID);
    expect(userBook?.currentChapter).toBe(bitacoraChapter);
  });

  it("LA TRAMPA: si el input solo mandara página (sin capítulo), el foro queda candado para siempre", async () => {
    // Simula el bug que el panel adversarial cazó: la card solo pide página.
    await updateProgress({ bookId: BOOK_ID, currentPage: 120 });

    const myChapter = myChapterDesdeBitacora(READER.id, BOOK_ID);
    expect(myChapter).toBe(0); // nunca se declaró capítulo → se queda en 0

    // Incluso la sala del capítulo 1 (el primero que existe) queda bloqueada.
    const sala1 = gateComment(
      { authorId: "otra-lectora", chapter: 1, isSpoiler: false, isReflection: false },
      { currentUserId: READER.id, myChapter, isModerator: false, hasFinishedBook: false },
    );
    expect(sala1).toEqual({ locked: true, reason: "chapter" });

    // Por eso hero-card.tsx exige `chapter` como campo obligatorio del form:
    // este test documenta POR QUÉ, no solo QUE funciona.
  });
});
