# Replay Page -- Design Specification

## Page Overview
- **Page type:** Webinar replay page -- presents the recorded webinar video with a single CTA to enrol
- **Total number of sections:** 1 (Replay Section)
- **Has sticky CTA:** No
- **Has navigation:** No
- **Has countdown timer:** No
- **Has progress bar:** No

---

## Typography

### Fonts
- **Heading font:** Cormorant Garamond (serif)
  - Google Fonts URL: `https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500;1,600&display=swap`
  - Tailwind key: `font-display` -> `"Cormorant Garamond", serif`
- **Body font:** Montserrat (sans-serif)
  - Google Fonts URL: `https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap`
  - Tailwind key: `font-body` -> `Montserrat, sans-serif`
  - Also set on `body` via CSS: `font-family: 'Montserrat', sans-serif`

### Type Scale
- **H1:** `text-3xl` (1.875rem / 30px) mobile | `md:text-5xl` (3rem / 48px) tablet | `lg:text-[3.5rem]` (56px) desktop
  - Weight: `font-semibold` (600)
  - Color: `text-charcoal` (#2C2C2C)
  - Line-height: `leading-tight` (1.25)
  - Letter-spacing: `-0.02em` (inline style)
  - Max-width: `max-w-3xl` (48rem / 768px)
- **Label / Overline:** `text-xs` (0.75rem / 12px)
  - Weight: `font-bold` (700)
  - Transform: `uppercase`
  - Tracking: `tracking-label` (0.12em)
  - Color: `text-gold` (#C9963A)
  - Font family: `font-body` (Montserrat)
- **CTA button text:** `text-sm` (0.875rem / 14px)
  - Weight: `font-bold` (700)
  - Transform: `uppercase`
  - Tracking: `tracking-button` (0.1em)
  - Color: `#fff`
  - Font family: `font-body` (Montserrat)

---

## Color System

### Tailwind Config Extended Colors
| Token | Value | Usage |
|---|---|---|
| `burgundy.DEFAULT` | `#8B1A3A` | CTA background, play button icon, shadow tints |
| `burgundy.dark` | `#5C1128` | -- |
| `burgundy.darker` | `#34161B` | Video overlay gradient (`from-burgundy-darker/30`), video placeholder bg |
| `burgundy.light` | `#A82050` | -- |
| `gold.DEFAULT` | `#C9963A` | Overline label text, focus-visible outline, diamond decoration stroke, scrollbar hover |
| `gold.light` | `#D4AB5E` | -- |
| `gold.faint` | `rgba(201,150,58,0.15)` | -- |
| `champagne` | `#F5E6D0` | Section gradient end color, video placeholder text color |
| `blush.DEFAULT` | `#E8C4B0` | Diamond decoration stroke, scrollbar thumb |
| `blush.light` | `#F5D8D0` | -- |
| `blush.lighter` | `#F8E8E0` | -- |
| `ivory` | `#FAF5EE` | Body background, section gradient start, play button bg, scrollbar track |
| `charcoal` | `#2C2C2C` | Body text color, H1 color, play button shadow tint |

### Body Defaults
- Background: `#FAF5EE` (ivory) -- set on `body` via CSS AND `bg-ivory` class
- Text color: `#2C2C2C` (charcoal) -- set on `body` via CSS

---

## Shadow System

### CTA Primary Button
- **Default:**
  ```
  box-shadow: 0 4px 15px rgba(139,26,58,0.25), 0 2px 6px rgba(139,26,58,0.15);
  ```
- **Hover:**
  ```
  box-shadow: 0 8px 25px rgba(139,26,58,0.35), 0 4px 10px rgba(139,26,58,0.2);
  ```

### Video Container
```
box-shadow: 0 25px 60px rgba(139,26,58,0.1), 0 8px 24px rgba(139,26,58,0.06);
```

### Play Button
```
box-shadow: 0 8px 30px rgba(44,44,44,0.15);
```

---

## Section-by-Section Spec

### Section 1: Replay Section (only section)

#### Background
- Gradient: `linear-gradient(180deg, #FAF5EE 0%, #F5E6D0 100%)` (ivory to champagne, top to bottom)
- Noise overlay: pseudo-element `::after` with SVG fractalNoise texture, `opacity: 0.03`, `background-size: 128px 128px`, `position: absolute`, `inset: 0`, `pointer-events: none`, `z-index: 1`
- Overflow: `overflow-hidden`

#### Padding
- Mobile: `py-16` (4rem / 64px top and bottom)
- Tablet: `md:py-24` (6rem / 96px)
- Desktop: `lg:py-32` (8rem / 128px)

#### Container
- Max-width: `max-w-4xl` (56rem / 896px)
- Centering: `mx-auto`
- Horizontal padding: `px-6` (1.5rem / 24px)
- Text alignment: `text-center`
- Stacking context: `relative z-10` (above noise overlay and decorations)

#### Decorative Elements
1. **Diamond SVG (top-right):**
   - Class: `diamond-deco` -- `position: absolute`, `width: 200px`, `height: 200px`, `opacity: 0.08`, `pointer-events: none`
   - Position: `right-[10%] top-[10%]`
   - SVG: diamond polygon (50,0 100,50 50,100 0,50), `fill: none`, `stroke: #E8C4B0`, `stroke-width: 0.3`

2. **Diamond SVG (bottom-left):**
   - Class: `diamond-deco` with override `opacity-[0.05]`
   - Position: `left-[5%] bottom-[15%]`
   - SVG: diamond polygon (same shape), `fill: none`, `stroke: #C9963A`, `stroke-width: 0.4`

#### Components (top to bottom)

**1. Overline Label**
- Tag: `<p>`
- Classes: `font-body text-xs font-bold uppercase tracking-label text-gold mb-6 reveal`
- Text: "Webinar Replay"
- Bottom margin: `mb-6` (1.5rem / 24px)

**2. Headline (H1)**
- Tag: `<h1>`
- Classes: `font-display text-3xl md:text-5xl lg:text-[3.5rem] font-semibold text-charcoal leading-tight mb-10 max-w-3xl mx-auto reveal reveal-delay-1`
- Inline style: `letter-spacing: -0.02em`
- Contains `<br class="hidden md:block">` -- line break visible only on md+ screens
- Bottom margin: `mb-10` (2.5rem / 40px)
- Max-width: `max-w-3xl` (48rem / 768px), centered with `mx-auto`

**3. Video Embed Block**
- Wrapper: `<div class="max-w-3xl mx-auto mb-10 reveal reveal-delay-2">`
  - Max-width: `max-w-3xl` (48rem / 768px)
  - Bottom margin: `mb-10` (2.5rem / 40px)
- Inner container: `<div class="relative aspect-video rounded-2xl overflow-hidden">`
  - Aspect ratio: `aspect-video` (16:9)
  - Border radius: `rounded-2xl` (1rem / 16px)
  - Overflow: `hidden`
  - Box-shadow: `0 25px 60px rgba(139,26,58,0.1), 0 8px 24px rgba(139,26,58,0.06)` (inline style)
- **Placeholder image:** `<img>` with `w-full h-full object-cover`
  - Src: `https://placehold.co/960x540/34161B/F5E6D0?text=Webinar+Replay`
  - Dimensions: 960x540 (16:9)
- **Gradient overlay:** `<div class="absolute inset-0 bg-gradient-to-t from-burgundy-darker/30 to-transparent">`
  - Gradient from bottom `#34161B` at 30% opacity to transparent at top
- **Play button (centered):**
  - Outer: `<div class="absolute inset-0 flex items-center justify-center">`
  - Button circle: `<div class="w-20 h-20 rounded-full bg-ivory/90 flex items-center justify-center cursor-pointer hover:bg-ivory transition-colors">`
    - Width/height: `w-20 h-20` (5rem / 80px)
    - Background: `bg-ivory/90` (`#FAF5EE` at 90% opacity), hover: `bg-ivory` (full opacity)
    - Border radius: `rounded-full` (50%)
    - Transition: `transition-colors` (color changes only)
    - Box-shadow: `0 8px 30px rgba(44,44,44,0.15)` (inline style)
  - Play icon SVG: `w-8 h-8` (2rem / 32px), `text-burgundy` (#8B1A3A), `ml-1` (0.25rem offset to optically center the triangle), `fill: currentColor`
    - Path: `M8 5v14l11-7z` (standard play triangle)

**4. CTA Button**
- Wrapper: `<div class="reveal reveal-delay-3">`
- Tag: `<a href="#">`
- Classes: `cta-primary font-body font-bold text-sm uppercase tracking-button px-12 py-4 rounded-lg inline-block`
- Text: "Enrol to the Path to Financial Power Program"
- Padding: `px-12` (3rem / 48px) horizontal, `py-4` (1rem / 16px) vertical
- Border radius: `rounded-lg` (0.5rem / 8px)
- Display: `inline-block`

---

## Photo Placement Map

| Slot | Location | Dimensions | Current Source | Notes |
|---|---|---|---|---|
| Video thumbnail / replay embed | Section 1, below headline | aspect-video (16:9), max-w-3xl (768px wide) | `https://placehold.co/960x540/34161B/F5E6D0?text=Webinar+Replay` | Replace with actual video embed or video thumbnail; has gradient overlay and centered play button |

**Total photo/video slots: 1**

---

## Interactive Elements

### CTA Primary Button (`.cta-primary`)
- **Default state:**
  - Background: `#8B1A3A`
  - Color: `#fff`
  - Box-shadow: `0 4px 15px rgba(139,26,58,0.25), 0 2px 6px rgba(139,26,58,0.15)`
  - Transition: `transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, opacity 0.3s ease`
- **Hover state:**
  - Transform: `translateY(-2px)`
  - Box-shadow: `0 8px 25px rgba(139,26,58,0.35), 0 4px 10px rgba(139,26,58,0.2)`
- **Focus-visible state:**
  - Outline: `2px solid #C9963A`
  - Outline-offset: `3px`
- **Active state:**
  - Transform: `translateY(0)`
  - Opacity: `0.9`

### Video Play Button
- **Default state:**
  - Background: `rgba(250,245,238,0.9)` (ivory at 90%)
  - Box-shadow: `0 8px 30px rgba(44,44,44,0.15)`
  - Cursor: `pointer`
- **Hover state:**
  - Background: `#FAF5EE` (ivory, full opacity)
  - Transition: `transition-colors` (default 150ms ease)

### Custom Scrollbar
- Track: `#FAF5EE` (ivory)
- Thumb: `#E8C4B0` (blush), `border-radius: 4px`
- Thumb hover: `#C9963A` (gold)
- Width: `8px`

---

## Responsive Breakpoints

### Mobile (default, < 768px)
- Section padding: `py-16` (64px)
- H1: `text-3xl` (30px)
- H1 line break: hidden (`<br class="hidden md:block">`)
- Container: `max-w-4xl`, `px-6`
- Video: full width within `max-w-3xl` container
- All elements stack vertically, centered

### Tablet (md: 768px+)
- Section padding: `md:py-24` (96px)
- H1: `md:text-5xl` (48px)
- H1 line break: visible (`md:block`)

### Desktop (lg: 1024px+)
- Section padding: `lg:py-32` (128px)
- H1: `lg:text-[3.5rem]` (56px)

**No layout changes between breakpoints** -- single-column centered layout throughout. Only padding and type sizes adjust.

---

## Animation System

### Reveal Animation (IntersectionObserver)
- **Initial state (`.reveal`):**
  - `opacity: 0`
  - `transform: translateY(24px)`
  - `transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)`
- **Visible state (`.reveal.visible`):**
  - `opacity: 1`
  - `transform: translateY(0)`
- **Staggered delays:**
  - `.reveal-delay-1`: `transition-delay: 0.08s`
  - `.reveal-delay-2`: `transition-delay: 0.16s`
  - `.reveal-delay-3`: `transition-delay: 0.24s`
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` -- `opacity: 1`, `transform: none`, `transition: none`

### IntersectionObserver Config
- `threshold: 0.05` (triggers when 5% of element visible)
- `rootMargin: '0px 0px 80px 0px'` (triggers 80px before element enters viewport from bottom)
- Observer unobserves after triggering (one-shot animation)
- Fallback timeout: `setTimeout` at 1500ms forces all un-triggered `.reveal` elements to become `.visible`

### Element Reveal Order
1. Overline label -- `reveal` (no delay, immediate)
2. Headline -- `reveal reveal-delay-1` (0.08s delay)
3. Video embed -- `reveal reveal-delay-2` (0.16s delay)
4. CTA button -- `reveal reveal-delay-3` (0.24s delay)

---

## Global Styles

### Box Model
- `* { box-sizing: border-box; }`

### Scroll Behavior
- `html { scroll-behavior: smooth; }`

### Font Smoothing
- `body { -webkit-font-smoothing: antialiased; }`

### Noise Overlay (`.noise-overlay::after`)
- `content: ''`
- `position: absolute`
- `inset: 0`
- `opacity: 0.03`
- `background-image: url("data:image/svg+xml,...")` -- SVG fractalNoise filter (`baseFrequency: 0.85`, `numOctaves: 4`, `stitchTiles: stitch`)
- `background-size: 128px 128px`
- `pointer-events: none`
- `z-index: 1`

### Diamond Decoration (`.diamond-deco`)
- `position: absolute`
- `width: 200px`
- `height: 200px`
- `opacity: 0.08` (default; overridden to `0.05` on second diamond)
- `pointer-events: none`
