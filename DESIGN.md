# Moon · Club de Lectura — DESIGN.md

## Color (HSL — identidad "Wisteria × Lemon")

Implementación actual en `src/app/globals.css` usando HSL. Convertir a OKLCH
sigue pendiente: la migración todavía no se hizo. Los valores HSL actuales
ya respetan la identidad del rebrand — hue wisteria (~279–283°) tintando
toda la superficie/tinta, y lemon (~55–60°) reservado como color de señal.

### Dark (default de la app)

| Token | HSL | Hex | Uso |
|---|---|---|---|
| `--background` | `263 36% 9%` | `#140E1E` | Fondo global |
| `--foreground` | `267 48% 95%` | `#F3EEF9` | Texto principal |
| `--card` | `258 39% 14%` | `#1D1530` | Tarjetas |
| `--card-foreground` | `267 48% 95%` | `#F3EEF9` | Texto sobre card |
| `--popover` | `258 39% 14%` | `#1D1530` | Dropdowns, dialogs |
| `--popover-foreground` | `267 48% 95%` | `#F3EEF9` | Texto sobre popover |
| `--primary` | `283 39% 73%` | `#C69FD5` | Wisteria, acento dominante |
| `--primary-foreground` | `276 40% 16%` | `#2B1838` | Texto sobre primary |
| `--secondary` | `260 30% 19%` | `#2C223F` | Superficies secundarias |
| `--secondary-foreground` | `267 48% 95%` | `#F3EEF9` | Texto sobre secondary |
| `--muted` | `260 26% 16%` | `#251E33` | Fondos apagados |
| `--muted-foreground` | `257 24% 68%` | `#A69BC2` | Texto secundario |
| `--accent` | `60 93% 89%` | `#FDFDC9` | Lemon, solo señal |
| `--accent-foreground` | `55 59% 15%` | `#3F3B10` | Texto sobre accent (fills) |
| `--accent-text` | `60 93% 89%` | `#FDFDC9` | Kickers / texto de acento sobre fondo oscuro |
| `--destructive` | `4 67% 73%` | `#E8918B` | Estados de error |
| `--destructive-foreground` | `4 45% 14%` | `#341614` | Texto sobre destructive |
| `--border` | `259 32% 23%` | `#34284E` | Líneas y separadores |
| `--input` | `259 32% 23%` | `#34284E` | Bordes de inputs |
| `--ring` | `283 39% 73%` | `#C69FD5` | Focus ring (= primary) |

### Light (toggle)

| Token | HSL | Hex | Uso |
|---|---|---|---|
| `--background` | `264 56% 98%` | `#FAF8FD` | Fondo global |
| `--foreground` | `259 33% 17%` | `#261D3A` | Texto principal |
| `--card` | `0 0% 100%` | `#FFFFFF` | Tarjetas |
| `--card-foreground` | `259 33% 17%` | `#261D3A` | Texto sobre card |
| `--popover` | `0 0% 100%` | `#FFFFFF` | Dropdowns, dialogs |
| `--popover-foreground` | `259 33% 17%` | `#261D3A` | Texto sobre popover |
| `--primary` | `279 31% 44%` | `#7B4E93` | Wisteria profunda (AA), acento dominante |
| `--primary-foreground` | `264 56% 98%` | `#FAF8FD` | Texto sobre primary |
| `--secondary` | `270 35% 94%` | `#F0EAF5` | Superficies secundarias |
| `--secondary-foreground` | `259 33% 17%` | `#261D3A` | Texto sobre secondary |
| `--muted` | `270 30% 95%` | `#F2EEF6` | Fondos apagados |
| `--muted-foreground` | `259 14% 44%` | `#6A6080` | Texto secundario |
| `--accent` | `55 87% 70%` | `#F5E96E` | Lemon profundizado, fill visible sobre blanco |
| `--accent-foreground` | `276 40% 16%` | `#2B1838` | Texto sobre accent (fills) |
| `--accent-text` | `279 31% 44%` | `#7B4E93` | Kickers / texto de acento sobre fondo claro |
| `--destructive` | `4 48% 47%` | `#B3473F` | Estados de error (rojo real) |
| `--destructive-foreground` | `0 0% 98%` | `#FAFAFA` | Texto sobre destructive |
| `--border` | `270 42% 91%` | `#E6DFF2` | Líneas y separadores |
| `--input` | `270 42% 91%` | `#E6DFF2` | Bordes de inputs |
| `--ring` | `279 31% 44%` | `#7B4E93` | Focus ring (= primary) |

