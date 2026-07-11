// Lista fija de géneros literarios para onboarding y perfil (mockup v3.1).
// El orden importa: es el orden en que se renderizan los chips.
export const GENEROS = [
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
  "Biografía",
  "Historia",
  "Filosofía",
  "Teatro",
  "Novela gráfica",
  "Juvenil",
  "Clásicos",
  "Crónica",
  "Divulgación",
] as const;

export type Genero = (typeof GENEROS)[number];
