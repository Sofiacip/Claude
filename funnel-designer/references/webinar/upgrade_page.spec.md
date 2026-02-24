# Upgrade Page — Design Specification

Extracted from: `references/webinar/upgrade_page.html`

---

## Page Overview

- **Page type & purpose:** Upgrade / one-time-offer page shown immediately after webinar registration, selling a $27 VIP mini-course bundle
- **Total number of sections:** 5 content sections + sticky top CTA bar + progress bar + sticky mobile CTA
- **Has sticky CTA:** Yes (two: fixed top bar + fixed mobile bottom bar)
- **Has navigation:** No
- **Has countdown timer:** Yes (10-minute countdown)
- **Has progress bar:** Yes (3-step: Registered > Upgrade > Enjoy)

---

## Typography

### Fonts

- **Heading/display font:** Cormorant Garamond (serif)
  - Google Fonts URL: `https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500;1,600&display=swap`
  - Tailwind config key: `fontFamily.display` = `['"Cormorant Garamond"', 'serif']`
- **Body font:** Montserrat (sans-serif)
  - Google Fonts URL: `https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap`
  - Tailwind config key: `fontFamily.body` = `['Montserrat', 'sans-serif']`
  - Also set in `body` CSS rule: `font-family: 'Montserrat', sans-serif;`

### Type Scale