### `--accent-text`: por qué existe

Lemon no contrasta sobre fondo claro — usarlo como color de texto ahí es
ilegible. Por eso el kicker/texto de acento (títulos pequeños, links de
énfasis) usa un token separado que cambia de rol según el tema:

- **Claro**: `--accent-text` = wisteria (`#7B4E93`, el mismo valor de
  `--primary`).
- **Oscuro**: `--accent-text` = lemon (`#FDFDC9`).

Para **fills** (badges, botones, superficies sólidas) se usa `--accent`
directo, no `--accent-text` — ahí sí funciona porque el fondo detrás del
texto lo controla `--accent-foreground`, no el color del texto sobre la
página.

### `.gold-shimmer`

Conserva el nombre "gold" por historia, pero su definición en
`globals.css` ya no anima sobre dorado: el gradiente corre sobre
`hsl(var(--accent))`, es decir, sobre lemon. Es el único gradiente-texto
autorizado en la app (ver invariantes más abajo).

### Color strategy

**Restrained product**: tinted neutrals + wisteria (acento dominante,
`--primary`) + lemon (acento ceremonial, escaso, reservado para señal:
badges "leído", CTA principal, countdowns, ✦ ornamentales — nunca como
texto sobre fondo claro). La intención se mantiene igual que con la
paleta anterior (lavanda/dorado): un acento cálido y ceremonial que
aparece poco y se nota cuando aparece.

## Typography

Tres familias vía `next/font` (cargadas en `src/app/layout.tsx`):

| Familia | Variable | Rol |
|---|---|---|
| **Fraunces** | `--font-display` | Display: h1, h2, títulos de tarjetas, números grandes. Variable axes SOFT/WONK/opsz para personalidad editorial. |
| **Karla** | `--font-sans` | Body: párrafos, UI, formularios. Grotesk humana, no Inter. |
| **Caveat** | `--font-hand` | Acentos manuscritos: wordmark "Moon", aforismos cortos ("bajo la misma luna"), nunca para body. |

### Scale

| Step | Tailwind | px | Uso |
|---|---|---|---|
| 7xl | `text-7xl` | 72 | Landing hero (desktop) |
| 5xl | `text-5xl` | 48 | h1 páginas (desktop) |
| 4xl | `text-4xl` | 36 | h1 (mobile), h2 |
| 3xl | `text-3xl` | 30 | h2 secciones |
| 2xl | `text-2xl` | 24 | Card titles |
| xl | `text-xl` | 20 | Sub-titles |
| base | `text-base` | 16 | Body |
| sm | `text-sm` | 14 | UI dense |
| xs | `text-xs` | 12 | Labels, metadata |
| 10px | `text-[10px]` | 10 | Eyebrow uppercase tracking-[0.32em] |

Ratio escalar ~1.25× cumplido entre steps adyacentes en uso real.

### Línea y tracking

- Body: `leading-relaxed` (1.625) en párrafos largos.
- Display: `leading-tight` (1.25) + `tracking-tight` (-0.015em).
- Eyebrows: `text-xs uppercase tracking-[0.18em–0.32em]`. Cuanto más pequeño
  el eyebrow, mayor el tracking.

## Spatial

