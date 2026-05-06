import { z } from "zod";

export const emailSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
});

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
  note: z.string().max(400).optional().nullable(),
});

export const meetingSchema = z
  .object({
    title: z.string().min(2).max(180),
    description: z.string().max(2000).optional().nullable(),
    bookId: z.string().optional().nullable(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional().nullable(),
    location: z.string().max(280).optional().nullable(),
    meetingUrl: z.string().url().optional().nullable().or(z.literal("")),
    isVirtual: z.boolean().default(false),
  })
  .refine(
    (d) => d.isVirtual ? !!d.meetingUrl : !!d.location || !!d.meetingUrl,
    { path: ["location"], message: "Indica un lugar o un enlace" },
  );

export const rsvpSchema = z.object({
  meetingId: z.string().min(1),
  status: z.enum(["YES", "NO", "MAYBE"]),
});
