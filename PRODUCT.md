# Moon · Club de Lectura — PRODUCT.md

## Register

`product` — esta es una app de uso, no una landing. La estética sirve a la
herramienta y al ritual del club, no es la pieza protagonista.

## Product purpose

Plataforma íntima y premium para gestionar el club de lectura **Moon**:

- Sugerir libros y votar de forma múltiple por los próximos a leer en rondas
  con fechas claras
- Acompañar la lectura del libro en curso (avance compartido, comentarios con
  hilos y spoilers ocultables, valoraciones)
- Coordinar reuniones (físicas o virtuales) con RSVP

El objetivo no es "una herramienta más"; es **darle ceremonia a la lectura
compartida** con un nivel de cuidado que se sienta en cada interacción.

## Users

- **Miembras del club**: lectoras (mayoritariamente mujeres, treintañeras,
  hispanohablantes, lectura por placer, no estudio académico). Acceden desde
  móvil principalmente, a veces desde laptop. Quieren entrar rápido, ver qué
  toca leer, marcar dónde van, comentar sin spoilear, y confirmar reuniones.
  Cero tolerancia a fricción de auth (de ahí el magic link).
- **Admin del club** (1–2 personas): abre rondas, marca libro en curso,
  programa reuniones, gestiona roles. Necesita un panel claro pero no
  enterprise; el club tiene 5–30 miembras, no miles.

## Brand & tone

- **Voz**: cálida, literaria, con guiños cómplices. Tutea siempre. Frases
  cortas. Acepta italiana, hand-script (Caveat) y ornamentos `✦` con mesura.
- **Identidad visual de referencia**: gato negro durmiendo sobre luna creciente
  morada con libro abierto entre las patas; estrellas pequeñas alrededor;
  wordmark "Moon" hand-lettered cursivo.
- **Mood word**: nocturno, íntimo, ritual, suave, sin estridencias.

## Anti-references

Lo que esta app NO debe parecerse a:

- SaaS corporativo (Linear, Notion, Vercel) — esto es un club, no un workspace.
- Plataformas de lectura masiva (Goodreads, StoryGraph) — más cálido, menos
  "review aggregator".
- Apps "femeninas" cliché tipo pastel rosa + sans rounded — la luna y el gato
  ya aportan suavidad, la tipografía y el contraste deben sostener seriedad.
- El cliché AI: gradientes morado-sobre-blanco, hero metric template, tarjetas
  idénticas en grid 3-cols con icono+título+texto, glassmorphism por todas
  partes.

## Strategic principles

1. **Móvil primero, retina obligatorio.** La mayoría entra desde el celular en
   la cama. Tipografía legible, touch targets ≥44px, sin overflow horizontal,
   sin scroll-jacking.
2. **Ritmo, no monotonía.** Espaciado variable, asimetría suave, contraste
   intencional entre serif Fraunces y grotesk Karla.
3. **Ceremonia, no fricción.** Magic link sin contraseña, autocompletado de
   libros, votación de un toque, RSVP de un toque.
4. **Modo oscuro premium primero**, claro funcional segundo (la mayoría leerá
   de noche).
5. **Cero spoilers accidentales.** Ocultar siempre, capítulo opcional para
   contextualizar.

## Register field

`product`