- Container: `container` Tailwind con padding **responsivo** —
  `1rem` por defecto, `1.5rem` en `sm`, `2rem` en `lg`, `2.5rem` en `xl` —
  y `max-width: 1400px` en `2xl` (`tailwind.config.ts`). Los demás
  breakpoints (`sm`, `md`, `lg`, `xl`) usan los defaults de Tailwind, solo
  `2xl` está sobreescrito.
- Vertical rhythm de páginas: `space-y-8` (32) → `space-y-10` (40) →
  `space-y-12` (48) según densidad.
- Card padding: `p-6` (24) por defecto, `p-8` (32) para hero cards, `p-4` (16)
  en compact.
- Mobile: reducir un step (`p-6` → `p-5`, `space-y-12` → `space-y-10`).

## Radius

- `--radius: 0.875rem` (14px) base — confirmado en `globals.css`.
- Cards: `rounded-2xl` (16).
- Inputs / buttons: `rounded-full` o `rounded-lg`.
- Avatars: `rounded-full`.

## Elevation

Sombras tintadas hacia el primary, no negras puras. Valor real de
`src/components/ui/card.tsx`:

```css
shadow-[0_1px_0_0_hsl(var(--primary)/0.06)_inset,0_24px_48px_-24px_rgba(0,0,0,0.4)]
```

Tres niveles:
- **Card resting**: la de arriba.
- **Card hover**: no es automática en `ui/card.tsx` — es un patrón que se
  aplica puntualmente donde se necesita (ej. `src/app/(app)/agenda/page.tsx`):
  `hover:-translate-y-0.5 hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]`.
- **Floating buttons / primary**: glow wisteria
  `shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.6)]`, confirmado en
  `ui/button.tsx` (variant `default`). Existe además una variante `gold`
  con el mismo patrón sobre `--accent`.

## Motion

- Transiciones: `transition-all duration-200` por defecto. `duration-300`
  para hover de cards.
- Easing: el default de Tailwind (`ease`) está bien para lo simple. Para
  reveals usar `ease-out`.
- Prohibido: bounce, elastic, animar layout properties.
- Animaciones definidas (`tailwind.config.ts`, confirmadas las 4, ninguna
  de más ni de menos): `fade-up`, `twinkle` (estrellas), `float` (luna),
  `shimmer` (usada por `.gold-shimmer`, hoy sobre lemon).

## Components inventory

Primitivos en `src/components/ui/` (15): avatar, badge, button, card,
checkbox, datetime-input, dialog, dropdown-menu, input, label, progress,
select, separator, tabs, textarea.

Composiciones en `src/components/` (41 archivos), agrupadas por función:

- **Navegación y shell**: nav, bottom-tab-bar, moon-logo, theme-toggle,
  theme-provider, session-provider, starfield, segmented-control.
- **Lectura y biblioteca**: book-cover, book-search, book-edit-dialog,
  book-tabs-provider, progress-form, rating-form, rating-histogram,
  star-rating, shelf-book-row, start-reading-button, add-to-shelf-dialog.
- **Social y club**: comments-section, thread-view, conversation-list,
  follow-button, member-list, quote-card, share-quote-dialog, vote-button,
  round-suggestions-list, suggest-book-dialog, delete-suggestion-button,
  report-dialog, round-status-badge.
- **Actividad y reuniones**: meetings-calendar, rsvp-buttons, hero-card,
  match-card, nudge-card, profile-stat.
- **Perfil y cuenta**: profile-edit-dialog, sign-out-button.
- **Estados de carga**: skeletons.

Además existe `src/components/admin/` (11 archivos), fuera de este
inventario por ser composiciones exclusivas del panel de administración:
book-state-buttons, choose-winner-button, kahoot-activity-actions,
kahoot-activity-form, kahoot-scores-form, meeting-edit-dialog,
meeting-form, reports-panel, role-select, round-actions, round-form.

## Anti-patterns activos a evitar

