# Texxel / Flux — Design System Analysis

> A complete breakdown of the design architecture, color system, component patterns,
> and structural ideas used in this workspace application — ready to replicate for
> a sibling app in the same suite.

---

## 1. Foundational Identity

| Aspect | Value |
|---|---|
| **App name** | Flux (internal) / Texxel (brand) |
| **Positioning** | "Your second brain" — docs, tasks, calendar, projects, databases in one calm workspace |
| **Design philosophy** | Warm, paper-like, durable, Notion-meets-Monday.com |
| **Typography** | Plus Jakarta Sans (display + body), Inter fallback, system-ui chain |
| **Icon library** | iconsax-reactjs (Bulk variant) + lucide-react for UI primitives |
| **UI framework** | shadcn/ui (new-york style) on Radix UI primitives |
| **CSS framework** | Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`) |
| **Animation** | tw-animate-css + framer-motion + custom keyframes |

### Font Stack
```css
--font-sans: "Plus Jakarta Sans", "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
--font-display: "Plus Jakarta Sans", "Inter", ui-sans-serif, system-ui, sans-serif;
```
Loaded via Google Fonts: weights 400–800 + italic 500.

---

## 2. Color System

### 2.1 Core Palette — "Warm Paper"

The entire system is built on a **warm neutral** base, not cold grays. This is the
single most defining aesthetic choice.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--background` | `#faf6f2` (warm white) | `#31302e` (warm black) | App canvas |
| `--foreground` | `#31302e` | `#faf6f2` | Primary text |
| `--card` | `#fffdfa` (paper white) | `#3a3936` | Card surfaces |
| `--popover` | `#fffdfa` | `#3a3936` | Popovers, dropdowns, menus |
| `--secondary` | `#f1eae3` (sand) | `#44423f` | Secondary surfaces |
| `--muted` | `#f2ece5` | `#413f3c` | Muted backgrounds |
| `--muted-foreground` | `#7a746d` | `#b3ada6` | Secondary text |
| `--accent` | `#f7ded9` (coral soft) | `#4a3430` | Hover/accent backgrounds |
| `--accent-foreground` | `#803c35` | `#f2c3bb` | Accent text |
| `--border` | `#e9e1d8` | `#4a4844` | All borders |
| `--input` | `#e9e1d8` | `#4f4d49` | Input borders |
| `--destructive` | `#c93c2a` | `#e05741` | Destructive actions |

### 2.2 Brand Accent — Coral

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--primary` | `#E14B3D` | `#E14B3D` | Buttons, links, focus, active states |
| `--primary-foreground` | `#faf6f2` | `#faf6f2` | Text on primary |
| `--ring` | `#E14B3D` | `#E14B3D` | Focus rings |
| `--flux-coral` | `#E14B3D` | `#E14B3D` | Brand constant |
| `--flux-coral-600` | `#c7473b` | — | Hover/pressed |
| `--flux-coral-soft` | `#f7ded9` | `#4a3430` | Tinted backgrounds |

### 2.3 Accent Presets (User-selectable)

The app lets users override the coral accent at runtime. 6 presets:

| Name | Hex |
|---|---|
| Coral | `#E14B3D` |
| Ocean | `#2f7ea6` |
| Mint | `#1f9d76` |
| Amber | `#d98324` |
| Violet | `#7c5cff` |
| Rose | `#e5487f` |

Applied via CSS variable overrides on `:root` at runtime (`--primary`, `--ring`,
`--sidebar-primary`, `--flux-coral`). Foreground contrast is auto-calculated via
luma threshold (168).

### 2.4 Secondary / Status Colors

| Color | Hex | Semantic role |
|---|---|---|
| Ocean / Blue | `#2f7ea6` | Planned status, low priority, info |
| Mint / Green | `#1f9d76` | Done status, success |
| Amber | `#d98324` | In progress, medium priority |
| Violet | `#7c5cff` | Review status |
| Red (dark) | `#c93c2a` | Blocked, urgent, destructive |

### 2.5 Chart Palette
```
--chart-1: #E14B3D  (coral)
--chart-2: #d98324  (amber)
--chart-3: #2f7ea6  (ocean)
--chart-4: #1f9d76  (mint)
--chart-5: #7c5cff  (violet)
```

