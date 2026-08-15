# Ciudad y país de la usuaria

Fecha: 2026-08-14
Estado: aprobado, pendiente de implementar

## Problema

El perfil de una socia no dice de dónde es. Queremos tres cosas, en este orden:

1. Mostrar ciudad y país en el perfil (propio y ajeno).
2. Que las socias se encuentren por cercanía: filtrar el directorio de `/club` por ciudad.
3. Métrica de admin: cuántas socias hay por país.

Y una cuarta, **explícitamente fuera de alcance**: un mapa del club estilo Skool. No se
implementa ahora, pero el modelo de datos no debe cerrarle la puerta.

## Decisiones tomadas

| Decisión | Elección |
| --- | --- |
| Visibilidad | Ciudad y país visibles para cualquier socia logueada. Sin opt-in. |
| Captura | **Obligatoria** en el onboarding (paso 3 nuevo). Editable después en el perfil. |
| Modelado | País cerrado (ISO 3166-1 alpha-2) + ciudad texto libre + slug derivado. |
| Dependencias | **Ninguna nueva.** `Intl.DisplayNames` para traducir, `<Select>` nativo ya existente. |

### Por qué no texto libre para el país

Con dos inputs libres la base termina con `Lima`, `lima`, `LIMA` y `Lima, Perú`
conviviendo. El filtro de cercanía muestra cuatro Limas distintas, la métrica de admin es
basura y el mapa futuro no se puede geocodificar sin limpiar a mano.

### Por qué no una tabla `Ciudad` con relación

Es la solución correcta para el problema que todavía no tenemos. Cuesta un modelo nuevo,
una relación, un `ALTER` más delicado contra producción y una UI de autocompletado, para
un dato que hoy solo se muestra y se filtra. El slug da el 90% del valor por el 20% del
trabajo, y el día del mapa se geocodifican los pares únicos `(citySlug, countryCode)` —
que serán ~15, no 300.

---

## 1. Modelo de datos

### Schema

Tres columnas nuevas en `model User` (`prisma/schema.prisma:14-57`), junto a `bio` y
`birthday`:

```prisma
countryCode String?  // ISO 3166-1 alpha-2 en mayúsculas: "PE"
city        String?  // como la escribió ella, con tildes: "Lima"
citySlug    String?  // derivada de city, para agrupar y filtrar: "lima"
```

**Sin índice.** Se evaluó `@@index([countryCode, citySlug])` y se descartó: el filtro del
directorio es client-side sobre filas ya cargadas (ver sección 3), el conteo de admin es un
`reduce` en memoria, y con decenas de socias Postgres prefiere el scan secuencial de todos
modos. Es peso muerto hasta que la tabla tenga miles de filas.

**Nombres en inglés a propósito.** Todos los campos escalares de `User` lo están (`bio`,
`birthday`, `favoriteGenres`, `isMatchOptIn`). La convención de español del repo aplica a
la lógica de dominio (`slugCiudad`, `NOMBRES_PAISES`, `PAISES`), igual que hoy conviven
`favoriteGenres` y la constante `GENEROS`.

### Los tres campos son opcionales en la base, y no es negociable

Aunque la ubicación sea **obligatoria en el onboarding**, las columnas son `String?`.

Las socias actuales ya tienen `onboardedAt` y jamás volverán a ver ese formulario. Una
columna `NOT NULL` hace fallar el `ALTER` en el acto: Postgres no puede inventar un valor
para las filas existentes. La obligatoriedad vive en Zod, en la capa de aplicación. En la
base, nunca.

### La invariante

Los tres campos no son independientes. `city` sin `citySlug` rompe el filtro en silencio,
y una ciudad sin país no se puede agrupar. Se escriben juntos o no se escribe ninguno —
la misma doctrina de `ReadingProgress` + `UserBook` en `updateProgress`.

Se modela como unión discriminada, no como tres opcionales sueltos:

```ts
// src/lib/ubicacion.ts
export type Ubicacion =
  | { tipo: "sin-ubicacion" }
  | { tipo: "solo-pais"; countryCode: string }
  | { tipo: "completa"; countryCode: string; city: string; citySlug: string };
```

