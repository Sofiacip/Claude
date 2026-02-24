# Thank You Page — Design Specification

Extracted from: `references/webinar/thank_you_page.html`

---

## Page Overview

- **Page type:** `thank_you_page` — Post-registration confirmation page that confirms sign-up, provides webinar date/time, and prompts three follow-up actions.
- **Total number of sections:** 2 (Hero/Confirmation + Action Cards)
- **Has sticky CTA:** No
- **Has navigation:** No
- **Has countdown timer:** No
- **Has progress bar:** No

---

## Typography

### Fonts
- **Heading font:** Cormorant Garamond (serif) — `https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500;1,600&display=swap`
- **Body font:** Montserrat (sans-serif) — `https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap`

### Tailwind Config Aliases
- `font-display` = `"Cormorant Garamond", serif`
- `font-body` = `Montserrat, sans-serif`

### Heading Scales
| Element | Size (mobile) | Size (md) | Size (lg) | Weight | Line-height | Color | Letter-spacing |
|---------|---------------|-----------|-----------|--------|-------------|-------|----------------|
| H1 (hero) | `text-3xl` (1.875rem / 30px) | `text-5xl` (3rem / 48px) | `text-[3.5rem]` (56px) | `font-semibold` (600) | `leading-tight` (1.25) | `text-charcoal` (#2C2C2C) | `-0.02em` (inline style) |
| H2 (card titles) | `text-lg` (1.125rem / 18px) | `text-xl` (1.25rem / 20px) | — | `font-semibold` (600) | default | `text-charcoal` (#2C2C2C) | default |

### Body Text Scales
| Role | Size | Weight | Color | Line-height |
|------|------|--------|-------|-------------|
| Hero subtitle | `text-base` (16px) / md: `text-lg` (18px) | 400 | `text-charcoal/65` (rgba(44,44,44,0.65)) | `leading-relaxed` (1.625) |
| Card body | `text-sm` (14px) | 400 | `text-charcoal/55` (rgba(44,44,44,0.55)) | default (1.5) |
| Card detail lines | `text-sm` (14px) | 400 | `text-charcoal/65` (rgba(44,44,44,0.65)) | default |
| Card fine print | `text-xs` (12px) | 400 | `text-charcoal/45` (rgba(44,44,44,0.45)) | default |
| Lightest fine print | `text-xs` (12px) | 400 | `text-charcoal/35` (rgba(44,44,44,0.35)) | default |
| Buddy note (card 3) | `text-xs` (12px) | 400 | `text-charcoal/40` (rgba(44,44,44,0.40)) | default |
| Email notice body | `text-sm` (14px) | 400 | `text-charcoal/65` (rgba(44,44,44,0.65)) | default |
| Email notice "Important:" | `text-sm` (14px) | `font-semibold` (600) | `text-charcoal` (#2C2C2C) | default |

### Label / Overline
| Role | Size | Weight | Tracking | Transform | Color |
|------|------|--------|----------|-----------|-------|
| Hero overline | `text-xs` (12px) | `font-bold` (700) | `tracking-label` (0.12em) | `uppercase` | `text-burgundy-light` (#A82050) |

### Button Text
| Role | Size | Weight | Tracking | Transform |
|------|------|--------|----------|-----------|
| CTA buttons | `text-xs` (12px) | `font-bold` (700) | `tracking-button` (0.1em) | `uppercase` |
| Hero secondary CTA | `text-sm` (14px) | `font-bold` (700) | `tracking-button` (0.1em) | `uppercase` |

### Italic / Display Accent
- Quoted email subject uses `font-display italic text-charcoal/65` — Cormorant Garamond italic at rgba(44,44,44,0.65).

---

## Color System

### Tailwind Config Extended Colors
```
burgundy:
  DEFAULT: #8B1A3A
  dark:    #5C1128
  darker:  #34161B
  light:   #A82050

gold:
  DEFAULT: #C9963A
  light:   #D4AB5E
  faint:   rgba(201,150,58,0.15)

champagne: #F5E6D0
blush:
  DEFAULT: #E8C4B0
  light:   #F5D8D0
  lighter: #F8E8E0

ivory:   #FAF5EE
charcoal: #2C2C2C
```

### Semantic Color Usage
| Role | Value |
|------|-------|
| Page background | `#FAF5EE` (ivory) |
| Body text | `#2C2C2C` (charcoal) |
| Primary accent | `#8B1A3A` (burgundy) |
| Secondary accent | `#C9963A` (gold) |
| Overline text | `#A82050` (burgundy-light) |
| Hero section bg | `champagne/50` — `rgba(245,230,208,0.5)` |
| Card background | `#FFFFFF` (white) |
| Card border | `blush/30` — `rgba(232,196,176,0.3)` |
| Email notice bg | `ivory/80` — `rgba(250,245,238,0.8)` |
| Email notice border | `blush/30` — `rgba(232,196,176,0.3)` |
| Icon circle bg | `champagne/60` — `rgba(245,230,208,0.6)` |
| Icon color | `#8B1A3A` (burgundy) |
| Divider line | `#C9963A` (gold) |
| Diamond decorations | `#C9963A` (gold, hero) and `#E8C4B0` (blush, cards section) |
| Bullet diamonds | `#8B1A3A` (burgundy) |
| Scrollbar track | `#FAF5EE` (ivory) |
| Scrollbar thumb | `#E8C4B0` (blush) |
| Scrollbar thumb hover | `#C9963A` (gold) |

### Opacity Usage
| Opacity | Usage |
|---------|-------|
| `/65` | Hero subtitle text, card detail text |
| `/60` | Card list items (card 3) |
| `/55` | Card body text |
| `/50` | Hero section bg (champagne/50) |
| `/45` | Card fine print |
| `/40` | Buddy note text (card 3) |
| `/35` | Lightest fine print |
| `/30` | Card borders (blush/30), email notice border |
| `/80` | Email notice bg (ivory/80) |
| `0.08` | Diamond decoration SVGs |
| `0.03` | Noise overlay |

---

## Shadow System

| Shadow Name / Role | Value |
|--------------------|-------|
| CTA primary (resting) | `0 4px 15px rgba(139,26,58,0.25), 0 2px 6px rgba(139,26,58,0.15)` |
| CTA primary (hover) | `0 8px 25px rgba(139,26,58,0.35), 0 4px 10px rgba(139,26,58,0.2)` |
| CTA secondary (hover) | `0 8px 25px rgba(139,26,58,0.25)` |
| Action card (resting) | `0 8px 30px rgba(139,26,58,0.04)` (inline style) |
| Action card (hover) | `0 12px 40px rgba(139,26,58,0.06), 0 4px 15px rgba(139,26,58,0.03)` |
| Email notice box | `0 8px 30px rgba(139,26,58,0.04)` (inline style) |
| Icon circle | `0 4px 12px rgba(201,150,58,0.1)` (inline style — gold-tinted) |
| Bullet diamond (card 3) | `0 1px 4px rgba(139,26,58,0.2)` (inline style) |

---

## Section-by-Section Spec

### Section 1: Hero / Confirmation

**Purpose:** Confirms registration, shows webinar title, prompts user to check email, provides webinar link.

**Background:** `bg-champagne/50` — rgba(245,230,208,0.5) with noise overlay.

**Noise overlay:** Pseudo-element `::after` with SVG fractalNoise (baseFrequency 0.85, 4 octaves), `opacity: 0.03`, `background-size: 128px 128px`, pointer-events none, z-index 1.

**Padding:** `py-16` (64px mobile) / `md:py-24` (96px tablet+)

**Container:** `max-w-3xl` (48rem / 768px) `mx-auto px-6` (24px horizontal padding), `text-center`, `relative z-10`

**Overflow:** `overflow-hidden`

**Diamond decoration:** SVG at `right-[10%] top-[15%]`, 200x200px, stroke `#C9963A`, stroke-width 0.3, opacity 0.08, positioned absolute.

**Components (in order):**

1. **Overline label**
   - Text: "Thank you for signing up for the free webinar"
   - Classes: `font-body text-xs font-bold uppercase tracking-label text-burgundy-light mb-6`
   - Reveal: `.reveal`

2. **H1 heading**
   - Text: "No Romance Without Finance: The Truth About Money, Power, and Modern Dating"
   - Classes: `font-display text-3xl md:text-5xl lg:text-[3.5rem] font-semibold text-charcoal leading-tight mb-6`
   - Inline style: `letter-spacing: -0.02em`
   - `<br class="hidden md:block">` after colon — line break on md+ only
   - Reveal: `.reveal .reveal-delay-1`

3. **Gold divider**
   - Dimensions: `w-16 h-[2px]` (64px wide, 2px tall)
   - Color: `bg-gold` (#C9963A)
   - Centered: `mx-auto`, `mb-6`
   - Reveal: `.reveal .reveal-delay-2`

4. **Subtitle paragraph**
   - Classes: `font-body text-base md:text-lg text-charcoal/65 max-w-2xl mx-auto leading-relaxed mb-8`
   - Max width: `max-w-2xl` (42rem / 672px)
   - Reveal: `.reveal .reveal-delay-2`

5. **Email notice card**
   - Container: `bg-ivory/80 border border-blush/30 rounded-2xl p-5 max-w-xl mx-auto mb-8`
   - Max width: `max-w-xl` (36rem / 576px)
   - Padding: `p-5` (20px)
   - Border radius: `rounded-2xl` (16px)
   - Shadow: `0 8px 30px rgba(139,26,58,0.04)` (inline)
   - Inner text: `font-body text-sm text-charcoal/65`
   - "Important:" span: `font-semibold text-charcoal`
   - Reveal: `.reveal .reveal-delay-3`

6. **Secondary CTA button**
   - Text: "Your Webinar Link"
   - Link: `href="#"`
   - Classes: `cta-secondary font-body font-bold text-sm uppercase tracking-button px-10 py-4 rounded inline-block`
   - Padding: `px-10` (40px) `py-4` (16px)
   - Border radius: `rounded` (4px)
   - Reveal: `.reveal .reveal-delay-3`

---

### Section 2: Action Cards

**Purpose:** Three instruction cards guiding user to (1) save webinar date, (2) whitelist emails, (3) invite a friend.

**Background:** `bg-ivory` (#FAF5EE)

**Padding:** `py-16 md:py-24 lg:py-32` (64px / 96px / 128px)

**Overflow:** `overflow-hidden`

**Container:** `max-w-2xl` (42rem / 672px) `mx-auto px-6`, `space-y-6` (24px vertical gap between cards)

**Diamond decoration:** SVG at `left-[-3%] top-[20%]`, 200x200px, stroke `#E8C4B0`, stroke-width 0.3, opacity 0.08, positioned absolute.

**Card shared structure:**
- Outer: `.action-card bg-white rounded-2xl p-6 md:p-8 border border-blush/30`
- Border radius: `rounded-2xl` (16px)
- Padding: `p-6` (24px) / `md:p-8` (32px)
- Border: `1px solid rgba(232,196,176,0.3)`
- Shadow: `0 8px 30px rgba(139,26,58,0.04)` (inline)
- Inner layout: `flex items-start gap-5 md:gap-6`

**Icon circle (shared across all cards):**
- Size: `w-12 h-12` (48px)
- Shape: `rounded-full` (50% border-radius)
- Background: `bg-champagne/60` — rgba(245,230,208,0.6)
- Shadow: `0 4px 12px rgba(201,150,58,0.1)` (inline)
- Flex: `flex items-center justify-center flex-shrink-0`
- Icon SVG: `w-5 h-5 text-burgundy`, stroke-width 1.5, fill none

#### Card 1: Save the Date
- **Reveal:** `.reveal` (no delay)
- **Icon:** Calendar SVG (24x24 viewBox, stroke-linecap/join round)
- **Title (H2):** "Save the Webinar Date on Your Calendar"
  - Classes: `font-display text-lg md:text-xl font-semibold text-charcoal mb-3`
- **Body text:** "This webinar will be LIVE..." — `font-body text-sm text-charcoal/55 mb-4`
  - "LIVE" emphasized: `font-semibold text-charcoal`
- **Date/time details:**
  - Container: `space-y-1 mb-4`
  - Date line: `font-body text-sm text-charcoal/65`
  - Labels "Date:" / "Time:": `text-burgundy font-semibold`
  - Values: "Thursday, February 26, 2026" / "6 PM PST / 9 PM EST"
- **Fine print:** `font-body text-xs text-charcoal/45 mb-5`
- **CTA (primary):** "Add Webinar to Your Calendar"
  - Classes: `cta-primary font-body font-bold text-xs uppercase tracking-button px-6 py-3 rounded inline-block`
  - Padding: `px-6` (24px) `py-3` (12px)
  - Border radius: `rounded` (4px)

#### Card 2: Don't Miss Emails
- **Reveal:** `.reveal .reveal-delay-1`
- **Icon:** Envelope SVG
- **Title (H2):** "Make Sure You Don't Miss Our Emails"
  - Same classes as Card 1 title
- **Body text:** Add contact email instruction — `font-body text-sm text-charcoal/55 mb-4`
  - Email: `hello@pattieehsaei.com` — emphasized with `font-semibold text-charcoal`
- **Confirmation email prompt:** `font-body text-sm text-charcoal/55 mb-3`
  - Email subject quoted in: `font-display italic text-charcoal/65`
- **Gmail instructions intro:** `font-body text-xs text-charcoal/45 mb-2`
- **Gmail bullet list:**
  - Container: `<ul class="space-y-1 mb-2">`
  - Each `<li>`: `font-body text-xs text-charcoal/45 flex items-start gap-2`
  - Bullet: `w-1.5 h-1.5 rounded-sm bg-burgundy rotate-45 mt-1 flex-shrink-0` (tiny diamond, 6x6px)
  - "Primary" tab emphasized: `font-semibold`
- **Final note:** `font-body text-xs text-charcoal/35`
- **No CTA button on this card.**

#### Card 3: Invite a Friend
- **Reveal:** `.reveal .reveal-delay-2`
- **Icon:** Users/people SVG
- **Title (H2):** "Invite a Friend to Join You for Free"
  - Same classes as Card 1 title
- **Body text:** `font-body text-sm text-charcoal/55 mb-4`
- **Bullet list:**
  - Container: `<ul class="space-y-2 mb-5">`
  - Each `<li>`: `font-body text-sm text-charcoal/60 flex items-start gap-3`
  - Bullet: `w-2 h-2 rounded-sm bg-burgundy rotate-45 mt-1.5 flex-shrink-0` (larger diamond, 8x8px)
  - Bullet shadow: `0 1px 4px rgba(139,26,58,0.2)` (inline)
  - Items: "Feels unsure about money or independence" / "Is navigating relationships or career decisions" / "Wants to build real financial confidence"
- **Buddy note:** `font-body text-xs text-charcoal/40 mb-5`
- **CTA (secondary):** "Invite a Friend Now"
  - Classes: `cta-secondary font-body font-bold text-xs uppercase tracking-button px-6 py-3 rounded inline-block`
  - Padding: `px-6` (24px) `py-3` (12px)
  - Border radius: `rounded` (4px)

---

## Photo Placement Map

**No photo slots on this page.** The thank you page contains no images, author photos, or background images. All visual decoration is achieved through SVG diamond shapes and CSS noise texture.

---

## Interactive Elements

### CTA Primary Button (`.cta-primary`)
```css
/* Resting state */
background: #8B1A3A;
color: #fff;
box-shadow: 0 4px 15px rgba(139,26,58,0.25), 0 2px 6px rgba(139,26,58,0.15);
transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
            box-shadow 0.3s ease,
            opacity 0.3s ease;

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
- Used on: Card 1 ("Add Webinar to Your Calendar")
- Padding variants: `px-6 py-3` (24px / 12px)
- Text: `font-body font-bold text-xs uppercase tracking-button`

### CTA Secondary Button (`.cta-secondary`)
```css
/* Resting state */
background: transparent;
color: #8B1A3A;
border: 2px solid #8B1A3A;
transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
            background 0.3s ease,
            color 0.3s ease,
            box-shadow 0.3s ease;

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
- Used on: Hero ("Your Webinar Link") with `px-10 py-4 text-sm`
- Used on: Card 3 ("Invite a Friend Now") with `px-6 py-3 text-xs`

### Action Cards (`.action-card`)
```css
/* Resting state */
transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 0.3s ease;

/* Hover */
transform: translateY(-2px);
box-shadow: 0 12px 40px rgba(139,26,58,0.06), 0 4px 15px rgba(139,26,58,0.03);
```

### Custom Scrollbar
```css
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #FAF5EE; }
::-webkit-scrollbar-thumb { background: #E8C4B0; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #C9963A; }
```

---

## Responsive Breakpoints

### Mobile (default, < 768px)
- H1: `text-3xl` (30px)
- H2: `text-lg` (18px)
- Hero subtitle: `text-base` (16px)
- Hero padding: `py-16` (64px)
- Cards padding: `p-6` (24px)
- Card gap: `gap-5` (20px)
- Cards section padding: `py-16` (64px)
- H1 `<br>` is `hidden` — title flows naturally

### Tablet (md: 768px+)
- H1: `text-5xl` (48px)
- H2: `text-xl` (20px)
- Hero subtitle: `text-lg` (18px)
- Hero padding: `md:py-24` (96px)
- Cards padding: `md:p-8` (32px)
- Card gap: `md:gap-6` (24px)
- Cards section padding: `md:py-24` (96px)
- H1 `<br class="hidden md:block">` visible — forces line break after colon

### Desktop (lg: 1024px+)
- H1: `text-[3.5rem]` (56px)
- Cards section padding: `lg:py-32` (128px)
- All other values same as tablet

### Container Max Widths
| Context | Max Width |
|---------|-----------|
| Hero container | `max-w-3xl` (48rem / 768px) |
| Hero subtitle | `max-w-2xl` (42rem / 672px) |
| Email notice box | `max-w-xl` (36rem / 576px) |
| Action cards container | `max-w-2xl` (42rem / 672px) |

---

## Animation System

### Reveal Animation
```css
/* Initial state */
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1),
              transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

/* Visible state (triggered by IntersectionObserver) */
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```

### Stagger Delay Classes
| Class | Delay |
|-------|-------|
| `.reveal-delay-1` | `0.08s` |
| `.reveal-delay-2` | `0.16s` |
| `.reveal-delay-3` | `0.24s` |

### Easing Curves
| Usage | Curve |
|-------|-------|
| Reveal animation | `cubic-bezier(0.22, 1, 0.36, 1)` — ease-out expo-like |
| CTA button transform | `cubic-bezier(0.34, 1.56, 0.64, 1)` — spring overshoot |
| CTA button other props | `ease` (0.25, 0.1, 0.25, 1) |
| Action card hover | `cubic-bezier(0.22, 1, 0.36, 1)` — ease-out expo-like |

### IntersectionObserver Configuration
```javascript
{
  threshold: 0.05,        // Triggers when 5% of element is visible
  rootMargin: '0px 0px 80px 0px'  // 80px bottom margin — triggers slightly before entering viewport
}
```

### Fallback Behavior
- After 1500ms, all `.reveal` elements that haven't yet received `.visible` are force-revealed via `setTimeout`.
- `@media (prefers-reduced-motion: reduce)`: `.reveal` has `opacity: 1; transform: none; transition: none;` — no animation at all.

### Reveal Assignments by Element
| Section | Element | Reveal Classes |
|---------|---------|---------------|
| Hero | Overline label | `.reveal` |
| Hero | H1 heading | `.reveal .reveal-delay-1` |
| Hero | Gold divider | `.reveal .reveal-delay-2` |
| Hero | Subtitle paragraph | `.reveal .reveal-delay-2` |
| Hero | Email notice card | `.reveal .reveal-delay-3` |
| Hero | Secondary CTA | `.reveal .reveal-delay-3` |
| Cards | Card 1 (Save Date) | `.reveal` |
| Cards | Card 2 (Emails) | `.reveal .reveal-delay-1` |
| Cards | Card 3 (Invite) | `.reveal .reveal-delay-2` |

---

## Decorative Elements

### Diamond SVGs (`.diamond-deco`)
```css
.diamond-deco {
  position: absolute;
  width: 200px;
  height: 200px;
  opacity: 0.08;
  pointer-events: none;
}
```
SVG shape: `<polygon points="50,0 100,50 50,100 0,50">` — rotated square (diamond), `fill="none"`, `stroke-width="0.3"`.

| Section | Position | Stroke Color |
|---------|----------|-------------|
| Hero | `right-[10%] top-[15%]` | `#C9963A` (gold) |
| Action Cards | `left-[-3%] top-[20%]` | `#E8C4B0` (blush) |

### Noise Overlay (`.noise-overlay::after`)
```css
content: '';
position: absolute;
inset: 0;
opacity: 0.03;
background-image: url("data:image/svg+xml,..."); /* SVG fractalNoise filter */
background-size: 128px 128px;
pointer-events: none;
z-index: 1;
```
Applied only to Section 1 (Hero/Confirmation).

### Bullet Diamonds
- **Card 2 (small):** `w-1.5 h-1.5` (6px) `rounded-sm bg-burgundy rotate-45 mt-1`, no shadow
- **Card 3 (large):** `w-2 h-2` (8px) `rounded-sm bg-burgundy rotate-45 mt-1.5`, shadow: `0 1px 4px rgba(139,26,58,0.2)`

### Gold Divider (Hero)
- `w-16 h-[2px]` — 64px wide, 2px tall
- `bg-gold` (#C9963A)
- Centered with `mx-auto`

---

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