### 2.6 Color Mixing Technique

The system heavily uses `color-mix(in oklch, ...)` for tints, shades, and
translucent overlays. This is the key to the "warm, layered" look:

```css
/* Tinted card background from accent */
background: color-mix(in oklch, #1f9d76 15%, var(--card));

/* Border that shifts toward primary on hover */
border-color: color-mix(in oklch, var(--primary) 22%, var(--border));

/* Selection highlight */
::selection { background: color-mix(in oklch, var(--primary) 22%, transparent); }
```

---

## 3. Typography & Spacing

### 3.1 Type Scale

| Element | Size | Weight | Tracking |
|---|---|---|---|
| H1 (hero) | 5xl–7xl | 800 (extrabold) | -0.03em |
| H1 (page) | 2xl–3xl | 700 (bold) | tight |
| H2 (section) | 4xl–5xl | 700 | tight |
| H3 (card) | lg | 600 (semibold) | — |
| Body | sm (14px) | 400–500 | — |
| Caption/meta | xs (12px) | 600 | -0.01em |
| Section labels | xs | 600, uppercase | 0.14em |

### 3.2 Document Editor Type Scale

| Element | Size | Weight | Tracking |
|---|---|---|---|
| H1 | 1.85em | 750 | -0.02em |
| H2 | 1.45em | 700 | -0.014em |
| H3 | 1.18em | 650 | -0.008em |
| Body | 16px (configurable) | 400 | — |
| Line height | 1.65 (configurable) | — | — |

### 3.3 Radius System

```
--radius: 0.85rem (13.6px) — base
--radius-sm:  calc(radius - 4px)  →  ~9.6px
--radius-md:  calc(radius - 2px)  →  ~11.6px
--radius-lg:  radius              →  13.6px
--radius-xl:  calc(radius + 6px)  →  ~19.6px
--radius-2xl: calc(radius + 12px) →  ~25.6px
```

In practice, cards use `16px` rounded corners, pills use `999px` (full), buttons
use `rounded-md` / `rounded-full` depending on context.

### 3.4 Density System

User-selectable interface density via root font-size:
- **Compact**: 14.5px
- **Default**: 16px
- **Comfortable**: 17px

All spacing is rem-based, so the entire app scales proportionally.

---

## 4. Elevation & Shadows

A 3-tier "engineered" elevation system with warm-tinted shadows:

```css
--shadow-color: 28 25% 22%;       /* light: warm brown HSL */
--shadow-strength: 0.10;           /* light: very subtle */

--elev-1: 0 1px 2px hsl(... / 0.07), 0 1px 1px hsl(... / 0.05);
--elev-2: 0 2px 4px hsl(... / 0.06), 0 8px 22px hsl(... / 0.09);
--elev-3: 0 4px 8px hsl(... / 0.07), 0 20px 48px hsl(... / 0.11);
```

Dark mode increases shadow strength to `0.5` and shifts color to `24 30% 3%`.

| Class | Usage |
|---|---|
| `.elev-1` | Cards at rest, subtle surfaces |
| `.elev-2` | Hovered cards, popovers, floating composers |
| `.elev-3` | Dialogs, hero product preview |

---

## 5. Component Catalog

### 5.1 Buttons

**shadcn Button** (`components/ui/button.tsx`) — CVA-based with 6 variants + 7 sizes:

| Variant | Style |
|---|---|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` |
| `destructive` | `bg-destructive text-white hover:bg-destructive/90` |
| `outline` | `border bg-background shadow-xs hover:bg-accent` |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` |
| `ghost` | `hover:bg-accent hover:text-accent-foreground` |
| `link` | `text-primary underline-offset-4 hover:underline` |

| Size | Height |
|---|---|
| `xs` | 24px |
| `sm` | 32px |
| `default` | 36px |
| `lg` | 40px |
| `icon` / `icon-xs` / `icon-sm` / `icon-lg` | square variants |

**App-level button tokens** (`components/app/common.tsx`):
- `btnPrimary` — pill-shaped (`rounded-full`), coral bg, focus ring
- `btnOutline` — pill, bordered, card bg
- `btnGhost` — pill, transparent, muted hover