Con esta forma "ciudad sin país" es **imposible de escribir**, no algo que se detecta
después. Es la misma razón por la que `EstadoBusqueda` separa `"resultados"` de
`"sin-resultados"`.

Se preserva `null` vs `""`: `null` significa "nunca lo dijo". Nunca guardar cadena vacía.

### Funciones puras — `src/lib/ubicacion.ts`

Sin Postgres, sin mocks. Es donde vive toda la lógica y donde va el grueso de los tests.

```ts
slugCiudad(entrada: string | null | undefined): string | null
```

Normaliza: `trim` → minúsculas → `NFD` y quita diacríticos → colapsa separadores en un
solo guion → descarta lo que no sea `[a-z0-9-]` → recorta guiones de los extremos.
Devuelve `null` si no queda nada.

| Entrada | Salida |
| --- | --- |
| `"  Bogotá "` | `"bogota"` |
| `"San Isidro"` | `"san-isidro"` |
| `"CUSCO"` | `"cusco"` |
| `"   "` | `null` |
| `""` / `null` / `undefined` | `null` |

```ts
construirUbicacion(input: { countryCode?, city? }): Ubicacion
camposUbicacion(u: Ubicacion): { countryCode: string | null; city: string | null; citySlug: string | null }
```

`camposUbicacion` es la **única** forma de producir el objeto que va al `db.user.update`.
Nadie arma esos tres campos a mano en ningún lado del código.

### Catálogo de países — `src/lib/paises.ts`

**La lista de códigos es una constante curada; `Intl.DisplayNames` solo traduce.**

Se verificó que derivar la lista en runtime iterando `AA`–`ZZ` contra `Intl.DisplayNames`
devuelve 280 entradas, e incluye `Unión Europea`, `zona del euro`, `Naciones Unidas`,
`Territorios alejados de Oceanía`, `Región desconocida`, `Pseudoacentos` y `Pseudobidi`.
Nadie vive en Pseudoacentos. Ese enfoque queda descartado: la lista es un dato de negocio
que se cura, la traducción es infraestructura que se delega.

```ts
export const CODIGOS_PAIS = ["AD", "AE", ..., "PE", ..., "ZW"] as const;  // ISO 3166-1, países reales
export type CodigoPais = (typeof CODIGOS_PAIS)[number];

export function nombrePais(codigo: string): string | null;   // "PE" -> "Perú"
export function esCodigoPais(v: unknown): v is CodigoPais;
export function paisesOrdenados(): { codigo: CodigoPais; nombre: string }[];
```

`paisesOrdenados()` devuelve **Perú primero** y el resto alfabético por nombre en español
(`localeCompare` con locale `es`). El club es peruano: pedirle a la usuaria que baje hasta
la P para el caso del 90% es fricción gratis.

`Intl.DisplayNames` con locale `es` está **verificado en `node:20-alpine`**, la imagen de
producción: devuelve `Perú` y `Argentina` correctamente. La imagen trae ICU completo.

### Migración contra producción

Aditiva, siguiendo `docs/MIGRATIONS.md`: **schema primero, deploy del código después**.

```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "city"        TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "citySlug"    TEXT;
```

- Contra el servicio `haiku_moon-postgres`, base `haiku`, usuario `postgres`. En ese VPS
  hay **tres** Postgres: apuntar al equivocado le rompe la base a otra app.
- Nombres entre comillas dobles: no hay `@@map` ni `@map`, la tabla es `"User"` tal cual.
- Todo con `IF NOT EXISTS`: reintentar es inofensivo.
- Verificar antes y después con `information_schema.columns`.

---

## 2. Escritura

### Validadores — `src/lib/validators.ts`

Un schema compartido, reutilizado por los dos puntos de entrada:

```ts
export const ubicacionSchema = z.object({
  countryCode: z.enum(CODIGOS_PAIS, { message: "Elige tu país" }),
  city: z.string().trim().min(2, "Escribe tu ciudad").max(80),
});
```

- `onboardingSchema` lo incorpora como **obligatorio** (la ubicación es requisito para
  completar el onboarding).
- `profileUpdateSchema` lo incorpora como **opcional y nullable**, igual que `bio` y
  `birthday`: desde el perfil se puede borrar la ubicación.

