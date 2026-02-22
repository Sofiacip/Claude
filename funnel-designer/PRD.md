__FUNNEL DESIGNER__

Product Requirements Document

Impact OS — Internal Tool | Scale for Impact Agency

# __PART 1 — TECHNICAL SPECIFICATION__

## __1\.1 What It Is__

Funnel Designer is a standalone internal tool that takes three inputs — a brand package, a set of copy documents \(one per page\), and a funnel type selection — and outputs a complete, fully branded, mobile\-responsive funnel: all pages built, QA\-checked, and deployed to Vercel with live URLs returned\.

It is the third component of Impact OS, sitting downstream of the Brand Module and the Copy Module\.

__Where It Fits in Impact OS__

__Copy Module__

Produces a Word doc per page with all funnel copy

__Brand Module__

Produces a brand\_package\.zip with assets \+ brand guide

__Funnel Designer__

Consumes both → outputs a complete deployed funnel

## __1\.2 The Problem It Solves__

Course creators currently spend 2–4 weeks and $1,000–$5,000 building funnel pages — hiring designers, developers, and copywriters separately, then stitching everything together\. Funnel Designer compresses that into 20 minutes by automating the entire pipeline while preserving the quality standards of a professionally designed funnel\.

## __1\.3 Who Uses It__

Alessio and the Scale for Impact agency team\. Internal use only\. Password protected\.

## __1\.4 Funnel Types__

Funnel Designer is built to support multiple funnel types\. Each funnel type has its own set of page templates\. The pipeline is identical for all funnel types — only the templates change\. Adding a new funnel type requires only adding new JSON template files; no pipeline code changes\.

__Funnel Type__

__Status__

__Pages__

__Webinar Funnel__

__Phase 1 — Build now__

Landing, Upgrade \(OTO1\), Upsell \(OTO2\), Thank You, Replay, Sales

__Low Ticket Funnel__

Phase 2 — Templates only

TBD

__Summit Funnel__

Phase 3 — Templates only

TBD

__Challenge Funnel__

Phase 4 — Templates only

TBD

## __1\.5 The Three Inputs__

- __brand\_package\.zip — output from Brand Module \(logos, photos, colors\.md, fonts\.md, brand\_guide\.md\)__
- __Copy documents — one Word doc \(\.docx\) per funnel page, containing all copy for that page__
- __Funnel type — selected from dropdown \(Webinar Funnel for Phase 1\)__

## __1\.6 The Output__

- 6 deployed HTML pages on Vercel \(one per funnel page\)
- 6 live URLs returned to the team
- All pages: fully branded, mobile responsive, QA\-passed

## __1\.7 The 5\-Stage Pipeline__

__Stage__

__Name__

__What Happens__

__1__

__Ingest__

Upload brand package \+ copy docs\. Parse via mammoth\.js\. Extract brand values \(colors, fonts, logo, photos\)\. Validate all required copy slots are present\.

__2__

__Map__

Match copy from each Word doc to the correct section slots in the template\. Flag missing slots before building\.

__3__

__Build__

Claude API generates a single index\.html per page using the template \+ brand \+ copy\. Tailwind CDN\. All styles inline\.

__4__

__QA__

Playwright screenshots at 375px / 768px / 1280px\. Claude vision reviews against template spec\. Minimum 2 rounds per page\.

__5__

__Deploy__

Push to GitHub via MCP\. Vercel auto\-deploys\. Return 6 live URLs\.

## __1\.8 Tech Stack__

- Runtime: Node\.js 20\+
- Backend: Express
- Page generation: Claude API \(claude\-sonnet\-4\-6\)
- Copy parsing: mammoth\.js
- QA screenshots: Playwright
- Deployment: GitHub MCP \+ Vercel MCP
- Progress streaming: Server\-Sent Events \(SSE\)
- Frontend: Single HTML file, Tailwind CDN, vanilla JS

## __1\.9 File Structure__

funnel\-designer/

  /templates/

    /webinar/

      landing\.json

      upgrade\.json

      upsell\.json

      thank\_you\.json

      replay\.json

      sales\.json

  /uploads/          ← temp files \(brand zip \+ copy docs\)

  /output/           ← generated HTML pages

  /brand/            ← extracted brand package

  server\.js          ← Express backend

  ingest\.js          ← parse brand \+ copy

  mapper\.js          ← match copy to template slots

  builder\.js         ← call Claude API, generate HTML

  qa\.js              ← Playwright screenshots \+ review

  deploy\.js          ← GitHub \+ Vercel MCP

  public/index\.html  ← frontend UI

  CLAUDE\.md          ← page generation rules

  \.env               ← secrets \(never commit\)

  \.env\.example       ← template with no secrets

