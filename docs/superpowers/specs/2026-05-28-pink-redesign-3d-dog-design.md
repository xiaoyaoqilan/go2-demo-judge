# JudgeDog Go2 — Pink Redesign + 3D Dog

**Date:** 2026-05-28  
**Status:** Approved

---

## Goal

Redesign the JudgeDog Go2 web app to match the pink logo brand and replace the CSS dog avatar with an animated Three.js low-poly 3D dog in a hero banner layout.

---

## Design System

### Colors
| Token | Value | Usage |
|---|---|---|
| `--pink` | `#ff1493` | Primary CTA, borders, accents |
| `--pink-mid` | `#ff69b4` | Dog body, hover states |
| `--pink-light` | `#ffe0f3` | Card fills, hero bg tint |
| `--pink-pale` | `#fff0f8` | Page background |
| `--ink` | `#1a0a2e` | Text, borders, dog outlines |
| `--ink-muted` | `#7a5c72` | Secondary text |
| `--white` | `#ffffff` | Panel surfaces |
| `--score-green` | `#00e676` | High score meter |
| `--score-yellow` | `#fff200` | Mid score meter |
| `--score-red` | `#ff3b30` | Low score meter |

### Typography
- Font: existing stack (`Microsoft YaHei`, `Segoe UI`, Arial, sans-serif)
- `h1`: `clamp(34px, 5vw, 62px)`, color `#1a0a2e`, no text-stroke
- `h2`: `20px`, `font-weight: 800`, color `#1a0a2e`
- Body: `#1a0a2e`, muted: `#7a5c72`

### Cards / Panels
- `border-radius: 24px`
- `border: 2px solid #ffd0e8`
- `box-shadow: 0 4px 24px rgba(255, 20, 147, 0.10)`
- `background: #ffffff`
- No neobrutalist offset shadow on panels (keep on buttons)

### Buttons
- **Primary:** pink gradient (`#ff1493` → `#ff69b4`), white text, `border-radius: 999px`, offset shadow `4px 4px 0 #d4006b`
- **Ghost:** white background, `#ff1493` border + text, same radius
- Hover: `transform: translate(2px, 2px)`, shadow shrinks

### Background
- Page: `#fff0f8` (pale pink)
- Subtle radial gradient behind hero: `radial-gradient(ellipse 80% 50% at 50% 0%, #ffd6ec 0%, transparent 70%)`
- No checkerboard pattern

---

## Layout

### Header (unchanged structure)
- Logo left + eyebrow + h1
- Status pills right (`judgeStatus`, `dogStatus`)

### Hero Zone (new)
- Full-width panel below header
- Two columns: `2fr 1fr` on desktop, stacked on mobile
- **Left (2fr):** Three.js `<canvas id="dogCanvas">` — the 3D dog
- **Right (1fr):**
  - Score badge (large, pink circle, white number)
  - Score meter bar
  - `reactionName` strong text
  - `verdictText` italic
  - Manual score slider + Route button

### Workspace (3-column, below hero)
- `Input Panel` | `Scoreboard` | `Action Router`
- Same columns as before: `370px | minmax(360px,1fr) | 350px`
- **Action Router panel** loses the CSS dog avatar and the reaction card (both move to hero zone); keeps:
  - Module stack (04 modules)
  - Command box + Send reaction button

### Timeline
- Unchanged, hidden by default

---

## 3D Dog (Three.js)

### Tech
- **Library:** Three.js r168 via CDN (`https://cdn.jsdelivr.net/npm/three@0.168/build/three.module.js`)
- **Renderer:** `WebGLRenderer`, transparent background, `antialias: true`
- **Camera:** `PerspectiveCamera`, fov 45, positioned at `(0, 1.5, 5)`
- **Lighting:** `AmbientLight #ffe0f3 0.8` + `DirectionalLight #ffffff 1.2` from top-right
- **Material:** `MeshToonMaterial` — flat shaded, cartoon look

### Geometry (all built from Three.js primitives — no GLTF)
| Part | Geometry | Color |
|---|---|---|
| Body | `BoxGeometry(1.2, 0.8, 0.7)` | `#ff69b4` |
| Head | `BoxGeometry(0.9, 0.8, 0.75)` | `#ffb3d9` |
| Ear L/R | `ConeGeometry(0.22, 0.5, 4)` | `#ff1493` |
| Eye L/R | `SphereGeometry(0.1, 8, 8)` | `#1a0a2e` |
| Nose | `SphereGeometry(0.08, 8, 8)` | `#d4006b` |
| Leg x4 | `BoxGeometry(0.22, 0.55, 0.22)` | `#ff69b4` |
| Tail | `CylinderGeometry(0.06, 0.1, 0.6, 8)` | `#ff1493` |

All parts assembled into a `Group` so the whole dog can be transformed together.

### Animation States
Driven by a `dogState` variable set by the scoring logic in `app.js`.

| State | Trigger | Animation |
|---|---|---|
| `idle` | Page load / no score | Slow vertical bob (`sin(t * 0.8) * 0.05`), tail wags left-right |
| `happy` | Score ≥ 75 | Fast bounce (`sin(t * 6) * 0.15`), full 360° Y rotation over 1.5s, ears flap |
| `neutral` | Score 50–74 | Head tilts side to side (`sin(t * 2) * 0.1` on Z), gentle nod |
| `sad` | Score < 50 | Dog sinks down 0.3 units over 0.5s, ears droop, no bounce |

State transitions use a `targetY` / `lerp` approach so movement is smooth, not instant.

### Integration with app.js
- `window.setDogState(state)` — called from `app.js` after scoring
- Replaces all `dogAvatar.className` state changes
- Existing `dog-avatar` CSS div is removed from HTML; `dogCanvas` takes its place in the hero

---

## Files Changed

| File | Change |
|---|---|
| `index.html` | Hero zone added; CSS dog div removed; dogCanvas added; Three.js script tag added |
| `styles.css` | Full redesign: pink palette, new card styles, hero layout, remove neobrutalist bg |
| `app.js` | Replace `dogAvatar` class mutations with `window.setDogState()` calls |
| `dog3d.js` (new) | Three.js dog scene: geometry, materials, animation loop, state machine |

---

## Out of Scope
- No build tool changes (stays CDN/vanilla)
- No backend changes
- No new features — existing scoring, rubric, evidence, timeline all preserved
- Mobile: hero stacks vertically (dog on top, score below), workspace single-column
