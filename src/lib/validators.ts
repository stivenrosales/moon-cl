import { z } from "zod";
import { GENEROS } from "@/lib/genres";

export const emailSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
});

export const idSchema = z.string().cuid();

export const bookInputSchema = z.object({
  title: z.string().min(1).max(280),
  authors: z.array(z.string().max(120)).default([]),
  coverUrl: z.string().url().optional().nullable(),
  description: z.string().max(8000).optional().nullable(),
  pageCount: z.number().int().positive().max(20000).optional().nullable(),
  publishedYear: z.number().int().min(0).max(2100).optional().nullable(),
  googleBooksId: z.string().max(60).optional().nullable(),
  isbn: z.string().max(20).optional().nullable(),
});

export const bookUpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(280),
  authors: z.array(z.string().max(120)).default([]),
  coverUrl: z.string().url().optional().nullable().or(z.literal("")),
  description: z.string().max(8000).optional().nullable(),
  pageCount: z.number().int().positive().max(20000).optional().nullable(),
  publishedYear: z.number().int().min(0).max(2100).optional().nullable(),
  isbn: z.string().max(20).optional().nullable().or(z.literal("")),
});

export const suggestBookSchema = bookInputSchema.extend({
  roundId: z.string().min(1),
  pitch: z.string().max(800).optional().nullable(),
});

export const roundSchema = z
  .object({
    title: z.string().min(2).max(160),
    description: z.string().max(800).optional().nullable(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((d) => d.endsAt > d.startsAt, {
    path: ["endsAt"],
    message: "La fecha de cierre debe ser posterior a la apertura",
  });

export const commentSchema = z.object({
  bookId: z.string().min(1),
  parentId: z.string().nullable().optional(),
  content: z.string().min(1).max(4000),
  isSpoiler: z.boolean().default(false),
  isReflection: z.boolean().default(false),
  chapter: z.number().int().positive().max(2000).optional().nullable(),
});

export const ratingSchema = z.object({
  bookId: z.string().min(1),
  stars: z.number().int().min(1).max(5),
  review: z.string().max(4000).optional().nullable(),
});

export const progressSchema = z.object({
  bookId: z.string().min(1),
  currentPage: z.number().int().min(0).max(20000),
  chapter: z.number().int().positive().max(2000).optional().nullable(),
  note: z.string().max(400).optional().nullable(),
});

export const meetingSchema = z
  .object({
    title: z.string().min(2).max(180),
    description: z.string().max(2000).optional().nullable(),
    bookId: z.string().optional().nullable(),
    type: z.enum(["REUNION", "CINE", "POESIA", "OTRO"]).default("REUNION"),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional().nullable(),
    location: z.string().max(280).optional().nullable(),
    meetingUrl: z.string().url().optional().nullable().or(z.literal("")),
    isVirtual: z.boolean().default(false),
  })
  .refine((d) => !d.isVirtual || !!d.meetingUrl, {
    path: ["meetingUrl"],
    message: "Indica un enlace para la reunión virtual",
  })
  .refine((d) => d.isVirtual || !!d.location || !!d.meetingUrl, {
    path: ["location"],
    message: "Indica un lugar o un enlace",
  });

export const rsvpSchema = z.object({
  meetingId: z.string().min(1),
  status: z.enum(["YES", "NO", "MAYBE"]),
});

// ─────────────────────────────────────────────────────────────────────────
// Onboarding 18+ y perfil (Paquete C)
// ─────────────────────────────────────────────────────────────────────────

export const onboardingSchema = z.object({
  ageConfirmed: z.literal(true, {
    message: "Debes confirmar que tienes 18 años o más",
  }),
  favoriteGenres: z.array(z.enum(GENEROS)).max(10).optional().default([]),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(2).max(60),
  bio: z.string().max(280).optional().nullable(),
  birthday: z.coerce.date().optional().nullable(),
  favoriteGenres: z.array(z.enum(GENEROS)).max(10).optional().default([]),
});

// ─────────────────────────────────────────────────────────────────────────
// Estanterías personales (Paquete E)
// ─────────────────────────────────────────────────────────────────────────

export const shelfStatusSchema = z.enum(["READING", "WANT_TO_READ", "FINISHED"]);

export const addToShelfSchema = bookInputSchema.extend({
  status: shelfStatusSchema,
});

export const moveShelfSchema = z.object({
  bookId: z.string().min(1),
  status: shelfStatusSchema,
});

export const updateMyBookSchema = z.object({
  bookId: z.string().min(1),
  // .min(0), no .positive(): consistente con progressSchema.currentPage.
  // La página 0 es un valor legítimo (portada/prólogo) y debe persistirse,
  // no tratarse como "no declarado".
  currentPage: z.number().int().min(0).max(20000).optional().nullable(),
  currentChapter: z.number().int().positive().max(2000).optional().nullable(),
});

// ─────────────────────────────────────────────────────────────────────────
// Comunidad y frases (Paquete C)
// ─────────────────────────────────────────────────────────────────────────

export const quoteSchema = z.object({
  bookId: z.string().min(1),
  content: z.string().min(3).max(500),
  page: z.number().int().positive().optional().nullable(),
  chapter: z.number().int().positive().optional().nullable(),
});

// ─────────────────────────────────────────────────────────────────────────
// Kahoot (Paquete E)
// ─────────────────────────────────────────────────────────────────────────

export const kahootActivitySchema = z.object({
  title: z.string().min(2).max(80),
  description: z.string().max(2000).optional().nullable(),
  playedAt: z.coerce.date(),
  meetingId: z.string().optional().nullable(),
});

export const kahootScoresSchema = z.object({
  activityId: z.string().min(1),
  scores: z
    .array(
      z.object({
        userId: z.string().min(1),
        points: z.number().int().min(0),
        correctAnswers: z.number().int().min(0).optional().nullable(),
      }),
    )
    .min(1, "Agrega al menos un puntaje"),
});

// ─────────────────────────────────────────────────────────────────────────
// Mensajes privados y moderación (Paquete B1)
// ─────────────────────────────────────────────────────────────────────────

export const messageSchema = z.object({
  receiverId: z.string().cuid(),
  content: z
    .string()
    .trim()
    .min(1, "El mensaje no puede estar vacío")
    .max(2000, "El mensaje es demasiado largo (máx. 2000 caracteres)"),
});

export const reportCategorySchema = z.enum([
  "ACOSO",
  "SPAM",
  "CONTENIDO_INAPROPIADO",
  "OTRO",
]);

export const reportSchema = z.object({
  reportedUserId: z.string().cuid(),
  category: reportCategorySchema,
  subReason: z.string().max(120).optional().nullable(),
  details: z.string().max(1000).optional().nullable(),
  messageId: z.string().cuid().optional().nullable(),
});
