# 🌙 Moon · Club de Lectura

Aplicación premium para gestionar el club de lectura **Moon**: qué toca leer hoy, avance
compartido, foro por salas sin spoilers, votaciones, reuniones con RSVP, mensajería entre
miembras y trivia del club.

## ✨ Funcionalidades

La app se organiza en **cinco destinos**, uno por trabajo que la usuaria viene a hacer.

**Hoy** — la pantalla de entrada. Card héroe con el libro que estás leyendo (o el del club)
y su avance en un toque, racha de días leídos, aviso de quién va más adelante y cuántos
comentarios nuevos hay en tus salas abiertas. Debajo, una fila de urgencia con lo que tiene
fecha límite (ronda por cerrar, próxima reunión) y, si no hay nada urgente, una recomendación
de tu lista de pendientes.

**Leer** — tu biblioteca y la del club. Estanterías personales (leyendo / quiero leer /
terminado), marca de página y capítulo, valoraciones de 1–5 estrellas con reseña, citas
compartidas y la ficha completa de cada libro.

**Club** — la vida social. Feed de actividad, directorio de personas con seguimiento,
muro de frases, mensajería directa y perfiles públicos.

**Agenda** — todo lo que tiene fecha. Reuniones (presenciales o virtuales) con RSVP y
descarga `.ics`, rondas de votación con sugerencias autocompletadas desde Google Books, y
el ranking de trivia (Kahoot).

**Perfil** — tu cuenta, avatar, géneros favoritos e historial.

Transversal a todo:

- **Auth sin contraseñas** — magic link por email (Resend o SMTP).
- **Onboarding en 2 pasos** — nombre, confirmación de 18+ y géneros favoritos.
- **Foro por salas sin spoilers** — los comentarios se abren por capítulo: si alguien
  comenta el capítulo 12 y tú vas por el 5, ese contenido **no viaja al navegador**. Hay
  además una sala de reflexión que solo se abre al terminar el libro.
- **Invitaciones contextuales (nudges)** — una sola a la vez, descartable, que acompaña el
  primer avance, la primera valoración, el primer mensaje.
- **Book Match semanal** — empareja lectoras por afinidad los lunes (opt-in).
- **Moderación** — reportes por categoría, bloqueo entre usuarias, panel de admin.
- **Roles** — admin / moderador / miembro. Admins iniciales por env var.
- **Modo claro y oscuro** — "editorial cósmico": lavanda + crema pergamino + dorado deslucido.

## 🧱 Stack