- **Overflow horizontal sin indicador visual**: la nav móvil de chips que
  documentaba esta entrada ya no existe — la reemplazó `BottomTabBar`
  (`src/components/bottom-tab-bar.tsx`, 5 destinos fijos). La preocupación
  migró a dos carruseles que usan `overflow-x-auto scrollbar-hide` sin
  ninguna pista de que hay más contenido a los lados:
  - `src/app/(app)/leer/page.tsx:181` (estantería "Quiero leer")
  - `src/app/(app)/club/persona/[id]/page.tsx:146` ("Leyendo ahora" en
    perfil de otro socio)

  Pendiente: agregar alguna señal visual de scroll (fade edge, sombra,
  flecha) en ambos.

## Invariantes de diseño (anti-patterns ya resueltos — mantener así)

- **Cards nunca anidadas**: en book detail
  (`src/app/(app)/leer/libro/[id]/page.tsx`) las Card ("Tu avance",
  "Avance del club", "Tu valoración", cada reseña) viven como HERMANAS
  dentro de `<TabsContent>`, nunca una Card envolviendo a otra. Un Tabs
  solo debe aportar contenido, nunca otro contenedor con su propio
  borde/sombra.
- **Gradient text solo para highlight ceremonial**: `.gold-shimmer` sigue
  siendo el único gradiente-texto autorizado, y su único uso en todo
  `src/` es `src/app/page.tsx:46` ("bajo la misma luna"). Nunca usarlo en
  h1/h2 de páginas ni en texto largo.
- **Tabs nunca envuelven**: `TabsList` (`src/components/ui/tabs.tsx:16`)
  resuelve el overflow con `max-w-full overflow-x-auto scrollbar-hide`,
  no con `flex-wrap`. El caso de book detail
  (`src/app/(app)/leer/libro/[id]/page.tsx:292`) además usa `w-full grid`
  con `gridTemplateColumns` dinámico (3 columnas si `book.isCurrent`, 1 si
  no) + `sm:inline-flex sm:w-auto` para no desperdiciar espacio en
  desktop. Nunca reintroducir `flex-wrap` en un `TabsList`.
- **Touch targets ≥44px**: escala de referencia —
  `h-9`=36px · `h-10`=40px · `h-11`=44px ✅ · `h-12`=48px.

  - Botón por defecto (`ui/button.tsx`): `size="default"` es `h-11`=44px
    ✅; `size="icon"` es `h-11 w-11`=44px ✅; `size="sm"` es `h-9`=36px
    (deliberado en contextos densos); `size="lg"` es `h-12`=48px.
  - Votación (`vote-button.tsx`): usa el `Button` default → 44px ✅.
  - RSVP (`rsvp-buttons.tsx`): mantiene `size="sm"` (ancho compacto) y
    suma `min-h-11` → 44px de alto sin ensanchar el botón ✅.
  - Cierre de dialog (`ui/dialog.tsx`): pasó de `right-4 top-4 p-1.5`
    (28px) a `right-2 top-2 h-11 w-11` centrado → 44px, con el icono en
    el MISMO lugar visual de antes (el área táctil crece hacia adentro,
    no se desplaza). `DialogHeader` pasó de `pr-8` a `pr-14` para que el
    título nunca quede debajo del área táctil del cierre.

  - Mensajes de la barra móvil (`nav.tsx`): pasó de `h-10 w-10` a
    `h-11 w-11` → 44px ✅. Cabe en la barra de `h-12` con 2px de aire.

  Excepciones, y son solo las de escritorio: los targets de la barra
  `hidden md:flex` se apuntan con mouse, no con dedo, así que quedan en
  40px a propósito — el avatar/dropdown trigger (`h-10 w-10`) y su botón
  de mensajes gemelo. En cualquier superficie táctil, 44px no se negocia.

## i18n

UI 100% en español neutral con tuteo (nunca "vos"). Sin
internacionalización por ahora.