El `enum` sobre `CODIGOS_PAIS` hace que un país inventado sea rechazado en el borde. Misma
doctrina que `sanearCandidato`: no relajar el schema, limpiar en la frontera.

### Actions — `src/server/actions/profile.ts`

- `completeOnboarding`: pasa a escribir también `countryCode`, `city`, `citySlug`, usando
  `camposUbicacion()`. Nunca los tres campos a mano.
- `updateProfile`: idem, con la ubicación opcional. Borrarla escribe `null` en los tres.

Ambas mantienen el contrato de siempre: `requireUser()` → `schema.parse(input)` →
escritura → `revalidatePath(routes.x())`. `updateProfile` debe revalidar además
`routes.club()`, porque el directorio ahora muestra la ciudad.

### Onboarding — paso 3

`src/app/onboarding/onboarding-form.tsx` pasa de `step: 1 | 2` a `step: 1 | 2 | 3`.

- Paso 3: `<Select>` de países + `<Input>` de ciudad.
- `src/components/ui/select.tsx` **no es Radix**: es un `<select>` **nativo** envuelto y
  estilizado, con chevron propio para que iOS no meta el suyo. Se reusa tal cual, con
  `<option>` planos. No se instala ningún combobox: el repo no tiene `cmdk` ni Radix
  `Popover`, y `CLAUDE.md` cierra la caja de UI a Radix + framer-motion + sonner +
  next-themes.
- Con ~250 `<option>`, el `<select>` nativo es además la mejor opción en móvil: iOS y
  Android abren su propio picker con búsqueda, que es mejor que cualquier combobox propio.
- **Obligatorio**: sin país y ciudad válidos, el botón de terminar queda deshabilitado.
  No hay "saltar este paso" acá, a diferencia del paso 2 de géneros.
- El paso 2 conserva su "puedes saltar este paso".

### Editar perfil

`src/components/profile-edit-dialog.tsx` suma los dos campos, entre bio y géneros.

Ya usa el patrón de remontaje (`ProfileEditDialog` con contador `aperturas`,
`ProfileEditForm` con `key={aperturas}`), así que los campos nuevos lo heredan gratis. No
introducir estado de ubicación en el componente que maneja `open`.

### El hueco: las socias que ya pasaron el onboarding

Son la mayoría, y nunca verán el paso 3. Sin resolverlo, el directorio nace medio vacío
para siempre.

Solución: **un nudge**, con la maquinaria que el repo ya tiene. `UserNudge` es único por
`[userId, key]`, así que la invitación se muestra una vez por persona y nunca vuelve, y
`nextNudge` devuelve una sola invitación para toda la app — no hay riesgo de spam.

Nueva key `"ubicacion"` en `NUDGE_KEYS`, con su check en `NUDGE_CHECKS`
(`src/server/services/nudge-queue.ts`). La lógica va en la función pura `buildNudgeQueue`,
nunca en el loader `nextNudge`.

```ts
function checkUbicacion(input: NudgeQueueInput): boolean {
  return input.onboardedAt != null && input.countryCode == null;
}
```

`NudgeQueueInput` suma `countryCode: string | null`, que `nextNudge` ya puede traer sin
query extra: agregarlo al `select` del `client.user.findUnique` existente.

#### Este nudge NO usa `afterEpoch`, y es a propósito

Es la única excepción de la cola, y hay que entender por qué antes de tocarla.

`NUDGE_EPOCH` (2026-07-16) existe porque los demás disparadores son **estados acumulados**
("3 calificaciones", "2 seguidas"): una veterana los cumple desde hace meses y sin el epoch
le explotarían todos en la cara el día del deploy. Por eso cada uno se ancla a la fecha real
en que su disparador se volvió cierto y exige que sea posterior al epoch.

Acá pasa lo contrario. Si se anclara a `onboardedAt` —el único ancla disponible—
`afterEpoch(onboardedAt)` daría **`false` para toda veterana**, que es exactamente a quien
queremos invitar. El nudge no se mostraría jamás y el hueco quedaría sin resolver.

La razón de fondo: este disparador no es un logro que la usuaria alcanzó en el pasado, es
**un dato que acabamos de inventar**. Su fecha de "se volvió cierto" es la del deploy, igual
para todas. No hay veterana injustamente molestada porque no hay nada que la usuaria haya
hecho antes; le falta un campo que hasta ayer no existía.