### 5.2 Cards

Two card systems coexist:

**shadcn pattern** — composed inline with `bg-card border border-border rounded-lg shadow-sm`

**Texxel durable card** (CSS classes):
```css
.tx-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--elev-1);
}
.tx-card-hover:hover {
  box-shadow: var(--elev-2);
  transform: translateY(-1px);
  border-color: color-mix(in oklch, var(--primary) 22%, var(--border));
}
```

Hover transition: `0.18s` with `--ease-standard: cubic-bezier(0.16, 1, 0.3, 1)`.

### 5.3 Badges & Pills

**shadcn Badge** — `rounded-full`, 6 variants (default, secondary, destructive,
outline, success, warning).

**Texxel Status Pills** (Monday-style):
```css
.tx-pill {
  display: inline-flex; align-items: center; gap: 6px;
  border-radius: 999px; padding: 3px 10px;
  font-size: 12px; font-weight: 600; letter-spacing: -0.01em;
}
```
With a 6px dot indicator (`.tx-dot`). Status variants:
- `.tx-status-done` — green tint
- `.tx-status-progress` — amber tint
- `.tx-status-blocked` — red tint
- `.tx-status-planned` — blue tint
- `.tx-status-todo` — neutral foreground tint
- `.tx-status-review` — violet tint

Priority variants: `.tx-prio-urgent`, `.tx-prio-high`, `.tx-prio-medium`,
`.tx-prio-low` — same pill shape, different color mixes.

### 5.4 Inputs

- **Input**: `h-9`, `rounded-md`, `border-input`, `shadow-xs`, focus ring
  `focus-visible:ring-[3px]` with `ring-ring/50`
- **Textarea**: `min-h-[60px]`, same border/focus pattern
- **Select**: Radix Select, `h-9` trigger, `rounded-md`, chevron icon
- **DatePicker**: Custom Popover-based calendar, `h-8` day cells, selected day
  uses `bg-primary text-primary-foreground`

### 5.5 Dialogs & Modals

- **Dialog**: Radix Dialog, centered, `bg-background`, `max-w-lg`, overlay
  `bg-black/70`, zoom-in/fade animation
- **AlertDialog**: Same pattern, supports `size="sm"` variant, media slot
- **Sheet**: Slide-in from sides, `bg-background`, overlay `bg-black/50`,
  300ms close / 500ms open
- **Command Dialog**: Dialog wrapper around cmdk, `p-0`, `h-12` input

All use `z-99999` for content, `z-99998` for sheet overlay.

### 5.6 Popovers & Dropdowns

- **Popover**: `bg-popover`, `rounded-md`, `border`, `shadow-md`, `w-72` default,
  `z-100000`
- **DropdownMenu**: Same surface, `min-w-32`, items use
  `focus:bg-accent focus:text-accent-foreground`, `rounded-sm`, `gap-2`
- **Tooltip**: Inverted colors (`bg-foreground text-background`), `text-xs`,
  includes arrow, `z-99999`

### 5.7 Avatars

- Sizes: `sm` (24px), `default` (32px), `lg` (40px)
- Fallback: `bg-muted text-muted-foreground`, first letter uppercase
- AvatarBadge: `bg-primary text-primary-foreground`, ring-2 with background color
- AvatarGroup: `-space-x-2`, ring-2 overlap

### 5.8 Switch

- `h-5 w-9`, `rounded-full`, checked = `bg-primary`, unchecked = `bg-input`
- Thumb: `h-4 w-4`, `bg-background`, `translate-x-4` when checked

### 5.9 Skeleton

- `animate-pulse`, `rounded-md`, `bg-primary/5` (very subtle coral tint)

### 5.10 Noise Overlay

Canvas-based film grain (`components/ui/noise.tsx`):
- 256×256 static noise pattern, alpha 16
- `pointer-events-none`, `image-rendering: pixelated`
- Used on auth gradient panels for texture

---

## 6. Layout Architecture

### 6.1 App Shell

