# Upsell Page — Design Specification

## Page Overview
- **Page type:** Upsell page — one-time post-purchase offer for a signature program at a discounted price
- **Total number of sections:** 6 (Hero/Offer, Program Showcase, What's Inside, Detailed Outcomes, Testimonials, Final Value Stack)
- **Has sticky CTA:** Yes (top bar + mobile bottom bar)
- **Has navigation:** No
- **Has countdown timer:** Yes (minutes:seconds, 15-minute countdown)
- **Has progress bar:** Yes (3-step: Registered > Upgraded > Special Offer)
- **Has decline link:** Yes (in Section 6)
- **Has 1-click charge notice:** Yes (in Section 1 and Section 6)

---

## Typography

### Font Stack
- **Heading font:** Cormorant Garamond (serif)
  - URL: `https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500;1,600&display=swap`
  - Tailwind key: `font-display`
- **Body font:** Montserrat (sans-serif)
  - URL: `https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap`
  - Tailwind key: `font-body`

### Type Scale
- **H1:** `text-3xl md:text-5xl lg:text-[3.5rem]` / `leading-tight` / `font-semibold` / `text-charcoal` / `letter-spacing: -0.02em` / `font-display`
- **H2:** `text-2xl md:text-4xl lg:text-5xl` / `leading-tight` / `font-semibold` / `text-charcoal` / `letter-spacing: -0.02em` / `font-display`
  - Variant (Section 6): `text-2xl md:text-3xl lg:text-4xl`
- **H3:** `text-xl md:text-2xl` / `font-semibold` / `text-charcoal` / `font-display`
- **Body (large):** `text-base md:text-lg` / `text-charcoal/65` / `leading-relaxed` / `font-body`
- **Body (standard):** `text-sm` / `text-charcoal/55` or `text-charcoal/60` or `text-charcoal/65` or `text-charcoal/70` / `leading-relaxed` / `font-body`
- **Label / Overline:** `text-xs` / `font-bold` / `uppercase` / `tracking-label` (0.12em) / `text-gold` / `font-body`
- **Pre-heading soft text:** `text-sm` / `text-charcoal/50` / `font-body`
- **Small / Caption:** `text-[10px]` / `text-charcoal/30` or `text-charcoal/40` / `font-body`
- **Pricing card label:** `text-[10px]` / `font-bold` / `uppercase` / `tracking-label` / `text-charcoal/40`
- **Pricing struck-through:** `text-2xl` / `font-bold` / `text-charcoal/35` / `line-through decoration-burgundy-light/40` / `font-display`
- **Pricing main:** `text-4xl md:text-5xl` / `font-bold` / `text-burgundy` / `letter-spacing: -0.02em` / `font-display`
- **Button text:** `text-sm` / `font-bold` / `uppercase` / `tracking-button` (0.1em) / `font-body`
- **Countdown number:** `font-display` / `font-semibold` / `2.5rem` (desktop) / `2rem` (mobile below 768px) / `line-height: 1`
- **Countdown label:** `0.65rem` / `tracking-label` (0.12em) / `uppercase` / `font-weight: 600`
- **Citation / Testimonial author:** `text-xs` / `text-champagne/40` / `not-italic` / `font-body`
- **Testimonial quote:** `text-sm` / `text-champagne/80` / `leading-relaxed` / `italic` / `font-body`
- **Star rating:** `text-sm` / `text-gold`
- **Value stack item title:** `text-base` / `font-semibold` / `text-charcoal` / `font-body`
- **Value stack item price:** `text-burgundy` / `font-normal` (within the semibold line)
- **Value stack item description:** `text-xs` / `text-charcoal/50` / `font-body`
- **Breakdown line item:** `text-sm` / `text-charcoal/70` / `font-body`
- **Breakdown value:** `text-sm` / `text-charcoal/45` / `font-body`
- **Breakdown bonus label:** `text-burgundy` / `font-semibold` within the line item
- **Breakdown total value:** `text-xs` / `text-charcoal/45` with `line-through`
- **Breakdown final price:** `text-2xl` / `font-bold` / `text-charcoal` with `text-burgundy` for the price / `font-display`

---

## Color System

### Tailwind Config Colors
```
burgundy:       #8B1A3A (DEFAULT)
burgundy-dark:  #5C1128
burgundy-darker:#34161B
burgundy-light: #A82050
gold:           #C9963A (DEFAULT)
gold-light:     #D4AB5E
gold-faint:     rgba(201,150,58,0.15)
champagne:      #F5E6D0
blush:          #E8C4B0 (DEFAULT)
blush-light:    #F5D8D0
blush-lighter:  #F8E8E0
ivory:          #FAF5EE
charcoal:       #2C2C2C
```

### Usage Map
| Role | Color | Hex / Value |
|------|-------|-------------|
| Page background | `bg-ivory` | #FAF5EE |
| Body text | `text-charcoal` | #2C2C2C |
| Muted body text | `text-charcoal/55` to `text-charcoal/70` | #2C2C2C at 55-70% opacity |
| Soft body text | `text-charcoal/50` | #2C2C2C at 50% |
| Caption / micro text | `text-charcoal/30` to `text-charcoal/40` | #2C2C2C at 30-40% |
| Primary CTA background | `bg-burgundy` | #8B1A3A |
| Primary CTA text | `#fff` | white |
| Gold CTA background | `bg-gold` | #C9963A |
| Gold CTA text | `text-burgundy-darker` | #34161B |
| Section label / overline | `text-gold` | #C9963A |
| Sticky top bar bg | `bg-burgundy-darker/95` | #34161B at 95% |
| Sticky top bar text | `text-champagne/70` | #F5E6D0 at 70% |
| Sticky top bar border | `border-burgundy/30` | #8B1A3A at 30% |
| Alt section bg | `bg-champagne/50` or `bg-champagne` | #F5E6D0 at 50% or 100% |
| Dark section bg | linear-gradient(180deg, #34161B 0%, #3D1A22 100%) |
| Dark section heading | `text-white` | white |
| Dark section body | `text-champagne/80` | #F5E6D0 at 80% |
| Dark section citations | `text-champagne/40` | #F5E6D0 at 40% |
| Decorative line | `bg-gold` | #C9963A |
| Progress bar completed circle | `bg-burgundy/30` | #8B1A3A at 30% |
| Progress bar active circle | `bg-burgundy-light` | #A82050 |
| Progress bar completed connector | `bg-burgundy/30` | #8B1A3A at 30% |
| Progress bar pending connector | `bg-blush/50` | #E8C4B0 at 50% |
| Card borders | `border-blush/30` | #E8C4B0 at 30% |
| Dark card borders | `border-champagne/10` | #F5E6D0 at 10% |
| Dark card bg | `bg-white/5` | white at 5% |
| Numbered circle bg | `bg-burgundy/10` | #8B1A3A at 10% |
| Numbered circle text | `text-burgundy` | #8B1A3A |
| Diamond bullet | `bg-burgundy` | #8B1A3A |
| Star rating | `text-gold` | #C9963A |
| Decline link | `text-charcoal/40` hover `text-charcoal/60` |
| Scrollbar thumb | `#E8C4B0` hover `#C9963A` |
| Scrollbar track | `#FAF5EE` |
| Pricing card bg | `bg-white/60` | white at 60% |
| Value stack card bg | `bg-champagne/40` | #F5E6D0 at 40% |
| Breakdown card bg | `bg-white` | white |
| Sticky mobile CTA bg | `rgba(250,245,238,0.92)` |
| Sticky mobile CTA border-top | `rgba(232,196,176,0.4)` |

---

## Shadow System

### Named Shadow Patterns
```css
/* CTA Primary — default */
box-shadow: 0 4px 15px rgba(139,26,58,0.25), 0 2px 6px rgba(139,26,58,0.15);

/* CTA Primary — hover */
box-shadow: 0 8px 25px rgba(139,26,58,0.35), 0 4px 10px rgba(139,26,58,0.2);

/* CTA Gold — default */
box-shadow: 0 4px 15px rgba(201,150,58,0.3), 0 2px 6px rgba(201,150,58,0.15);

/* CTA Gold — hover */
box-shadow: 0 8px 25px rgba(201,150,58,0.4), 0 4px 10px rgba(201,150,58,0.2);

/* Sticky top bar */
box-shadow: 0 4px 20px rgba(52,22,27,0.15);

/* Sticky mobile CTA */
box-shadow: 0 -4px 20px rgba(44,44,44,0.08);

/* Progress active step */
box-shadow: 0 2px 8px rgba(168,32,80,0.2);

/* Pricing card / light content cards */
box-shadow: 0 8px 30px rgba(139,26,58,0.04);

/* Large image container */
box-shadow: 0 20px 60px rgba(139,26,58,0.08), 0 8px 25px rgba(139,26,58,0.04);

/* Smaller image container (4/3 aspect) */
box-shadow: 0 20px 60px rgba(139,26,58,0.08), 0 8px 24px rgba(139,26,58,0.04);

/* Breakdown / value summary card */
box-shadow: 0 20px 60px rgba(139,26,58,0.06), 0 8px 25px rgba(139,26,58,0.03);

/* Dark testimonial card */
box-shadow: 0 8px 30px rgba(0,0,0,0.1);

/* Component card — hover */
box-shadow: 0 12px 40px rgba(139,26,58,0.08), 0 4px 15px rgba(139,26,58,0.04);

/* Diamond bullet */
box-shadow: 0 1px 4px rgba(139,26,58,0.2);
```

---

## Noise / Texture Overlay
Applied via `.noise-overlay::after` pseudo-element:
```css
content: '';
position: absolute;
inset: 0;
opacity: 0.03;
background-image: url("data:image/svg+xml,...feTurbulence fractalNoise baseFrequency=0.85 numOctaves=4...");
background-size: 128px 128px;
pointer-events: none;
z-index: 1;
```
Used on: Section 2 (Program Showcase), Section 4 (Detailed Outcomes), Section 5 (Testimonials)

---

## Decorative Elements

### Diamond SVG
```css
.diamond-deco {
  position: absolute;
  width: 200px;
  height: 200px;
  opacity: 0.08;
  pointer-events: none;
}
```
SVG: `<polygon points="50,0 100,50 50,100 0,50" fill="none" stroke="[color]" stroke-width="0.3"/>`
- Sections 1, 3, 6: stroke `#E8C4B0` stroke-width `0.3`
- Section 4: stroke `#C9963A` stroke-width `0.3`
- Section 5: stroke `#F5E6D0` stroke-width `0.5`, opacity overridden to `opacity-[0.04]`

### Decorative Divider
- Gold line: `w-16 h-[2px] bg-gold mx-auto` (Section 1 only, between heading and body)

### Diamond Bullet Points (Sections 3 components)
- `w-2 h-2 rounded-sm bg-burgundy rotate-45 mt-1.5 flex-shrink-0`
- Shadow: `0 1px 4px rgba(139,26,58,0.2)`

### Numbered Circles
- `w-8 h-8 rounded-full bg-burgundy/10 flex items-center justify-center flex-shrink-0`
- Number: `font-display text-sm font-bold text-burgundy`

---

## Section-by-Section Specification

---

### Sticky Top CTA Bar
- **Element:** `<div id="sticky-top">`
- **Position:** `fixed top-0 left-0 right-0 z-50`
- **Background:** `bg-burgundy-darker/95` (#34161B at 95%)
- **Backdrop filter:** `blur(12px)`
- **Padding:** `py-3 px-4`
- **Border:** `border-b border-burgundy/30`
- **Shadow:** `0 4px 20px rgba(52,22,27,0.15)`
- **Container:** `max-w-4xl mx-auto flex items-center justify-between gap-4`
- **Left text:** `font-body text-xs md:text-sm text-champagne/70` — hidden on mobile (`hidden md:block`)
- **CTA button:** `.cta-gold font-body font-bold text-xs uppercase tracking-button w-full md:w-auto text-center px-8 py-2.5 rounded`
  - Text: "Add to Order"
  - Href: `#checkout`
- **Behavior:** Hides (translateY(-100%)) when `#checkout` element is visible in viewport (threshold 0.1); slides back in when scrolled away. Transition: `transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease`

---

### Progress Bar
- **Wrapper:** `pt-14 bg-ivory border-b border-blush/30`
- **Container:** `max-w-2xl mx-auto px-4 py-5`
- **Layout:** `flex items-center justify-center gap-2 md:gap-4 text-xs md:text-sm`
- **3 steps:**
  1. **Registered** (completed): circle `w-6 h-6 rounded-full bg-burgundy/30` with white checkmark SVG (stroke-width 3), label `text-charcoal/40`
  2. **Upgraded** (completed): same as step 1
  3. **Special Offer** (active): circle `w-6 h-6 rounded-full bg-burgundy-light` with shadow `0 2px 8px rgba(168,32,80,0.2)`, number "3" in `text-white text-[10px] font-bold`, label `font-semibold text-charcoal`
- **Connectors between steps:**
  - After step 1: `w-8 md:w-16 h-px bg-burgundy/30`
  - After step 2: `w-8 md:w-16 h-px bg-blush/50`
- **Checkmark SVG:** `w-3 h-3 text-white` `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>`

---

### Section 1: Hero / Offer
- **Background:** `bg-ivory` (#FAF5EE)
- **Padding:** `py-12 md:py-16`
- **Overflow:** `overflow-hidden`
- **Container:** `max-w-3xl mx-auto px-6 text-center relative z-10`
- **Diamond deco:** `right-[10%] top-[10%]`, stroke #E8C4B0

**Components (in order):**
1. **Pre-heading:** `font-body text-sm text-charcoal/50 mb-5` — "Before you go, there's one more gentle invitation..."
2. **H1:** `font-display text-3xl md:text-5xl lg:text-[3.5rem] font-semibold text-charcoal leading-tight mb-6` / `letter-spacing: -0.02em`
3. **Gold divider:** `w-16 h-[2px] bg-gold mx-auto mb-6`
4. **Body paragraph (large):** `font-body text-base md:text-lg text-charcoal/65 max-w-2xl mx-auto leading-relaxed mb-3`
5. **Body paragraph (small):** `font-body text-sm text-charcoal/50 max-w-xl mx-auto leading-relaxed mb-10`
6. **Pricing Card:**
   - Container: `inline-block bg-white/60 rounded-2xl px-8 py-6 border border-blush/30 mb-8`
   - Shadow: `0 8px 30px rgba(139,26,58,0.04)`
   - Label: `font-body text-[10px] font-bold uppercase tracking-label text-charcoal/40 mb-2` — "Regular Price:"
   - Struck price: `font-display text-2xl font-bold text-charcoal/35 line-through decoration-burgundy-light/40 mb-1` — "$488"
   - Current label: `font-body text-sm text-charcoal/60 mb-1` — "Exclusive Today:"
   - Current price: `font-display text-4xl md:text-5xl font-bold text-burgundy` / `letter-spacing: -0.02em` — "$288"
7. **Countdown Timer:**
   - Wrapper: `mb-8`
   - Container: `inline-flex flex-col items-center bg-burgundy-darker/90 backdrop-blur-sm rounded-full px-8 py-4 border border-champagne/10`
   - Label: `font-body text-[10px] font-bold uppercase tracking-label text-champagne/60 mb-2` — "This offer expires in:"
   - Numbers layout: `flex gap-6 text-champagne`
   - Minutes: `.countdown-num` (2.5rem desktop / 2rem mobile)
   - Colon separator: `.countdown-num text-champagne/30`
   - Seconds: `.countdown-num`
   - Sub-labels: `.countdown-label` (0.65rem, uppercase, tracking 0.12em, font-weight 600)
   - Initial value: 14:50 (starts from 15*60 = 900 seconds)
8. **CTA (id="checkout"):**
   - Button: `.cta-primary font-body font-bold text-sm uppercase tracking-button inline-block w-full max-w-md px-10 py-4 rounded-lg`
   - Text: "Add to Order"
   - Href: `#`
9. **1-click notice:** `mt-2 font-body text-[10px] text-charcoal/30` — "By clicking this button, your saved payment method will be charged $288 instantly."

---

### Section 2: Program Showcase
- **Background:** `bg-champagne/50` (#F5E6D0 at 50%) + `.noise-overlay`
- **Padding:** `py-16 md:py-24`
- **Overflow:** `overflow-hidden`
- **Container:** `max-w-4xl mx-auto px-6 relative z-10`
- **No diamond deco in this section**

**Components (in order):**
1. **Overline:** `font-body text-xs font-bold uppercase tracking-label text-gold mb-5 text-center` — "The Program"
2. **H2:** `font-display text-2xl md:text-4xl lg:text-5xl font-semibold text-charcoal text-center leading-tight mb-4` / `letter-spacing: -0.02em` — "Get Lifetime Access to the Signature Program" (with `<br>`)
3. **Subtitle:** `font-body text-sm text-charcoal/55 text-center max-w-xl mx-auto mb-10`
4. **Program Image:**
   - Wrapper: `max-w-2xl mx-auto mb-10`
   - Image container: `relative aspect-video rounded-2xl overflow-hidden`
   - Shadow: `0 20px 60px rgba(139,26,58,0.08), 0 8px 25px rgba(139,26,58,0.04)`
   - Placeholder: `800x450` / `#34161B` bg / `#F5E6D0` text
   - Overlay: `absolute inset-0 bg-gradient-to-t from-burgundy-darker/20 to-transparent`
   - **Photo slot: Program image, landscape 16:9, 800x450**
5. **Description paragraph:** `font-body text-sm text-charcoal/60 leading-relaxed mb-8` (centered, max-w-2xl)
   - Uses `<em class="font-display italic">` for emphasis
6. **Learning Outcomes sub-label:** `font-body text-xs font-bold uppercase tracking-label text-gold mb-6` — "Inside the program, you'll learn how to:"
7. **Numbered list (4 items):**
   - Container: `text-left max-w-md mx-auto space-y-4 mb-10`
   - Each item: `flex gap-4 items-start`
   - Number circle: `w-8 h-8 rounded-full bg-burgundy/10` with `font-display text-sm font-bold text-burgundy`
   - Text: `font-body text-sm text-charcoal/70 pt-1`
8. **CTA:** `.cta-primary font-body font-bold text-sm uppercase tracking-button inline-block px-10 py-4 rounded-lg`
   - Text: "Begin Your Journey"
   - Href: `#checkout`

---

### Section 3: What's Inside (3 Components)
- **Background:** `bg-ivory` (#FAF5EE)
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Overflow:** `overflow-hidden`
- **Container:** `max-w-4xl mx-auto px-6 relative z-10`
- **Diamond deco:** `left-[-2%] top-[20%]`, stroke #E8C4B0

**Components (in order):**
1. **Overline:** `font-body text-xs font-bold uppercase tracking-label text-gold mb-5 text-center` — "What's Included"
2. **H2:** `font-display text-2xl md:text-4xl lg:text-5xl font-semibold text-charcoal text-center leading-tight mb-4` / `letter-spacing: -0.02em`
3. **Subtitle:** `font-body text-sm text-charcoal/55 text-center max-w-xl mx-auto mb-14`
4. **Components grid:** `space-y-10`

**Component 1: Video Lessons (image left, text right)**
- Grid: `grid grid-cols-1 md:grid-cols-2 gap-8 items-center`
- Image: `relative aspect-[4/3] rounded-2xl overflow-hidden`
  - Shadow: `0 20px 60px rgba(139,26,58,0.08), 0 8px 24px rgba(139,26,58,0.04)`
  - Placeholder: `600x450` / `#34161B` bg
  - Overlay: `bg-gradient-to-t from-burgundy-darker/20 to-transparent`
  - **Photo slot: Video lessons image, 4:3 landscape, 600x450**
- H3: `font-display text-xl md:text-2xl font-semibold text-charcoal mb-4`
- Description: `font-body text-sm text-charcoal/55 mb-5`
- Bullet list: `space-y-3`, diamond bullets (rotated squares)
  - Bullet: `w-2 h-2 rounded-sm bg-burgundy rotate-45 mt-1.5 flex-shrink-0` / shadow `0 1px 4px rgba(139,26,58,0.2)`
  - Text: `font-body text-sm text-charcoal/65`

**Component 2: Workbook (text left, image right — reversed on mobile)**
- Grid: `grid grid-cols-1 md:grid-cols-2 gap-8 items-center`
- Text column: `order-2 md:order-1`
- Image column: `order-1 md:order-2`
- Same image/text styling as Component 1
- **Photo slot: Workbook image, 4:3 landscape, 600x450**

**Component 3: Meditations (image left, text right)**
- Same layout/styling as Component 1
- **Photo slot: Meditations image, 4:3 landscape, 600x450**

---

### Section 4: Detailed Outcomes (8 Items)
- **Background:** `bg-champagne` (#F5E6D0) + `.noise-overlay`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Overflow:** `overflow-hidden`
- **Container:** `max-w-4xl mx-auto px-6 relative z-10`
- **Diamond deco:** `right-[8%] top-[5%]`, stroke #C9963A

**Components (in order):**
1. **Overline:** `text-gold` — "The Transformation"
2. **H2:** standard sizing — "What You'll Learn Inside"
3. **Subtitle:** `font-body text-sm text-charcoal/55 text-center max-w-xl mx-auto mb-12`
4. **Outcome cards grid:**
   - Grid: `grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto mb-10`
   - Each card: `bg-ivory/80 rounded-2xl p-5 border border-blush/30 flex gap-4 items-start`
   - Shadow: `0 8px 30px rgba(139,26,58,0.04)`
   - Number circle: `w-8 h-8 rounded-full bg-burgundy/10` with number
   - Text: `font-body text-sm text-charcoal/70`
   - **8 cards total, numbered 1-8**
5. **CTA:** `.cta-primary` — "Begin Your Journey" — href `#checkout`

---

### Section 5: Testimonials (Dark)
- **Background:** `linear-gradient(180deg, #34161B 0%, #3D1A22 100%)` + `.noise-overlay`
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Overflow:** `overflow-hidden`
- **Container:** `max-w-4xl mx-auto px-6 relative z-10`
- **Diamond deco:** `left-[5%] bottom-[10%]`, stroke #F5E6D0, stroke-width 0.5, `opacity-[0.04]`

**Components (in order):**
1. **Overline:** `text-gold` — "Real Stories"
2. **H2:** `text-white` — "What Women Are Saying About the Program" (with `<br class="hidden md:block">`)
   - Margin-bottom: `mb-14`
3. **Testimonial cards grid:** `grid grid-cols-1 md:grid-cols-3 gap-6`
   - Each card: `bg-white/5 border border-champagne/10 rounded-2xl p-6 backdrop-blur-sm`
   - Shadow: `0 8px 30px rgba(0,0,0,0.1)`
   - Stars: `flex gap-1 mb-4` — 5 gold stars (`&#9733;`) in `text-gold text-sm`
   - Quote: `font-body text-sm text-champagne/80 leading-relaxed italic mb-4` wrapped in `<blockquote>`
   - Citation: `font-body text-xs text-champagne/40 not-italic` in `<cite>` with em-dash prefix
   - **3 testimonial cards total**
- **No CTA in this section**
- **No photo slots in testimonials**

---

### Section 6: Final Value Stack + 1-Click CTA
- **Background:** `bg-ivory` (#FAF5EE)
- **Padding:** `py-20 md:py-28 lg:py-36`
- **Overflow:** `overflow-hidden`
- **Container:** `max-w-2xl mx-auto px-6 text-center relative z-10`
- **Diamond deco:** `right-[8%] top-[5%]`, stroke #E8C4B0

**Components (in order):**
1. **Overline:** `text-gold` — "Your Investment"
2. **H2:** `text-2xl md:text-3xl lg:text-4xl font-semibold text-charcoal leading-tight mb-8` / `letter-spacing: -0.02em`
3. **Value stack cards:** `space-y-4 text-left mb-8`
   - Each card: `bg-champagne/40 rounded-2xl p-5 border border-blush/30`
   - Shadow: `0 8px 30px rgba(139,26,58,0.04)`
   - Title line: `font-body text-base font-semibold text-charcoal mb-1` with price in `text-burgundy font-normal`
   - Description: `font-body text-xs text-charcoal/50`
   - **2 value stack cards:**
     - "Lifetime Access to the Signature Program ($488)"
     - "FREE 1-Month Access to the Community ($44)"
4. **Detailed breakdown card:**
   - Container: `bg-white rounded-2xl p-6 md:p-8 border border-blush/30 mb-8`
   - Shadow: `0 20px 60px rgba(139,26,58,0.06), 0 8px 25px rgba(139,26,58,0.03)`
   - Heading: `font-display text-lg font-semibold text-charcoal mb-6` — "What You Get When You Join Today"
   - Line items: `space-y-3 text-left mb-6`
     - Each row: `flex justify-between items-center border-b border-blush/30 pb-3` (last item no border)
     - Left: `font-body text-sm text-charcoal/70`
     - Right: `font-body text-sm text-charcoal/45`
     - Bonus labels: `text-burgundy font-semibold` (BONUS #1, #2, #3)
   - **4 line items:**
     1. "Lifetime Access to the Program" — "(Value: $488)"
     2. "BONUS #1: The Workbook" — "Included"
     3. "BONUS #2: Embodied Meditations" — "Included"
     4. "BONUS #3: 1 Month Community Access" — "(Value: $44)"
   - Bottom total area: `pt-4 border-t border-blush/30`
     - Total value: `font-body text-xs text-charcoal/45 mb-1` — "Total Value: ~~$532~~"
     - Final price: `font-display text-2xl font-bold text-charcoal` — "Yours Today for only **$288**" (price in `text-burgundy`)
5. **CTA:** `.cta-primary font-body font-bold text-sm uppercase tracking-button inline-block w-full max-w-md px-10 py-4 rounded-lg`
   - Text: "Add to Order"
   - Href: `#`
6. **1-click notice:** `mt-2 font-body text-[10px] text-charcoal/30`
7. **Decline link:** `mt-4` containing `a.decline-link font-body text-xs text-charcoal/40 hover:text-charcoal/60`
   - Text: "No thanks, I'll skip this offer"
   - Href: `#`

---

## Photo Placement Map

| # | Section | Slot Name | Aspect Ratio | Dimensions | Orientation | Overlay | Border Radius |
|---|---------|-----------|-------------|------------|-------------|---------|---------------|
| 1 | Sec 2 | Program image | 16:9 (aspect-video) | 800x450 | Landscape | `bg-gradient-to-t from-burgundy-darker/20 to-transparent` | `rounded-2xl` |
| 2 | Sec 3 | Video Lessons | 4:3 (aspect-[4/3]) | 600x450 | Landscape | `bg-gradient-to-t from-burgundy-darker/20 to-transparent` | `rounded-2xl` |
| 3 | Sec 3 | Workbook | 4:3 (aspect-[4/3]) | 600x450 | Landscape | `bg-gradient-to-t from-burgundy-darker/20 to-transparent` | `rounded-2xl` |
| 4 | Sec 3 | Meditations | 4:3 (aspect-[4/3]) | 600x450 | Landscape | `bg-gradient-to-t from-burgundy-darker/20 to-transparent` | `rounded-2xl` |

All images use:
- `w-full h-full object-cover`
- Rounded container: `rounded-2xl overflow-hidden`
- Gradient overlay as an `absolute inset-0` div
- Image shadow on the container (not the img element)

---

## Interactive Elements

### CTA Primary (`.cta-primary`)
```css
/* Default */
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
Tailwind classes on buttons: `font-body font-bold text-sm uppercase tracking-button inline-block px-10 py-4 rounded-lg`
Full-width variant: adds `w-full max-w-md`

### CTA Gold (`.cta-gold`)
```css
/* Default */
background: #C9963A;
color: #34161B;
box-shadow: 0 4px 15px rgba(201,150,58,0.3), 0 2px 6px rgba(201,150,58,0.15);
transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
            box-shadow 0.3s ease,
            opacity 0.3s ease;

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
Tailwind classes: `font-body font-bold text-xs uppercase tracking-button w-full md:w-auto text-center px-8 py-2.5 rounded`

### Countdown Timer
- Container: `bg-burgundy-darker/90 backdrop-blur-sm rounded-full px-8 py-4 border border-champagne/10`
- Displayed as `inline-flex flex-col items-center`
- Numbers: `font-family: 'Cormorant Garamond', serif; font-weight: 600; font-size: 2.5rem; line-height: 1;` (2rem on mobile < 768px)
- Labels: `font-size: 0.65rem; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 600;`
- Color: `text-champagne` (#F5E6D0)
- Separator colon: `text-champagne/30`
- Starts at 15 minutes (900 seconds), counts down by 1 each second
- Uses `setInterval(update, 1000)`, pads with leading zeros via `padStart(2, '0')`
- Stops at 0 (does not go negative)

### Progress Bar
- 3 steps: Registered (completed), Upgraded (completed), Special Offer (active)
- Completed steps: `w-6 h-6 rounded-full bg-burgundy/30` with checkmark SVG
- Active step: `w-6 h-6 rounded-full bg-burgundy-light` with number, shadow `0 2px 8px rgba(168,32,80,0.2)`
- Connectors: `w-8 md:w-16 h-px` — completed connector `bg-burgundy/30`, pending connector `bg-blush/50`

### Sticky Top Bar
```css
.sticky-top-cta {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
              box-shadow 0.3s ease;
}
```
- Position: `fixed top-0 left-0 right-0 z-50`
- Behavior: Hides via `translateY(-100%)` when `#checkout` is in viewport; shows via `translateY(0)` otherwise
- IntersectionObserver threshold: `0.1`

### Sticky Mobile CTA
```css
.sticky-cta {
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
  transform: translateY(100%);
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}
.sticky-cta.show { transform: translateY(0); }
```
- **Hidden on tablet/desktop:** `@media (min-width: 768px) { .sticky-cta { display: none; } }`
- Button inside: `.cta-primary font-body font-bold text-sm uppercase tracking-button py-3.5 rounded-lg block text-center w-full`
- Text: "Add to Order -- $288"
- Href: `#checkout`
- Show logic: shows when `scrollY > 200` AND `#checkout` is NOT visible in viewport; hides otherwise

### Decline Link
```css
.decline-link {
  transition: color 0.3s ease, opacity 0.3s ease;
}
.decline-link:hover {
  opacity: 0.8;
}
```
Tailwind: `font-body text-xs text-charcoal/40 hover:text-charcoal/60`

### 1-Click Charge Notice
- Placement: Below CTA in Section 1 and Section 6
- Styling: `mt-2 font-body text-[10px] text-charcoal/30`
- Text: "By clicking this button, your saved payment method will be charged $288 instantly."

### Component Cards (Section 3 image containers)
```css
.component-card {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease;
}
.component-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 40px rgba(139,26,58,0.08), 0 4px 15px rgba(139,26,58,0.04);
}
```
Note: This CSS class is defined but not explicitly applied to any element in the current HTML. It is available for use on Section 3 components.

---

## Responsive Breakpoints

### Mobile (< 768px)
- Sticky top bar: CTA is `w-full`, left text hidden (`hidden md:block`)
- Sticky mobile CTA: visible (fixed bottom)
- Progress bar: `gap-2`, `text-xs`, connectors `w-8`
- H1: `text-3xl`
- H2: `text-2xl`
- Section padding: `py-12` (Sec 1), `py-16` (Sec 2), `py-20` (Sec 3, 4, 5, 6)
- Countdown numbers: `2rem` (overridden from 2.5rem)
- Component grids (Sec 3): single column, stacked
- Workbook component: image on top (order-1), text below (order-2)
- Outcome grid (Sec 4): single column
- Testimonial grid (Sec 5): single column
- Pricing: `text-4xl`
- Value stack breakdown card: `p-6`

### Tablet (768px+)
- Sticky top bar: CTA is `w-auto`, left text visible
- Sticky mobile CTA: `display: none`
- Progress bar: `gap-4`, `text-sm`, connectors `w-16`
- H1: `text-5xl`
- H2: `text-4xl`
- Component grids (Sec 3): 2 columns side by side
- Workbook: image right (order-2), text left (order-1)
- Outcome grid (Sec 4): 2 columns
- Testimonial grid (Sec 5): 3 columns
- Section padding: `md:py-16` (Sec 1), `md:py-24` (Sec 2), `md:py-28` (Sec 3, 4, 5, 6)

### Desktop (1024px+)
- H1: `lg:text-[3.5rem]` (56px)
- H2: `lg:text-5xl` (48px)
- H2 variant (Sec 6): `lg:text-4xl` (36px)
- Section padding: `lg:py-36` (Sec 3, 4, 5, 6)
- Value stack breakdown card: `md:p-8`

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

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
}
```

### IntersectionObserver Config
```javascript
threshold: 0.05
rootMargin: '0px 0px 80px 0px'
```
- Elements get `.visible` class when 5% visible (with 80px bottom margin lookahead)
- Once revealed, observer stops watching that element (`observer.unobserve(entry.target)`)
- Fallback: after 1500ms, all unrevealed elements get `.visible` class

### Transition Timing Functions Used
| Purpose | Easing |
|---------|--------|
| Reveal animations | `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out expo) |
| CTA button hover | `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring/overshoot) |
| Sticky bar show/hide | `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out expo) |
| Decline link | `ease` (linear-ish) |
| Component card hover | `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out expo) |

### Properties Animated
- `opacity` and `transform` only (per CLAUDE.md anti-generic guardrails)
- Exception: `box-shadow` transitions on CTAs and sticky bar (via `ease`)
- Exception: `color` transition on decline link (via `ease`)

---

## Global Styles

### Base
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

### Scrollbar
```css
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #FAF5EE; }
::-webkit-scrollbar-thumb { background: #E8C4B0; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #C9963A; }
```

---

## CTA Inventory

| # | Section | Text | Href | Style | Width |
|---|---------|------|------|-------|-------|
| 1 | Sticky top bar | "Add to Order" | `#checkout` | `.cta-gold` | `w-full md:w-auto` |
| 2 | Section 1 (Hero) | "Add to Order" | `#` | `.cta-primary` | `w-full max-w-md` |
| 3 | Section 2 (Program) | "Begin Your Journey" | `#checkout` | `.cta-primary` | auto (inline) |
| 4 | Section 4 (Outcomes) | "Begin Your Journey" | `#checkout` | `.cta-primary` | auto (inline) |
| 5 | Section 6 (Value Stack) | "Add to Order" | `#` | `.cta-primary` | `w-full max-w-md` |
| 6 | Sticky mobile CTA | "Add to Order -- $288" | `#checkout` | `.cta-primary` | `w-full block` |
| 7 | Section 6 (Decline) | "No thanks, I'll skip this offer" | `#` | `.decline-link` | auto (inline) |

---

## Container Width Map

| Section | Container Max-Width |
|---------|-------------------|
| Sticky top bar | `max-w-4xl` (896px) |
| Progress bar | `max-w-2xl` (672px) |
| Section 1 (Hero) | `max-w-3xl` (768px) |
| Section 2 (Program) | `max-w-4xl` (896px), image `max-w-2xl`, text `max-w-2xl`, outcomes list `max-w-md` |
| Section 3 (What's Inside) | `max-w-4xl` (896px) |
| Section 4 (Outcomes) | `max-w-4xl` (896px), grid `max-w-3xl` |
| Section 5 (Testimonials) | `max-w-4xl` (896px) |
| Section 6 (Value Stack) | `max-w-2xl` (672px) |

All containers use `mx-auto px-6` (24px horizontal padding) except Progress bar which uses `px-4` (16px).