Las garantías que hacen esto seguro:

- `UserNudge` es único por `[userId, key]` y `dismissNudge` escribe `dismissedAt`: se
  muestra **una vez por persona y nunca vuelve**.
- `nextNudge` devuelve **una sola** invitación para toda la app: no hay riesgo de avalancha.
- **Se auto-apaga**: en cuanto la usuaria guarda su país, el check da `false` solo. Es más
  sano que `primer-rating` y `primer-mensaje`, que según los comentarios del propio
  `nudge-queue.ts` reaparecen porque su disparador no se apaga con la acción.
- Las socias nuevas nunca lo ven: llenan la ubicación en el paso 3 del onboarding.

Dejar un comentario en el código explicando esta excepción, en el estilo del archivo.

#### Posición, pantalla y copy

- **Primero en `NUDGE_CHECKS`**, antes de `bienvenida`. No compite con la escalera de
  arranque: una recién llegada siempre tiene `countryCode` (el onboarding se lo exigió), así
  que para ella este check es `false` y la escalera sigue igual que hoy.
- `NUDGE_SCREENS.ubicacion = "hoy"`: se pinta en la portada, que es donde entran.
- `inline: false` (solo `"sugerir"` es inline).
- Copy nuevo en `src/components/nudge-card-copy.ts`, con `resolveNudgeAction` devolviendo
  `{ tipo: "navigate" }` hacia `routes.perfil()`.
- **No** tocar `prisma/backfill-nudges.ts`: ese script existe para *apagar* nudges de gente
  preexistente, que es lo contrario de lo que se busca acá.

---

## 3. Lectura

### Perfil propio — `src/app/(app)/perfil/page.tsx`

Sumar `countryCode`, `city` al `select` explícito (líneas 36-47) y pintar la ubicación en
la sección que hoy agrupa bio y cumpleaños (líneas 176-191), cuya condición pasa a
contemplar el caso nuevo.

Formato visible: `Lima, Perú` — se muestra `city` tal como la escribió ella (con tildes),
nunca el slug. El slug es interno.

### Perfil ajeno — `src/app/(app)/club/persona/[id]/page.tsx`

Misma línea, junto a la bio (líneas 171-176).

Ojo: esa página hace `findUnique` **sin `select`**, o sea trae la fila entera incluido el
correo. Hoy no hay leak porque el Server Component arma el JSX a mano, pero al tocarla
conviene acotar el `select` a lo que realmente se pinta. Es la doctrina de
`aPersonaPublica()` aplicada donde todavía no llegó.

### Directorio — `/club?vista=personas`

`PersonaPublica` (`src/lib/persona-publica.ts`) suma dos campos:

```ts
export interface PersonaPublica {
  id: string;
  nombre: string | null;
  iniciales: string;
  image: string | null;
  ciudad: string | null;   // "Lima", ya formateada en el servidor
  pais: string | null;     // "Perú", ya traducida en el servidor
  email?: never;
}
```

**Construidos campo por campo dentro de `aPersonaPublica()`, jamás con spread.** Un
`{ ...u, ...aPersonaPublica(u) }` vuelve a colar el correo y TypeScript lo deja pasar; ya
pasó, y por eso existe `email?: never`. El nombre del país se traduce en el servidor: al
cliente viaja `"Perú"`, no `"PE"`.

`src/components/member-list.tsx` muestra la ciudad en la `contextLine()` existente
(líneas 112-120), sin agregar una línea nueva a la fila.

### Filtro por ciudad — client-side, siguiendo el patrón que ya existe

**No** se agrega un searchParam ni se toca `routes.ts`.

`/club` hoy lee un solo searchParam (`vista`) y su único filtro es el **buscador por nombre
client-side** dentro de `MemberList` (`src/components/member-list.tsx:34-47`), con un
comentario que explica la decisión: el volumen es de decenas de filas y no justifica una
query server-side. El filtro de ciudad sigue ese mismo camino.

- Un `<Select>` de ciudades junto al buscador de nombre, dentro de `MemberList`.
- Las opciones salen de las propias `rows` ya cargadas (`citySlug` únicos, etiquetados con
  el `ciudad` legible), no de un catálogo fijo ni de un `groupBy`. Si nadie declaró ciudad,
  el selector no se pinta.