```
┌─────────────────────────────────────────────┐
│  Sidebar (280px, resizable 224–400px)       │
│  ┌───────────────────────────────────────┐  │
│  │ Topbar (h-14/h-16, sticky, blur)      │  │
│  ├───────────────────────────────────────┤  │
│  │                                       │  │
│  │  Main content (overflow-y-auto)       │  │
│  │  max-w-[1120px], mx-auto              │  │
│  │                                       │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

- `flex h-screen overflow-hidden` root
- Sidebar: `fixed` on mobile, `static` on desktop, collapsible (⌘\)
- Topbar: `sticky top-0`, `bg-background/85 backdrop-blur`
- Content: `PageContainer` = `max-w-[1120px] mx-auto px-4 py-6 md:px-8 md:py-8`

### 6.2 Sidebar Structure

1. **Workspace switcher** — dropdown with avatar, name, member count
2. **Search button** — `rounded-xl`, shows ⌘K hint
3. **Nav items** — `rounded-xl px-3 py-2`, active state with 3px coral left bar
4. **Favorites section** — collapsible, draggable items
5. **Private/docs tree** — Notion-style nested document tree with DnD
6. **Footer** — Trash (droppable), Settings

### 6.3 Topbar Structure

1. Mobile menu button
2. Back/forward navigation (Linear-style)
3. Search pill (`rounded-full`, `max-w-sm`)
4. Theme toggle (sun/moon)
5. Notifications (with badge count)
6. User avatar dropdown

### 6.4 Landing Page

- Sticky nav with scroll-aware background (`transparent → bg-background/80 backdrop-blur-xl`)
- Hero with `flux-grid-bg` (dotted radial pattern), badge pill, large headline
- Product preview mock (browser chrome with 3 colored dots)
- Feature grid (4 cards with tinted icon backgrounds)
- Durable band (border-y, bg-card)
- Connected band with stat cards
- Final CTA with `tx-grain-panel` (animated coral gradient + noise)

---

## 7. Motion & Animation

### 7.1 Easing

```css
--ease-standard: cubic-bezier(0.16, 1, 0.3, 1);   /* decelerate */
--ease-exit:     cubic-bezier(0.4, 0, 1, 1);       /* accelerate */
```

### 7.2 Key Animations

| Name | Duration | Usage |
|---|---|---|
| `tx-fade-in` | 0.5s | Page/section entrance (translateY 10px → 0) |
| `tx-typing` | 1.1s infinite | AI typing indicator dots |
| `tx-gradient-drift` | 26s infinite | Auth panel gradient shift |
| `flux-float` | 6s infinite | Decorative floating elements |
| `texxel-anchor-flash` | 1.3s | Comment anchor highlight pulse |
| `tx-tree-expand` | 0.22s | Document tree node expand |

### 7.3 Hover Transitions

- Cards: `0.18s` (shadow + transform + border-color)
- Nav items: `0.12s` (background-color)
- Tree rows: `0.12s` (background-color)
- Side menu: `0.15s` opacity fade

### 7.4 Reduced Motion

All animations disabled via `@media (prefers-reduced-motion: reduce)`.

---

## 8. Specialized Patterns

### 8.1 Active Nav Indicator

3px coral bar on the left side of active sidebar items:
```jsx
{active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary" />}
```

### 8.2 Tinted Icon Containers

Feature/page icons sit in rounded containers with color-mix backgrounds:
```jsx
<span style={{
  backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`,
  color: color
}} />
```
Sizes: `h-8 w-8 rounded-xl` (compact), `h-11 w-11 rounded-2xl` (page headers),
`h-12 w-12 rounded-2xl` (feature cards).

### 8.3 Page Header Pattern

```jsx
<PageHeader
  icon={Icon}
  title="Page Title"
  subtitle="Optional description"
  actions={<Button>Action</Button>}
/>
```
Icon in `bg-[var(--flux-coral-soft)] text-primary` container, title in
`font-display text-2xl font-bold tracking-tight md:text-3xl`.

### 8.4 Empty State Pattern

Dashed border, centered, large muted icon, title + description + action:
```jsx
<div className="flex flex-col items-center justify-center rounded-3xl
  border border-dashed border-border bg-card/40 px-6 py-16 text-center">
```

### 8.5 Contribution Heatmap

5-level intensity scale using color-mix with primary:
```css
.tx-heat-0 { background: color-mix(in oklch, var(--foreground) 6%, var(--card)); }
.tx-heat-1 { background: color-mix(in oklch, var(--primary) 25%, var(--card)); }
.tx-heat-2 { background: color-mix(in oklch, var(--primary) 45%, var(--card)); }
.tx-heat-3 { background: color-mix(in oklch, var(--primary) 68%, var(--card)); }
.tx-heat-4 { background: var(--primary); }
```

### 8.6 Auth Gradient Panel

Multi-radial-gradient coral panel with animated drift + SVG noise overlay:
```css
.tx-grain-panel {
  background:
    radial-gradient(120% 120% at 15% 20%, #f0b2aa 0%, transparent 55%),
    radial-gradient(120% 120% at 85% 30%, #E14B3D 0%, transparent 60%),
    radial-gradient(140% 140% at 50% 100%, #a34238 0%, transparent 65%),
    #c7473b;
  animation: tx-gradient-drift 26s ease-in-out infinite;
}
```

### 8.7 Scrollbar Styling

Thin, rounded, foreground-tinted:
```css
::-webkit-scrollbar { width: 10px; }
::-webkit-scrollbar-thumb {
  background: color-mix(in oklch, var(--foreground) 16%, transparent);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: content-box;
}
```

### 8.8 Focus Ring

Double-ring pattern (background cutout + ring):
```css
.tx-focus:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--background), 0 0 0 4px color-mix(in oklch, var(--ring) 60%, transparent);
}
```

### 8.9 Easy Reading Mode

Accessibility toggle (`html[data-easyread="true"]`):
- Letter-spacing: 0.012em
- Line-height: 1.7
- All text: font-weight 600
- Headings: font-weight 800
- Muted text lifted to 82% foreground mix

---

## 9. Tech Stack Summary

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Webpack) |
| React | 19.2 |
| Styling | Tailwind CSS v4 (CSS-first, `@theme inline`) |
| UI primitives | Radix UI (via `radix-ui` package + individual `@radix-ui/*`) |
| Component system | shadcn/ui (new-york style) |
| Icons | iconsax-reactjs (Bulk), lucide-react |
| Animation | tw-animate-css, framer-motion |
| Backend | Convex |
| Auth | WorkOS AuthKit |
| Editor | BlockNote 0.47 |
| State | Zustand, Convex real-time queries |
| i18n | next-intl |
| Charts | Recharts |
| DnD | @dnd-kit |
| Toasts | Sonner |

---

## 10. Design Principles to Replicate

1. **Warm, not cold** — Use `#faf6f2` / `#31302e` instead of pure white/black.
   Every neutral has a warm undertone (brownish HSL).

2. **One accent, many tints** — A single coral accent propagates through
   `color-mix()` to create tints (15%), borders (22%), hovers (90%), and
   translucent overlays. Never introduce raw hex colors in components.

3. **Hairline borders + soft shadows** — 1px borders in `--border` paired with
   very low-strength warm shadows create depth without heaviness.

4. **Pills for status, rounded for actions** — Status indicators are always
   `rounded-full` pills with dot indicators. Buttons vary: `rounded-md` for
   shadcn, `rounded-full` for app-level pill buttons.

5. **Layered surfaces** — Background → Sidebar → Card → Popover. Each level
   gets progressively lighter (light mode) or lighter (dark mode), creating
   visual hierarchy through subtle background shifts.

6. **Motion is calm** — 0.12s–0.22s transitions with decelerate easing. No
   bounces, no springs. Hover lifts are 1px max.

7. **Typography carries weight** — Extrabold (800) headlines with tight
   tracking, semibold (600) labels, regular (400) body. The contrast between
   800 and 400 creates rhythm.

8. **Keyboard-first** — ⌘K command palette, ⌘\ sidebar toggle, back/forward
   navigation. Every action has a shortcut.

9. **Accessibility as a feature, not an afterthought** — Easy reading mode,
   density control, accent customization, reduced-motion support, and
   accessible focus rings are all first-class settings.

10. **Durable, not trendy** — The aesthetic borrows from Notion (editor,
    sidebar tree), Monday.com (status pills, task tables), and Linear (nav
    navigation, command palette) — proven patterns, refined with warmth.
