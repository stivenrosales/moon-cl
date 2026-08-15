# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```bash
npm run dev            # servidor de desarrollo
npm test               # vitest run (784 tests / 64 archivos, ~2s)
npm run test:watch     # vitest en watch
npx tsc --noEmit       # chequeo de tipos — el gate real de este repo
npm run build          # prisma generate && next build — NO toca la base
npm run db:push        # aplica schema.prisma a la BD (ver "Base de datos")
npm run db:studio      # explorar la BD
npm run db:seed        # tsx prisma/seed.ts
npm run db:backfill-nudges  # siembra UserNudge de usuarias previas a NUDGE_EPOCH

docker compose up --build   # verificar la imagen en local (ver "Despliegue")
```

**`npm run db:migrate` está en `package.json` pero no lo corras.** Este repo no usa
migraciones (ver "Base de datos"); `prisma migrate dev` crearía `prisma/migrations/` y
partiría el flujo en dos. El script quedó del scaffold inicial.

Correr un test suelto o filtrar por nombre:

```bash
npx vitest run src/server/services/today.test.ts
npx vitest run -t "no deja votar en una ronda que no está OPEN"
```

**`npm run lint` está roto.** No existe config de ESLint en el repo y `next lint` está
deprecado en Next 15.5: el comando se cuelga en un prompt interactivo pidiendo crear la
config. No lo ejecutes. La verificación de este repo es `npx tsc --noEmit` + `npm test`.

El repo versiona `.env.example`, no `.env.local`. Sin `.env.local` no levanta `npm run dev`
ni corre `db:push` — pero `npm test` y `npx tsc --noEmit` sí funcionan sin él, porque nada
del suite toca Postgres. Si solo vas a verificar código, no necesitas credenciales.

Al correr comandos de Next aparece un warning de lockfiles múltiples (hay un
`package-lock.json` en el `$HOME` del usuario). Es ruido, no un problema del proyecto.

## Arquitectura

Next.js 15 App Router + React 18 + Prisma/PostgreSQL. Server Components por defecto; el
estado del servidor viaja por Server Actions, no por una capa de API. Los `route.ts` de
`src/app/api/` existen solo para lo que no puede ser una action: NextAuth, el cron, el
`.ics` de reuniones, el upload de avatar y el polling de mensajes con SWR.

### Las cuatro capas

```
src/app/(app)/**/page.tsx   Server Components. Leen searchParams, llaman a services,
                            renderizan. No escriben nunca.
