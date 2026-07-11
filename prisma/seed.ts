/**
 * Seed de demo local — datos del contrato visual (mockups v3.1).
 * Ejecutar con: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const now = new Date();
const daysFromNow = (d: number, h = 0) =>
  new Date(now.getTime() + d * 86400000 + h * 3600000);
const daysAgo = (d: number, h = 0) => daysFromNow(-d, -h);

function mondayOfThisWeek(): Date {
  const d = new Date(now);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // lunes = 0
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function main() {
  console.log("🌙 Sembrando Moon Club…");

  // ── Usuarios ──────────────────────────────────────────────
  const stiven = await db.user.create({
    data: {
      name: "Stiven",
      email: "stivenrosales01@gmail.com",
      emailVerified: now,
      role: "ADMIN",
      // Sin onboardedAt: el usuario principal VIVE el onboarding al entrar.
    },
  });

  const camila = await db.user.create({
    data: {
      name: "Camila Ríos",
      email: "camila@moonclub.demo",
      emailVerified: now,
      role: "MODERATOR",
      bio: "Leo de madrugada y subrayo demasiado. Té antes que café, Cortázar antes que todo.",
      favoriteGenres: ["Realismo mágico", "Poesía", "Cuento"],
      birthday: new Date(Date.UTC(2000, 2, 12)),
      ageConfirmedAt: daysAgo(300),
      onboardedAt: daysAgo(300),
      isMatchOptIn: true,
    },
  });

  const diego = await db.user.create({
    data: {
      name: "Diego Arana",
      email: "diego@moonclub.demo",
      emailVerified: now,
      bio: "Fan de Rulfo y de las trivias de los viernes.",
      favoriteGenres: ["Novela", "Clásicos", "Historia"],
      ageConfirmedAt: daysAgo(280),
      onboardedAt: daysAgo(280),
    },
  });

  const lucia = await db.user.create({
    data: {
      name: "Lucía Torres",
      email: "lucia@moonclub.demo",
      emailVerified: now,
      bio: "31 libros este año y contando.",
      favoriteGenres: ["Cuento", "Ensayo", "Ciencia ficción"],
      ageConfirmedAt: daysAgo(250),
      onboardedAt: daysAgo(250),
    },
  });

  const andres = await db.user.create({
    data: {
      name: "Andrés Paz",
      email: "andres@moonclub.demo",
      emailVerified: now,
      bio: "Poesía o nada.",
      favoriteGenres: ["Poesía", "Teatro"],
      birthday: new Date(Date.UTC(2000, now.getUTCMonth(), Math.min(now.getUTCDate() + 4, 28))),
      ageConfirmedAt: daysAgo(200),
      onboardedAt: daysAgo(200),
      isMatchOptIn: true,
    },
  });

  const sofia = await db.user.create({
    data: {
      name: "Sofía Quispe",
      email: "sofia@moonclub.demo",
      emailVerified: now,
      favoriteGenres: ["Romance", "Juvenil"],
      ageConfirmedAt: daysAgo(6),
      onboardedAt: daysAgo(6),
    },
  });

  // ── Libros ────────────────────────────────────────────────
  const cienAnos = await db.book.create({
    data: {
      title: "Cien años de soledad",
      authors: ["Gabriel García Márquez"],
      description:
        "La saga de la familia Buendía en Macondo, obra cumbre del realismo mágico.",
      pageCount: 351,
      publishedYear: 1967,
      status: "CURRENT",
      isCurrent: true,
      startedAt: daysAgo(21),
      categories: ["Realismo mágico", "Novela"],
    },
  });

  const rayuela = await db.book.create({
    data: {
      title: "Rayuela",
      authors: ["Julio Cortázar"],
      pageCount: 736,
      publishedYear: 1963,
      status: "FINISHED",
      finishedAt: daysAgo(40),
      categories: ["Novela", "Clásicos"],
    },
  });

  const ficciones = await db.book.create({
    data: {
      title: "Ficciones",
      authors: ["Jorge Luis Borges"],
      pageCount: 218,
      publishedYear: 1944,
      status: "FINISHED",
      finishedAt: daysAgo(80),
      categories: ["Cuento"],
    },
  });

  const pedroParamo = await db.book.create({
    data: {
      title: "Pedro Páramo",
      authors: ["Juan Rulfo"],
      pageCount: 128,
      publishedYear: 1955,
      status: "SUGGESTED",
      categories: ["Novela", "Realismo mágico"],
    },
  });

  const ciudadPerros = await db.book.create({
    data: {
      title: "La ciudad y los perros",
      authors: ["Mario Vargas Llosa"],
      pageCount: 419,
      publishedYear: 1963,
      status: "SUGGESTED",
      categories: ["Novela", "Clásicos"],
    },
  });

  const casaEspiritus = await db.book.create({
    data: {
      title: "La casa de los espíritus",
      authors: ["Isabel Allende"],
      pageCount: 433,
      publishedYear: 1982,
      status: "SUGGESTED",
      categories: ["Realismo mágico", "Novela"],
    },
  });

  const riosProfundos = await db.book.create({
    data: {
      title: "Los ríos profundos",
      authors: ["José María Arguedas"],
      pageCount: 250,
      publishedYear: 1958,
      status: "SUGGESTED",
      categories: ["Novela", "Clásicos"],
    },
  });

  // ── Ronda 9 abierta (cierra en 2 días) ────────────────────
  const ronda = await db.round.create({
    data: {
      title: "Ronda 9 · ¿Qué leemos en agosto?",
      description: "Se abre la votación para la lectura de agosto.",
      startsAt: daysAgo(5),
      endsAt: daysFromNow(2),
      status: "OPEN",
      creatorId: stiven.id,
    },
  });

  const sug1 = await db.bookSuggestion.create({
    data: { roundId: ronda.id, bookId: pedroParamo.id, userId: camila.id, pitch: "Corto, fantasmal y perfecto para agosto." },
  });
  const sug2 = await db.bookSuggestion.create({
    data: { roundId: ronda.id, bookId: ciudadPerros.id, userId: diego.id, pitch: "Nunca lo leímos juntos y es un clásico." },
  });
  const sug3 = await db.bookSuggestion.create({
    data: { roundId: ronda.id, bookId: casaEspiritus.id, userId: lucia.id, pitch: "Seguimos con el realismo mágico." },
  });

  await db.vote.createMany({
    data: [
      { suggestionId: sug1.id, userId: stiven.id },
      { suggestionId: sug1.id, userId: camila.id },
      { suggestionId: sug1.id, userId: lucia.id },
      { suggestionId: sug2.id, userId: diego.id },
      { suggestionId: sug2.id, userId: andres.id },
      { suggestionId: sug3.id, userId: sofia.id },
    ],
  });

  // ── Progreso del libro del club ───────────────────────────
  await db.readingProgress.createMany({
    data: [
      { bookId: cienAnos.id, userId: stiven.id, currentPage: 214, chapter: 12 },
      { bookId: cienAnos.id, userId: camila.id, currentPage: 248, chapter: 14 },
      { bookId: cienAnos.id, userId: diego.id, currentPage: 214, chapter: 12 },
      { bookId: cienAnos.id, userId: lucia.id, currentPage: 175, chapter: 10 },
    ],
  });

  // ── Estanterías personales ────────────────────────────────
  await db.userBook.createMany({
    data: [
      { userId: stiven.id, bookId: riosProfundos.id, status: "READING", currentPage: 85, currentChapter: 5, startedAt: daysAgo(10) },
      { userId: stiven.id, bookId: ficciones.id, status: "WANT_TO_READ" },
      { userId: stiven.id, bookId: casaEspiritus.id, status: "WANT_TO_READ" },
      { userId: camila.id, bookId: rayuela.id, status: "FINISHED", startedAt: daysAgo(30), finishedAt: daysAgo(1) },
      { userId: camila.id, bookId: pedroParamo.id, status: "WANT_TO_READ" },
      { userId: diego.id, bookId: pedroParamo.id, status: "READING", currentPage: 30, currentChapter: 2, startedAt: daysAgo(1) },
      { userId: lucia.id, bookId: ficciones.id, status: "FINISHED", startedAt: daysAgo(20), finishedAt: daysAgo(1) },
      { userId: andres.id, bookId: rayuela.id, status: "WANT_TO_READ" },
    ],
  });

  // ── Calificaciones ────────────────────────────────────────
  await db.rating.createMany({
    data: [
      { bookId: rayuela.id, userId: camila.id, stars: 5, review: "Se puede leer en el orden que quieras y aun así te rompe. Mi libro del año." },
      { bookId: ficciones.id, userId: lucia.id, stars: 4, review: "Borges no se lee, se relee." },
      { bookId: cienAnos.id, userId: diego.id, stars: 5 },
      { bookId: cienAnos.id, userId: lucia.id, stars: 4 },
      { bookId: rayuela.id, userId: stiven.id, stars: 4 },
    ],
  });

  // ── Foro del libro del club (salas por capítulo) ──────────
  await db.comment.createMany({
    data: [
      { bookId: cienAnos.id, userId: diego.id, chapter: 12, content: "La escena del insomnio colectivo me pareció una locura. ¿Nadie más pensó en pandemias?", createdAt: daysAgo(0, 2) },
      { bookId: cienAnos.id, userId: camila.id, chapter: 12, content: "Y los papelitos con nombres de las cosas… García Márquez inventó los post-it.", createdAt: daysAgo(0, 1) },
      { bookId: cienAnos.id, userId: camila.id, chapter: 14, content: "Lo que pasa con Remedios en este capítulo es de lo más bello que he leído.", createdAt: daysAgo(0, 3) },
      { bookId: cienAnos.id, userId: lucia.id, chapter: 9, content: "El coronel y sus pescaditos de oro… la melancolía hecha personaje.", createdAt: daysAgo(1) },
      { bookId: cienAnos.id, userId: diego.id, content: "¿Alguien más lo lee con el árbol genealógico a la mano? Los Aurelianos me superan.", createdAt: daysAgo(2) },
      { bookId: cienAnos.id, userId: camila.id, chapter: 13, isSpoiler: true, content: "No puedo creer LO QUE LE PASA a José Arcadio. Necesito hablar de esto ya.", createdAt: daysAgo(0, 5) },
    ],
  });

  // ── Frases ────────────────────────────────────────────────
  const q1 = await db.quote.create({
    data: { bookId: cienAnos.id, userId: stiven.id, page: 9, content: "Muchos años después, frente al pelotón de fusilamiento, el coronel Aureliano Buendía había de recordar aquella tarde remota en que su padre lo llevó a conocer el hielo." },
  });
  const q2 = await db.quote.create({
    data: { bookId: cienAnos.id, userId: camila.id, page: 9, content: "El mundo era tan reciente, que muchas cosas carecían de nombre, y para mencionarlas había que señalarlas con el dedo." },
  });
  const q3 = await db.quote.create({
    data: { bookId: cienAnos.id, userId: diego.id, chapter: 12, content: "No morirá nadie mientras alguien lo recuerde." },
  });
  await db.quoteLike.createMany({
    data: [
      { quoteId: q1.id, userId: camila.id },
      { quoteId: q1.id, userId: diego.id },
      { quoteId: q1.id, userId: lucia.id },
      { quoteId: q2.id, userId: stiven.id },
      { quoteId: q2.id, userId: andres.id },
      { quoteId: q3.id, userId: camila.id },
    ],
  });

  // ── Seguidores ────────────────────────────────────────────
  await db.follow.createMany({
    data: [
      { followerId: stiven.id, followingId: camila.id },
      { followerId: stiven.id, followingId: lucia.id },
      { followerId: camila.id, followingId: stiven.id },
      { followerId: diego.id, followingId: stiven.id },
      { followerId: lucia.id, followingId: camila.id },
      { followerId: andres.id, followingId: camila.id },
    ],
  });

  // ── Mensajes (hilo del mockup) ────────────────────────────
  await db.message.createMany({
    data: [
      { senderId: camila.id, receiverId: stiven.id, content: "¿Ya llegaste al capítulo 12? Necesito hablar de los papelitos con nombres 😭", createdAt: daysAgo(0, 3), readAt: daysAgo(0, 2) },
      { senderId: stiven.id, receiverId: camila.id, content: "¡Recién! No me spoilees nada de más adelante", createdAt: daysAgo(0, 2), readAt: daysAgo(0, 2) },
      { senderId: camila.id, receiverId: stiven.id, content: "Jajaja te espero en el foro entonces", createdAt: daysAgo(0, 1) },
      { senderId: lucia.id, receiverId: stiven.id, content: "¿Llevo algo para el cine del viernes?", createdAt: daysAgo(0, 5) },
    ],
  });

  // ── Actividades del club ──────────────────────────────────
  const cine = await db.meeting.create({
    data: {
      title: "Cine · Como agua para chocolate",
      description: "Después del capítulo 14. Palomitas incluidas.",
      type: "CINE",
      startsAt: daysFromNow(14, 3),
      location: "Casa de Lucía",
      creatorId: stiven.id,
      bookId: cienAnos.id,
    },
  });
  const cierre = await db.meeting.create({
    data: {
      title: "Cierre del libro · caps. 15–20",
      type: "REUNION",
      startsAt: daysFromNow(18, 2),
      isVirtual: true,
      meetingUrl: "https://meet.google.com/moon-club-demo",
      creatorId: stiven.id,
      bookId: cienAnos.id,
    },
  });
  await db.meeting.create({
    data: {
      title: "Tarde de poesía peruana",
      type: "POESIA",
      startsAt: daysFromNow(7, 1),
      location: "Parque Kennedy",
      creatorId: andres.id,
    },
  });

  await db.rsvp.createMany({
    data: [
      { meetingId: cine.id, userId: stiven.id, status: "YES" },
      { meetingId: cine.id, userId: camila.id, status: "YES" },
      { meetingId: cine.id, userId: diego.id, status: "YES" },
      { meetingId: cine.id, userId: lucia.id, status: "YES" },
      { meetingId: cine.id, userId: andres.id, status: "MAYBE" },
      { meetingId: cierre.id, userId: camila.id, status: "YES" },
    ],
  });

  // ── Kahoot ────────────────────────────────────────────────
  const trivia = await db.kahootActivity.create({
    data: { title: "Trivia de «Rayuela»", playedAt: daysAgo(7), creatorId: camila.id },
  });
  await db.kahootScore.createMany({
    data: [
      { activityId: trivia.id, userId: camila.id, points: 2380, correctAnswers: 12 },
      { activityId: trivia.id, userId: lucia.id, points: 2140, correctAnswers: 11 },
      { activityId: trivia.id, userId: diego.id, points: 1990, correctAnswers: 10 },
      { activityId: trivia.id, userId: stiven.id, points: 1870, correctAnswers: 9 },
      { activityId: trivia.id, userId: andres.id, points: 1645, correctAnswers: 8 },
      { activityId: trivia.id, userId: sofia.id, points: 1320, correctAnswers: 7 },
    ],
  });

  // ── Book Match de la semana ───────────────────────────────
  await db.match.create({
    data: { userAId: camila.id, userBId: andres.id, weekOf: mondayOfThisWeek(), score: 87 },
  });

  console.log("✅ Seed completo: 6 usuarios, 7 libros, ronda abierta, foro, frases, mensajes, actividades y trivia.");
  console.log("→ Inicia sesión con stivenrosales01@gmail.com (el magic link sale en la consola del dev server).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
