# Moon · Club de Lectura — PRODUCT.md

## Register

`product` — esta es una app de uso, no una landing. La estética sirve a la
herramienta y al ritual del club, no es la pieza protagonista.

## Product purpose

Plataforma íntima y premium para el club de lectura **Moon**, que sostiene
tres cosas a la vez:

- Sugerir libros y votar de forma múltiple por los próximos a leer en rondas
  con fechas claras
- Acompañar la lectura del libro en curso (avance compartido, comentarios con
  hilos y spoilers ocultables, valoraciones)
- Coordinar reuniones (físicas o virtuales) con RSVP

Pero Moon ya no es solo la herramienta que se abre para votar o marcar
página: es el lugar donde el club **sigue existiendo entre reunión y
reunión**. Feed de actividad, seguimiento entre miembras, muro de frases,
mensajería directa y perfiles públicos le dan al club una vida social propia,
que no depende de que haya una ronda abierta o una reunión próxima para tener
sentido entrar.

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
- **Moderadoras**: revisan reportes y pueden ver el contenido que el gating
  de spoilers le esconde al resto (incluida la sala de reflexión) para poder
  moderarlo. Entran al panel, pero solo a lo suyo: reportes y trivia. Las
  rondas, reuniones, libros y roles siguen siendo de la admin. No administran
  el club; cuidan que el espacio social siga siendo seguro.

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
- Redes sociales al uso (Instagram, X, BeReal) — el feed, el seguimiento y las
  frases existen para acercar lectoras entre reuniones, no para acumular
  seguidores ni sostener un scroll infinito.

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
6. **Lo social acerca, no compite.** Nada de contadores de seguidores como
   puntaje, nada de rankings de popularidad, nada de presión por publicar. El
   seguimiento y el muro de frases existen para que una lectora encuentre a
   otra, no para que el club se convierta en una vitrina.
7. **Seguridad social por diseño, no por parche.** Bloqueo entre usuarias,
   reportes por categoría y el opt-in explícito de Book Match no son
   features aparte: son condición para que el feed, los perfiles públicos y
   la mensajería directa existan.

## Register field

`product`