- El filtro compone con el buscador de nombre: ambos se aplican sobre `rows`.
- Cero cambios en `routes.ts`, cuyos builders hoy manejan un solo query param cada uno y no
  tienen precedente de combinar dos.

Esto también evita el problema de `revalidatePath`: un path con query no invalida el path
base, así que un filtro por URL habría exigido cuidado extra en las actions. Sin searchParam,
el problema no existe.

### Admin

Conteo de socias por país en la sección `#miembros` de `src/app/(app)/admin/page.tsx`.

Se calcula con un `reduce` en memoria sobre el array `users` que esa página **ya carga**
(`db.user.findMany`), sin query adicional — el mismo patrón inline que usa `hayRondaAbierta`.
No hay service de estadísticas en el repo y no se crea uno para esto.

Los nombres se traducen con `nombrePais()`. Las socias sin ubicación se cuentan aparte como
"sin especificar": es el dato que dice cuánto falta por llenar.

---

## 4. Testing

Vitest, `environment: "node"`, sin JSX. Nombres en español describiendo la regla de
negocio. **TDD estricto: el test primero.**

| Archivo | Qué cubre |
| --- | --- |
| `src/lib/ubicacion.test.ts` | `slugCiudad` (tildes, mayúsculas, espacios, vacío → `null`), `construirUbicacion` (los tres estados de la unión), `camposUbicacion` (la invariante: nunca `city` sin `citySlug`) |
| `src/lib/paises.test.ts` | `nombrePais("PE") === "Perú"`, código inválido → `null`, `paisesOrdenados()` arranca con Perú, y que la lista **no** contiene `EU`/`UN`/`ZZ`/`XA`/`XB`/`EZ`/`QO` |
| `src/lib/validators.test.ts` | Casos nuevos en `onboardingSchema` (ubicación obligatoria) y `profileUpdateSchema` (opcional, nullable, país inválido rechazado) |
| `src/server/actions/profile.test.ts` | `updateProfile` y `completeOnboarding` escriben los tres campos juntos; borrar la ubicación escribe `null` en los tres. Mockear `@/lib/db`, `@/server/auth-helpers`, `next/cache` como ya hace el archivo |
| `src/server/services/nudge-queue.test.ts` | El nudge `"ubicacion"` **sí** aparece para una veterana con `onboardedAt` muy anterior a `NUDGE_EPOCH` y sin `countryCode` (es la excepción al epoch: el test la fija para que nadie la "arregle" después); no aparece si ya tiene país; desaparece al llenarlo; y una recién llegada con país sigue viendo `bienvenida` — la escalera existente no cambia |

No se testea JSX. La lógica de los componentes que la necesite se extrae a un `.ts` puro,
como `nudge-card-copy.ts`.

## 5. Fuera de alcance

- **Mapa del club.** Fase posterior. Se habilita geocodificando los pares únicos
  `(citySlug, countryCode)`.
- **Ciudad como señal de matching.** `computeAffinity` (`src/server/services/affinity.ts`)
  no se toca. Sus pesos hoy son libros en común (50%), géneros (30%) y calificaciones
  (20%); meter geografía reduciría mucho los pares posibles en un club chico.
- **Normalizar `Cusco` vs `Cuzco`.** Dos slugs distintos para el sistema. Con este tamaño
  de club se corrige mirando `/admin`, no con un catálogo.
- **Provincia o distrito.** Solo ciudad y país.

## 6. Orden de ejecución

1. Aplicar el `ALTER` contra producción (aditivo, seguro con el código viejo corriendo).
2. `schema.prisma` + `npx prisma format` + `validate` + `generate`.
3. `src/lib/ubicacion.ts` y `src/lib/paises.ts`, con sus tests primero.
4. Validadores y actions.
5. Onboarding paso 3 y diálogo de perfil.
6. Lectura: perfil propio, perfil ajeno, `PersonaPublica`, directorio, filtro, admin.
7. Nudge para las veteranas.
8. Gate: `npx tsc --noEmit` y `npm test`. `npm run lint` está roto, no ejecutarlo.
