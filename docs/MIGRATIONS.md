# Runbook de migraciones de base de datos

Este documento explica cómo está gestionado hoy el schema de Prisma en Moon Club, por qué eso es un riesgo a medida que el roadmap crece, y el procedimiento seguro para aplicar cada cambio de schema a producción.

## 1. Estado actual

- No existe la carpeta `prisma/migrations/`. El schema (`prisma/schema.prisma`) se ha aplicado a la base de datos históricamente con `prisma db push`, ejecutado a mano por un humano.
- El build de Vercel corre `prisma generate && next build` (ver `package.json`, script `build`, y `postinstall`: `prisma generate`). **Ese build NO aplica cambios de schema a la base de datos** — solo genera el cliente de Prisma a partir del `schema.prisma` que ya está en el repo. Si el schema cambió pero no se corrió `db push` (o, tras adoptar migraciones, `migrate deploy`) contra la base de producción, el deploy queda desincronizado: el código nuevo puede esperar columnas/índices que la base todavía no tiene.
- Consecuencia práctica: cada cambio de schema requiere hoy un paso manual fuera del pipeline de CI/CD, sin registro histórico versionado de qué se aplicó y cuándo, y sin forma de reproducir el estado de la base en un entorno nuevo (staging, onboarding de un dev) más que corriendo `db push` contra el schema actual.

## 2. Recomendación: adoptar `prisma migrate`

Migrar de `db push` a `prisma migrate` da historial versionado, reproducibilidad y la posibilidad de automatizar `migrate deploy` en el pipeline de build. El cambio se hace en dos pasos: (a) crear una migración baseline que represente el schema actual sin tocar la base (porque ya existe y ya tiene los datos), y (b) a partir de ahí, todo cambio de schema se expresa como una migración nueva.

### 2.1 Baseline del schema actual

La base de datos ya existe con datos reales, así que la primera migración no debe crearse con `prisma migrate dev` (que intentaría diffear contra una base vacía y podría proponer un plan destructivo). Se genera el SQL de baseline comparando "nada" contra el schema actual, y se marca como ya aplicada:

```bash
# 1. Generar la carpeta de la migración baseline con el SQL equivalente al schema actual
mkdir -p prisma/migrations/0_baseline
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_baseline/migration.sql

# 2. Marcar esa migración como ya aplicada en la base real (no ejecuta el SQL, solo registra el historial)
npx prisma migrate resolve --applied 0_baseline
```

Después de esto, `prisma migrate status` debería mostrar la base como sincronizada con el historial de migraciones, sin pendientes.

### 2.2 Automatizar `migrate deploy` en el build

Una vez existe el baseline, el script de build de Vercel pasa de:

```json
"build": "prisma generate && next build"
```

a:

```json
"build": "prisma generate && prisma migrate deploy && next build"
```

`prisma migrate deploy` aplica únicamente las migraciones pendientes registradas en `prisma/migrations/`, sin generar SQL nuevo ni pedir confirmación interactiva — es seguro para CI/CD. **Este cambio de `package.json` no está aplicado todavía**; queda documentado aquí como el paso siguiente recomendado, a decidir junto con el humano responsable del deploy.

### 2.3 Flujo de trabajo para cambios de schema futuros (una vez adoptado `migrate`)

```bash
# Editar prisma/schema.prisma, luego:
npx prisma migrate dev --name descripcion_del_cambio
```

Esto genera el SQL de la migración en `prisma/migrations/<timestamp>_descripcion_del_cambio/`, lo aplica al entorno de desarrollo local y regenera el cliente. La migración se commitea al repo. En producción, `migrate deploy` (manual o en el build, según 2.2) aplica esa misma migración ya generada — nunca se re-genera SQL en producción.

## 3. Procedimiento seguro para aplicar un cambio de schema a producción (mientras se siga usando `db push`)

Hasta que se adopte `prisma migrate` (sección 2), cada cambio de schema debe aplicarse a mano, coordinado con el deploy, siguiendo este orden — **schema aditivo primero, código después** — para evitar downtime o errores 500 por columnas/índices que el código espera y la base todavía no tiene (o viceversa, código viejo corriendo contra un schema ya cambiado de forma incompatible):

