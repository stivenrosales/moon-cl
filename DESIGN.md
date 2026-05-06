# Moon · Club de Lectura — DESIGN.md

## Color (OKLCH-inspired tinted neutrals)

Implementación actual en `src/app/globals.css` usando HSL. Convertir a OKLCH
está pendiente — los valores HSL elegidos ya respetan la regla de tintar todo
neutro hacia el morado lavanda y bajar chroma en extremos.

### Dark (default)

| Token | HSL | Aprox HEX | Uso |
|---|---|---|---|
| `--background` | `263 38% 8%` | `#11091F` | Midnight aubergine, fondo global |
| `--card` | `263 32% 11%` | `#19102A` | Tarjetas (1 paso encima del fondo) |
| `--popover` | `263 36% 10%` | `#160D24` | Dropdowns, dialogs |
| `--foreground` | `36 38% 92%` | `#F2E8D6` | Crema pergamino, body |
| `--muted-foreground` | `268 26% 70%` | `#B8A6D0` | Texto secundario |
| `--primary` | `268 60% 70%` | `#B392E0` | Lavanda viva, acento dominante |
| `--accent` | `41 56% 64%` | `#D4B770` | Dorado deslucido, acento secundario |
| `--border` | `263 24% 20%` | `#2C1F40` | Líneas y separadores |

### Light (toggle)

| Token | HSL | Aprox HEX | Uso |
|---|---|---|---|
| `--background` | `36 47% 95%` | `#F5EFE2` | Pergamino crema |
| `--foreground` | `268 52% 16%` | `#2A1740` | Aubergine profundo |
| `--primary` | `268 48% 56%` | `#9B73CE` | Lavanda |
| `--accent` | `41 50% 64%` | `#D4B770` | Dorado |

### Color strategy

**Restrained product**: tinted neutrals + lavanda (≤15% superficie) +
dorado (≤5% superficie, solo highlights ceremoniales). El dorado se reserva
para: badges "leído", botón gold de CTA principal, ✦ ornamentales.

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

- Container: `container` Tailwind con padding 2rem (32px), max-width 1400px en
  2xl.
- Vertical rhythm de páginas: `space-y-8` (32) → `space-y-10` (40) →
  `space-y-12` (48) según densidad.
- Card padding: `p-6` (24) por defecto, `p-8` (32) para hero cards, `p-4` (16)
  en compact.
- Mobile: reducir un step (`p-6` → `p-5`, `space-y-12` → `space-y-10`).

## Radius

- `--radius: 0.875rem` (14px) base.
- Cards: `rounded-2xl` (16).
- Inputs / buttons: `rounded-full` o `rounded-lg`.
- Avatars: `rounded-full`.

## Elevation

Sombras tintadas hacia el primary, no negras puras.

```css
shadow-[0_1px_0_0_hsl(var(--primary)/0.08)_inset, 0_24px_48px_-24px_rgba(0,0,0,0.45)]
```

Tres niveles:
- Card resting: la de arriba.
- Card hover: shadow más profunda + `-translate-y-0.5`.
- Floating buttons / primary: glow lavanda `0_8px_30px_-12px_hsl(var(--primary)/0.6)`.

## Motion

- Transiciones: `transition-all duration-200` por defecto. `duration-300`
  para hover de cards.
- Easing: el default de Tailwind (`ease`) está bien para lo simple. Para
  reveals usar `ease-out`.
- Prohibido: bounce, elastic, animar layout properties.
- Animaciones definidas: `fade-up`, `twinkle` (estrellas), `float` (luna), `shimmer` (dorado).

## Components inventory

Primitivos en `src/components/ui/`: button, input, textarea, label, card,
badge, avatar, dropdown-menu, dialog, progress, separator, tabs.

Composiciones en `src/components/`: moon-logo, starfield, nav, theme-toggle,
book-cover, book-search, comments-section, vote-button, rating-form,
progress-form, rsvp-buttons, suggest-book-dialog, round-status-badge,
star-rating.

## Anti-patterns activos a evitar

- **Cards anidadas**: ya hay un caso en book detail (Tabs dentro de la página
  envuelven en Card otra vez para Avance/Comentarios). Hay que aplanar.
- **Gradient text**: solo `gold-shimmer` está autorizado, y solo para
  highlights tipo "misma luna". No para títulos de páginas.
- **Touch targets pequeños**: confirmar ≥44px en botones de votación, RSVP,
  dropdown trigger del avatar, cierre de dialog.
- **Overflow horizontal**: la nav móvil tiene chips con `overflow-x-auto` —
  comprobar que no rompa el layout y que tenga indicador visual de scroll.
- **Tabs que envuelven**: TabsList del book detail con `flex-wrap` — en
  pantallas estrechas se ve mal. Resolver con scroll horizontal.

## i18n

UI 100% en español rioplatense neutral (tutea, no usa "vos"). Sin
internacionalización por ahora.
