# 🌙 Moon · Club de Lectura

Aplicación premium para gestionar el club de lectura **Moon**: sugerencias de libros, votación múltiple, libro en curso, comentarios con hilos y spoilers ocultables, valoraciones, avance de lectura grupal y reuniones con RSVP.

## ✨ Funcionalidades

- **Auth sin contraseñas** — magic link por email (Resend o SMTP).
- **Roles** — admin / moderador / miembro. Admins iniciales por env var.
- **Rondas de votación** — el admin abre rondas con fechas; los miembros sugieren libros (autocompletado con Google Books) y votan a los que quieran. Al cerrar, el más votado se elige automáticamente.
- **Libro en curso** — el ganador (o cualquier libro elegido por el admin) se promueve a libro del club.
- **Avance de lectura** — cada miembro marca su página actual; la app calcula el % y muestra panel grupal.
- **Comentarios** — con hilos de un nivel, marca de spoiler ocultable y capítulo opcional para evitar arruinar a quien va más atrás.
- **Valoraciones** — 1–5 estrellas + reseña, una por miembro por libro.
- **Reuniones** — fecha, lugar físico o enlace virtual, descripción y RSVP (sí / quizás / no).
- **Biblioteca histórica** — todos los libros del club con su estado.
- **Modo claro y oscuro** — premium "editorial cósmico" con paleta lavanda + crema pergamino + dorado deslucido.

## 🧱 Stack

- **Next.js 15** (App Router) + TypeScript
- **NextAuth v5 (Auth.js)** con provider Resend / Nodemailer
- **PostgreSQL** (recomendado: [Neon](https://neon.tech))
- **Prisma ORM**
- **Tailwind CSS** + componentes propios (Radix UI primitives)
- **Fuentes**: Fraunces (display) · Karla (sans) · Caveat (hand-script) — vía `next/font`
- **Sonner** para notificaciones, **Framer Motion** para microinteracciones

## 🚀 Puesta en marcha

### 1. Instala dependencias

```bash
npm install
```

### 2. Configura variables de entorno

Copia `.env.example` a `.env`:

```bash
cp .env.example .env
```

Completa al menos:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/dbname?sslmode=require"
AUTH_SECRET="..."          # genera con: openssl rand -base64 32
AUTH_URL="http://localhost:3000"
AUTH_RESEND_KEY="re_..."   # crea en https://resend.com (opcional en dev)
EMAIL_FROM="Moon Club <noreply@tudominio.com>"
ADMIN_EMAILS="tu@email.com,otroadmin@email.com"
```

> En desarrollo, si no configuras `AUTH_RESEND_KEY` ni SMTP, los magic links se imprimen en la consola del servidor.

### 3. Crea las tablas en la base de datos

```bash
npx prisma db push
```

### 4. Levanta el servidor de desarrollo

```bash
npm run dev
```

Abre <http://localhost:3000>.

### 5. Conviértete en admin

Asegúrate de que tu email esté en `ADMIN_EMAILS` antes de iniciar sesión por primera vez. Al crear tu cuenta, se promoverá automáticamente a `ADMIN`.

## 🌍 Despliegue (Vercel + Neon + Resend)

1. Crea un proyecto en [Neon](https://neon.tech) y copia el `DATABASE_URL` con `?sslmode=require`.
2. Crea una API key en [Resend](https://resend.com) y verifica un dominio para enviar correos en producción.
3. Sube el repo a GitHub y conéctalo a [Vercel](https://vercel.com).
4. En la configuración de Vercel, añade las mismas variables del `.env`.
5. Deploy.

Tras el deploy, ejecuta una vez `npx prisma db push` apuntando a la `DATABASE_URL` de producción para crear las tablas.

## 📂 Estructura

```
src/
├── app/
│   ├── (app)/                # Rutas protegidas (auth requerida)
│   │   ├── dashboard/        # Inicio: libro en curso + ronda + reunión
│   │   ├── rondas/           # Listado y detalle de rondas
│   │   ├── libros/[id]/      # Página completa de libro
│   │   ├── biblioteca/       # Histórico de libros
│   │   ├── reuniones/        # Reuniones + RSVP
│   │   ├── perfil/           # Perfil del usuario
│   │   └── admin/            # Panel admin
│   ├── api/auth/             # NextAuth handlers
│   ├── login/                # Magic link
│   ├── page.tsx              # Landing pública
│   ├── layout.tsx            # Root layout (fuentes, theme provider, starfield)
│   └── globals.css           # Tema editorial cósmico
├── components/
│   ├── ui/                   # Primitivos (Button, Input, Card…)
│   ├── admin/                # Formularios y acciones del panel admin
│   ├── moon-logo.tsx         # Logo SVG (luna + gato + libro + estrellas)
│   ├── starfield.tsx         # Atmósfera nocturna
│   ├── nav.tsx               # Navegación principal
│   ├── book-search.tsx       # Autocomplete Google Books
│   ├── comments-section.tsx  # Hilos + spoilers
│   ├── progress-form.tsx     # Avance de lectura
│   ├── rating-form.tsx       # Valoración + reseña
│   ├── rsvp-buttons.tsx      # Confirmación de asistencia
│   └── …
├── lib/
│   ├── auth.ts               # NextAuth config
│   ├── db.ts                 # Cliente Prisma
│   ├── email.ts              # Plantilla del magic link
│   ├── google-books.ts       # Wrapper de la API
│   ├── permissions.ts        # Helpers de roles
│   ├── utils.ts              # cn(), fechas, iniciales, %…
│   └── validators.ts         # Esquemas Zod
└── server/
    ├── auth-helpers.ts       # requireUser/requireAdmin/…
    └── actions/              # Server actions tipadas
        ├── rounds.ts
        ├── suggestions.ts
        ├── votes.ts
        ├── books.ts
        ├── comments.ts
        ├── ratings.ts
        ├── progress.ts
        ├── meetings.ts
        └── admin.ts
```

## 🧪 Scripts

```bash
npm run dev          # servidor de desarrollo
npm run build        # build de producción (incluye prisma generate)
npm run start        # servidor de producción
npm run lint         # ESLint
npm run db:push      # aplica el schema a la BD (sin migraciones)
npm run db:migrate   # crea migración en dev
npm run db:studio    # explora la BD en el navegador
```

## 🎨 Paleta y tipografías

- **Modo oscuro**: midnight aubergine `#11091F` · lavanda viva · crema pergamino para texto · dorado deslucido para acentos.
- **Modo claro**: pergamino crema `#F5EFE2` · aubergine profundo `#2A1740` · lavanda · dorado.
- **Display**: Fraunces (variable, características editoriales).
- **Body**: Karla.
- **Hand-script**: Caveat (acentos manuscritos como en el logo).

## 📝 Licencia

Privado · Moon Club de Lectura.