1. **Escribir el cambio de schema como aditivo siempre que sea posible**: agregar columnas nuevas como opcionales o con `@default(...)`, agregar tablas nuevas, agregar índices. Evitar en el mismo paso: renombrar columnas/tablas, cambiar un tipo de forma incompatible, o eliminar columnas que el código en producción todavía lee.
2. **Aplicar el schema a producción ANTES de deployar el código que lo usa**:
   ```bash
   DATABASE_URL="<url de produccion>" npx prisma db push
   ```
   Esto lo corre un humano, manualmente, apuntando explícitamente a la base de producción. Nunca se ejecuta desde el pipeline de build de Vercel.
3. **Verificar** con `npx prisma validate` (contra el schema) y una consulta rápida (o `npx prisma studio` puntual) que la columna/índice/tabla nueva existe en producción antes de continuar.
4. **Recién entonces deployar el código** (push a `main` / merge del PR) que depende del cambio de schema. Como el paso 2 fue aditivo, el código viejo (el que está corriendo mientras se propaga el deploy) sigue funcionando sin errores contra el schema ya actualizado.
5. **Si el cambio requiere un paso destructivo** (renombrar, eliminar, cambiar tipo de forma incompatible): partirlo en al menos dos despliegues:
   - Deploy A: agregar la columna/tabla nueva (aditivo) + código que escribe en ambas (vieja y nueva) o migra datos.
   - Deploy B (después de confirmar que Deploy A es estable y los datos migraron): eliminar la columna/tabla vieja del schema y del código.
6. **Backup antes de cualquier cambio con riesgo de pérdida de datos** (eliminar columna, cambiar tipo). Confirmar con el humano responsable de la base antes de correr `db push` en ese caso.

## 4. Cambios de schema pendientes en el roadmap (a planificar en orden)

Lista de cambios de schema conocidos, para secuenciarlos aplicando el procedimiento de la sección 3 (o, una vez adoptado `migrate`, generando una migración por cada uno o agrupando los compatibles). El orden sugerido prioriza cambios aditivos simples primero y deja para el final los que introducen modelos nuevos con más relaciones:

1. ~~`User.birthday` — columna opcional nueva, aditivo simple.~~ **Ya escrito en `schema.prisma`, ver sección 6 (Lote 2).**
2. ~~`User.favoriteGenres`, `User.ageConfirmedAt`, `User.onboardedAt` — columnas opcionales nuevas en `User`, aditivo simple.~~ **Ya escrito en `schema.prisma`, ver sección 6 (Lote 2).**
3. ~~`Book.categories` — columna nueva en `Book` (`String[]`, igual que `authors`), aditivo simple.~~ **Ya escrito en `schema.prisma`, ver sección 6 (Lote 2).**
4. ~~`ReadingProgress.chapter` — columna opcional nueva, aditivo simple.~~ **Ya escrito en `schema.prisma`, ver sección 6 (Lote 2).**
5. ~~`Meeting`: introducir `MeetingType` (enum) + `remindedAt`.~~ **Ya escrito en `schema.prisma`, ver sección 6 (Lote 2).**
6. `Quote` (modelo nuevo) — tabla nueva con relación a `Book`/`User`, aditivo (no afecta modelos existentes salvo agregar la relación inversa). **Pendiente, no incluido en Lote 2.**
7. `Follow` (modelo nuevo) — tabla nueva de relación `User`-`User` (follower/followed), aditivo. **Pendiente, no incluido en Lote 2.**
8. `Message` (modelo nuevo) — tabla nueva, aditivo. Evaluar si depende de `Follow` (mensajería entre usuarios que se siguen) para decidir si va antes o después del punto 7. **Pendiente, no incluido en Lote 2.**
9. ~~`UserBook` / estanterías — modelo nuevo.~~ **Ya escrito en `schema.prisma`, ver sección 6 (Lote 2).** Convive con `ReadingProgress`/`Rating` sin reemplazarlas; no migra datos existentes.
10. Modelos de **Kahoot** (quiz/trivia) — el de mayor superficie nueva (probablemente varios modelos: sesión, preguntas, respuestas, participantes). Ir al final del roadmap de schema porque es la funcionalidad más nueva y con más relaciones a definir; conviene que el resto del dominio esté estable antes de diseñarlo. **Pendiente, no incluido en Lote 2.**