src/server/services/*.ts    Lectura + reglas de negocio. Patrón build/load (ver abajo).
src/server/actions/*.ts     "use server". Única puerta de ESCRITURA.
src/lib/*.ts                Puro y compartible: routes, validators, permissions, utils.
```

### Patrón build/load en services

Cada service parte en dos: una función **pura** que decide, y un **loader** que consulta.
`buildToday(input)` / `loadToday(userId)`, `buildFeed` / `loadFeed`, `buildNudgeQueue` /
`nextNudge`, `buildUrgency` / `loadUrgency`. La pura recibe filas ya cargadas y es la que
se testea a fondo sin tocar Postgres; el loader arma las queries y delega.

Cuando agregues lógica a un service, va en la función pura. Si te encuentras testeando el
loader, la lógica está en el lugar equivocado.

### Escrituras: una sola puerta por concepto

`updateProgress` (`src/server/actions/progress.ts`) es el ejemplo canónico: en una sola
`db.$transaction` inserta el `ReadingProgress` (bitácora append-only, nunca se pisa) **y**
hace upsert del `UserBook` (estado de la estantería). Nunca escribas uno sin el otro —
`ReadingProgress` y `UserBook` se desincronizan y `/hoy` empieza a mentir.

Toda action: `requireUser()` → `schema.parse(input)` (Zod, desde `src/lib/validators.ts`)
→ escritura → `revalidatePath(routes.x())`.

### `src/lib/routes.ts` es la fuente única de rutas

No escribas paths literales en `href`, `redirect`, `router.push` ni `revalidatePath`.
Un builder llamado **sin argumentos devuelve el path pelado a propósito**:
`revalidatePath("/leer?vista=club")` no invalida `/leer`, así que el objeto `{ vista }`
es exclusivo para el `href` de un `<Link>`.

Las rutas se reestructuraron de 8 pestañas a 5 destinos (`/hoy`, `/leer`, `/club`,
`/agenda`, `/perfil`). Las viejas siguen vivas como redirects 307 en
`src/lib/legacy-redirects.ts`, consumidas por `next.config.ts`. Son 307 y no 308 a
propósito: un 308 lo cachea el navegador para siempre. Si mueves una ruta, agrega su
redirect ahí.

**El README.md describe la estructura anterior a esa reestructuración** (`/dashboard`,
`/rondas`, `/reuniones`, `/biblioteca`). No lo uses como mapa del código. Su sección de
despliegue **también quedó obsoleta**: habla de Vercel + Neon + Resend, y ya no se despliega
así (ver "Despliegue"). Sigue siendo válido para stack y setup local.

### Vistas dentro de un destino

Las sub-vistas no son rutas: son `?vista=` + `SegmentedControl`. `resolverSegmentoActivo`
(`src/lib/segmented-control.ts`) cae al primer segmento si el param viene ausente o
manipulado, así que la nav nunca queda sin estado activo. Máximo 3 segmentos — la tupla
`Segmentos` no compila con un cuarto.

Al cambiar de vista dentro del mismo tab, Next **no** re-dispara `loading.tsx` (no hay
boundary nuevo). Por eso las páginas envuelven el contenido en `<Suspense key={vistaActiva}>`
con un skeleton: el `key` fuerza el desmontaje y evita que se quede el contenido viejo
congelado. Cada segmento de `(app)` tiene además su `loading.tsx` calcando la silueta real
de su `page.tsx`.

### Auth y permisos

Sesión con estrategia **database** (Auth.js v5 + adapter de Prisma), magic link sin
contraseña. `getSession()` (`src/lib/session.ts`) envuelve `auth()` en `React.cache` porque
cada llamada cruda dispara un lookup Session+User a Postgres; layout, page y actions del
mismo render comparten resultado.

En el servidor: `requireUser()` / `requireRole()` / `requireAdmin()` / `requireModerator()`
de `src/server/auth-helpers.ts`, que lanzan `AuthError`. En el cliente/render:
`isAdmin()` / `isModeratorOrAbove()` de `src/lib/permissions.ts`.

El layout de `(app)` redirige a `/onboarding` si falta `onboardedAt` — que viaja en
`session.user` desde el callback `session`, sin query extra.

### Foro por salas y spoilers

`gateComment()` (`src/server/services/comment-gating.ts`) decide si el **contenido** de un
comentario viaja al cliente. Esto es una decisión de servidor, no un blur de CSS: hubo un
leak verificado donde el texto llegaba en el HTML igual. Orden de reglas: moderadores ven
todo → sala de reflexión solo si terminaste el libro → capítulo posterior al tuyo bloqueado
→ spoiler oculto salvo para su autor.

De ahí que `currentChapter` sea sagrado: si una escritura de progreso lo pisa con `null`,
las salas quedan ancladas y se vuelven candados.

### La portada de `/hoy`: franja, slots y nudges

Dos servicios distintos alimentan `/hoy` y no se pisan.

`buildUrgency` (`services/urgency-queue.ts`) arma la fila de urgencia: ronda OPEN y
próxima reunión compiten por **máximo 2 slots** ordenados por fecha límite más cercana; si
no hay ninguno, entra un slot de **reposo** con una recomendación de "Quiero leer" — la fila
nunca queda vacía. Un resultado de trivia de las últimas 48h **no compite por slot**: viaja
aparte en `franja`, porque su criterio es una ventana de expiración, no una fecha límite
comparable con las otras dos.

`nextNudge` (`services/nudge-queue.ts`) devuelve **una sola invitación para toda la app**,
no una por página: cada pantalla pinta la que le toca según `NUDGE_SCREENS`. La trampa está
en que los disparadores son **estados acumulados** ("3 calificaciones", "primer libro
terminado"), no eventos — una usuaria veterana los cumple todos desde hace meses. Por eso
cada disparador se ancla a la fecha real en que se volvió cierto y se exige que sea
posterior a `NUDGE_EPOCH`. Si agregas un nudge nuevo, ánclalo igual o le explotará en la
cara a todo el club el día del deploy.

### Cron

**Todos** los jobs cuelgan de un dispatcher único: `src/app/api/cron/daily/route.ts`
(autenticado con `Bearer $CRON_SECRET`). Agregar un job es agregar una entrada al array
`jobs` e implementarlo en `src/server/jobs/`. Los jobs que no son diarios se auto-descartan
por fecha dentro de su propia función (`runBookMatch` sale si no es lunes en `America/Lima`).

El dispatcher nació por el límite de Vercel Hobby (2 crons, 1 ejecución/día). Ese límite ya
no existe —el disparador vive en `/etc/cron.d/moon-cl` del VPS— pero el patrón se mantiene:
un solo punto de entrada autenticado es más fácil de auditar que N endpoints. No lo partas
en varias rutas solo porque ahora se puede.

`runBookMatch` **no es idempotente**: escribe con `db.match.create` dentro de un loop que
además manda el email, sin transacción. Dispararlo dos veces el mismo lunes revienta con
violación de constraint después de haber enviado correos. Ojo al reintentar el cron a mano.

**El SDK de Resend no lanza ante un error de la API: devuelve `{ data, error }`.** Los tres
jobs que mandan correo ignoraban ese `error`, así que un fallo real —dominio sin verificar,
rate limit, saldo— se veía igual que un envío exitoso; `sendMeetingReminders` además marcaba
`remindedAt` pasara lo que pasara, dejando la reunión como recordada sin haberse enviado y sin
reintento posible. Si agregas un job que manda correo, verifica el `error` y que el resultado
que devuelves al dispatcher refleje los fallos: eso es lo único que se ve desde afuera.

Las fechas de negocio se calculan en `America/Lima`, no en UTC — rachas, cumpleaños y
recordatorios se rompen cerca de medianoche si usas UTC. Los helpers viven en
`src/lib/lima-date.ts` (`LIMA_TIMEZONE`, `limaYear`, `inicioDeAnioLima`, `fechaDiscretaLima`)
y los formateadores de `src/lib/utils.ts` ya usan Lima por defecto.

Esto vale también para el navegador, no solo para los jobs: **el contenedor corre en UTC**, así
que un `Intl.DateTimeFormat` sin `timeZone` dentro de un Server Component —o de un componente
cliente, que igual se renderiza primero en el servidor— muestra el día siguiente entre las 19:00
y las 23:59 hora Lima. Ya pasó en `/hoy`, en el contador anual del perfil público y en la lista
de conversaciones. Un test de fecha **debe** fijar `process.env.TZ` y dar lo mismo con
`TZ=America/Lima` y con `TZ=UTC`: el CI corre en UTC y ahí estos bugs son invisibles.

## Mapa del dominio

`prisma/schema.prisma` tiene ~22 modelos. Los agrupamientos que no se deducen leyendo un
solo archivo:

**Elegir libro** — `Round` (`SCHEDULED | OPEN | CLOSED`) → `BookSuggestion` (única por
`[roundId, bookId]`) → `Vote` (único por `[suggestionId, userId]`). El ganador se congela en
`Round.winnerBookId`, que es `@unique`: un libro gana una ronda y solo una. `RoundStatus` es
un campo, no una verdad: una ronda vencida sigue marcada `OPEN` hasta que el cron la cierre,
así que las reglas comparan contra `endsAt`, nunca contra el status solo.

La votación es **un** camino, no el único. La lectura en curso del club es `Book.isCurrent`
—`loadToday` lee `getCurrentClubBook()`, no `Round.winnerBookId`— y se pone a dedo desde
`/admin` con `setBookAsCurrent` o al crear el libro con `createBook({ marcarComoActual: true })`.
Cerrar una ronda termina llamando a `setCurrentBookTx`, la misma función. Ojo con la
consecuencia: si queda una ronda `OPEN` vencida, el cron la cierra y su ganador **pisa** el
libro que pusiste a mano, archivándolo como `FINISHED`. Por eso el diálogo de agregar libro
avisa cuando hay una ronda vigente.

**Leer** — `Book` es el catálogo compartido; `UserBook` es la estantería de cada quien
(`ShelfStatus`); `ReadingProgress` es la bitácora append-only. Los tres se tocan juntos, ver
"Escrituras: una sola puerta por concepto".

Un libro entra al catálogo por `findOrCreateBook` (`src/server/services/books.ts`), que es el
helper canónico y acepta un `client` para usarse dentro de transacciones. Sus datos vienen de
Google Books y Open Library, que devuelven registros sucios con total normalidad: `pageCount`
en 0, descripciones de más de 8000 caracteres, ISBN concatenados, `coverUrl` vacía. Nada de
eso pasa `bookInputSchema`, y como las tres puertas de entrada de libros lo parsean, un
candidato sin sanear hacía lanzar la action y la usuaria solo veía el error genérico de
producción. Por eso `sanearCandidato` (`src/lib/google-books.ts`) limpia en el **borde**: no
relajes el schema, que sería aceptar basura dentro de la base para siempre.

Por la misma razón `searchBooks` distingue "sin resultados" de "la búsqueda falló"
(`BookSearchResult`, y `EstadoBusqueda` del lado de la UI). Colapsar los dos hacía que un 429
de Google Books —la cuota anónima se quema rápido sin `GOOGLE_BOOKS_API_KEY`— se le mostrara a
la usuaria como "ese libro no existe".

**Conversar** — `Comment` lleva `chapter`, `isSpoiler`, `isReflection` y `parentId`: las
cuatro columnas que consume `gateComment()`. `Message` es DM directo entre dos usuarias (sin
modelo de conversación: el hilo se deriva del par). `Block` y `Report` son moderación.

**Comunidad** — `Follow`, `Quote`/`QuoteLike`, `Rating`, `Meeting`/`Rsvp`,
`KahootActivity`/`KahootScore` (trivia). `Match` es el emparejamiento semanal por afinidad,
único por `[userAId, userBId, weekOf]`, donde `weekOf` es el lunes en `America/Lima`. Ojo:
`runBookMatch` escribe con `db.match.create` dentro de un loop que además manda el email —
sin transacción y sin upsert. Una segunda ejecución el mismo lunes **no** es idempotente:
revienta con violación de constraint después de haber mandado los emails de los pares que
alcanzó a crear. El histórico de `Match` sirve para otra cosa: evitar repetir pareja en las
últimas semanas.

**Invitaciones** — `UserNudge`, único por `[userId, key]`: una invitación se muestra una vez
por persona y nunca vuelve. `reason: 'pre-existing'` marca las filas del backfill.

## Base de datos

Producción corre **PostgreSQL 17** en el VPS (servicio `moon-postgres` de EasyPanel,
alcanzable solo por la red interna `easypanel-haiku`). La versión no es casual: la base
venía de Neon 17, y un dump de una mayor no restaura en una menor.

**No hay `prisma/migrations/`.** El schema se aplica con `prisma db push` corrido a mano por
un humano. Ni el CI ni el contenedor tocan la base: el `CMD` del Dockerfile arranca la app y
nada más. Si cambias el schema y nadie corre `db push` contra producción, el deploy queda
desincronizado y el código nuevo rompe en runtime contra columnas que no existen.

**Cómo se aplica un cambio contra producción** (probado con `Book.publisher`):

```bash
ssh haiku-vps   # está en ~/.ssh/config
docker exec haiku_moon-postgres.1.<sufijo> \
  psql -U postgres -d haiku -c 'ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "publisher" TEXT;'
```

Tres cosas que hay que saber antes de correr eso:

- **En ese VPS hay tres Postgres** (`haiku_moon-postgres`, `haiku_unw-postgres`,
  `n8n_postgres-haiku`). Apuntar al equivocado le rompe la base a otra app. El de este repo es
  el de imagen `postgres:17`; la base se llama `haiku` y el usuario es `postgres`.
- **No sirve correr `prisma db push` dentro del contenedor de la app.** El stage final del
  Dockerfile solo copia `.next/standalone` más `node_modules/.prisma` y `@prisma/client`: la
  CLI de Prisma es devDependency y no viaja, y `prisma/schema.prisma` tampoco está en la
  imagen. Para una columna opcional, el `ALTER` a mano es exactamente el SQL que generaría
  `db push`, con menos piezas.
- Los nombres van **entre comillas dobles**: los modelos no tienen `@@map` ni `@map`, así que
  la tabla es `"Book"` tal cual. Y usa `IF NOT EXISTS` para que reintentar sea inofensivo.

Verifica siempre antes y después con
`information_schema.columns`, y acordate del orden: schema aditivo primero, deploy del código
después.

Hay backup diario en el VPS (`/root/backup-moon-cl.sh`, 11:20 UTC, retiene 14 días en
`/root/backups/moon-cl/`). Descarta a propósito los dumps de menos de 1KB: un respaldo vacío
que se guarda como bueno es peor que no tener respaldo, porque te enteras el día que lo
necesitas.

Antes de cualquier cambio de schema lee `docs/MIGRATIONS.md`. Regla corta: escribe el cambio
como aditivo (columnas opcionales o con `@default`), aplícalo a producción **antes** de
deployar el código que lo usa, y parte cualquier cambio destructivo en dos deploys.

Ciclo local: editar `schema.prisma` → `npx prisma format` → `npx prisma validate` →
`npx prisma generate`.

`prisma/init.sql` es un dump del schema inicial que **no lo referencia nadie** y no se
mantiene. No es la migración base ni el estado actual de la BD: la fuente de verdad es
`schema.prisma`. No lo edites ni lo apliques.

## Despliegue

Ya **no es Vercel**. La app corre dockerizada en un VPS con EasyPanel (proyecto `haiku`,
junto a otras apps que no son de este repo).

```
git push main → GitHub Actions (gate: tsc + vitest) → imagen a GHCR → EasyPanel hace pull
```

El VPS **nunca buildea**: ya corre ~19 contenedores y un `next build` le competiría por la
RAM. `.github/workflows/docker.yml` corre el gate y solo entonces publica
`ghcr.io/stivenrosales/moon-cl` (tags `sha-<corto>` y `latest`) — el tag por SHA es lo que
permite volver atrás sin rebuildear.

Dos cosas del `Dockerfile` que parecen ruido y no lo son:

- **`apk add openssl` en los tres stages.** Sin él, `prisma generate` arma el motor para
  `openssl-1.1.x`, que ya no existe en el Alpine moderno. No falla en el build: falla en la
  primera query a Postgres, en producción.
- **`npm install -g npm@11`.** `node:20-alpine` trae npm 10, que resuelve distinto una
  peerDependency opcional de next-auth y hace fallar `npm ci` contra un lockfile
  perfectamente sincronizado. El mismo arreglo hace falta en el workflow, por la misma razón.

`HOSTNAME=0.0.0.0` tampoco es adorno: el standalone de Next escucha en localhost por defecto
y Traefik —el proxy de EasyPanel, que también resuelve el TLS— nunca lo alcanzaría.

`docker-compose.yml` es **solo para verificación local**. En producción Postgres es un
servicio aparte de EasyPanel, no un contenedor de ese archivo.

### Storage

Los avatares ya no viven en Vercel Blob sino detrás de `src/lib/storage/`, con un adaptador
S3-compatible que hoy apunta a Cloudflare R2 (bucket `moon-media`) y mañana puede apuntar a
MinIO cambiando las cinco variables `STORAGE_*`, sin tocar código de dominio.

El archivo **no pasa por el servidor**: el cliente pide una URL PUT firmada a `/api/avatar`
y sube directo. Es obligatorio, no una optimización — `bodySizeLimit` es 2mb y el avatar
admite 4MB. El `ContentLength` va dentro de la firma, así que el storage rechaza con 403
cualquier PUT que traiga más bytes de los declarados.

`keyPerteneceAUsuario()` (`src/lib/storage/avatar-key.ts`) es una regla de seguridad, no una
validación cosmética: las URLs de avatar son públicas y viajan en el HTML de cualquier
perfil, así que sin ella alguien podía guardarse la URL ajena y disparar el borrado del
archivo de otra persona. Se comprueba al guardar **y** al borrar.

Las portadas de libros ya viven en el bucket con el prefijo `covers/`
(`src/lib/storage/cover-key.ts`, endpoint `POST /api/cover`) y **no** llevan esa regla: una
portada no tiene dueño, es del catálogo, y su permiso es de rol — moderadora o admin, que se
verifica en el endpoint con `isModeratorOrAbove`.

La portada se optimiza **en el navegador** antes de subirla (`src/lib/image-optimizer.ts`:
canvas → WebP, 600px de ancho), no en el servidor: el VPS ya corre ~19 contenedores y no
tiene RAM de sobra, que es la misma razón por la que tampoco buildea ahí. Dos detalles que
parecen adorno y no lo son: `imageOrientation: "from-image"` en `createImageBitmap` (sin él
las fotos de celular salen acostadas, porque el canvas ignora la orientación EXIF), y que el
`size` que se manda a `/api/cover` sea el del archivo **ya optimizado** — va firmado como
`ContentLength` y el storage rechaza con 403 cualquier PUT que traiga más bytes.

### Lo que cruza al cliente

`aPersonaPublica()` (`src/lib/persona-publica.ts`) es la única forma de mandar datos de otra
socia a un componente cliente. Devuelve `id`, `nombre` e `iniciales` **ya resueltos en el
servidor**, nunca el correo: lo que viaja como prop de un `"use client"` queda embebido en el
payload RSC y lo lee cualquiera con el inspector. Es la misma doctrina de `gateComment()`.

`PersonaPublica` declara `email?: never`, y eso no es decorativo. Construir el objeto campo
por campo no alcanza: `{ ...u, ...aPersonaPublica(u) }` vuelve a colar el correo y TypeScript
lo deja pasar, porque a las propiedades que vienen de un spread no les aplica el chequeo de
propiedades de más. Se comprobó: con ese spread, `tsc` **y** el test de frontera daban los dos
en verde mientras `/club` publicaba el directorio de correos. Con `email?: never` el mismo
spread deja de compilar.

`src/lib/frontera-correo-cliente.test.ts` recorre el código fuente y falla si un componente
cliente declara un campo de correo en sus props. Cubre la mitad declarativa; la marca del tipo
cubre la estructural. Hacen falta las dos.

## Testing

Vitest con `environment: "node"` y alias `@ → src`. No hay Testing Library ni jsdom.

**Vitest no puede parsear JSX.** `tsconfig.json` usa `"jsx": "preserve"` (para el compilador
de Next, no para el transform de esbuild), así que importar un `.tsx` desde un test falla.
El patrón del repo es extraer la lógica del componente a un `.ts` puro y testear eso: a
`src/lib/` si la comparten varios componentes (`bottom-tab-bar.tsx` + `nav.tsx` →
`lib/bottom-tabs.ts`, `hero-card.tsx` → `lib/reading-progress-copy.ts`), o a un `.ts`
hermano en `src/components/` si es de un solo componente (`nudge-card.tsx` →
`components/nudge-card-copy.ts`). El JSX queda sin test y está bien.

Los tests de actions mockean Prisma por método con `vi.mock("@/lib/db", ...)`, más
`@/server/auth-helpers` y `next/cache`. Los tests de services se apoyan en la función pura
y casi nunca mockean. Los nombres de test van en español, describiendo la regla de negocio
("no deja votar tras el cierre aunque la ronda siga marcada OPEN").

## Convenciones

Todo el código está en **español**: nombres de dominio (`buildToday`, `resolverSegmentoActivo`,
`alguienAdelante`, `medianaClub`), comentarios, mensajes de error y tests. Los comentarios
explican **por qué**, no qué — y varios documentan bugs ya arreglados para que no vuelvan.
Mantén ese registro cuando toques esas zonas.

Los estados se modelan como **discriminated unions**, no como booleanos ni campos opcionales
sueltos: `TodayHero` es `"sin-libro" | "sin-empezar" | "leyendo"`, `GateDecision` es
`{ locked: false } | { locked: true; reason }`. Preserva la distinción `null` vs `0` —
"nunca marcó avance" y "marcó la página 0" son estados distintos y colapsarlos con `?? 0`
ya causó bugs de copy.

Cuando puedas, elige la forma que hace el error **imposible de escribir** en vez de la que lo
detecta después. `EstadoBusqueda` separa `"resultados"` de `"sin-resultados"` en vez de tener
un solo `"ok"` con `books.length`, justamente porque con la primera forma nadie puede volver a
anidar el aviso donde no se ve.

**Los diálogos con formulario se remontan al abrirse.** El estado no puede vivir en el
componente que maneja `open`, porque ese no se desmonta nunca: `useState(props.x)` lee las
props una sola vez y lo que la usuaria toca y cierra SIN guardar sobrevive para siempre. El
patrón está en `profile-edit-dialog.tsx` — un componente externo con `open` y un contador
`aperturas`, y el formulario real con `key={aperturas}`. Y no alcanza con confiar en que Radix
desmonte el contenido al cerrar: durante la animación de salida sigue montado, así que reabrir
en esa ventana reusa la instancia vieja. Este bug apareció en **seis** diálogos distintos; si
agregas uno nuevo, nace con el patrón.

`src/components/ui/` son primitivas genéricas al estilo shadcn (envoltorios de Radix +
`cva` + `cn`) y **no conocen el dominio**: no importes `@/lib/routes` ni tipos de Prisma ahí.
Todo lo que sabe qué es una ronda, un nudge o una estantería vive en `src/components/*.tsx`
plano. Fuera de Radix, la caja de UI es `framer-motion` (animación), `sonner` (toasts) y
`next-themes` (tema) — no agregues una cuarta librería para lo mismo.

`DESIGN.md` (tokens, escala tipográfica, elevación, anti-patterns) y `PRODUCT.md` (usuarias,
tono, anti-referencias) son vinculantes para cualquier cambio de UI. Resumen operativo:
móvil primero, touch targets ≥44px, dorado solo en highlights ceremoniales, sin gradient
text fuera de `gold-shimmer`, sin cards anidadas. La UI tutea siempre.
