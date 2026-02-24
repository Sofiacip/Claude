# Sales Page Design Specification

## Page Overview
- **Page type:** `sales_page` -- long-form sales page for course enrollment with value stack, curriculum, testimonials, guarantee, and pricing
- **Total number of sections:** 13 (Sticky Top Bar, Countdown Strip, Hero, Pain Points, Root Cause/Conditioning, Program Introduction, Meet Your Coach, Testimonials, Curriculum/What's Inside, Week-by-Week Curriculum, Bonuses, Guarantee, Pricing/Value Stack, FAQ, Final CTA) -- 15 distinct content blocks including sticky elements
- **Has sticky CTA:** yes (top bar with countdown + mobile bottom bar)
- **Has navigation:** no
- **Has countdown timer:** yes (dual display -- inline in sticky top bar + standalone strip below top bar)
- **Has progress bar:** no

---

## Typography

### Fonts
- **Heading font:** Cormorant Garamond (Google Fonts: `https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500;1,600`)
  - Tailwind alias: `font-display`
  - Family stack: `"Cormorant Garamond", serif`
- **Body font:** Montserrat (Google Fonts: `https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800`)
  - Tailwind alias: `font-body`
  - Family stack: `Montserrat, sans-serif`

### Heading Sizes
- **H1:** `text-4xl` (2.25rem/36px) / md:`text-5xl` (3rem/48px) / lg:`text-[3.75rem]` (60px) / `leading-snug` (1.1) / `font-semibold` (600) / `text-charcoal` (#2C2C2C) / `letter-spacing: -0.02em`
- **H2 (large variant):** `text-3xl` (1.875rem/30px) / md:`text-5xl` (3rem/48px) / `font-semibold` (600) / `leading-snug` (1.1) / `tracking-tight` (-0.025em)
  - Light bg: `text-charcoal` (#2C2C2C)
  - Dark bg: `text-champagne` (#F5E6D0)
- **H2 (medium variant):** `text-3xl` (1.875rem/30px) / md:`text-4xl` (2.25rem/36px) / lg:`text-[2.75rem]` (44px) or lg:`text-[2.8rem]` (44.8px) / `font-semibold` (600) / `leading-snug` (1.1) / `tracking-tight`
- **H2 (small/card variant):** `text-2xl` (1.5rem/24px) / md:`text-3xl` (1.875rem/30px) / `font-semibold` (600) / `tracking-tight`
- **H2 (subheading in card):** `text-lg` (1.125rem/18px) / md:`text-xl` (1.25rem/20px) / `font-semibold` (600) / `uppercase` / `tracking-wide` / inline style `letter-spacing: 0.08em` / `text-charcoal/50`
- **H3 (module card):** `text-lg` (1.125rem/18px) / `font-semibold` (600) / `text-charcoal` (#2C2C2C) / font-display

### Body Text
- **Body (standard):** `text-sm` (0.875rem/14px) / `leading-body` (1.7) / light bg: `text-charcoal/55` or `text-charcoal/50` or `text-charcoal/45` / dark bg: `text-champagne/65` or `text-blush/45` or `text-blush/50`
- **Body (large):** `text-base` (1rem/16px) / md:`text-lg` (1.125rem/18px) / `leading-body` (1.7) / `text-charcoal/55`
- **Subhead (italic):** `text-base` (1rem/16px) / md:`text-lg` (1.125rem/18px) / font-display / italic / `text-charcoal/65`

### Label / Overline
- **Overline (gold):** `text-xs` (0.75rem/12px) / `font-bold` (700) / `uppercase` / `tracking-label` (0.12em) / `text-gold` (#C9963A)
- **Overline (dark bg):** `text-xs` / `font-bold` / `uppercase` / `tracking-label` (0.12em) / `text-champagne/35`

### Small / Caption
- **Caption:** `text-xs` (0.75rem/12px) / `text-champagne/30` or `text-charcoal/40`
- **Countdown label:** `font-size: 0.65rem` (10.4px) / `letter-spacing: 0.12em` / `text-transform: uppercase` / `font-weight: 600`

### Price Display
- **Main price:** font-display / `text-5xl` (3rem/48px) / md:`text-6xl` (3.75rem/60px) / `font-semibold` (600) / `text-champagne` (#F5E6D0) / `letter-spacing: -0.02em`
- **Payment plan:** font-body / `text-sm` (14px) / `text-champagne/45` with `text-gold font-bold` for the amount
- **Struck-through total value:** font-body / `text-xs` (12px) / `text-champagne/35` / `line-through`
- **Bonus value tags:** font-body / `text-xs` (12px) / `text-burgundy` (#8B1A3A) / `font-bold`

### Countdown Numbers
- **Standalone strip:** `font-family: 'Cormorant Garamond', serif` / `font-weight: 600` / `font-size: 2rem` (32px) / `line-height: 1` / `text-charcoal`
- **Mobile strip override:** `font-size: 1.5rem` (24px) at max-width 767px
- **Sticky top bar:** font-display / `font-semibold` / `text-base` (16px) / md:`text-lg` (18px) / `text-champagne/80`

---

## Color System

### Primary Family (Burgundy)
| Token | Value | Usage |
|---|---|---|
| `burgundy.DEFAULT` | `#8B1A3A` | CTA primary bg, diamond markers, outline focus rings |
| `burgundy.dark` | `#5C1128` | Dark gradient mid-stop |
| `burgundy.darker` | `#34161B` | Dark gradient start, sticky top bar bg, photo overlay |
| `burgundy.light` | `#A82050` | (Available but not used inline in this page) |

### Accent Family (Gold)
| Token | Value | Usage |
|---|---|---|
| `gold.DEFAULT` | `#C9963A` | CTA gold bg, overline labels, diamond accents, countdown nums, scrollbar hover, focus ring |
| `gold.light` | `#D4AB5E` | (Available in config, not directly used) |
| `gold.faint` | `rgba(201,150,58,0.15)` | Bonus number badge bg (`bg-gold/15`) |

### Neutrals
| Token | Value | Usage |
|---|---|---|
| `ivory` | `#FAF5EE` | Page background, module card bg, light section bg, sticky mobile bg |
| `champagne` | `#F5E6D0` | CTA light bg, hero gradient stop, card bg tint, text on dark bg |
| `blush.DEFAULT` | `#E8C4B0` | Diamond stroke, border color, scrollbar thumb |
| `blush.light` | `#F5D8D0` | Hero gradient end stop, gradient section start |
| `blush.lighter` | `#F8E8E0` | Root cause section gradient end, curriculum gradient mid |
| `charcoal` | `#2C2C2C` | Body text on light bg |

### Opacity Patterns (Dark Sections)
- Text hierarchy on dark bg: `text-champagne` (100%) > `text-champagne/75` > `text-champagne/65` > `text-champagne/55` > `text-champagne/45` > `text-champagne/40` > `text-champagne/35` > `text-champagne/30`
- Text hierarchy on dark bg (blush): `text-blush/50` > `text-blush/45`
- Border on dark: `border-champagne/10`, `border-champagne/8`
- Card bg on dark: `bg-white/5`

### Opacity Patterns (Light Sections)
- Text hierarchy on light bg: `text-charcoal` (100%) > `text-charcoal/65` > `text-charcoal/60` > `text-charcoal/55` > `text-charcoal/50` > `text-charcoal/45` > `text-charcoal/40` > `text-charcoal/30`
- Borders on light: `border-blush/25`, `border-blush/20`, `border-blush/15`
- Card tint bg: `bg-champagne/30`, `bg-champagne/20`, `bg-champagne/15`

---

## Shadow System

| Name | CSS Value | Usage |
|---|---|---|
| CTA primary resting | `0 4px 15px rgba(139,26,58,0.25), 0 2px 6px rgba(139,26,58,0.15)` | `.cta-primary` default |
| CTA primary hover | `0 8px 25px rgba(139,26,58,0.35), 0 4px 10px rgba(139,26,58,0.2)` | `.cta-primary:hover` |
| CTA gold resting | `0 4px 15px rgba(201,150,58,0.3), 0 2px 6px rgba(201,150,58,0.2)` | `.cta-gold` default |
| CTA gold hover | `0 8px 25px rgba(201,150,58,0.4), 0 4px 10px rgba(201,150,58,0.25)` | `.cta-gold:hover` |
| CTA light resting | `0 4px 15px rgba(201,150,58,0.2), 0 2px 6px rgba(201,150,58,0.1)` | `.cta-light` default |
| CTA light hover | `0 8px 25px rgba(201,150,58,0.3)` | `.cta-light:hover` (single layer) |
| Module card resting | `0 8px 30px rgba(139,26,58,0.04), 0 2px 8px rgba(139,26,58,0.02)` | `.module-card` inline style, bonus cards, accordion items |
| Module card hover | `0 12px 30px rgba(139,26,58,0.08), 0 4px 12px rgba(139,26,58,0.04)` | `.module-card:hover` |
| Light card (subtle) | `0 4px 15px rgba(139,26,58,0.03)` | Accordion triggers, program intro numbered items |
| Coach photo | `0 25px 60px rgba(139,26,58,0.12), 0 8px 24px rgba(139,26,58,0.08)` | Photo container |
| Testimonial card | `0 8px 30px rgba(0,0,0,0.12)` | Dark bg testimonial cards |
| Guarantee card | `0 20px 60px rgba(139,26,58,0.06), 0 8px 25px rgba(139,26,58,0.03)` | Guarantee section card |
| Pricing card | `0 20px 60px rgba(0,0,0,0.2), 0 8px 25px rgba(0,0,0,0.1)` | Value stack card on dark bg |
| Root cause card | `0 8px 30px rgba(139,26,58,0.04), 0 2px 8px rgba(139,26,58,0.02)` | Conditioning list card |
| Diamond accent (gold) | `0 2px 8px rgba(201,150,58,0.3)` | Gold diamond bullet markers |
| Diamond accent (burg) | `0 2px 8px rgba(139,26,58,0.2)` | Burgundy diamond markers in module cards |
| Sticky mobile CTA | `0 -4px 20px rgba(44,44,44,0.08)` | Bottom sticky bar |

---

## Section-by-Section Spec

### Section 0: Sticky Top CTA Bar
- **Element:** `<div id="sticky-top">`
- **Position:** `fixed top-0 left-0 right-0 z-50`
- **Background:** `rgba(52,22,27,0.95)` (burgundy-darker at 95% opacity)
- **Backdrop filter:** `blur(12px)`
- **Padding:** `py-3 px-4`
- **Container:** `max-w-5xl mx-auto`
- **Layout:** flex row, `items-center justify-between gap-4`
- **Left:** Urgency text -- `text-xs text-champagne/60` -- hidden on mobile (`hidden md:block`)
- **Right:** flex row with countdown (HH:MM:SS with `:` separators in `text-champagne/30`) + CTA gold button
- **Countdown numbers:** font-display / `font-semibold` / `text-base` md:`text-lg` / `text-champagne/80`
- **CTA:** `.cta-gold` / `text-xs uppercase tracking-button` / `px-6 py-2.5 rounded-lg` / text: "Enrol Now" / href: `#pricing`
- **Show/hide:** IntersectionObserver on `#pricing` section -- `transform: translateY(-100%)` when pricing visible, `translateY(0)` otherwise
- **Transition:** `transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)`
- **Mobile:** Countdown and CTA center-aligned (`flex-1 justify-center`), text hidden
- **Desktop:** CTA right-aligned (`md:flex-none md:justify-end`)

### Section 1: Countdown Timer Strip
- **Element:** `<section>`
- **Background:** `bg-ivory` (#FAF5EE)
- **Border:** `border-b border-blush/20`
- **Padding:** `pt-16` (clears sticky top bar) + inner `py-5 px-4`
- **Container:** `max-w-lg mx-auto text-center`
- **Overline:** "Your Special Offer Ends In" -- `text-xs font-bold uppercase tracking-label text-gold mb-4`
- **Countdown layout:** flex row, `justify-center gap-6 md:gap-8`
- **Each unit:** text-center with `.countdown-num` (2rem/1.5rem mobile) `text-charcoal` + `.countdown-label` (0.65rem) `text-charcoal/40 mt-1` uppercase
- **IDs:** `cd-d`, `cd-h`, `cd-m`, `cd-s`
- **Diamond decorations:** none

### Section 2: Hero
- **Background:** `linear-gradient(180deg, #FAF5EE 0%, #F5E6D0 60%, #F5D8D0 100%)` + `.noise-overlay`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Container:** `max-w-3xl mx-auto px-6 text-center relative z-10`
- **Overflow:** hidden
- **Diamond decorations:**
  1. `right-[8%] top-[12%]` -- stroke `#E8C4B0` width `0.3` -- default opacity 0.08
  2. `left-[5%] bottom-[10%]` -- stroke `#C9963A` width `0.4` -- `opacity-[0.05]`
- **Components:**
  - Subtext: `text-xs md:text-sm text-charcoal/45 leading-relaxed mb-5` -- line break hidden on mobile (`hidden md:block`)
  - H1: (see Typography H1 spec)
  - Body: `text-base md:text-lg text-charcoal/55 max-w-2xl mx-auto leading-body mb-10`
  - CTA: `.cta-primary` / `text-sm uppercase tracking-button px-12 py-4 rounded-lg inline-block` / text: "Join Now" / href: `#pricing`
- **Reveal stagger:** subtext (0), H1 (delay-1), body (delay-2), CTA (delay-3)

### Section 3: Pain Points (Dark)
- **Background:** `linear-gradient(135deg, #34161B 0%, #5C1128 50%, #8B1A3A 100%)` + `.noise-overlay`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Container:** `max-w-4xl mx-auto px-6` with `relative z-10`
- **Overflow:** hidden
- **Diamond decorations:**
  1. `right-[5%] top-[8%]` -- stroke `#E8C4B0` width `0.25`
  2. `left-[8%] bottom-[12%]` -- stroke `#C9963A` width `0.3` -- `opacity-[0.04]`
- **Components:**
  - Overline: "Have you ever noticed..." -- `text-xs font-bold uppercase tracking-label text-champagne/35 text-center mb-4`
  - H2: `text-3xl md:text-4xl lg:text-[2.8rem] font-semibold text-center text-champagne leading-snug tracking-tight mb-6`
  - Subtext: `text-sm text-blush/50 text-center max-w-2xl mx-auto mb-12 leading-body`
  - Label: "Tell me if any of this feels familiar:" -- `text-xs font-bold uppercase tracking-label text-gold text-center mb-8`
  - Pain points list: `space-y-5 max-w-2xl mx-auto`
    - Each item: `flex gap-5 items-start`
    - Diamond bullet: `w-3.5 h-3.5 bg-gold/80 rotate-45 flex-shrink-0 mt-1.5` + shadow `0 2px 8px rgba(201,150,58,0.3)`
    - Title: font-display / `font-semibold text-base text-champagne mb-1`
    - Desc: font-body / `text-sm text-blush/45`
  - 5 pain points total
- **Reveal stagger:** overline (0), H2 (delay-1), subtext+label (delay-2), items (delay-1 through delay-4, last two share delay-4)

### Section 4: Root Cause / Conditioning
- **Background:** `linear-gradient(180deg, #FAF5EE 0%, #F8E8E0 100%)` + `.noise-overlay`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Container:** `max-w-2xl mx-auto px-6 text-center relative z-10`
- **Overflow:** hidden
- **Diamond decorations:**
  1. `right-[12%] top-[15%]` -- stroke `#E8C4B0` width `0.3`
- **Components:**
  - Opening body: `text-sm text-charcoal/50 mb-5 leading-body`
  - Statement: font-display / `text-xl md:text-2xl font-semibold text-charcoal mb-10 leading-snug`
  - Card: `bg-champagne/30 rounded-2xl p-8 md:p-10 border border-blush/20 mb-10` + shadow `0 8px 30px rgba(139,26,58,0.04), 0 2px 8px rgba(139,26,58,0.02)`
    - Card H2: font-display / `text-lg md:text-xl font-semibold text-charcoal/50 uppercase tracking-wide` + inline `letter-spacing: 0.08em` / `mb-6`
    - Card body: `text-sm text-charcoal/50 leading-body mb-8`
    - Bullet list: `space-y-4 text-left max-w-md mx-auto`
      - Each: `flex items-start gap-4`
      - Diamond: `w-3 h-3 bg-gold rotate-45 flex-shrink-0 mt-1.5` + shadow `0 2px 8px rgba(201,150,58,0.3)`
      - Text: `text-sm text-charcoal/60`
    - 5 bullet items
  - Closing statement: font-display / `text-xl font-semibold text-charcoal mb-3`
  - Closing italic: font-display / `italic text-lg text-charcoal/55`

### Section 5: Program Introduction
- **Background:** `bg-ivory` + `border-t border-blush/15`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Container:** `max-w-3xl mx-auto px-6 text-center relative z-10`
- **Overflow:** hidden
- **Diamond decorations:**
  1. `left-[3%] top-[20%]` -- stroke `#C9963A` width `0.35` -- `opacity-[0.05]`
- **Components:**
  - Overline: "Introducing" -- `text-xs font-bold uppercase tracking-label text-gold mb-5`
  - H2: `text-3xl md:text-5xl lg:text-[3.25rem] font-semibold text-charcoal leading-snug mb-6` + `letter-spacing: -0.02em` -- line break `hidden md:block`
  - Body: `text-sm text-charcoal/50 max-w-xl mx-auto leading-body mb-12`
  - Numbered grid: `grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-12 text-left`
    - Each card: `flex gap-5 items-start bg-champagne/20 rounded-xl p-5 border border-blush/15` + shadow `0 4px 15px rgba(139,26,58,0.03)`
    - Number: font-display / `font-semibold text-3xl text-gold/60 leading-none flex-shrink-0`
    - Text: `text-sm text-charcoal/60 leading-relaxed`
    - 4 items (01-04)
  - CTA: `.cta-primary` / `text-sm uppercase tracking-button px-12 py-4 rounded-lg inline-block` / text: "Join Now" / href: `#pricing`

### Section 6: Meet Your Coach
- **Background:** `linear-gradient(180deg, #F5D8D0 0%, #F8E8E0 50%, #FAF5EE 100%)` + `.noise-overlay`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Container:** `max-w-5xl mx-auto px-6 relative z-10`
- **Overflow:** hidden
- **Diamond decorations:**
  1. `right-[6%] bottom-[15%]` -- stroke `#8B1A3A` width `0.3` -- `opacity-[0.06]`
- **Layout:** `grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center`
- **Left column (photo):**
  - Container: `relative w-72 md:w-96 rounded-2xl overflow-hidden` + shadow `0 25px 60px rgba(139,26,58,0.12), 0 8px 24px rgba(139,26,58,0.08)`
  - Image: `w-full aspect-[3/4] object-cover` -- placeholder `500x660`
  - Overlay: `absolute inset-0 bg-gradient-to-t from-burgundy-darker/25 to-transparent`
- **Right column (bio):**
  - Overline: "Meet Your Coach" -- `text-xs font-bold uppercase tracking-label text-gold mb-3`
  - Subtitle: font-display / `italic text-base md:text-lg text-charcoal/65 mb-6 leading-relaxed`
  - Bio paragraphs (3): `text-sm text-charcoal/55 leading-body mb-4` (last has no mb)
- **Photo slot:** 1 coach photo, portrait 3:4 ratio, 500x660px placeholder

### Section 7: Testimonials (Dark)
- **Background:** `linear-gradient(135deg, #34161B 0%, #5C1128 50%, #8B1A3A 100%)` + `.noise-overlay`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Container:** `max-w-4xl mx-auto px-6` with `relative z-10`
- **Overflow:** hidden
- **Diamond decorations:**
  1. `left-[4%] top-[10%]` -- stroke `#E8C4B0` width `0.25`
  2. `right-[8%] bottom-[8%]` -- stroke `#C9963A` width `0.3` -- `opacity-[0.04]`
- **Components:**
  - Overline: "What people are saying..." -- `text-xs font-bold uppercase tracking-label text-champagne/35 text-center mb-4`
  - H2: `text-3xl md:text-5xl font-semibold text-center text-champagne leading-snug tracking-tight mb-14`
  - Card grid: `grid grid-cols-1 md:grid-cols-3 gap-6`
    - Each card: `bg-white/5 border border-champagne/10 rounded-2xl p-7` + shadow `0 8px 30px rgba(0,0,0,0.12)`
    - Quote icon: `w-8 h-8 mb-4` container with `w-5 h-5 text-gold/50` SVG quotation mark
    - Quote text: `text-sm text-champagne/65 italic mb-5 leading-body`
    - Attribution: `text-xs text-champagne/30 font-medium`
  - 3 testimonial cards

### Section 8: Curriculum / What's Inside
- **Background:** `bg-ivory` + `border-t border-blush/15`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Container:** `max-w-3xl mx-auto px-6 relative z-10`
- **Overflow:** hidden
- **Diamond decorations:**
  1. `right-[4%] top-[8%]` -- stroke `#C9963A` width `0.3` -- `opacity-[0.05]`
- **Header:** centered, `mb-14`
  - Overline: "Everything You Get" -- gold standard
  - H2: `text-3xl md:text-4xl lg:text-[2.75rem] font-semibold text-charcoal leading-snug tracking-tight`
  - Subtext: `text-sm text-charcoal/50 max-w-xl mx-auto mt-4 leading-body`
- **Module cards:** `space-y-6` -- 5 cards total
  - Each: `.module-card bg-ivory p-6 md:p-8` + inline shadow `0 8px 30px rgba(139,26,58,0.04), 0 2px 8px rgba(139,26,58,0.02)`
  - Card header: `flex items-center gap-3 mb-4`
    - Diamond: `w-3.5 h-3.5 bg-burgundy rotate-45 flex-shrink-0` + shadow `0 2px 8px rgba(139,26,58,0.2)`
    - H3: font-display / `font-semibold text-lg text-charcoal`
  - Description: `text-sm text-charcoal/45 mb-5 leading-body`
  - Sub-items: `space-y-3 pl-7`
    - Each: `flex gap-3 items-start`
    - Mini diamond: `w-1.5 h-1.5 bg-gold rotate-45 flex-shrink-0 mt-2`
    - Text: `text-sm text-charcoal/55`
    - 3 sub-items per card
- **CTA:** `.cta-primary` / same spec as hero / text: "Join Now" / href: `#pricing` / centered, `mt-12`

### Section 9: Week-by-Week Curriculum (Accordion)
- **Background:** `linear-gradient(180deg, #F5D8D0 0%, #F8E8E0 50%, #FAF5EE 100%)` + `.noise-overlay`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Container:** `max-w-3xl mx-auto px-6 relative z-10`
- **Header:** centered, `mb-14`
  - Overline: "Week by Week" -- gold standard
  - H2: `text-3xl md:text-4xl font-semibold text-charcoal leading-snug tracking-tight`
- **Accordion list:** `space-y-4` -- 5 weeks
  - Each trigger container: `.accordion-trigger bg-ivory rounded-2xl border border-blush/25 overflow-hidden` + inline shadow `0 4px 15px rgba(139,26,58,0.03)`
  - Trigger row: `flex items-center justify-between p-5 md:p-6 cursor-pointer`
    - Left: `flex items-center gap-4`
      - Diamond indicator (varies per week):
        - Week 1: `w-4 h-4 bg-gold rotate-45` + shadow `0 2px 8px rgba(201,150,58,0.3)`
        - Week 2: `w-4 h-4 border-2 border-burgundy-darker rotate-45` (outline only)
        - Week 3: `w-4 h-4 bg-blush rotate-45` (blush filled)
        - Week 4: `w-4 h-4 bg-gold rotate-45` + shadow `0 2px 8px rgba(201,150,58,0.3)`
        - Week 5: `w-4 h-4 border-2 border-burgundy-darker rotate-45` (outline only)
      - Title: font-display / `font-semibold text-base text-charcoal`
    - Right: `.accordion-icon w-5 h-5 flex items-center justify-center text-charcoal/30 text-lg font-light flex-shrink-0 ml-4` -- "+" text
  - Content: `.accordion-content` (max-height 0 -> 600px)
    - Inner: `px-5 md:px-6 pb-5 md:pb-6 pt-0`
    - Text: `text-sm text-charcoal/50 leading-body pl-8`
  - Behavior: exclusive accordion (opening one closes all others)

### Section 10: Bonuses
- **Background:** `bg-ivory` + `border-t border-blush/15`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Container:** `max-w-2xl mx-auto px-6 relative z-10`
- **Overflow:** hidden
- **Diamond decorations:**
  1. `left-[6%] top-[12%]` -- stroke `#C9963A` width `0.35` -- `opacity-[0.05]`
- **Header:** centered, `mb-12`
  - Overline: "Exclusive Bonuses" -- gold standard
  - H2: `text-3xl md:text-4xl font-semibold text-charcoal leading-snug tracking-tight`
- **Bonus cards:** `space-y-5` -- 3 cards
  - Each: `bg-champagne/20 rounded-2xl border border-blush/20 p-6 md:p-7` + shadow `0 8px 30px rgba(139,26,58,0.04), 0 2px 8px rgba(139,26,58,0.02)`
  - Layout: `flex items-start gap-4`
    - Number badge: `w-10 h-10 bg-gold/15 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5`
      - Number: font-display / `font-semibold text-lg text-gold`
    - Content:
      - Title: font-display / `font-semibold text-base text-charcoal mb-1` + value tag `font-body text-xs text-burgundy font-bold ml-1` in parentheses
      - Desc: `text-sm text-charcoal/45 leading-body`
- **CTA:** `.cta-primary` / centered, `mt-10` / text: "Join Now" / href: `#pricing`

### Section 11: Guarantee
- **Background:** `linear-gradient(180deg, #F8E8E0 0%, #FAF5EE 100%)` + `.noise-overlay`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Container:** `max-w-2xl mx-auto px-6 text-center relative z-10`
- **Overflow:** hidden
- **Diamond decorations:**
  1. `right-[10%] top-[15%]` -- stroke `#8B1A3A` width `0.3` -- `opacity-[0.06]`
- **Guarantee card:** `bg-ivory rounded-2xl border border-blush/20 p-8 md:p-12` + shadow `0 20px 60px rgba(139,26,58,0.06), 0 8px 25px rgba(139,26,58,0.03)`
  - Shield icon: `w-16 h-16 mx-auto mb-6 bg-gold/10 rounded-full` with `w-8 h-8 text-gold` SVG shield check icon (stroke, 1.5 width)
  - H2: `text-2xl md:text-3xl font-semibold text-charcoal tracking-tight mb-6`
  - Body: `text-sm text-charcoal/50 leading-body mb-10 max-w-lg mx-auto`
  - Steps: `text-left max-w-md mx-auto space-y-5 mb-10`
    - Each: `flex gap-4 items-start`
    - Number: font-display / `font-semibold text-xl text-gold leading-none flex-shrink-0 mt-0.5`
    - Text: `text-sm text-charcoal/60 leading-relaxed`
    - 3 steps
  - Closing: font-display / `italic text-base text-charcoal/45`

### Section 12: Pricing / Value Stack (Dark)
- **ID:** `pricing` (scroll target)
- **Background:** `linear-gradient(135deg, #34161B 0%, #5C1128 50%, #8B1A3A 100%)` + `.noise-overlay`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Container:** `max-w-2xl mx-auto px-6` with `relative z-10`
- **Overflow:** hidden
- **Diamond decorations:**
  1. `right-[6%] top-[10%]` -- stroke `#E8C4B0` width `0.2`
  2. `left-[4%] bottom-[12%]` -- stroke `#C9963A` width `0.3` -- `opacity-[0.04]`
- **Header:** centered, `mb-10`
  - Overline: "Your Investment" -- `text-champagne/35`
  - H2: `text-3xl md:text-4xl font-semibold text-champagne leading-snug tracking-tight`
- **Value stack card:** `bg-white/5 border border-champagne/10 rounded-2xl p-6 md:p-8 mb-8` + shadow `0 20px 60px rgba(0,0,0,0.2), 0 8px 25px rgba(0,0,0,0.1)`
  - Line items: `space-y-4`
    - Each (except last): `flex justify-between items-center border-b border-champagne/8 pb-4`
    - Label: `text-sm text-champagne/75`
    - Value: `text-sm text-champagne/40` or `text-sm text-gold font-bold` for "Included"
    - Last item: no border-b, `pb-2`
  - 5 line items
- **Price block:** centered, `mb-10`
  - Total value (struck): `text-xs text-champagne/35` with `line-through`
  - "Join today for only": `text-sm text-champagne/55 mb-3`
  - Price: font-display / `text-5xl md:text-6xl font-semibold text-champagne` / `letter-spacing: -0.02em` -- "$447"
  - Payment plan: `text-sm text-champagne/45 mt-2` with gold bold "$117 x 4"
- **CTA:** `.cta-gold` / `text-sm uppercase tracking-button px-12 py-4 rounded-lg inline-block w-full max-w-md` / text: "Join Now for $447" / href: `#`

### Section 13: FAQ (Accordion)
- **Background:** `bg-ivory`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Container:** `max-w-2xl mx-auto px-6 relative z-10`
- **Overflow:** hidden
- **Diamond decorations:**
  1. `left-[8%] top-[10%]` -- stroke `#E8C4B0` width `0.3` -- `opacity-[0.05]`
- **Header:** centered, `mb-14`
  - Overline: "Common Questions" -- gold standard
  - H2: `text-3xl md:text-4xl font-semibold text-charcoal leading-snug tracking-tight`
- **FAQ accordion:** `space-y-3` -- 7 questions
  - Each: `.accordion-trigger bg-champagne/15 rounded-2xl border border-blush/20 overflow-hidden`
  - Trigger row: `flex items-center justify-between p-5 md:p-6 cursor-pointer`
    - Question: font-display / `font-semibold text-base text-charcoal pr-4`
    - Icon: `.accordion-icon w-5 h-5 flex items-center justify-center text-charcoal/30 text-lg font-light flex-shrink-0` -- "+" text (no `ml-4` unlike week accordion)
  - Content: `.accordion-content`
    - Inner: `px-5 md:px-6 pb-5 md:pb-6 pt-0`
    - Text: `text-sm text-charcoal/50 leading-body`
  - **Difference from Week accordion:** no diamond indicators, no `pl-8` on content text, bg is `bg-champagne/15` instead of `bg-ivory`, `space-y-3` instead of `space-y-4`

### Section 14: Final CTA (Dark)
- **Background:** `linear-gradient(135deg, #34161B 0%, #5C1128 50%, #8B1A3A 100%)` + `.noise-overlay`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Container:** `max-w-2xl mx-auto px-6 text-center` with `relative z-10`
- **Overflow:** hidden
- **Diamond decorations:**
  1. `right-[10%] top-[15%]` -- stroke `#E8C4B0` width `0.2`
  2. `left-[6%] bottom-[10%]` -- stroke `#C9963A` width `0.3` -- `opacity-[0.04]`
- **Components:**
  - Overline: "Don't Wait" -- `text-champagne/35`
  - H2: `text-3xl md:text-4xl font-semibold text-champagne leading-snug tracking-tight mb-8`
  - Price block (duplicate of pricing section): same struck total, same $447 display (`text-5xl` only, no md:text-6xl), same payment plan text
  - CTA: `.cta-gold` / `text-sm uppercase tracking-button px-12 py-4 rounded-lg inline-block w-full max-w-md` / text: "Join Now for $447" / href: `#`

### Sticky Mobile CTA (Bottom)
- **Element:** `<div id="sticky-mobile" class="sticky-cta">`
- **Position:** `fixed bottom-0 left-0 right-0 z-49`
- **Padding:** `12px 16px` + `padding-bottom: max(12px, env(safe-area-inset-bottom))`
- **Background:** `rgba(250,245,238,0.92)` (ivory at 92% opacity)
- **Backdrop filter:** `blur(14px)`
- **Border top:** `1px solid rgba(232,196,176,0.4)`
- **Shadow:** `0 -4px 20px rgba(44,44,44,0.08)`
- **Hidden on:** `md` and above (`@media (min-width: 768px) { display: none; }`)
- **CTA button:** `.cta-primary` / `text-sm uppercase tracking-button py-3.5 rounded-lg block text-center w-full` / text: "Join Now" / href: `#pricing`
- **Show/hide:** class `.show` added when `scrollY > 600` and scrolling down; removed when `scrollY < 300`
- **Transition:** `transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)` -- `translateY(100%)` default, `translateY(0)` when `.show`

---

## Photo Placement Map

| # | Section | Slot Description | Dimensions | Aspect Ratio | Overlay |
|---|---|---|---|---|---|
| 1 | Meet Your Coach (Section 6) | Coach portrait photo | 500x660 placeholder / `w-72 md:w-96` | 3:4 (`aspect-[3/4]`) | `bg-gradient-to-t from-burgundy-darker/25 to-transparent` |

Total photo slots: **1**

---

## Interactive Elements

### CTA Primary (`.cta-primary`)
- **Resting:** `background: #8B1A3A` / `color: #fff` / `box-shadow: 0 4px 15px rgba(139,26,58,0.25), 0 2px 6px rgba(139,26,58,0.15)` / `border-radius: 0.5rem` (rounded-lg)
- **Hover:** `transform: translateY(-2px)` / `box-shadow: 0 8px 25px rgba(139,26,58,0.35), 0 4px 10px rgba(139,26,58,0.2)`
- **Focus-visible:** `outline: 2px solid #C9963A` / `outline-offset: 3px`
- **Active:** `transform: translateY(0)` / `opacity: 0.9`
- **Transition:** `transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, opacity 0.3s ease`
- **Shared classes:** `font-body font-bold text-sm uppercase tracking-button px-12 py-4 rounded-lg inline-block`

### CTA Gold (`.cta-gold`)
- **Resting:** `background: #C9963A` / `color: #34161B` / `box-shadow: 0 4px 15px rgba(201,150,58,0.3), 0 2px 6px rgba(201,150,58,0.2)`
- **Hover:** `transform: translateY(-2px)` / `box-shadow: 0 8px 25px rgba(201,150,58,0.4), 0 4px 10px rgba(201,150,58,0.25)`
- **Focus-visible:** `outline: 2px solid #8B1A3A` / `outline-offset: 3px`
- **Active:** `transform: translateY(0)` / `opacity: 0.9`
- **Transition:** `transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, opacity 0.3s ease`
- **Sticky top bar variant:** `text-xs uppercase tracking-button px-6 py-2.5 rounded-lg whitespace-nowrap`
- **Pricing variant:** `text-sm uppercase tracking-button px-12 py-4 rounded-lg inline-block w-full max-w-md`

### CTA Light (`.cta-light`)
- **Resting:** `background: #F5E6D0` / `color: #8B1A3A` / `box-shadow: 0 4px 15px rgba(201,150,58,0.2), 0 2px 6px rgba(201,150,58,0.1)`
- **Hover:** `transform: translateY(-2px)` / `box-shadow: 0 8px 25px rgba(201,150,58,0.3)`
- **Focus-visible:** `outline: 2px solid #C9963A` / `outline-offset: 3px`
- **Active:** `transform: translateY(0)` / `opacity: 0.9`
- **Transition:** `transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, opacity 0.3s ease`
- **Note:** Defined in CSS but NOT used on this page

### Module Cards (`.module-card`)
- **Border:** `1px solid rgba(232,196,176,0.4)`
- **Border-radius:** `16px`
- **Resting:** inline shadow `0 8px 30px rgba(139,26,58,0.04), 0 2px 8px rgba(139,26,58,0.02)`
- **Hover:** `transform: translateY(-3px)` / `box-shadow: 0 12px 30px rgba(139,26,58,0.08), 0 4px 12px rgba(139,26,58,0.04)`
- **Transition:** `transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease`

### Accordion (Week-by-Week + FAQ)
- **Trigger:** `.accordion-trigger` with `cursor: pointer` on the inner div
- **Content container:** `.accordion-content` -- `max-height: 0` / `overflow: hidden`
- **Content open:** `.accordion-content.open` -- `max-height: 600px`
- **Transition:** `max-height 0.5s cubic-bezier(0.22, 1, 0.36, 1)`
- **Icon:** `.accordion-icon` -- "+" character
- **Icon rotation:** `.accordion-icon.rotated` -- `transform: rotate(45deg)` (+ becomes x)
- **Icon transition:** `transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)`
- **Behavior:** Exclusive -- clicking one closes all others, then toggles clicked item
- **JS function:** `toggleAccordion(el)` -- closes all `.accordion-content.open` and removes all `.accordion-icon.rotated`, then opens clicked if it was previously closed

### Sticky Top Bar
- **Position:** `fixed top-0 left-0 right-0 z-50`
- **Background:** `rgba(52,22,27,0.95)` (inline style)
- **Backdrop filter:** `blur(12px)` + `-webkit-backdrop-filter: blur(12px)`
- **Show/hide:** IntersectionObserver on `#pricing` section, `threshold: 0.1`
  - Pricing visible: `bar.style.transform = 'translateY(-100%)'`
  - Pricing not visible: `bar.style.transform = 'translateY(0)'`
- **Transition:** `transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)`

### Sticky Mobile CTA
- **Position:** `fixed bottom-0 left-0 right-0 z-49`
- **Background:** `rgba(250,245,238,0.92)`
- **Backdrop filter:** `blur(14px)` + `-webkit-backdrop-filter: blur(14px)`
- **Border top:** `1px solid rgba(232,196,176,0.4)`
- **Shadow:** `0 -4px 20px rgba(44,44,44,0.08)`
- **Default state:** `transform: translateY(100%)` (hidden below viewport)
- **Show state:** `.sticky-cta.show` -- `transform: translateY(0)`
- **Transition:** `transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)`
- **Show logic:** `scrollY > 600` AND scrolling down (current > lastScroll) -> add `.show`
- **Hide logic:** `scrollY < 300` -> remove `.show`
- **Scroll listener:** `{ passive: true }`
- **Hidden on desktop:** `@media (min-width: 768px) { display: none; }`

### Countdown Timer
- **Dual display:**
  1. Standalone strip (Section 1): Full days/hours/minutes/seconds with labels
  2. Sticky top bar (Section 0): Hours:minutes:seconds inline, no labels
- **Timer logic:** `Date.now() + 3 * 86400000` (3 days from page load)
- **Update interval:** `setInterval(update, 1000)` (every second)
- **Format:** 2-digit zero-padded (`padStart(2, '0')`)
- **IDs:** Strip: `cd-d`, `cd-h`, `cd-m`, `cd-s` / Top bar: `st-h`, `st-m`, `st-s`

---

## Responsive Breakpoints

### Mobile (default, < 768px)
- All grids stack to single column (`grid-cols-1`)
- Countdown numbers: `font-size: 1.5rem` (24px)
- Countdown gap: `gap-6`
- Section padding: `py-20`
- Coach photo: `w-72` (288px), centered
- Hero H1: `text-4xl` (36px)
- Sticky top bar: countdown centered (`flex-1 justify-center`), urgency text hidden
- Sticky mobile CTA: visible (when triggered by scroll)
- Module cards: `p-6`
- Accordion: `p-5`
- Pricing CTA: `w-full`
- Top bar countdown: `text-base` (16px), `gap-1.5`

### Tablet (768px -- `md:` prefix)
- Grids become multi-column: `md:grid-cols-2` (coach, program intro), `md:grid-cols-3` (testimonials)
- Section padding: `md:py-28`
- Coach photo: `md:w-96` (384px)
- Hero H1: `md:text-5xl` (48px)
- Line breaks shown: `hidden md:block` becomes visible
- Sticky mobile CTA: `display: none`
- Module cards: `md:p-8`
- Accordion: `md:p-6`
- Top bar: urgency text shown (`md:block`), countdown right-aligned (`md:flex-none md:justify-end`), numbers `md:text-lg`, gap `md:gap-3`/`md:gap-6`
- Countdown strip gap: `md:gap-8`

### Desktop (1280px -- `lg:` prefix)
- Section padding: `lg:py-36`
- Hero H1: `lg:text-[3.75rem]` (60px)
- H2 large: up to `lg:text-[2.8rem]` (44.8px) or `lg:text-[3.25rem]` (52px)
- H2 medium: up to `lg:text-[2.75rem]` (44px)

---

## Animation System

### Reveal (Scroll-triggered)
- **Initial state:** `opacity: 0` / `transform: translateY(24px)`
- **Visible state:** `opacity: 1` / `transform: translateY(0)`
- **Transition:** `opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)`
- **Stagger delays:**
  - `.reveal-delay-1`: `transition-delay: 0.08s`
  - `.reveal-delay-2`: `transition-delay: 0.16s`
  - `.reveal-delay-3`: `transition-delay: 0.24s`
  - `.reveal-delay-4`: `transition-delay: 0.32s`
- **Trigger:** IntersectionObserver with `threshold: 0.05` and `rootMargin: '0px 0px 80px 0px'`
- **Behavior:** One-shot -- once visible, `observer.unobserve(entry.target)` is called
- **Fallback:** After 1500ms timeout, all non-visible `.reveal` elements get `.visible` class forced
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` -- `opacity: 1; transform: none; transition: none;`

### Accordion Content
- **Closed:** `max-height: 0` / `overflow: hidden`
- **Open:** `max-height: 600px`
- **Transition:** `max-height 0.5s cubic-bezier(0.22, 1, 0.36, 1)`

### Accordion Icon Rotation
- **Default:** no transform
- **Rotated:** `transform: rotate(45deg)` (turns "+" into "x")
- **Transition:** `transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)`

### CTA Hover/Active
- **Lift:** `transform: translateY(-2px)` on hover
- **Return:** `transform: translateY(0)` on active
- **Easing:** `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring/overshoot curve for transform)
- **Shadow/opacity easing:** `ease` (standard)
- **Duration:** `0.3s` for all three properties

### Module Card Hover
- **Lift:** `transform: translateY(-3px)`
- **Easing:** `cubic-bezier(0.22, 1, 0.36, 1)` for transform, `ease` for shadow
- **Duration:** `0.3s`

### Sticky Bar Transitions
- **Top bar:** `transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)` -- slide up/down
- **Mobile CTA:** `transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)` -- slide up/down

### Scroll Behavior
- `html { scroll-behavior: smooth; }` -- smooth scrolling for anchor links (`#pricing`)

---

## Noise Overlay
- **Implementation:** `::after` pseudo-element on `.noise-overlay` class
- **Position:** `absolute; inset: 0`
- **Opacity:** `0.03`
- **Background:** inline SVG data URI with `feTurbulence` filter (`fractalNoise`, `baseFrequency: 0.85`, `numOctaves: 4`, `stitchTiles: stitch`)
- **Background size:** `128px 128px` (repeating tile)
- **Pointer events:** `none`
- **Z-index:** `1`

---

## Diamond Decorations
- **Base class:** `.diamond-deco` -- `position: absolute; width: 200px; height: 200px; opacity: 0.08; pointer-events: none`
- **Shape:** SVG `<polygon points="50,0 100,50 50,100 0,50">` (diamond/rhombus)
- **Fill:** always `none` (outline only)
- **Stroke colors:** `#E8C4B0` (blush), `#C9963A` (gold), `#8B1A3A` (burgundy)
- **Stroke widths:** 0.2, 0.25, 0.3, 0.35, 0.4
- **Opacity overrides:** some use `opacity-[0.04]`, `opacity-[0.05]`, `opacity-[0.06]` instead of base 0.08
- **Placement pattern:** Most sections have 1-2 diamonds, positioned with percentage-based inset (`right-[X%] top-[Y%]`, etc.)

---

## Scrollbar Customization
- **Width:** `8px`
- **Track:** `background: #FAF5EE` (ivory)
- **Thumb:** `background: #E8C4B0` (blush) / `border-radius: 4px`
- **Thumb hover:** `background: #C9963A` (gold)

---

## Background Gradient Catalog

| Section | Direction | Stops |
|---|---|---|
| Hero | `180deg` | `#FAF5EE 0%`, `#F5E6D0 60%`, `#F5D8D0 100%` |
| Pain Points | `135deg` | `#34161B 0%`, `#5C1128 50%`, `#8B1A3A 100%` |
| Root Cause | `180deg` | `#FAF5EE 0%`, `#F8E8E0 100%` |
| Meet Your Coach | `180deg` | `#F5D8D0 0%`, `#F8E8E0 50%`, `#FAF5EE 100%` |
| Testimonials | `135deg` | `#34161B 0%`, `#5C1128 50%`, `#8B1A3A 100%` |
| Week-by-Week | `180deg` | `#F5D8D0 0%`, `#F8E8E0 50%`, `#FAF5EE 100%` |
| Guarantee | `180deg` | `#F8E8E0 0%`, `#FAF5EE 100%` |
| Pricing | `135deg` | `#34161B 0%`, `#5C1128 50%`, `#8B1A3A 100%` |
| Final CTA | `135deg` | `#34161B 0%`, `#5C1128 50%`, `#8B1A3A 100%` |

**Pattern:** Dark sections use `135deg` diagonal. Light sections use `180deg` vertical. Dark gradient is always the same 3-stop burgundy ramp. Light gradients vary.

---

## Section Container Width Summary

| Width Class | Sections |
|---|---|
| `max-w-5xl` | Sticky top bar, Meet Your Coach |
| `max-w-4xl` | Pain Points, Testimonials |
| `max-w-3xl` | Hero, Program Introduction, Curriculum/What's Inside, Week-by-Week |
| `max-w-2xl` | Root Cause, Bonuses, Guarantee, Pricing, FAQ, Final CTA |
| `max-w-lg` | Countdown strip |
| `max-w-md` | CTA buttons (`max-w-md` on pricing/final CTA gold buttons), guarantee steps list, conditioning bullet list |

---

## CTA Button Inventory

| Section | Variant | Text | Href | Extra Classes |
|---|---|---|---|---|
| Sticky Top Bar | `.cta-gold` | "Enrol Now" | `#pricing` | `text-xs px-6 py-2.5 whitespace-nowrap` |
| Hero | `.cta-primary` | "Join Now" | `#pricing` | `text-sm px-12 py-4` |
| Program Intro | `.cta-primary` | "Join Now" | `#pricing` | `text-sm px-12 py-4` |
| Curriculum | `.cta-primary` | "Join Now" | `#pricing` | `text-sm px-12 py-4` |
| Bonuses | `.cta-primary` | "Join Now" | `#pricing` | `text-sm px-12 py-4` |
| Pricing | `.cta-gold` | "Join Now for $447" | `#` | `text-sm px-12 py-4 w-full max-w-md` |
| Final CTA | `.cta-gold` | "Join Now for $447" | `#` | `text-sm px-12 py-4 w-full max-w-md` |
| Sticky Mobile | `.cta-primary` | "Join Now" | `#pricing` | `text-sm py-3.5 block w-full` |

Total CTA buttons: **8**