Cada uno de estos cambios debe pasar por su propio ciclo: editar `schema.prisma` → `npx prisma format` → `npx prisma validate` → (una vez adoptado `migrate`) `prisma migrate dev --name <nombre>` → aplicar a producción siguiendo la sección 3 → deployar el código que lo consume.

## 5. Índices agregados en este cambio

Se agregaron dos índices a `prisma/schema.prisma`:

- `@@index([isCurrent])` en `Book` — la app consulta el libro actual del club filtrando por `isCurrent` sin índice.
- `@@index([status])` en `Round` — la app consulta rondas por `status` (por ejemplo, la ronda abierta) sin índice.

**Estos índices están declarados en el schema pero todavía NO están aplicados en la base de datos.** Como se documentó en la sección 1, ningún build de Vercel corre `db push` ni `migrate deploy`, así que se requiere que un humano los aplique manualmente a producción:

```bash
DATABASE_URL="<url de produccion>" npx prisma db push
```

Al ser una operación puramente aditiva (agregar índices no rompe lecturas/escrituras existentes), se puede aplicar sin necesidad de coordinar con un deploy de código específico — pero conviene aplicarla antes de que el volumen de datos en `Book`/`Round` crezca lo suficiente como para que crear el índice sea una operación pesada en producción.

## 6. Lote 2 — pendiente de aplicar a producción

Este lote agrupa todos los cambios de schema de las Fases F2/F3/F5/F6 del roadmap (ver puntos 1-5 y 9 de la sección 4), escritos en una sola pasada en `prisma/schema.prisma` y verificados localmente con `npx prisma format` + `npx prisma generate` (83 tests con mocks siguen en verde). **Ninguno de estos cambios está aplicado todavía en la base de datos real** — el código que los consume compilará y sus tests con mocks pasarán, pero las rutas que lean/escriban estos campos romperán en runtime contra producción hasta que un humano corra `db push` (o `migrate deploy`, si se adopta la sección 2) contra la base real.

Orden sugerido de aplicación (todo es aditivo — columnas opcionales o con `@default(...)`, un modelo nuevo, dos enums nuevos; no hay renombres, cambios de tipo incompatibles ni eliminaciones, así que se puede aplicar en un solo `db push` sin downtime, siguiendo igualmente el procedimiento de la sección 3: schema en producción ANTES que el código que lo usa):

1. `User.birthday DateTime? @db.Date` — columna opcional nueva.
2. `User.favoriteGenres String[] @default([])`, `User.ageConfirmedAt DateTime?`, `User.onboardedAt DateTime?` — columnas opcionales/con default nuevas en `User`.
3. `Book.categories String[] @default([])` — columna con default nueva en `Book`.
4. `ReadingProgress.chapter Int?` — columna opcional nueva (prerrequisito del foro de F6).
5. `enum MeetingType { REUNION, CINE, POESIA, OTRO }` + `Meeting.type MeetingType @default(REUNION)` + `Meeting.remindedAt DateTime?` — enum nuevo con default sensato (`REUNION`, el tipo histórico implícito de todas las reuniones existentes) y columna opcional.
6. `enum ShelfStatus { READING, WANT_TO_READ, FINISHED }` + `model UserBook` (estanterías: `userId`, `bookId`, `status`, `currentPage?`, `currentChapter?`, `startedAt?`, `finishedAt?`, `@@unique([userId, bookId])`, `@@index([userId, status])`, relaciones `onDelete: Cascade` hacia `User` y `Book`) — tabla nueva, no reemplaza `ReadingProgress`/`Rating` ni migra datos de ellas.

Aplicación:

```bash
DATABASE_URL="<url de produccion>" npx prisma db push
```

Verificar después con `npx prisma validate` (contra el schema) y una consulta puntual (o `prisma studio`) de que `UserBook`, los enums `MeetingType`/`ShelfStatus` y las columnas nuevas existen en producción, antes de deployar el código que dependa de ellas (según el orden de la sección 3).
