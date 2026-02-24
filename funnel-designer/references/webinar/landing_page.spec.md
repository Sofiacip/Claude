# Landing Page Design Specification

## Page Overview
- **Page type:** Webinar registration landing page — captures name, email, phone via two registration forms (hero + final CTA)
- **Total number of sections:** 10 (Announcement Bar, Hero, Social Proof Stats, As Seen In, Pain Points, Bridge/Transition, What You'll Learn, About the Host, Testimonials, Final CTA, Footer Quote, Sticky Mobile CTA)
- **Has sticky CTA:** Yes (mobile only, `<768px`)
- **Has navigation:** No
- **Has countdown timer:** Yes (hero section, targets webinar date)
- **Has progress bar:** No

## Typography

### Fonts
- **Heading font:** Cormorant Garamond (serif) — `https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500;1,600&display=swap`
- **Body font:** Montserrat (sans-serif) — `https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap`
- **Tailwind config:** `fontFamily: { display: ['"Cormorant Garamond"', 'serif'], body: ['Montserrat', 'sans-serif'] }`

### Type Scale
- **H1:** `text-4xl md:text-6xl lg:text-7xl` (2.25rem / 3.75rem / 4.5rem) / `leading-tight` / `font-semibold` (600) / `text-charcoal` (#2C2C2C) / `letter-spacing: -0.02em`
- **H2:** `text-3xl md:text-4xl lg:text-5xl` (1.875rem / 2.25rem / 3rem) / `leading-tight` / `font-semibold` (600) / `text-charcoal` or `text-white` on dark sections / `letter-spacing: -0.02em`
- **H3 (sub-headline / section intro):** `text-xl md:text-2xl` (1.25rem / 1.5rem) / `font-medium` (500) / `text-charcoal/65` (`rgba(44,44,44,0.65)`)
- **Body:** `text-base md:text-[17px]` (1rem / 17px) / `leading-body` (1.7) / `text-charcoal` (#2C2C2C) or `text-charcoal/65` for secondary
- **Label/overline:** `text-xs` (0.75rem) or `text-[10px]` (10px) / `tracking-label` (0.12em) / `font-bold` (700) / `uppercase` / `text-gold` (#C9963A) or `text-charcoal/40`
- **Small/caption:** `text-[10px]` (10px) / `text-charcoal/35` or `text-champagne/30` on dark
- **Button text:** `text-sm` (0.875rem) / `font-bold` (700) / `uppercase` / `tracking-button` (0.1em)
- **Countdown number:** `font-family: 'Cormorant Garamond', serif` / `font-weight: 600` / `font-size: 2rem` (mobile: `1.5rem`) / `line-height: 1`
- **Countdown label:** `font-size: 0.65rem` / `letter-spacing: 0.12em` / `text-transform: uppercase` / `font-weight: 600`
- **Stat numbers:** `text-4xl md:text-5xl` (2.25rem / 3rem) / `font-semibold` / `text-charcoal` / `letter-spacing: -0.02em`

### Custom Line Heights (Tailwind config)
- `body`: 1.7
- `tight`: 0.9
- `snug`: 1.1

### Custom Letter Spacing (Tailwind config)
- `label`: 0.12em
- `button`: 0.1em

## Color System

### Tailwind Config Colors
```
--color-primary:         #8B1A3A  (burgundy.DEFAULT)
--color-primary-dark:    #5C1128  (burgundy.dark)
--color-primary-darker:  #34161B  (burgundy.darker)
--color-primary-light:   #A82050  (burgundy.light)
--color-accent:          #C9963A  (gold.DEFAULT)
--color-accent-light:    #D4AB5E  (gold.light)
--color-accent-faint:    rgba(201,150,58,0.15)  (gold.faint)
--color-bg-base:         #FAF5EE  (ivory)
--color-bg-alt:          #F5E6D0  (champagne)
--color-bg-warm:         #E8C4B0  (blush.DEFAULT)
--color-bg-warm-light:   #F5D8D0  (blush.light)
--color-bg-warm-lighter: #F8E8E0  (blush.lighter)
--color-text-primary:    #2C2C2C  (charcoal)
--color-text-muted:      rgba(44,44,44,0.65)  (text-charcoal/65 — used for secondary body text)
```

### Common Opacity Patterns
- `text-charcoal/80` — announcement bar text
- `text-charcoal/70` — sub-headlines on light bg
- `text-charcoal/65` — secondary body text on light bg
- `text-charcoal/55` — stat descriptions
- `text-charcoal/45` — countdown prefix label
- `text-charcoal/40` — "As Featured In" label
- `text-charcoal/35` — form disclaimer text
- `text-champagne/85` — primary body text on dark bg
- `text-champagne/80` — testimonial quote text
- `text-champagne/65` — secondary body text on dark bg
- `text-champagne/60` — footer quote text, final CTA label
- `text-champagne/50` — final CTA date text
- `text-champagne/40` — testimonial cite text
- `text-champagne/30` — countdown colon separators, dark form disclaimer, footer cite
- `text-white/10` — watermark text in final CTA
- `border-blush/30` — card borders on light bg
- `border-blush/20` — section dividers
- `border-champagne/10` — card borders on dark bg

## Shadow System

### Card Shadows
- **Shadow-elevated (stat/outcome cards):** `box-shadow: 0 8px 30px rgba(139,26,58,0.03)` (light bg) or `box-shadow: 0 8px 30px rgba(139,26,58,0.04)` (champagne bg)
- **Shadow-testimonial-card:** `box-shadow: 0 8px 30px rgba(0,0,0,0.1)` (dark bg)
- **Shadow-form-container:** `box-shadow: 0 20px 60px rgba(139,26,58,0.06), 0 8px 25px rgba(139,26,58,0.03)`

### Photo Shadows
- **Shadow-photo (hero host photo):** `box-shadow: 0 25px 60px rgba(139,26,58,0.12), 0 8px 24px rgba(139,26,58,0.08)`
- **Shadow-photo (about host photo):** `box-shadow: 0 25px 60px rgba(139,26,58,0.1), 0 8px 20px rgba(139,26,58,0.06)`

### CTA Button Shadows
- **Shadow-glow-primary (resting):** `box-shadow: 0 4px 15px rgba(139,26,58,0.25), 0 2px 6px rgba(139,26,58,0.15)`
- **Shadow-glow-primary (hover):** `box-shadow: 0 8px 25px rgba(139,26,58,0.35), 0 4px 10px rgba(139,26,58,0.2)`
- **Shadow-glow-gold (resting):** `box-shadow: 0 4px 15px rgba(201,150,58,0.3), 0 2px 6px rgba(201,150,58,0.15)`
- **Shadow-glow-gold (hover):** `box-shadow: 0 8px 25px rgba(201,150,58,0.4), 0 4px 10px rgba(201,150,58,0.2)`
- **Shadow-glow-light (resting):** `box-shadow: 0 4px 15px rgba(201,150,58,0.2), 0 2px 6px rgba(201,150,58,0.1)`
- **Shadow-glow-light (hover):** `box-shadow: 0 8px 25px rgba(201,150,58,0.3)`
- **Shadow-glow-secondary (hover):** `box-shadow: 0 8px 25px rgba(139,26,58,0.25)`

### Decorative Shadows
- **Diamond-icon:** `box-shadow: 0 2px 8px rgba(201,150,58,0.3)`
- **Diamond-deco (stat card):** `box-shadow: 0 2px 8px rgba(201,150,58,0.25)`
- **Sticky CTA bar:** `box-shadow: 0 -4px 20px rgba(44,44,44,0.08)`

## Section-by-Section Spec

---

### S0 — Announcement Bar
- **Background:** `bg-champagne/70` (`rgba(245,230,208,0.7)`)
- **Border:** `border-b border-blush/30` (`1px solid rgba(232,196,176,0.3)`)
- **Padding:** `py-3 px-4`
- **Max-width:** None (full bleed)
- **Layout:** Single centered line of text
- **Content:** `font-display text-sm md:text-base italic text-charcoal/80 leading-relaxed` — announcement text with responsive truncation (`hidden md:inline` for extended copy, `md:hidden` for ellipsis)
- **Photo slots:** None
- **CTA buttons:** None
- **Special behaviors:** Mobile truncates to shorter copy with ellipsis

---

### S1 — Hero
- **Background:** Custom `.hero-pattern` class:
  ```css
  background-color: #FAF5EE;
  background-image:
    radial-gradient(circle at 20% 50%, rgba(232,196,176,0.15) 0%, transparent 50%),
    radial-gradient(circle at 80% 30%, rgba(201,150,58,0.08) 0%, transparent 40%);
  ```
- **Noise overlay:** Yes (`.noise-overlay` class applied)
- **Padding:** `pt-14 pb-8 md:pt-24 md:pb-16` (on inner container)
- **Max-width:** `max-w-4xl mx-auto px-6` (inner content)
- **Layout:** Single column, centered
- **Section ID:** `id="top"`
- **Diamond decorations:**
  - SVG diamond: `right-[10%] top-[15%]`, stroke `#E8C4B0`, stroke-width `0.3`, 200x200px, opacity 0.08
  - SVG diamond: `left-[5%] bottom-[20%] opacity-[0.05]`, stroke `#C9963A`, stroke-width `0.4`

**Components (top to bottom):**
1. **Pre-headline label:** `text-xs font-bold uppercase tracking-label text-gold mb-6`
2. **H1 headline:** `font-display text-4xl md:text-6xl lg:text-7xl font-semibold text-center text-charcoal mb-6 leading-tight` / `letter-spacing: -0.02em` — contains `<br class="hidden md:block">` for desktop line break
3. **Gold divider:** `w-16 h-[2px] bg-gold mx-auto mb-6`
4. **Sub-headline:** `font-body text-base md:text-lg text-charcoal/70 text-center max-w-2xl mx-auto mb-12 leading-relaxed`
5. **Registration card** (inside `max-w-md mx-auto`):
   - Card container: `bg-white/60 rounded-2xl p-6 md:p-8 border border-blush/30 backdrop-blur-sm` / `box-shadow: 0 20px 60px rgba(139,26,58,0.06), 0 8px 25px rgba(139,26,58,0.03)`
   - Date line: `font-display text-lg md:text-xl font-semibold text-charcoal mb-1`
   - Time line: `font-display italic text-base text-charcoal/70`
   - Badge: `font-body text-xs font-bold uppercase tracking-label text-burgundy mt-2`
   - Countdown prefix: `text-[10px] font-bold uppercase tracking-label text-charcoal/45 mb-3`
   - Countdown pill: `inline-flex items-center justify-center w-full bg-burgundy-darker/90 backdrop-blur-sm rounded-full px-5 py-3 gap-4 md:gap-6 border border-champagne/10` — contains 4 number/label pairs with `:` separators in `text-champagne/30`
   - Form: 3 inputs (`form-input` class) + 1 submit button (`cta-primary` + `w-full py-4 rounded-lg`) — text "Save My Free Seat"
   - Disclaimer: `text-[10px] text-center text-charcoal/35 leading-relaxed`
6. **Host photo:** `mt-14`, container `rounded-2xl overflow-hidden w-72 md:w-96` / `box-shadow: 0 25px 60px rgba(139,26,58,0.12), 0 8px 24px rgba(139,26,58,0.08)` — gradient overlay `bg-gradient-to-t from-burgundy-darker/25 to-transparent`

- **Photo slots:** 1 — Host portrait, vertical orientation, 500x620px placeholder, rounded-2xl, layered shadow + gradient overlay
- **CTA buttons:** 1 — `cta-primary`, "Save My Free Seat", form submit
- **Special behaviors:** Countdown timer targets ISO date `2026-02-26T18:00:00-08:00`, updates every 1000ms

---

### S2 — Social Proof Stats
- **Background:** `bg-ivory` (#FAF5EE)
- **Padding:** `py-16 md:py-24`
- **Max-width:** `max-w-5xl mx-auto px-6`
- **Layout:** `grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4`

**Components:**
- 3 stat cards, each: `bg-champagne/30 rounded-2xl p-6 md:p-8 border border-blush/20` / `box-shadow: 0 8px 30px rgba(139,26,58,0.03)`
  - **Card 1:** Gold filled diamond (4x4, `bg-gold rotate-45`, shadow `0 2px 8px rgba(201,150,58,0.25)`) → stat `5,000+` → description
  - **Card 2:** Burgundy outline diamond (4x4, `border-2 border-burgundy rotate-45`) → stat `1,000,000+` → description
  - **Card 3:** Label `text-[10px] font-bold uppercase tracking-label text-gold` "Amazon Bestseller" → italic title `font-display text-xl md:text-2xl font-semibold italic text-charcoal` → description
- Stat number style: `font-display text-4xl md:text-5xl font-semibold text-charcoal mb-2` / `letter-spacing: -0.02em`
- Description style: `font-body text-sm text-charcoal/55 leading-relaxed max-w-[200px] mx-auto` (or max-w-[220px])

- **Photo slots:** None
- **CTA buttons:** None
- **Special behaviors:** Staggered reveal (delay-0, delay-1, delay-2)

---

### S3 — As Seen In (Logo Bar)
- **Background:** `bg-champagne/50` (`rgba(245,230,208,0.5)`)
- **Borders:** `border-t border-blush/20 border-b border-blush/20`
- **Padding:** `py-12 md:py-16`
- **Max-width:** `max-w-5xl mx-auto px-6`
- **Layout:** Centered, single row flex wrap

**Components:**
1. **Label:** `text-[10px] font-bold uppercase tracking-label text-charcoal/40 mb-8`
2. **Logo grid:** `flex flex-wrap justify-center items-center gap-8 md:gap-12` — 8 logo images
   - Logo treatment: `filter: grayscale(100%) brightness(0.6); opacity: 0.5; max-height: 32px; width: auto; object-fit: contain`
   - Logo hover: `opacity: 0.8; filter: grayscale(0%)`
   - Transition: `opacity 0.3s ease, filter 0.3s ease`

- **Photo slots:** 8 logo images (120x36, 100x36, 80x36 placeholder sizes) — GMA, Forbes, ABC, BBC, MSNBC, Newsweek, HuffPost, Yahoo
- **CTA buttons:** None
- **Special behaviors:** Grayscale by default, color on hover

---

### S4 — Pain Points (Dark Section)
- **Background:** `linear-gradient(135deg, #34161B 0%, #5C1128 50%, #8B1A3A 100%)`
- **Noise overlay:** Yes
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Max-width:** `max-w-3xl mx-auto px-6`
- **Layout:** Single column centered, pain point list left-aligned within `max-w-2xl mx-auto`
- **Diamond decoration:** SVG, `right-[5%] top-[10%] opacity-[0.04]`, stroke `#F5E6D0`, stroke-width `0.5`

**Components (top to bottom):**
1. **Label:** `text-xs font-bold uppercase tracking-label text-gold mb-5 text-center` — "Have you ever noticed..."
2. **H2:** `font-display text-3xl md:text-4xl lg:text-5xl font-semibold text-white text-center mb-8 leading-tight` / `letter-spacing: -0.02em`
3. **Gold divider:** `w-16 h-[2px] bg-gold mx-auto mb-10`
4. **Intro paragraphs:** `font-body text-base md:text-[17px] text-champagne/85 leading-body space-y-5 text-center`
   - Second paragraph: `text-champagne/65` (dimmer)
5. **Sub-label:** `text-xs font-bold uppercase tracking-label text-burgundy-light text-center mt-12 mb-8`
6. **Pain point cards** (5 items): `space-y-5 max-w-2xl mx-auto`
   - Each card: `flex gap-5 items-start`
   - Diamond bullet: `.diamond-icon` — `width: 14px; height: 14px; background: #C9963A; transform: rotate(45deg); flex-shrink: 0; margin-top: 5px; box-shadow: 0 2px 8px rgba(201,150,58,0.3)`
   - Title: `font-body text-base font-semibold text-white mb-1`
   - Description: `font-body text-sm text-champagne/65 leading-relaxed`

- **Photo slots:** None
- **CTA buttons:** None
- **Special behaviors:** Staggered reveal on pain point cards (delay-0 through delay-4)

---

### S5 — Bridge / Transition
- **Background:** `bg-ivory` (#FAF5EE)
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Max-width:** `max-w-2xl mx-auto px-6`
- **Layout:** Single column, centered text
- **Diamond decoration:** SVG, `left-[-3%] top-[15%]`, stroke `#E8C4B0`, stroke-width `0.3`

**Components (top to bottom):**
1. **Italic intro:** `font-display text-xl md:text-2xl italic text-charcoal/75 mb-8`
2. **Body paragraphs:** `font-body text-base md:text-[17px] text-charcoal/65 leading-body space-y-5 mb-12`
3. **Label:** `text-xs font-bold uppercase tracking-label text-gold mb-6`
4. **Statement block 1 (large):** `font-display text-3xl md:text-5xl font-bold text-charcoal leading-snug` — "YOU DO NOT HAVE TO STAY THERE." with `<span class="text-burgundy italic">NOT</span>`, `mb-6`
5. **Statement block 2 (medium):** `font-display text-2xl md:text-4xl font-bold text-charcoal/50 leading-snug` — "YOU WERE NEVER MEANT TO STAY SMALL." with `<span class="text-burgundy italic">NEVER</span>`, `mb-12`
6. **Gold divider:** `w-16 h-[2px] bg-gold mx-auto mb-10`
7. **Body paragraph:** `font-body text-base md:text-[17px] text-charcoal/65 leading-body mb-10 max-w-xl mx-auto`
8. **CTA button**

- **Photo slots:** None
- **CTA buttons:** 1 — `cta-primary`, `px-10 py-4 rounded inline-block`, "Save Your Free Spot Now", `href="#register"`
- **Special behaviors:** Staggered reveal throughout

---

### S6 — What You'll Learn (Outcomes Grid)
- **Background:** `bg-champagne` (#F5E6D0)
- **Noise overlay:** Yes
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Max-width:** `max-w-4xl mx-auto px-6`
- **Layout:** Header centered, then `grid md:grid-cols-2 gap-6`
- **Diamond decoration:** SVG, `right-[8%] top-[5%]`, stroke `#C9963A`, stroke-width `0.3`

**Components (top to bottom):**
1. **Label:** `text-xs font-bold uppercase tracking-label text-gold mb-5`
2. **H2:** `font-display text-3xl md:text-4xl lg:text-5xl font-semibold text-charcoal leading-tight mb-4` / `letter-spacing: -0.02em`
3. **Sub-headline:** `font-display text-xl md:text-2xl font-medium text-charcoal/65`
4. **Outcome cards** (5 cards in 2-col grid):
   - Card style: `bg-ivory/80 rounded-2xl p-6 md:p-8 border border-blush/30` / `box-shadow: 0 8px 30px rgba(139,26,58,0.04)`
   - Number badge: `w-10 h-10 rounded-full bg-burgundy/10 flex items-center justify-center mb-4` → `text-burgundy font-display text-lg font-bold`
   - Title: `font-body text-base font-semibold text-charcoal mb-2`
   - Description: `font-body text-sm text-charcoal/65 leading-body`
   - Card 5 (solo): `md:col-span-2 md:max-w-md md:mx-auto` (centered at bottom)
5. **Credibility callout:** `mt-14 bg-ivory/60 rounded-2xl p-6 md:p-8 border border-blush/30 text-center` / `box-shadow: 0 8px 30px rgba(139,26,58,0.04)`
   - Quote: `font-display text-lg md:text-xl font-semibold text-burgundy italic leading-snug mb-4`
   - Description: `font-body text-sm text-charcoal/60 leading-relaxed max-w-xl mx-auto`
6. **CTA button:** `mt-10`, centered

- **Photo slots:** None
- **CTA buttons:** 1 — `cta-primary`, `px-10 py-4 rounded inline-block`, "Save Your Free Spot Now", `href="#register"`
- **Special behaviors:** Card 5 spans full width on desktop and centers itself

---

### S7 — About the Host
- **Background:** `bg-ivory` (#FAF5EE)
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Max-width:** `max-w-6xl mx-auto px-6`
- **Layout:** `grid md:grid-cols-2 gap-12 lg:gap-20 items-center` — photo left, bio right
- **Diamond decoration:** SVG, `left-[3%] top-[10%]`, stroke `#E8C4B0`, stroke-width `0.3`

**Components:**
- **Left column (Photo):**
  - Container: `rounded-2xl overflow-hidden border border-blush/30` / `box-shadow: 0 25px 60px rgba(139,26,58,0.1), 0 8px 20px rgba(139,26,58,0.06)`
  - Image: `w-full h-auto`, 500x660px placeholder
  - Overlay: `absolute inset-0 bg-gradient-to-t from-burgundy-darker/20 to-transparent mix-blend-multiply`

- **Right column (Bio):**
  1. **Label:** `text-xs font-bold uppercase tracking-label text-gold mb-5` — "About the Host & Speaker"
  2. **Tagline:** `font-display text-lg md:text-xl italic text-charcoal/65 mb-6` — role descriptions separated by `::`
  3. **Bio paragraphs:** `font-body text-base md:text-[17px] text-charcoal leading-body space-y-5` — 3 paragraphs
     - Third paragraph: `text-burgundy font-medium` (accent colored)

- **Photo slots:** 1 — Host portrait, vertical orientation, 500x660px, rounded-2xl, border, dual-layer shadow, gradient overlay with mix-blend-multiply
- **CTA buttons:** None
- **Special behaviors:** 2-col grid collapses to stacked on mobile (photo on top, bio below)

---

### S8 — Testimonials (Dark Section)
- **Background:** `linear-gradient(180deg, #34161B 0%, #3D1A22 100%)`
- **Noise overlay:** Yes
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Max-width:** `max-w-4xl mx-auto px-6`
- **Layout:** Header centered, then `grid grid-cols-1 md:grid-cols-3 gap-6`
- **Diamond decoration:** SVG, `left-[8%] bottom-[10%] opacity-[0.04]`, stroke `#F5E6D0`, stroke-width `0.5`

**Components:**
1. **Label:** `text-xs font-bold uppercase tracking-label text-gold mb-5 text-center`
2. **H2:** `font-display text-3xl md:text-4xl lg:text-5xl font-semibold text-white text-center mb-14 leading-tight` / `letter-spacing: -0.02em` — contains `<br class="hidden md:block">`
3. **Testimonial cards** (3 cards):
   - Card style: `bg-white/5 border border-champagne/10 rounded-2xl p-6 backdrop-blur-sm` / `box-shadow: 0 8px 30px rgba(0,0,0,0.1)`
   - Stars: `text-gold text-sm` — 5 unicode stars (&#9733;)
   - Quote: `font-body text-sm text-champagne/80 leading-relaxed italic mb-4` — wrapped in `<blockquote>`
   - Citation: `font-body text-xs text-champagne/40 not-italic` — wrapped in `<cite>`

- **Photo slots:** None
- **CTA buttons:** None
- **Special behaviors:** Staggered reveal on cards (delay-0, delay-1, delay-2)

---

### S9 — Final CTA (Dark Section)
- **Background:** `linear-gradient(135deg, #5C1128 0%, #8B1A3A 60%, #A82050 100%)`
- **Noise overlay:** Yes
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Max-width:** `max-w-lg mx-auto px-6`
- **Layout:** Single column, centered
- **Section ID:** `id="register"` (anchor target for all CTA links)
- **Diamond decoration:** SVG, `right-[10%] top-[8%] opacity-[0.04]`, stroke `#F5E6D0`, stroke-width `0.5`

**Components (top to bottom):**
1. **Watermark text:** `font-display text-4xl md:text-6xl font-bold text-white/10 leading-none` — "STOP" + "SECOND-GUESSING" (two lines, very faint)
2. **H2:** `font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4` / `letter-spacing: -0.02em`
3. **Gold divider:** `w-16 h-[2px] bg-gold mx-auto mb-6`
4. **Label:** `text-xs font-bold uppercase tracking-label text-champagne/60 mb-1`
5. **Date line:** `text-sm text-champagne/50 mb-8`
6. **Registration form:** `space-y-3 mb-4 max-w-md mx-auto`
   - 3 inputs: `form-input form-input-dark`
   - Submit: `cta-gold font-body font-bold text-sm uppercase tracking-button w-full py-4 rounded-lg` — "Save My Free Seat"
7. **Disclaimer:** `text-[10px] text-champagne/30 leading-relaxed max-w-sm mx-auto`

- **Photo slots:** None
- **CTA buttons:** 1 — `cta-gold`, "Save My Free Seat", form submit (gold button variant on dark bg)
- **Special behaviors:** This is the scroll target for all `href="#register"` links and the section that hides the sticky CTA when visible

---

### S10 — Footer Quote
- **Element:** `<footer>`
- **Background:** `linear-gradient(180deg, #34161B 0%, #2A1015 100%)`
- **Noise overlay:** Yes
- **Padding:** `py-16 md:py-20`
- **Max-width:** `max-w-3xl mx-auto px-6`
- **Layout:** Single column, centered

**Components:**
1. **Gold divider:** `w-12 h-[2px] bg-gold mx-auto mb-8` (note: 12 wide, not 16)
2. **Blockquote:** `font-display text-lg md:text-xl italic text-champagne/60 leading-relaxed mb-4` — contains `<span class="text-white font-semibold not-italic">` for emphasis
3. **Citation:** `font-body text-xs font-bold uppercase tracking-label text-champagne/30 not-italic`

- **Photo slots:** None
- **CTA buttons:** None
- **Special behaviors:** None

---

## Photo Placement Map

| # | Section | Description | Orientation | Placeholder Size | Treatment |
|---|---------|-------------|-------------|-----------------|-----------|
| 1 | S1 Hero | Host photo below registration form | Vertical (portrait) | 500x620 | `rounded-2xl`, `box-shadow: 0 25px 60px rgba(139,26,58,0.12), 0 8px 24px rgba(139,26,58,0.08)`, gradient overlay `bg-gradient-to-t from-burgundy-darker/25 to-transparent`, container `w-72 md:w-96` |
| 2 | S7 About | Host bio photo, left column | Vertical (portrait) | 500x660 | `rounded-2xl`, `border border-blush/30`, `box-shadow: 0 25px 60px rgba(139,26,58,0.1), 0 8px 20px rgba(139,26,58,0.06)`, gradient overlay `bg-gradient-to-t from-burgundy-darker/20 to-transparent mix-blend-multiply` |

**Logo images (S3):** 8 media logos at various widths x 36px height — GMA (120x36), Forbes (100x36), ABC (80x36), BBC (80x36), MSNBC (100x36), Newsweek (120x36), HuffPost (110x36), Yahoo (100x36). Treatment: grayscale + dimmed by default, color on hover.

## Interactive Elements

### CTA Primary (`.cta-primary`)
```css
/* Resting */
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
- Typography: `font-body font-bold text-sm uppercase tracking-button`
- Border-radius: `rounded` (4px) for inline links, `rounded-lg` (8px) for full-width form buttons
- Sizing: `px-10 py-4` for inline, `w-full py-4` for full-width

### CTA Secondary (`.cta-secondary`)
```css
/* Resting */
background: transparent;
color: #8B1A3A;
border: 2px solid #8B1A3A;
transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease, color 0.3s ease, box-shadow 0.3s ease;

/* Hover */
background: #8B1A3A;
color: #fff;
transform: translateY(-2px);
box-shadow: 0 8px 25px rgba(139,26,58,0.25);

/* Focus-visible */
outline: 2px solid #C9963A;
outline-offset: 3px;

/* Active */
transform: translateY(0);
```

### CTA Gold (`.cta-gold`)
```css
/* Resting */
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

### CTA Light (`.cta-light`)
```css
/* Resting */
background: #F5E6D0;
color: #8B1A3A;
box-shadow: 0 4px 15px rgba(201,150,58,0.2), 0 2px 6px rgba(201,150,58,0.1);
transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, opacity 0.3s ease;

/* Hover */
transform: translateY(-2px);
box-shadow: 0 8px 25px rgba(201,150,58,0.3);

/* Focus-visible */
outline: 2px solid #C9963A;
outline-offset: 3px;

/* Active */
transform: translateY(0);
opacity: 0.9;
```

### Form Inputs (`.form-input`)
```css
/* Resting */
width: 100%;
padding: 14px 20px;
border: 1px solid rgba(232,196,176,0.5);
background: rgba(255,255,255,0.7);
border-radius: 6px;
font-family: 'Montserrat', sans-serif;
font-size: 14px;
color: #2C2C2C;
transition: border-color 0.3s ease, box-shadow 0.3s ease;

/* Focus */
outline: none;
border-color: #8B1A3A;
box-shadow: 0 0 0 3px rgba(139,26,58,0.08);

/* Placeholder */
color: #2C2C2C;
opacity: 0.4;
```

### Form Inputs Dark (`.form-input-dark`)
```css
/* Resting (extends .form-input) */
border-color: rgba(245,230,208,0.2);
background: rgba(255,255,255,0.08);
color: #F5E6D0;

/* Focus */
border-color: rgba(245,230,208,0.5);
box-shadow: 0 0 0 3px rgba(245,230,208,0.08);

/* Placeholder */
color: #F5E6D0;
opacity: 0.4;
```

### Sticky Mobile CTA (`.sticky-cta`)
```css
/* Container */
position: fixed;
bottom: 0;
left: 0;
right: 0;
z-index: 49;
padding: 12px 16px;
padding-bottom: max(12px, env(safe-area-inset-bottom));
background: rgba(250,245,238,0.92);
backdrop-filter: blur(14px);
-webkit-backdrop-filter: blur(14px);
border-top: 1px solid rgba(232,196,176,0.4);
box-shadow: 0 -4px 20px rgba(44,44,44,0.08);

/* Hidden state (default) */
transform: translateY(100%);
transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);

/* Visible state (.show) */
transform: translateY(0);

/* Desktop: hidden entirely */
@media (min-width: 768px) { display: none; }
```
- **Show condition:** Hero bottom scrolls above viewport AND final CTA (`#register`) is NOT visible
- **Hide condition:** User is in hero area OR final CTA section is in viewport
- **Button inside:** `cta-primary font-body font-bold text-sm uppercase tracking-button py-3.5 rounded-lg block text-center w-full` — "Save My Free Seat", `href="#register"`

### Logo Hover
```css
/* Resting */
filter: grayscale(100%) brightness(0.6);
opacity: 0.5;
max-height: 32px;
width: auto;
object-fit: contain;
transition: opacity 0.3s ease, filter 0.3s ease;

/* Hover */
opacity: 0.8;
filter: grayscale(0%);
```

### Custom Scrollbar
```css
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #FAF5EE; }
::-webkit-scrollbar-thumb { background: #E8C4B0; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #C9963A; }
```

## Responsive Breakpoints

### Mobile (default, < 768px)
- All grids collapse to single column (`grid-cols-1`)
- H1: `text-4xl` (2.25rem)
- H2: `text-3xl` (1.875rem)
- Hero host photo: `w-72` (288px)
- Countdown numbers: `font-size: 1.5rem`
- Countdown pill gaps: `gap-4`
- Registration card padding: `p-6`
- Section padding: `py-16` to `py-20`
- Sticky CTA visible (below hero, above final CTA)
- Announcement bar truncates with ellipsis (`.md:hidden` span shown)
- About section: photo stacks above bio
- Stats: stacked vertical with `gap-8`

### Tablet (768px, `md:`)
- Stats grid: `md:grid-cols-3 gap-4`
- Testimonials grid: `md:grid-cols-3`
- Outcomes grid: `md:grid-cols-2`
- About host grid: `md:grid-cols-2 gap-12`
- H1: `md:text-6xl` (3.75rem)
- H2: `md:text-4xl` (2.25rem)
- Hero host photo: `md:w-96` (384px)
- Countdown pill gaps: `md:gap-6`
- Registration card padding: `md:p-8`
- Section padding: `md:py-24` to `md:py-28`
- Sticky CTA: `display: none`
- Announcement bar shows full text (`hidden md:inline` revealed)
- Line breaks in headlines: `hidden md:block` becomes visible

### Desktop (1280px, `lg:`)
- H1: `lg:text-7xl` (4.5rem)
- H2: `lg:text-5xl` (3rem)
- About host grid: `lg:gap-20`
- Section padding: `lg:py-36`
- No additional layout changes beyond `md:` breakpoint

## Animation System

### Reveal Animation (`.reveal`)
```css
/* Initial state */
opacity: 0;
transform: translateY(24px);
transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);

/* Visible state (.visible) */
opacity: 1;
transform: translateY(0);
```

### Stagger Delays
- `.reveal-delay-1`: `transition-delay: 0.08s`
- `.reveal-delay-2`: `transition-delay: 0.16s`
- `.reveal-delay-3`: `transition-delay: 0.24s`
- `.reveal-delay-4`: `transition-delay: 0.32s`

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
}
```

### IntersectionObserver Config
```js
{ threshold: 0.05, rootMargin: '0px 0px 80px 0px' }
```
- Elements are observed once, then unobserved after becoming visible
- Fallback: all `.reveal:not(.visible)` elements get `.visible` class after 1500ms (screenshot compatibility)

### Countdown Timer
- **Target:** ISO 8601 format `2026-02-26T18:00:00-08:00` (Feb 26, 2026 at 6 PM PST)
- **Update interval:** `setInterval(update, 1000)` (every 1 second)
- **Display format:** `DD : HH : MM : SS` (zero-padded with `String().padStart(2, '0')`)
- **Floor behavior:** `Math.max(0, target - now)` — never shows negative values

## Decorative Elements

### Noise Overlay (`.noise-overlay::after`)
```css
content: '';
position: absolute;
inset: 0;
opacity: 0.03;
background-image: url("data:image/svg+xml,..."); /* SVG feTurbulence noise */
background-size: 128px 128px;
pointer-events: none;
z-index: 1;
```
Applied to: S1 Hero, S4 Pain Points, S6 What You'll Learn, S8 Testimonials, S9 Final CTA, S10 Footer

### Diamond SVG Decorations (`.diamond-deco`)
```css
position: absolute;
width: 200px;
height: 200px;
opacity: 0.08; /* default, overridden per-instance */
pointer-events: none;
```
- Shape: `<polygon points="50,0 100,50 50,100 0,50" fill="none">` (diamond/rhombus outline)
- Light bg strokes: `#E8C4B0` (blush) or `#C9963A` (gold), stroke-width `0.3` or `0.4`
- Dark bg strokes: `#F5E6D0` (champagne), stroke-width `0.5`, opacity `0.04`

### Gold Dividers
- Standard: `w-16 h-[2px] bg-gold mx-auto` (64px wide, 2px tall)
- Footer variant: `w-12 h-[2px] bg-gold mx-auto` (48px wide, 2px tall)

### Diamond Bullets
- **Pain point variant (`.diamond-icon`):** 14x14px, `background: #C9963A`, `transform: rotate(45deg)`, `margin-top: 5px`, `box-shadow: 0 2px 8px rgba(201,150,58,0.3)`
- **Stat card variant:** 16x16px (`w-4 h-4`), `bg-gold rotate-45` (filled) or `border-2 border-burgundy rotate-45` (outlined)
- **Check list variant (`.check-list li::before`):** 8x8px, `background: #C9963A`, `transform: rotate(45deg)`, `margin-top: 6px`

## Global Styles
```css
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  font-family: 'Montserrat', sans-serif;
  color: #2C2C2C;
  background: #FAF5EE;
  -webkit-font-smoothing: antialiased;
}
```