| Role | Font | Size (mobile / md / lg) | Line-height | Weight | Color | Letter-spacing | Extra |
|------|------|-------------------------|-------------|--------|-------|----------------|-------|
| **H1** | `font-display` | `text-3xl` (1.875rem) / `md:text-5xl` (3rem) / `lg:text-[3.5rem]` (3.5rem) | `leading-tight` (1.25) | `font-semibold` (600) | `text-charcoal` (#2C2C2C) | `-0.02em` (inline style) | — |
| **H2 (light bg)** | `font-display` | `text-3xl` (1.875rem) / `md:text-4xl` (2.25rem) / `lg:text-5xl` (3rem) | `leading-tight` (1.25) | `font-semibold` (600) | `text-charcoal` (#2C2C2C) | `-0.02em` (inline style) | — |
| **H2 (dark bg)** | `font-display` | `text-2xl` (1.5rem) / `md:text-4xl` (2.25rem) | `leading-tight` (1.25) | `font-semibold` (600) | `text-white` (#fff) | `-0.02em` (inline style) | — |
| **H3 (product card)** | `font-display` | `text-xl` (1.25rem) / `md:text-2xl` (1.5rem) | default | `font-semibold` (600) | `text-charcoal` (#2C2C2C) | default | `pr-20` to avoid badge overlap |
| **Subheading (display italic)** | `font-display` | `text-lg` (1.125rem) / `md:text-xl` (1.25rem) | `leading-relaxed` (1.625) | 400 (italic) | `text-charcoal/60` | default | `italic` |
| **Display quote (section 2)** | `font-display` | `text-xl` (1.25rem) / `md:text-2xl` (1.5rem) | `leading-snug` (custom: 1.1) | `font-semibold` (600) | `text-charcoal/80` | default | — |
| **Body text** | `font-body` | `text-base` (1rem) / `md:text-lg` (1.125rem) | `leading-relaxed` (1.625) | 400 | `text-charcoal/65` | default | — |
| **Body small** | `font-body` | `text-sm` (0.875rem) | `leading-relaxed` (1.625) | 400 | `text-charcoal/55` or `text-charcoal/60` | default | — |
| **Label/overline** | `font-body` | `text-xs` (0.75rem) or `text-[10px]` | default | `font-bold` (700) | varies: `text-burgundy-light`, `text-gold`, `text-charcoal/40` | `tracking-label` (0.12em) | `uppercase` |
| **Countdown number** | Cormorant Garamond (via `.countdown-num` class) | `2.5rem` desktop / `2rem` mobile (max-width: 767px) | `line-height: 1` | `font-weight: 600` | `text-charcoal` (#2C2C2C) | default | — |
| **Countdown label** | `.countdown-label` class | `0.65rem` | default | `font-weight: 600` | `text-charcoal/50` | `0.12em` | `text-transform: uppercase` |
| **Button text** | `font-body` | `text-sm` (0.875rem) or `text-xs` (0.75rem) | default | `font-bold` (700) | white or `#34161B` | `tracking-button` (0.1em) | `uppercase` |
| **Product card italic closer** | `font-display` | `text-sm` (0.875rem) | default | 400 | `text-charcoal/45` | default | `italic` |
| **Value stack item title (dark)** | `font-body` | `text-base` (1rem) | default | `font-semibold` (600) | `text-white` | default | — |
| **Value stack item body (dark)** | `font-body` | `text-sm` (0.875rem) | default | 400 | `text-champagne/60` | default | — |
| **Pricing display** | `font-display` | `text-3xl` (1.875rem) | default | `font-bold` (700) | `text-charcoal/40` (struck) / `text-burgundy` (current) | default | `line-through decoration-burgundy-light/50` on old price |
| **Value stack pricing** | `font-display` | `text-2xl` (1.5rem) / `md:text-3xl` (1.875rem) | default | `font-semibold` (600) | `text-white` / `text-gold` for price | default | `line-through text-champagne/40` on old price |

### Custom Line-height Config

```js
lineHeight: {
  body: '1.7',
  tight: '0.9',
  snug: '1.1',
}
```

### Custom Letter-spacing Config

```js
letterSpacing: {
  label: '0.12em',
  button: '0.1em',
}
```

---

## Color System

### Tailwind Config Colors

```js
colors: {
  burgundy: {
    DEFAULT: '#8B1A3A',    // --color-primary
    dark: '#5C1128',       // --color-primary-dark
    darker: '#34161B',     // --color-primary-darker
    light: '#A82050',      // --color-primary-light
  },
  gold: {
    DEFAULT: '#C9963A',    // --color-accent
    light: '#D4AB5E',      // --color-accent-light
    faint: 'rgba(201,150,58,0.15)',  // --color-accent-faint
  },
  champagne: '#F5E6D0',     // --color-bg-alt
  blush: {
    DEFAULT: '#E8C4B0',     // --color-bg-warm
    light: '#F5D8D0',       // --color-bg-warm-light (not used on this page)
    lighter: '#F8E8E0',     // --color-bg-warm-lighter (not used on this page)
  },
  ivory: '#FAF5EE',          // --color-bg-base
  charcoal: '#2C2C2C',       // --color-text-primary
}
```

### Color Usage Summary

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary` | `#8B1A3A` | Primary CTA background, progress step completed, bullet markers, decorative accents |
| `--color-primary-dark` | `#5C1128` | Dark gradient midpoint (value stack section) |
| `--color-primary-darker` | `#34161B` | Dark gradient start, gold CTA text color, sticky top bar bg (`bg-burgundy-darker/95`) |
| `--color-primary-light` | `#A82050` | Current progress step, overline labels, urgency text |
| `--color-accent` (gold) | `#C9963A` | Gold CTA background, section overlines, price highlight, value badges, focus outline on primary CTA, scrollbar thumb hover |
| `--color-accent-light` | `#D4AB5E` | (Available but not directly used on this page) |
| `--color-accent-faint` | `rgba(201,150,58,0.15)` | Value badge background (`bg-gold/15`) |
| `--color-bg-base` (ivory) | `#FAF5EE` | Page background, countdown timer inner bg (`bg-ivory/80`), sticky mobile CTA bg (`rgba(250,245,238,0.92)`), scrollbar track |
| `--color-bg-alt` (champagne) | `#F5E6D0` | Section 2 bg (`bg-champagne/50`), benefits box bg (`bg-champagne/40`), dark section text muted, gold CTA focus outline |
| `--color-bg-warm` (blush) | `#E8C4B0` | Card borders (`border-blush/30`), progress divider, diamond deco stroke, scrollbar thumb, sticky mobile border |
| `--color-text-primary` (charcoal) | `#2C2C2C` | All body text on light sections |
| Text muted | `text-charcoal/55`, `text-charcoal/60`, `text-charcoal/65` | Body text at various opacity levels |
| Text faint | `text-charcoal/40` | Labels, declined links, struck-through pricing |
| Dark section text muted | `text-champagne/60`, `text-champagne/40`, `text-champagne/35`, `text-champagne/30` | Various opacity levels of champagne on dark backgrounds |

---

## Shadow System

| Token | CSS Value | Usage |
|-------|-----------|-------|
| **Shadow-card** | `0 8px 30px rgba(139,26,58,0.04)` | Product cards, countdown container, benefits box |
| **Shadow-video** | `0 20px 60px rgba(139,26,58,0.08), 0 8px 25px rgba(139,26,58,0.04)` | Video embed placeholder |
| **Shadow-dark-card** | `0 8px 30px rgba(0,0,0,0.1)` | Value stack items on dark section |
| **Shadow-CTA-primary (rest)** | `0 4px 15px rgba(139,26,58,0.25), 0 2px 6px rgba(139,26,58,0.15)` | `.cta-primary` default state |
| **Shadow-CTA-primary (hover)** | `0 8px 25px rgba(139,26,58,0.35), 0 4px 10px rgba(139,26,58,0.2)` | `.cta-primary:hover` |
| **Shadow-CTA-gold (rest)** | `0 4px 15px rgba(201,150,58,0.3), 0 2px 6px rgba(201,150,58,0.15)` | `.cta-gold` default state |
| **Shadow-CTA-gold (hover)** | `0 8px 25px rgba(201,150,58,0.4), 0 4px 10px rgba(201,150,58,0.2)` | `.cta-gold:hover` |
| **Shadow-sticky-top** | `0 4px 20px rgba(52,22,27,0.15)` | Sticky top CTA bar (inline style) |
| **Shadow-sticky-mobile** | `0 -4px 20px rgba(44,44,44,0.08)` | Sticky mobile CTA |
| **Shadow-progress-step** | `0 2px 8px rgba(139,26,58,0.2)` | Completed/current progress step circles |
| **Shadow-progress-current** | `0 2px 8px rgba(168,32,80,0.2)` | Current step (burgundy-light tint) |
| **Shadow-play-button** | `0 4px 20px rgba(139,26,58,0.3)` | Video play button |
| **Shadow-product-card-hover** | `0 12px 40px rgba(139,26,58,0.08), 0 4px 15px rgba(139,26,58,0.04)` | `.product-card:hover` |
| **Shadow-bullet-marker** | `0 1px 4px rgba(139,26,58,0.2)` | Rotated diamond bullet markers in benefits list |

---

## Noise / Texture Overlay

Applied via `.noise-overlay::after` pseudo-element:

```css
.noise-overlay::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 128px 128px;
  pointer-events: none;
  z-index: 1;
}
```

Used on: Section 2 (champagne bg), Section 4 (dark gradient bg).

---

## Diamond Decoration

Decorative SVG diamond shapes used as section accents:

```css
.diamond-deco {
  position: absolute;
  width: 200px;
  height: 200px;
  opacity: 0.08;
  pointer-events: none;
}
```

SVG markup: `<polygon points="50,0 100,50 50,100 0,50" fill="none" stroke="#E8C4B0" stroke-width="0.3"/>`
On dark section: `stroke="#F5E6D0" stroke-width="0.5"` with `opacity-[0.04]` override.

---

## Section-by-Section Spec

---

### Sticky Top CTA Bar

- **Element:** `<div id="sticky-top">` (not a `<section>`)
- **Position:** `fixed top-0 left-0 right-0 z-50`
- **Background:** `bg-burgundy-darker/95` (#34161B at 95% opacity)
- **Backdrop filter:** `backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);`
- **Padding:** `py-3 px-4`
- **Border:** `border-b border-burgundy/30`
- **Shadow:** `box-shadow: 0 4px 20px rgba(52,22,27,0.15)` (inline style)
- **Container:** `max-w-4xl mx-auto`
- **Layout:** `flex items-center justify-between gap-4`
- **Left text:** `font-body text-xs md:text-sm text-champagne/70` -- hidden on mobile (`hidden md:block`), content: "Special one-time offer -- upgrade for just $27"
- **Right CTA:** Gold button (`cta-gold`), `font-body font-bold text-xs uppercase tracking-button`, `w-full md:w-auto text-center`, `px-8 py-2.5 rounded`, href `#checkout`, text: "Yes, I Want to Upgrade for $27"
- **Behavior:** Slides up (`transform: translateY(-100%)`) when `#checkout` element is in viewport (threshold 0.1), slides back down when checkout scrolls out of view. Transition: `transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease`.

---

### Progress Bar

- **Element:** `<div>` (not a `<section>`)
- **Background:** `bg-ivory` with `border-b border-blush/30`
- **Top padding:** `pt-14` (to clear fixed sticky bar)
- **Container:** `max-w-2xl mx-auto px-4 py-5`
- **Layout:** `flex items-center justify-center gap-2 md:gap-4`
- **Font size:** `text-xs md:text-sm`
- **Step 1 (Completed):**
  - Circle: `w-6 h-6 rounded-full bg-burgundy`, `box-shadow: 0 2px 8px rgba(139,26,58,0.2)`
  - Icon: White checkmark SVG, `w-3 h-3`, `stroke-width="3"`
  - Label: `font-body text-charcoal/50`, text: "Registered"
- **Divider 1:** `w-8 md:w-16 h-px bg-burgundy/30`
- **Step 2 (Current):**
  - Circle: `w-6 h-6 rounded-full bg-burgundy-light`, `box-shadow: 0 2px 8px rgba(168,32,80,0.2)`
  - Number: `text-white text-[10px] font-bold`, text: "2"
  - Label: `font-body font-semibold text-charcoal`, text: "Upgrade"
- **Divider 2:** `w-8 md:w-16 h-px bg-blush/50`
- **Step 3 (Pending):**
  - Circle: `w-6 h-6 rounded-full bg-blush/40`
  - Number: `text-charcoal/40 text-[10px] font-bold`, text: "3"
  - Label: `font-body text-charcoal/40`, text: "Enjoy"

---

### Section 1: Congrats + Headline

- **Background:** `bg-ivory`
- **Padding:** `py-12 md:py-16`
- **Overflow:** `overflow-hidden`
- **Position:** `relative`
- **Container:** `max-w-3xl mx-auto px-6 text-center relative z-10`
- **Diamond deco:** positioned `right-[8%] top-[5%]`, stroke `#E8C4B0`
- **Components (top to bottom):**
  1. **Overline:** `font-body text-xs font-bold uppercase tracking-label text-burgundy-light mb-2`, text: "Congrats! You're registered.", class `reveal`
  2. **Subtext:** `font-body text-sm text-charcoal/55 mb-8`, text: "Before you go, I have a special invitation for you:", class `reveal reveal-delay-1`
  3. **H1:** `font-display text-3xl md:text-5xl lg:text-[3.5rem] font-semibold text-charcoal leading-tight mb-6`, `letter-spacing: -0.02em`, class `reveal reveal-delay-1`
  4. **Gold divider:** `w-16 h-[2px] bg-gold mx-auto mb-6`, class `reveal reveal-delay-2`
  5. **Body paragraph:** `font-body text-base md:text-lg text-charcoal/65 max-w-2xl mx-auto leading-relaxed`, class `reveal reveal-delay-2`
- **Photo slots:** None
- **CTA buttons:** None

---

### Section 2: Video + Pricing + Countdown

- **Background:** `bg-champagne/50` (#F5E6D0 at 50% opacity)
- **Padding:** `py-14 md:py-20`
- **Overflow:** `overflow-hidden`
- **Position:** `relative`
- **Has noise overlay:** Yes (`.noise-overlay`)
- **Container:** `max-w-3xl mx-auto px-6 relative z-10`
- **Components (top to bottom):**
  1. **Video embed placeholder:**
     - Container: `aspect-video bg-burgundy-darker/10 rounded-2xl mb-10`, `overflow-hidden relative`
     - Shadow: `box-shadow: 0 20px 60px rgba(139,26,58,0.08), 0 8px 25px rgba(139,26,58,0.04)`
     - Play button: `w-16 h-16 rounded-full bg-burgundy/80`, hover `bg-burgundy`, `transition-colors`, `box-shadow: 0 4px 20px rgba(139,26,58,0.3)`, centered via flex
     - Play icon: White triangle SVG `w-6 h-6 ml-1`
     - Bottom-left text: `absolute bottom-4 left-4 font-body text-xs text-charcoal/30`, "Watch the video above"
     - Class: `reveal`
  2. **Display quote:** `font-display text-xl md:text-2xl font-semibold text-charcoal/80 mb-4 max-w-xl mx-auto leading-snug`, class `reveal`
  3. **Body paragraph:** `font-body text-sm text-charcoal/55 max-w-lg mx-auto leading-relaxed mb-10`, class `reveal reveal-delay-1`
  4. **Pricing block:**
     - Wrapper: `mb-8`, class `reveal reveal-delay-2`
     - Value label: `font-body text-[10px] font-bold uppercase tracking-label text-charcoal/40 mb-2`, text: "Total value:"
     - Old price: `font-display text-3xl font-bold text-charcoal/40 line-through decoration-burgundy-light/50 mb-1`, text: "$168"
     - Current price: `font-body text-sm text-charcoal/65`, contains `font-display text-3xl font-bold text-burgundy` for "$27"
  5. **Countdown timer:**
     - Outer wrapper: `mb-10`, class `reveal reveal-delay-2`
     - Timer box: `inline-flex flex-col items-center bg-ivory/80 rounded-2xl px-8 py-5 border border-blush/30`, `box-shadow: 0 8px 30px rgba(139,26,58,0.04)`
     - Urgency label: `font-body text-[10px] font-bold uppercase tracking-label text-burgundy-light mb-3`, text: "This offer expires when you leave this page"
     - Timer display: `flex gap-8 text-charcoal`
     - Minutes: `.countdown-num` (id `minutes`), initial value "10"
     - Colon separator: `.countdown-num text-charcoal/20`
     - Seconds: `.countdown-num` (id `seconds`), initial value "00"
     - Unit labels: `.countdown-label text-charcoal/50`, text: "Minutes" / "Seconds"
  6. **CTA + Decline:**
     - Wrapper: `id="checkout"`, class `reveal reveal-delay-3`
     - Button: `cta-primary font-body font-bold text-sm uppercase tracking-button inline-block w-full max-w-md px-10 py-4 rounded-lg`, text: "Yes, I Want to Upgrade for $27"
     - Decline link: `decline-link font-body text-xs text-charcoal/40 hover:text-charcoal/60`, text: "No thanks, I'll attend the webinar without the VIP bundle", wrapped in `mt-4` paragraph

---

### Section 3: Product Cards

- **Background:** `bg-ivory`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Overflow:** `overflow-hidden`
- **Position:** `relative`
- **Diamond deco:** positioned `left-[-3%] top-[15%]`, stroke `#E8C4B0`
- **Container:** `max-w-3xl mx-auto px-6 text-center relative z-10`
- **Components (top to bottom):**
  1. **Overline:** `font-body text-xs font-bold uppercase tracking-label text-gold mb-5`, text: "What You Get", class `reveal`
  2. **H2:** `font-display text-3xl md:text-4xl lg:text-5xl font-semibold text-charcoal leading-tight mb-4`, `letter-spacing: -0.02em`, class `reveal reveal-delay-1`
  3. **Subtext:** `font-body text-sm text-charcoal/55 mb-12`, class `reveal reveal-delay-2`
  4. **Product card stack:** `space-y-6 text-left max-w-2xl mx-auto`
     - **Product Card 1:**
       - Container: `product-card bg-white rounded-2xl p-6 md:p-8 border border-blush/30 relative`, `box-shadow: 0 8px 30px rgba(139,26,58,0.04)`, class `reveal`
       - Value badge: `absolute top-4 right-4 bg-gold/15 text-gold font-body font-bold text-xs px-3 py-1.5 rounded-full border border-gold/20`, text: "$79 Value"
       - H3: `font-display text-xl md:text-2xl font-semibold text-charcoal mb-3 pr-20`, text: "Mutual Funds, Finally Explained"
       - Description: `font-body text-sm text-charcoal/60 mb-5`
       - Ordered list: `<ol class="space-y-3 mb-4">`
         - Each item: `font-body text-sm text-charcoal/70 flex gap-3 items-start`
         - Number: `font-display text-lg font-bold text-burgundy/30 flex-shrink-0 w-5`
         - 4 items total
       - Closing italic: `font-display italic text-sm text-charcoal/45`
     - **Product Card 2:**
       - Identical structure to Card 1, class `reveal reveal-delay-1`
       - Value badge text: "$89 Value"
       - H3 text: "Retire Like a Queen"
       - 4 list items
       - Closing italic: "This is about freedom, not fantasy."
  5. **CTA button:** `mt-10`, class `reveal`
     - `cta-primary font-body font-bold text-sm uppercase tracking-button inline-block px-10 py-4 rounded-lg`
     - Text: "Upgrade Now for Just $27"
     - Note: NOT full width (no `w-full max-w-md`) -- just inline-block with padding

---

### Section 4: Value Stack (Dark)

- **Background:** `linear-gradient(135deg, #34161B 0%, #5C1128 50%, #8B1A3A 100%)` (inline style)
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Overflow:** `overflow-hidden`
- **Position:** `relative`
- **Has noise overlay:** Yes (`.noise-overlay`)
- **Diamond deco:** positioned `right-[5%] top-[10%]`, `opacity-[0.04]`, stroke `#F5E6D0`, `stroke-width="0.5"`
- **Container:** `max-w-2xl mx-auto px-6 text-center relative z-10`
- **Components (top to bottom):**
  1. **Overline:** `font-body text-xs font-bold uppercase tracking-label text-gold mb-5`, text: "Your Bundle", class `reveal`
  2. **H2:** `font-display text-2xl md:text-4xl font-semibold text-white leading-tight mb-10`, `letter-spacing: -0.02em`, class `reveal reveal-delay-1`
  3. **Value stack items:** `space-y-4 text-left mb-10`
     - **Item 1:** `bg-white/8 border border-champagne/10 rounded-2xl p-5 backdrop-blur-sm`, `box-shadow: 0 8px 30px rgba(0,0,0,0.1)`, class `reveal`
       - Title: `font-body text-base font-semibold text-white mb-1`, includes `<span class="text-gold font-normal">` for value
       - Description: `font-body text-sm text-champagne/60`
     - **Item 2:** Same structure, class `reveal reveal-delay-1`
  4. **Pricing summary:** `py-6 border-t border-b border-champagne/10 mb-8`, class `reveal reveal-delay-2`
     - Top label: `font-body text-[10px] font-bold uppercase tracking-label text-champagne/40 mb-2`
     - Price line: `font-display text-2xl md:text-3xl font-semibold text-white`
       - Old price: `line-through text-champagne/40` ("$168")
       - Arrow: `mx-2 text-champagne/30` (right arrow entity)
       - New price: `text-gold` ("$27")
     - Bottom note: `font-body text-xs text-champagne/40 mt-2`
  5. **Urgency label:** `font-body text-xs font-bold uppercase tracking-label text-burgundy-light mb-6`, class `reveal reveal-delay-2`
  6. **CTA + Decline:**
     - Class `reveal reveal-delay-3`
     - Button: `cta-gold font-body font-bold text-sm uppercase tracking-button inline-block w-full max-w-md px-10 py-4 rounded-lg`, text: "Yes! I Want the Bundle for $27"
     - Decline link: `decline-link font-body text-xs text-champagne/35 hover:text-champagne/55`, text: "No thanks, I'll skip the upgrade", wrapped in `mt-4` paragraph

---

### Section 5: Why This Matters

- **Background:** `bg-ivory`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Overflow:** `overflow-hidden`
- **Position:** `relative`
- **Diamond deco:** positioned `left-[5%] bottom-[10%]`, stroke `#E8C4B0`
- **Container:** `max-w-2xl mx-auto px-6 text-center relative z-10`
- **Components (top to bottom):**
  1. **Overline:** `font-body text-xs font-bold uppercase tracking-label text-gold mb-5`, text: "The Real Reason", class `reveal`
  2. **H2:** `font-display text-3xl md:text-4xl lg:text-5xl font-semibold text-charcoal leading-tight mb-6`, `letter-spacing: -0.02em`, class `reveal reveal-delay-1`
  3. **Gold divider:** `w-16 h-[2px] bg-gold mx-auto mb-8`, class `reveal reveal-delay-2`
  4. **Display italic quote:** `font-display text-lg md:text-xl italic text-charcoal/60 mb-10 max-w-lg mx-auto leading-relaxed`, class `reveal reveal-delay-2`
  5. **Benefits box:**
     - Container: `bg-champagne/40 rounded-2xl p-6 md:p-8 border border-blush/30 text-left max-w-md mx-auto mb-10`, `box-shadow: 0 8px 30px rgba(139,26,58,0.04)`, class `reveal`
     - Heading: `font-body text-sm font-semibold text-charcoal mb-4`, text: "This bundle helps you:"
     - List: `<ul class="space-y-3">`
       - Each item: `flex items-start gap-3`
       - Bullet marker: `w-2 h-2 rounded-sm bg-burgundy rotate-45 mt-1.5 flex-shrink-0`, `box-shadow: 0 1px 4px rgba(139,26,58,0.2)`
       - Text: `font-body text-sm text-charcoal/70`
       - 4 items total
  6. **Closing label:** `font-body text-xs font-bold uppercase tracking-label text-charcoal/40 mb-8`, class `reveal`
  7. **CTA button:** class `reveal`
     - `cta-primary font-body font-bold text-sm uppercase tracking-button inline-block w-full max-w-md px-10 py-4 rounded-lg`
     - Text: "Upgrade for Just $27"

---

### Sticky Mobile CTA

- **Element:** `<div class="sticky-cta" id="stickyCta">`
- **Position:** `fixed bottom-0 left-0 right-0 z-49`
- **Padding:** `12px 16px`, bottom: `max(12px, env(safe-area-inset-bottom))`
- **Background:** `rgba(250,245,238,0.92)` (ivory at 92% opacity)
- **Backdrop filter:** `blur(14px)` / `-webkit-backdrop-filter: blur(14px)`
- **Border:** `border-top: 1px solid rgba(232,196,176,0.4)` (blush at 40%)
- **Shadow:** `0 -4px 20px rgba(44,44,44,0.08)`
- **Hidden state:** `transform: translateY(100%)`
- **Visible state:** `.sticky-cta.show` -> `transform: translateY(0)`
- **Transition:** `transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)`
- **Responsive:** Hidden on `min-width: 768px` via `display: none`
- **CTA inside:** `cta-primary font-body font-bold text-sm uppercase tracking-button py-3.5 rounded-lg block text-center w-full`, href `#checkout`, text: "Upgrade for $27"
- **Show logic:** Appears after scrolling past 200px AND `#checkout` is not in viewport. Hides when checkout is visible or user is at top.

---

## Photo Placement Map

| Slot | Location | Current State | CSS Classes |
|------|----------|---------------|-------------|
| **Video embed** | Section 2, top | Placeholder (play button only) | `aspect-video bg-burgundy-darker/10 rounded-2xl` |

**Note:** This page has no photo/image slots. There are no author photos, product mockups, or hero images in the reference. All visual interest comes from typography, color gradients, decorative SVG diamonds, and card-based layout.

---

## Interactive Elements

### CTA Button Variants

#### `.cta-primary` (Burgundy)

```css
/* Rest */
background: #8B1A3A;
color: #fff;
box-shadow: 0 4px 15px rgba(139,26,58,0.25), 0 2px 6px rgba(139,26,58,0.15);
transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, opacity 0.3s ease;

/* Hover */
transform: translateY(-2px);
box-shadow: 0 8px 25px rgba(139,26,58,0.35), 0 4px 10px rgba(139,26,58,0.2);

/* Focus-visible */
outline: 2px solid #C9963A;
outline-offset: 3px;

/* Active */
transform: translateY(0);
opacity: 0.9;
```

Common classes applied: `font-body font-bold text-sm uppercase tracking-button`
Typical padding: `px-10 py-4 rounded-lg`
Full-width variant: `w-full max-w-md` (sections 2, 4, 5) or inline (section 3)

#### `.cta-gold` (Gold)

```css
/* Rest */
background: #C9963A;
color: #34161B;
box-shadow: 0 4px 15px rgba(201,150,58,0.3), 0 2px 6px rgba(201,150,58,0.15);
transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, opacity 0.3s ease;

/* Hover */
transform: translateY(-2px);
box-shadow: 0 8px 25px rgba(201,150,58,0.4), 0 4px 10px rgba(201,150,58,0.2);

/* Focus-visible */
outline: 2px solid #F5E6D0;
outline-offset: 3px;

/* Active */
transform: translateY(0);
opacity: 0.9;
```

Used in: Sticky top bar (smaller: `px-8 py-2.5 rounded text-xs`), Section 4 dark value stack (`px-10 py-4 rounded-lg text-sm`).

### Product Card Hover

```css
.product-card {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease;
}
.product-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 40px rgba(139,26,58,0.08), 0 4px 15px rgba(139,26,58,0.04);
}
```

### Decline Link

```css
.decline-link {
  transition: color 0.3s ease, opacity 0.3s ease;
}
.decline-link:hover {
  opacity: 0.8;
}
```

Light background variant: `text-charcoal/40 hover:text-charcoal/60`
Dark background variant: `text-champagne/35 hover:text-champagne/55`

### Video Play Button

```css
/* Container */
w-16 h-16 rounded-full bg-burgundy/80
box-shadow: 0 4px 20px rgba(139,26,58,0.3);
cursor: pointer;

/* Hover */
hover:bg-burgundy
transition-colors
```

### Countdown Timer

- **Start value:** 10 minutes (600 seconds)
- **Update interval:** 1000ms (every second)
- **Format:** MM:SS with zero-padding via `String(n).padStart(2, '0')`
- **Behavior:** Counts down to 0, then stops
- **Number font:** Cormorant Garamond, weight 600, size 2.5rem (2rem on mobile)
- **Label font:** 0.65rem, weight 600, tracking 0.12em, uppercase

### Progress Bar

- **Step states:**
  - Completed: `bg-burgundy` circle with white checkmark SVG, muted label text
  - Current: `bg-burgundy-light` circle with white number, bold label text
  - Pending: `bg-blush/40` circle with muted number, muted label text
- **Dividers between steps:**
  - After completed: `bg-burgundy/30`
  - After current: `bg-blush/50`
- **Circle size:** `w-6 h-6` (24px)
- **Divider size:** `w-8 md:w-16 h-px`

### Sticky Top CTA Bar Behavior

- **Show/hide logic:** Uses IntersectionObserver on `#checkout` element with threshold 0.1
- **When `#checkout` IS visible:** `transform: translateY(-100%)` (slides up/hides)
- **When `#checkout` is NOT visible:** `transform: translateY(0)` (visible)
- **Transition:** `transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease`

### Sticky Mobile CTA Behavior

- **Show condition:** `window.scrollY > 200` AND `#checkout` element is NOT in viewport
- **Hide condition:** At top of page (scrollY <= 200) OR `#checkout` is visible
- **Viewport check:** `getBoundingClientRect()` — visible if `top < window.innerHeight && bottom > 0`
- **Event listener:** `scroll` with `{ passive: true }`
- **CSS transition:** `transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)`

### Scrollbar Customization

```css
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #FAF5EE; }
::-webkit-scrollbar-thumb { background: #E8C4B0; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #C9963A; }
```

---

## Responsive Breakpoints

### Mobile (default / 375px)

- Sticky top bar: CTA is full-width (`w-full`), descriptive text hidden (`hidden md:block`)
- Progress bar: `gap-2`, dividers `w-8`, text `text-xs`
- H1: `text-3xl` (1.875rem)
- H2 (light): `text-3xl` (1.875rem)
- H2 (dark): `text-2xl` (1.5rem)
- Product card padding: `p-6`
- Countdown number: `2rem` (via media query `max-width: 767px`)
- Sticky mobile CTA: visible (slides up on scroll)
- Section padding: `py-12` (section 1), `py-14` (section 2), `py-20` (sections 3-5)
- Value stack pricing: `text-2xl`

### Tablet (md: 768px)

- Sticky top bar: shows descriptive text, CTA auto-width (`md:w-auto`)
- Progress bar: `gap-4`, dividers `w-16`, text `text-sm`
- H1: `text-5xl` (3rem)
- H2 (light): `text-4xl` (2.25rem)
- H2 (dark): `text-4xl` (2.25rem)
- Product card padding: `p-8`
- Countdown number: `2.5rem` (default)
- Sticky mobile CTA: hidden (`display: none`)
- Section padding: `py-16` (section 1), `py-20` (section 2), `py-28` (sections 3-5)
- Body text: `md:text-lg`
- Value stack pricing: `md:text-3xl`

### Desktop (lg: 1024px)

- H1: `lg:text-[3.5rem]` (3.5rem)
- H2 (light sections): `lg:text-5xl` (3rem)
- Section padding: sections 3-5 get `lg:py-36`
- No other significant layout changes -- single column throughout

---

## Animation System

### Reveal Animation

```css
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1),
              transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```

### Stagger Delays

```css
.reveal-delay-1 { transition-delay: 0.08s; }
.reveal-delay-2 { transition-delay: 0.16s; }
.reveal-delay-3 { transition-delay: 0.24s; }
```

### IntersectionObserver Config

```js
{
  threshold: 0.05,
  rootMargin: '0px 0px 80px 0px'  // triggers 80px before element enters viewport from bottom
}
```

Once an element becomes visible, it is unobserved (one-shot animation). A fallback `setTimeout` at 1500ms forces all unrevealed elements to become visible.

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

### Easing Curves Used

| Curve | Value | Usage |
|-------|-------|-------|
| **Reveal / slide** | `cubic-bezier(0.22, 1, 0.36, 1)` | Reveal animations, sticky bar transitions, product card hover, sticky CTA |
| **CTA bounce** | `cubic-bezier(0.34, 1.56, 0.64, 1)` | CTA button `transform` on hover (slight overshoot) |
| **Linear ease** | `ease` | Box-shadow transitions, opacity transitions |

### Only Animated Properties

- `transform` (translateY)
- `opacity`
- `box-shadow`
- `color` (decline link)
- `background-color` (play button via `transition-colors`)

No `transition-all` used anywhere.

---

## Container Max-widths Used

| Container | Max-width | Usage |
|-----------|-----------|-------|
| `max-w-4xl` | 56rem (896px) | Sticky top bar |
| `max-w-3xl` | 48rem (768px) | Sections 1, 2, 3 |
| `max-w-2xl` | 42rem (672px) | Progress bar, Sections 4, 5 |
| `max-w-xl` | 36rem (576px) | Display subheading in section 2 |
| `max-w-lg` | 32rem (512px) | Body text in section 2, italic quote in section 5 |
| `max-w-md` | 28rem (448px) | CTA button max-width, benefits box in section 5 |

---

## CTA Placement Summary

| Location | Variant | Text | href | Width | Notes |
|----------|---------|------|------|-------|-------|
| Sticky top bar | `cta-gold` | "Yes, I Want to Upgrade for $27" | `#checkout` | `w-full md:w-auto` | `text-xs px-8 py-2.5 rounded` |
| Section 2 (checkout) | `cta-primary` | "Yes, I Want to Upgrade for $27" | `#` | `w-full max-w-md` | Has decline link below |
| Section 3 (product cards) | `cta-primary` | "Upgrade Now for Just $27" | `#checkout` | inline (no w-full) | No decline link |
| Section 4 (value stack) | `cta-gold` | "Yes! I Want the Bundle for $27" | `#` | `w-full max-w-md` | Has decline link below |
| Section 5 (why this matters) | `cta-primary` | "Upgrade for Just $27" | `#` | `w-full max-w-md` | No decline link |
| Sticky mobile | `cta-primary` | "Upgrade for $27" | `#checkout` | `w-full block` | `py-3.5 rounded-lg` |

---

## Decline Links Summary

| Location | Text | Color |
|----------|------|-------|
| Section 2 | "No thanks, I'll attend the webinar without the VIP bundle" | `text-charcoal/40 hover:text-charcoal/60` |
| Section 4 | "No thanks, I'll skip the upgrade" | `text-champagne/35 hover:text-champagne/55` |