## __1\.10 CLAUDE\.md Rules \(Page Generation\)__

The CLAUDE\.md in this project governs how Claude Code behaves when generating pages\. It inherits all rules from the Web Designer CLAUDE\.md \(frontend\-design skill, anti\-generic guardrails, screenshot QA loop, mobile\-first rules\) and adds funnel\-specific rules on top\. It overrides nothing from the Web Designer\.

- Read frontend\-design skill before writing any frontend code, every session
- Never default to Tailwind blue — all colors from brand package
- Single index\.html per page, Tailwind CDN only, all styles inline
- Near\-black \(\#0f0f0f\) and off\-white \(\#f5f5f5\), never pure black/white
- Screenshot at 375px, 768px, 1280px — minimum 3 QA rounds per page
- Sticky CTA: landing, upgrade, upsell, sales pages ONLY \(not thank\_you, replay, live\)
- Do not add sections not in the template\. Do not improve the template — follow it\.

## __1\.11 JSON Template Format__

Each template is a JSON file defining the page structure\. Claude reads this file during the Build stage to know exactly which sections to render, in which order, and what copy slots to fill\.

\{

  "page\_type": "landing\_page",

  "funnel": "webinar",

  "sticky\_cta": true,

  "nav": false,

  "sections": \[

    \{

      "id": "S1",

      "name": "Logo Bar",

      "component": "logo\_bar",

      "slots": \["logo"\],

      "mobile": "centered, 60px height"

    \},

    \{

      "id": "S5",

      "name": "Registration Form",

      "component": "form",

      "anchor": "\#form",

      "slots": \["cta\_text", "form\_fields"\],

      "mobile": "full width, stacked fields"

    \}

  \]

\}

## __1\.12 QA Checklist__

Applied to every page after each build round:

- Brand colors match brand\_package exactly
- Fonts loading correctly \(Google Fonts or system fonts from brand\_guide\)
- Logo renders at correct size and placement
- All template sections present in correct order
- No placeholder copy remaining \(no \[brackets\] visible\)
- All CTA buttons linked correctly \(no \# placeholders\)
- Anchor links work \(\#form scrolls to form\)
- Countdown timer present on: landing, upgrade, upsell pages
- Progress bar present on: upgrade, upsell pages
- Decline link present on: upgrade, upsell pages
- 1\-click confirmation note present on: upsell page
- Value stack shows struck\-through original price
- No navigation on: landing, upgrade, upsell, thank\_you
- Mobile: single column at 375px, no overflow, no overlap
- Sticky CTA visible and functional on: landing, upgrade, upsell, sales
- Sticky CTA absent on: thank\_you, replay, live

## __1\.13 The App Interface__

### __Screen 1 — Login__

Simple password protection\. No user accounts needed for now\.

### __Screen 2 — New Funnel__

- Dropdown: Select funnel type
- Upload: Brand package \.zip
- Upload: Word docs \(one per page, labeled by page type\)
- Text field: Client name
- Button: Build Funnel

### __Screen 3 — Progress__

Live SSE status updates per page: Building Landing Page\.\.\. ✓ → Building Upgrade Page\.\.\. ✓ → etc\.

### __Screen 4 — Review__

- Thumbnail preview of each page at mobile and desktop
- Approve or request changes per page individually
- Changes go back to Build stage for that page only

### __Screen 5 — Deploy__

- Summary: all 6 pages with status
- Deploy All to Vercel button
- Returns live URLs for all 6 pages

## __1\.14 Success Metrics__

- Time from inputs to live URLs: under 30 minutes
- QA pass rate on first round: above 80%
- Brand accuracy: 100% \(colors, fonts, logo match brand package\)
- Placeholder text in deployed pages: zero
- Mobile responsive at 375px: 100%

# __PART 2 — WEBINAR FUNNEL TEMPLATE SPECIFICATIONS__

The following specifications were reverse\-engineered from real high\-performing webinar funnels\. Each template defines the exact section order, copy slots, and design rules for that page type\.

## __2\.1 Landing Page__

__Landing Page — Overview__

__Purpose__

Main registration page\. Primary goal: get the email and name\.

__Nav__

None — no exit points

__Sticky CTA__

Yes — links to \#form anchor

__Timer__

Countdown appears twice \(S6 and S16\)

__Form__

Appears twice \(S5 and S16\)

__Total sections__

17

### __Section Order__

1. S1 — Logo Bar: Centered logo, no nav links, no distractions
2. S2 — Pre\-Headline: Short credibility line above main headline
3. S3 — Hero Headline: Main benefit\-driven headline\. FREE always capitalized\.
4. S4 — Hero Subheadline: Elaborates on the promise
5. S5 — Registration Form: Name \+ email fields\. Anchor: \#form\. CTA button\.
6. S6 — Countdown Timer: Date/time of webinar\. Creates urgency\.
7. S7 — Social Proof Stats: 3–4 numbers \(students, results, years\)
8. S8 — Media Logos: 'As seen in' logos bar
9. S9 — Pain Section: 'Does this feel familiar?' 3–5 pain points as checklist
10. S10 — Bridge Paragraph: Transition from pain to solution
11. S11 — What You'll Learn: Numbered outcomes list
12. S12 — Mid\-Page CTA: Button linking to \#form
13. S13 — Meet Your Guide: Host photo \+ bio \+ credentials
14. S14 — Testimonials: 3–5 cards with name, photo, result
15. S15 — Value Stack: Bonuses listed with individual values\. Total value shown\.
16. S16 — Final CTA Block: Form repeated\. Timer repeated\.
17. S17 — Footer: Terms, privacy links only\. No nav\.

### __Copy Slots__

- \[webinar\_title\] — used in headline and meta
- \[webinar\_date\] — date string, used in timer and calendar
- \[host\_name\] — used in bio section and form CTA
- \[host\_credentials\] — short credential line under host name
- \[hero\_subheadline\] — S4 body text
- \[pain\_points\] — array of 3–5 pain statements for S9
- \[bridge\_paragraph\] — S10 transition copy
- \[outcomes\] — array of numbered learning outcomes for S11
- \[bio\_text\] — S13 host biography
- \[testimonials\] — array with name, result, photo for S14
- \[bonuses\] — array with name and value for S15
- \[total\_value\] — total value shown in S15
- \[cta\_text\] — button copy used on all CTAs

### __Key Design Rules__

- FREE always uppercase everywhere it appears
- CTA buttons always link to \#form anchor \(never external in pre\-registration state\)
- Timer format: Days / Hours / Minutes / Seconds
- Pain points styled as checkbox list \(unchecked visual state\)
- Value stack: each bonus shows name \+ individual value, final line shows total

## __2\.2 Upgrade Page \(OTO1\)__

__Upgrade Page — Overview__

__Purpose__

First upsell immediately after registration\. Goal: one\-click upgrade\.

__Nav__

None — no exit points except decline link

__Sticky CTA__

Yes

__Timer__

Minutes \+ seconds only \(maximum urgency\)

__Progress Bar__

Yes — top of page \(Registered ✓ → Upgrade → Enjoy\)

__Total sections__

12

### __Section Order__

1. S1 — Progress Bar: 3\-step visual \(Registered ✓ → Upgrade → Enjoy\)\. Creates commitment bias\.
2. S2 — Congratulations Hook: Acknowledges registration, builds momentum
3. S3 — Offer Headline: States the upgrade offer clearly
4. S4 — Urgency Warning: ⚠️ DO NOT CLOSE — this offer expires
5. S5 — Discount Framing: e\.g\. '95% OFF — Today Only'
6. S6 — Bullet Benefits: 3–5 benefits of upgrading
7. S7 — Countdown Timer: Minutes \+ seconds only
8. S8 — Primary CTA: Buy button with price
9. S9 — Decline Link: 'No thanks, I don't want to \[benefit\]' — loss framing
10. S10 — Product Details: What exactly they're getting
11. S11 — Value Stack: Items \+ individual values \+ total value
12. S12 — Repeat CTA: Button \+ decline link again

### __Copy Slots__

- \[oto1\_headline\] — S3 offer headline
- \[oto1\_benefits\] — array of 3–5 bullet benefits
- \[oto1\_items\] — array with name and value for value stack
- \[oto1\_price\] — sale price shown on button
- \[oto1\_regular\_price\] — struck\-through original price
- \[oto1\_checkout\_url\] — payment link
- \[thankyou\_url\] — decline link destination

### __Key Design Rules__

- Progress bar: Registered step is checked/completed, Upgrade step is active/highlighted
- Timer shows minutes:seconds only — no days or hours — creates maximum urgency
- Decline link uses loss framing: 'I don't want to \[miss the benefit\]'
- Price: struck\-through original next to bold sale price
- Urgency warning \(S4\) uses warning icon and high\-contrast color

## __2\.3 One\-Click Upsell Page \(OTO2\)__

__Upsell Page — Overview__

__Purpose__

Second upsell\. Softer tone\. One\-click purchase — payment already saved\.

__Nav__

None

__Sticky CTA__

Yes

__Timer__

Countdown present

__Progress Bar__

Yes — updated step \(Registered ✓ → Upgraded ✓ → Bonus Offer\)

__1\-Click Note__

Yes — legally required disclosure

__Total sections__

16

### __Section Order__

1. S1 — Progress Bar: Updated to show OTO1 completed
2. S2 — Transition Hook: 'One more thing before you go\.\.\.' — gentle, not pushy
3. S3 — Transformation Headline: Outcome\-focused, aspirational
4. S4 — Offer Framing: What makes this offer unique / why now
5. S5 — Strikethrough Pricing: Original price crossed out, sale price bold
6. S6 — Countdown Timer
7. S7 — CTA: 'Add to My Order' button
8. S8 — Program Overview: What this program is in 2–3 sentences
9. S9 — Numbered Outcomes: What they'll achieve
10. S10 — Image Break: Visual of the product / program
11. S11 — What's Inside: Components of the program
12. S12 — Detailed Learning Outcomes: Deeper breakdown
13. S13 — Testimonials: Social proof specific to this offer
14. S14 — Full Value Stack: All components \+ total value
15. S15 — Enrollment CTA: Final button \+ decline link
16. S16 — 1\-Click Confirmation Note: 'By clicking above, you authorize this charge to the payment method on file'

### __Copy Slots__

- \[oto2\_headline\] — S3 transformation headline
- \[program\_name\] — name of the program being offered
- \[program\_overview\] — S8 2–3 sentence description
- \[program\_outcomes\] — array of numbered outcomes
- \[program\_components\] — array of what's inside
- \[learning\_outcomes\] — detailed breakdown
- \[oto2\_testimonials\] — array with name, result, photo
- \[oto2\_items\] — array for value stack
- \[oto2\_price\] — sale price
- \[oto2\_regular\_price\] — struck\-through original price
- \[oto2\_checkout\_url\] — 1\-click payment link

### __Key Design Rules__

- Tone is softer than OTO1 — 'gentle invitation', not hard sell
- Progress bar shows OTO1 step as completed
- 1\-click note is mandatory — it is a legal disclosure, not optional
- 'Add to My Order' framing \(not 'Buy'\) — reinforces ease and continuity

## __2\.4 Thank You Page__

__Thank You Page — Overview__

__Purpose__

Confirm registration\. Tell them what to do next\. Reduce no\-shows\.

__Nav__

None

__Sticky CTA__

None

__Total sections__

6

### __Section Order__

1. S1 — Hero Image: Celebratory or brand visual
2. S2 — Confirmation Headline: 'You're In\!' or equivalent
3. S3 — Emotional Acknowledgment: Validates their decision
4. S4 — Email Check: 'Check your inbox for the confirmation email'
5. S5 — Step 1: Add to Calendar — pre\-built Google Calendar link with Zoom URL \+ date \+ time
6. S6 — Step 2: Invite a Friend — referral CTA with share link

### __Copy Slots__

- \[confirmation\_headline\] — S2 main headline
- \[acknowledgment\_text\] — S3 emotional paragraph
- \[webinar\_date\] — used in calendar link
- \[webinar\_time\] — used in calendar link
- \[webinar\_zoom\_url\] — Zoom join link
- \[calendar\_link\] — pre\-built Google Calendar URL
- \[referral\_copy\] — S6 share invite copy

### __Key Design Rules__

- Shortest page in the funnel — 6 sections only
- Calendar link must be pre\-built: encodes event title, date, time, Zoom URL
- Tone is celebratory and warm — the hard sell is over
- No navigation, no distractions — just next steps

## __2\.5 Replay Page__

__Replay Page — Overview__

__Purpose__

Post\-webinar replay access\. Warm traffic\. Soft sell to main offer\.

__Nav__

Full navigation restored — user already converted

__Sticky CTA__

None

__Total sections__

6

### __Section Order__

1. S1 — Full Navigation: Brand nav restored
2. S2 — Page Title: 'Replay: \[Webinar Title\]'
3. S3 — Video Embed: Full\-width video player
4. S4 — Primary CTA Below Video: Direct link to sales page or checkout
5. S5 — Newsletter Signup: Fallback conversion for those not ready to buy
6. S6 — Full Footer: Normal footer with all links

### __Copy Slots__

- \[webinar\_title\] — used in page title
- \[video\_embed\_url\] — Vimeo or YouTube embed URL
- \[replay\_cta\_text\] — CTA button copy below video
- \[replay\_cta\_url\] — destination \(sales page or checkout\)
- \[newsletter\_headline\] — S5 signup headline

### __Key Design Rules__

- Full navigation restored — this user is already a lead, exploration is fine
- CTA placed immediately below video — highest intent moment
- Newsletter is a fallback, not the primary goal
- No urgency mechanics — replay is evergreen access

## __2\.6 Sales Page__

__Sales Page — Overview__

__Purpose__

Long\-form sales page for the main offer\. Converts warm traffic from replay\.

__Nav__

Optional — can include brand nav or go navless

__Sticky CTA__

Yes — throughout the page

__Timer__

Urgency banner at top

__Total sections__

23

### __Section Order__

1. S1 — Urgency Banner: Timer \+ 'Enrollment closes \[date\]'
2. S2 — Pre\-Headline: Short credibility or context line
3. S3 — Program Headline: Main benefit headline
4. S4 — Hero Subheadline: Elaborates on the promise
5. S5 — Primary CTA: Early CTA for warm traffic who arrived ready to buy
6. S6 — Problem Agitation: Describes the painful current state
7. S7 — Root Cause Reframe: 'The real reason you're stuck is\.\.\.' — emotional turning point
8. S8 — Conditioning Story: Host's personal story / journey
9. S9 — Readiness Bridge: 'You're ready if\.\.\.' — qualification
10. S10 — Program Introduction: Introduces the solution
11. S11 — Numbered Pillars: Core transformation pillars of the program
12. S12 — CTA Repeat
13. S13 — Meet Your Coach: Bio \+ credentials \+ photo
14. S14 — Testimonials Round 1: 3–5 result\-focused testimonials
15. S15 — What's Inside: Program components overview
16. S16 — Curriculum Breakdown: Module\-by\-module detail
17. S17 — Bonuses: Bonus stack with individual values
18. S18 — CTA Repeat
19. S19 — Guarantee: Money\-back guarantee with name and terms
20. S20 — Full Value Stack: All components \+ bonuses \+ total value
21. S21 — FAQ: 5–8 objection\-handling questions and answers
22. S22 — Final Value Stack \+ CTA: Last chance to buy
23. S23 — Host Photo \+ Footer: Warm closing image \+ full footer

### __Copy Slots__

- \[program\_headline\] — S3 main headline
- \[program\_subheadline\] — S4 subheadline
- \[problem\_observation\] — S6 problem description
- \[pain\_bullets\] — S6 array of pain points
- \[root\_cause\] — S7 reframe paragraph
- \[conditioning\_story\] — S8 host story
- \[program\_pillars\] — S11 array of pillars
- \[host\_bio\] — S13 biography
- \[testimonials\_r1\] — S14 array with name, result, photo
- \[program\_components\] — S15 what's inside list
- \[curriculum\] — S16 module breakdown
- \[bonuses\] — S17 bonus stack with values
- \[guarantee\_name\] — S19 guarantee name \(e\.g\. '30\-Day Money Back'\)
- \[guarantee\_days\] — number of days
- \[guarantee\_terms\] — S19 guarantee terms text
- \[value\_stack\_items\] — S20 full value stack array
- \[total\_value\] — total value shown
- \[price\_full\] — one\-time full price
- \[price\_plan\] — payment plan option
- \[checkout\_url\] — payment link
- \[faq\_items\] — S21 array of question \+ answer pairs

### __Key Design Rules__

- S5 early CTA exists specifically for warm traffic — do not remove it
- S7 root cause reframe is the emotional turning point — most important copy on the page
- Payment plan shown alongside full price — not hidden
- FAQ placed after pricing — removes final objections at highest intent moment
- Urgency banner \(S1\) persists at top or as sticky element

# __PART 3 — ROADMAP__

## __3\.1 Phase Roadmap__

__Phase__

__Funnel Type__

__Scope__

__Phase 1__

Webinar Funnel

6 pages built\. Pipeline complete\. Local upload\. Vercel deploy\. Templates reverse\-engineered from real funnels\.

__Phase 2__

Low Ticket Funnel

Add /templates/low\_ticket/ JSON files\. No pipeline changes\.

__Phase 3__

Summit Funnel

Add /templates/summit/ JSON files\.

__Phase 4__

Challenge Funnel

Add /templates/challenge/ JSON files\.

## __3\.2 Out of Scope \(Phase 1\)__

- Course or coaching funnel templates
- In\-app copy editing
- Client\-facing access
- A/B testing variations
- Multi\-user accounts

Funnel Designer — Impact OS

Scale for Impact Agency — Internal Use Only

