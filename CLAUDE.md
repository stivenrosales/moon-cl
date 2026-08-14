# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```bash
npm run dev            # servidor de desarrollo
npm test               # vitest run (620 tests / 47 archivos, ~3s)
npm run test:watch     # vitest en watch
npx tsc --noEmit       # chequeo de tipos — el gate real de este repo
npm run build          # prisma generate && next build — NO toca la base
npm run db:push        # aplica schema.prisma a la BD (ver "Base de datos")
npm run db:studio      # explorar la BD
npm run db:seed        # tsx prisma/seed.ts
npm run db:backfill-nudges  # siembra UserNudge de usuarias previas a NUDGE_EPOCH
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
`/rondas`, `/reuniones`, `/biblioteca`). No lo uses como mapa del código; sí sigue siendo
válido para stack, setup y despliegue.

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

Vercel Hobby permite 2 crons con 1 ejecución/día, así que **todos** los jobs cuelgan de un
dispatcher único: `src/app/api/cron/daily/route.ts` (autenticado con `Bearer $CRON_SECRET`).
Agregar un job es agregar una entrada al array `jobs` e implementarlo en
`src/server/jobs/`. Los jobs que no son diarios se auto-descartan por fecha dentro de su
propia función (`runBookMatch` sale si no es lunes en `America/Lima`).

Las fechas de negocio se calculan en `America/Lima`, no en UTC — rachas, cumpleaños y
recordatorios se rompen cerca de medianoche si usas UTC.

## Mapa del dominio

`prisma/schema.prisma` tiene ~22 modelos. Los agrupamientos que no se deducen leyendo un
solo archivo:

**Elegir libro** — `Round` (`SCHEDULED | OPEN | CLOSED`) → `BookSuggestion` (única por
`[roundId, bookId]`) → `Vote` (único por `[suggestionId, userId]`). El ganador se congela en
`Round.winnerBookId`, que es `@unique`: un libro gana una ronda y solo una. `RoundStatus` es
un campo, no una verdad: una ronda vencida sigue marcada `OPEN` hasta que el cron la cierre,
así que las reglas comparan contra `endsAt`, nunca contra el status solo.

**Leer** — `Book` es el catálogo compartido; `UserBook` es la estantería de cada quien
(`ShelfStatus`); `ReadingProgress` es la bitácora append-only. Los tres se tocan juntos, ver
"Escrituras: una sola puerta por concepto".

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

**No hay `prisma/migrations/`.** El schema se aplica con `prisma db push` corrido a mano por
un humano. El build de Vercel (`prisma generate && next build`) **no toca la base**: si
cambias el schema y nadie corre `db push` contra producción, el deploy queda desincronizado
y el código nuevo rompe en runtime contra columnas que no existen.

Antes de cualquier cambio de schema lee `docs/MIGRATIONS.md`. Regla corta: escribe el cambio
como aditivo (columnas opcionales o con `@default`), aplícalo a producción **antes** de
deployar el código que lo usa, y parte cualquier cambio destructivo en dos deploys.

Ciclo local: editar `schema.prisma` → `npx prisma format` → `npx prisma validate` →
`npx prisma generate`.

`prisma/init.sql` es un dump del schema inicial que **no lo referencia nadie** y no se
mantiene. No es la migración base ni el estado actual de la BD: la fuente de verdad es
`schema.prisma`. No lo edites ni lo apliques.

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

`src/components/ui/` son primitivas genéricas al estilo shadcn (envoltorios de Radix +
`cva` + `cn`) y **no conocen el dominio**: no importes `@/lib/routes` ni tipos de Prisma ahí.
Todo lo que sabe qué es una ronda, un nudge o una estantería vive en `src/components/*.tsx`
plano. Fuera de Radix, la caja de UI es `framer-motion` (animación), `sonner` (toasts) y
`next-themes` (tema) — no agregues una cuarta librería para lo mismo.

`DESIGN.md` (tokens, escala tipográfica, elevación, anti-patterns) y `PRODUCT.md` (usuarias,
tono, anti-referencias) son vinculantes para cualquier cambio de UI. Resumen operativo:
móvil primero, touch targets ≥44px, dorado solo en highlights ceremoniales, sin gradient
text fuera de `gold-shimmer`, sin cards anidadas. La UI tutea siempre.