- **Next.js 15** (App Router) + React 18 + TypeScript
- **NextAuth v5 (Auth.js)** con provider Resend / Nodemailer, sesión con estrategia *database*
- **PostgreSQL** (recomendado: [Neon](https://neon.tech)) + **Prisma ORM**
- **Tailwind CSS** + primitivos propios sobre Radix UI
- **SWR** para el polling del hilo de mensajes · **Vercel Blob** para avatares · **ics** para calendario
- **Vitest** para tests (620 tests, entorno node)
- **Fuentes**: Fraunces (display) · Karla (sans) · Caveat (hand-script) — vía `next/font`
- **Sonner** para notificaciones, **Framer Motion** para microinteracciones

## 🚀 Puesta en marcha

### 1. Instala dependencias

```bash
npm install
```

### 2. Configura variables de entorno

Copia `.env.example` a `.env` y completa al menos:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/dbname?sslmode=require"
AUTH_SECRET="..."          # genera con: openssl rand -base64 32
AUTH_URL="http://localhost:3000"
AUTH_RESEND_KEY="re_..."   # crea en https://resend.com (opcional en dev)
EMAIL_FROM="Moon Club <noreply@tudominio.com>"
ADMIN_EMAILS="tu@email.com,otroadmin@email.com"
```

Opcionales, según la funcionalidad que necesites:

| Variable | Para qué | Sin ella |
|---|---|---|
| `GOOGLE_BOOKS_API_KEY` | autocompletado de libros | funciona, con rate limit |
| `CRON_SECRET` | autentica `/api/cron/daily` | el endpoint responde 500 |
| `BLOB_READ_WRITE_TOKEN` | subida de avatares a Vercel Blob | el upload falla |

> `CRON_SECRET` y `BLOB_READ_WRITE_TOKEN` **no están todavía en `.env.example`** — agrégalas
> a mano si vas a tocar cron o avatares. Vercel inyecta `BLOB_READ_WRITE_TOKEN` solo, al
> crear el store.

> En desarrollo, si no configuras `AUTH_RESEND_KEY` ni SMTP, los magic links se imprimen en
> la consola del servidor.

### 3. Crea las tablas en la base de datos

```bash
npx prisma db push
```

### 4. Levanta el servidor

```bash
npm run dev
```

Abre <http://localhost:3000>.

### 5. Conviértete en admin

Asegúrate de que tu email esté en `ADMIN_EMAILS` **antes** de iniciar sesión por primera vez.
Al crear tu cuenta, se promoverá automáticamente a `ADMIN`.

## 📂 Estructura

```
src/
├── app/
│   ├── (app)/                    # Rutas protegidas (requieren auth + onboarding)
│   │   ├── hoy/                  # Héroe + fila de urgencia + nudge
│   │   ├── leer/                 # ?vista=mios|club · libro/[id]
│   │   ├── club/                 # ?vista=actividad|personas|frases
│   │   │   ├── mensajes/         # bandeja · [userId] = hilo
│   │   │   └── persona/[id]/     # perfil público
│   │   ├── agenda/               # ?vista=reuniones|votaciones|trivia
│   │   │   ├── reunion/[id]/
│   │   │   └── ronda/[id]/
│   │   ├── perfil/ · admin/
│   │   └── layout.tsx            # guard de sesión + onboarding, nav, tab bar
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   ├── avatar/               # upload a Vercel Blob
│   │   ├── cron/daily/           # dispatcher único de todos los jobs
│   │   ├── mensajes/[userId]/    # polling SWR del hilo
│   │   └── reuniones/[id]/ics/   # descarga de calendario
│   ├── login/ · onboarding/      # fuera de (app): evitan loop de redirect
│   ├── page.tsx                  # landing pública
│   └── layout.tsx · globals.css
├── components/
│   ├── ui/                       # primitivos (button, card, dialog, select…)
│   ├── admin/                    # formularios del panel
│   └── …                         # composiciones (hero-card, nudge-card, …)
├── lib/                          # puro y compartible
│   ├── routes.ts                 # fuente única de rutas — no escribas paths literales
│   ├── legacy-redirects.ts       # redirects 307 de las rutas viejas
│   ├── validators.ts             # esquemas Zod
│   ├── auth.ts · session.ts · db.ts · permissions.ts · utils.ts
│   └── …                         # lógica extraída de componentes, para testearla
└── server/
    ├── actions/                  # "use server" — única puerta de escritura
    ├── services/                 # lecturas + reglas (patrón función pura + loader)
    ├── jobs/                     # tareas del cron diario
    └── auth-helpers.ts           # requireUser / requireAdmin / requireModerator
```

Las rutas se reestructuraron de 8 pestañas a estos 5 destinos. **Las URLs viejas siguen
funcionando** como redirects 307 declarados en `src/lib/legacy-redirects.ts`.

## 🧪 Scripts

```bash
npm run dev              # servidor de desarrollo
npm test                 # vitest run — 620 tests en ~3s
npm run test:watch       # vitest en watch
npx tsc --noEmit         # chequeo de tipos
npm run build            # build de producción (prisma generate + next build)
npm run start            # servidor de producción
npm run db:push          # aplica el schema a la BD (sin migraciones)
npm run db:studio        # explora la BD en el navegador
npm run db:seed          # datos de ejemplo
npm run db:backfill-nudges
```

Para correr un test suelto:

```bash
npx vitest run src/server/services/today.test.ts
npx vitest run -t "no deja votar en una ronda que no está OPEN"
```

> ⚠️ **`npm run lint` no funciona.** No hay config de ESLint en el repo y `next lint` está
> deprecado en Next 15.5: el comando se cuelga pidiendo crear la configuración de forma
> interactiva. La verificación del proyecto es `npx tsc --noEmit` + `npm test`.

## 🗄️ Base de datos

**No hay carpeta `prisma/migrations/`**: el schema se aplica con `prisma db push` corrido a
mano. El build de Vercel (`prisma generate && next build`) **no toca la base de datos**, así
que un cambio de schema sin `db push` contra producción deja el deploy desincronizado.

Regla corta: escribe el cambio como aditivo, aplícalo a producción **antes** de deployar el
código que lo usa, y parte cualquier cambio destructivo en dos deploys. El runbook completo
—incluido cómo adoptar `prisma migrate` con un baseline— está en
[`docs/MIGRATIONS.md`](docs/MIGRATIONS.md).

## 🌍 Despliegue (Vercel + Neon + Resend)

1. Crea un proyecto en [Neon](https://neon.tech) y copia el `DATABASE_URL` con `?sslmode=require`.
2. Crea una API key en [Resend](https://resend.com) y verifica un dominio para producción.
3. Crea un store de **Vercel Blob** si quieres avatares (inyecta `BLOB_READ_WRITE_TOKEN`).
4. Sube el repo a GitHub y conéctalo a [Vercel](https://vercel.com).
5. Añade las variables del `.env` en la configuración de Vercel, incluida `CRON_SECRET`.
6. Deploy.

Tras el deploy, ejecuta una vez `npx prisma db push` apuntando a la `DATABASE_URL` de
producción para crear las tablas.

### Cron

`vercel.json` declara **un solo cron**: `/api/cron/daily` a las 12:00 UTC. Vercel Hobby
permite máximo 2 crons con una ejecución diaria, así que todos los jobs (cierre de rondas
vencidas, recordatorios de reuniones, saludos de cumpleaños, Book Match) cuelgan de ese
endpoint único y se auto-descartan por fecha si no les toca. Va autenticado con
`Authorization: Bearer $CRON_SECRET`.

## 🎨 Paleta y tipografías

Paleta **Wisteria × Lemon**. La fuente de verdad es `src/app/globals.css`.

| Token | Claro | Oscuro |
|---|---|---|
| `--background` | `#FAF8FD` blanco lila | `#140E1E` noche wisteria |
| `--foreground` | `#261D3A` tinta wisteria | `#F3EEF9` |
| `--primary` | `#7B4E93` wisteria profunda (AA) | `#C69FD5` wisteria |
| `--accent` | `#F5E96E` lemon | `#FDFDC9` lemon (solo señal) |
| `--accent-text` | `#7B4E93` | `#FDFDC9` |

`--accent-text` existe porque el lemon no contrasta contra fondo claro: los kickers y el
texto de acento usan wisteria en modo claro y lemon en oscuro. Para fills (badges, botones)
va `--accent` directo. La clase `.gold-shimmer` conserva el nombre por historia, pero ya
anima sobre `--accent`, o sea lemon.

Tipografías: **Fraunces** display (variable, ejes editoriales) · **Karla** body ·
**Caveat** hand-script (wordmark y aforismos, nunca body).

> ⚠️ `DESIGN.md` documenta la paleta **anterior** al rebrand (aubergine + lavanda + dorado
> `#D4B770`) y su inventario de componentes está incompleto. Sus reglas de tipografía,
> espaciado, elevación y motion siguen vigentes; la tabla de color, no. Ver
> [`DESIGN.md`](DESIGN.md) con ese filtro y [`PRODUCT.md`](PRODUCT.md) para el contexto de
> producto (usuarias, tono, anti-referencias).

## 📝 Licencia

Privado · Moon Club de Lectura.
