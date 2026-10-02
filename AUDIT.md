# Expat Protect Hub — Phase 1 Audit

Prepared: 2026-10-02
Scope: Audit only. No production code has been modified.
Reference brief: `SEO and AIO Update - Expat protect.docx`

---

## 1. Current framework

- **Static multi-page HTML site**, served directly by Netlify from the repo root (`netlify.toml → publish = "."`).
- **No bundler, no SPA framework, no package.json at repo root.** Each `.html` file has its own inline `<style>` and inline/external scripts.
- Shared assets live in `/assets/` (logo, lifestyle images, `phone-nsn.js`).
- Third-party runtime: Google Fonts (Inter), EmailJS browser SDK, Meta Pixel.
- Netlify also builds a separate React SPA at `/crm/*` from `expatprotecthub-crm/` — out of scope for this audit.

**Design-system tokens** (defined inline on each page, with slightly different variable names from file to file):
`--navy #1B263B`, `--teal #0FB9B1`, `--teal-dark #0B6E6B`, `--cream #F8F9FA`, `--gold #E9B949`, `--grey #6B7280`, `--light #E4E7EB`, Inter font.
`index.html` uses legacy aliases (`--green/--coral/--sage`) that map to the same navy/teal values — worth consolidating but not urgent.

---

## 2. Current routes

Clean URLs declared in `_redirects`, served by Netlify:

| Clean URL | Actual file | Indexable? |
|---|---|---|
| `/` | `index.html` | yes |
| `/expat-health-insurance` | `expat-health-insurance.html` | yes |
| `/free-expat-guide` | `free-expat-guide.html` | yes |
| `/find-my-plan` | `find-my-plan.html` | yes |
| `/life-insurance` | `life-insurance.html` | yes |
| `/life-insurance/quote` | `life-insurance-quote.html` | yes |
| `/about` | `about.html` | yes |
| `/claim` | `claim.html` | yes |
| `/faq` | `faq.html` | yes |
| `/privacy` | `privacy.html` | yes |
| `/terms` | `terms.html` | yes |
| `/thank-you` | `thank-you.html` | **noindex (meta + X-Robots-Tag header)** |
| `/thailand-health-insurance` → `/expat-health-insurance` | 301 | — |
| 5 `blog-*` posts | raw `.html` filename | yes (via sitemap) |
| `/crm/*` | React SPA | out of scope |

**No clean URLs for the blog posts** — they use `/blog-expat-health-insurance-comparison-southeast-asia-2026` etc. Not broken, but a `/blog/` prefix would be cleaner.

---

## 3. Current SEO issues

### 3.1 Missing / empty metadata
| Page | Problem |
|---|---|
| `blog-international-health-insurance-guide-2026.html` | **Empty `<meta name="description">`** |
| `terms.html` | **Empty `<meta name="description">`** |
| `thank-you.html` | Empty description (acceptable — noindex) |

### 3.2 Robots meta inconsistency
Only four pages have an explicit `<meta name="robots">` tag (`expat-health-insurance`, `find-my-plan`, `free-expat-guide`, `life-insurance`, `life-insurance-quote` → `index,follow`; `thank-you` → `noindex`). All other indexable pages (including `index.html`, blog posts, `about`, `faq`, `claim`, `privacy`, `terms`) rely on the implicit default. Not broken, but inconsistent.

### 3.3 Title / description duplication risk
`expat-health-insurance.html` and `find-my-plan.html` both target the same primary keyword cluster ("expat health insurance, quote") and have overlapping meta descriptions ("Get a free quote in …"). Google may canonicalise one over the other.

### 3.4 JSON-LD coverage
Only `index.html` carries structured data (Organization + WebSite). None of the service pages, blog posts, or FAQ page have JSON-LD. **Nothing has BreadcrumbList, FAQPage, Service, or Article schema.**

### 3.5 No breadcrumbs
No visible breadcrumb UI and no `BreadcrumbList` JSON-LD anywhere.

### 3.6 No custom 404 page
`404.html` is missing. Netlify falls back to its default plain error page — poor branding and poor retention signal.

### 3.7 Image optimisation gaps
- Hero images in `/assets/` are JPEGs with no WebP/AVIF alternatives.
- No `width`/`height` attributes declared on content `<img>` tags → **layout shift risk (CLS)**.
- No `loading="lazy"` on below-the-fold images.

### 3.8 No internal cross-linking between service pages
`/life-insurance` barely links to `/expat-health-insurance` and vice versa. Blog posts rarely link to each other or back to the service pages beyond generic CTAs.

### 3.9 Sitemap minor
Sitemap looks correct (16 URLs, no `thank-you`/`signature` leaks). No `lastmod` dates, which Google now uses as a signal when they are accurate.

---

## 4. Current AIO (AI-search) issues

AIO is about making content legible to LLM-powered search (Google SGE, ChatGPT, Perplexity, Claude, Bing Copilot). Current state:

### 4.1 Missing direct-answer blocks
No page opens with a concise "What is X?" definition the way the brief wants. The homepage and `/expat-health-insurance` go straight into hero marketing copy without a factual summary that an LLM can quote.

### 4.2 Heading structure not question-based
Most H2s on service pages are promotional ("Built for life abroad", "How It Works"). LLMs favour question-shaped headings ("What is international health insurance?", "Who can apply?").

### 4.3 FAQ structure exists but is not marked up as FAQPage
`faq.html` has a `<details>` accordion with real Q&A, but no `FAQPage` JSON-LD. Life-insurance page has a FAQ section — also no schema.

### 4.4 Author / updated-date / reviewer attribution absent on blog posts
Checked all 5 blog posts: none carry a byline, published date, updated date, reviewer, or `Article` JSON-LD. E-E-A-T (Experience, Expertise, Authoritativeness, Trust) signals are the weakest part of the site.

### 4.5 Inconsistent terminology
"Expat health insurance" / "international health insurance" / "worldwide expat coverage" / "global medical insurance" used interchangeably without a defined canonical term.

### 4.6 Uncertainty not expressed
Promotional language is confident; policy limits, exclusions, and waiting-period language is sparse. LLMs down-weight pages that read like marketing-only without hedging.

---

## 5. Current UX and conversion issues

### 5.1 Three homepage lead forms
`index.html` has one large multi-step quote form (`#get-quote`, `name="expat-quote"`). It uses `destination_country` + `current_country`, while `find-my-plan` and `expat-health-insurance` use **different field names** (e.g. `nationality` vs `current_country`). This fragments any CRM analysis across source pages.

### 5.2 WhatsApp missing
Phase 9 of the brief recommends WhatsApp as a contact option. **No `wa.me` link exists anywhere on the site**, despite WhatsApp being how most Southeast Asian expats actually communicate.

### 5.3 "Not an insurance contract" language inconsistent
Life-insurance quote has clear "indicative premium" + "subject to underwriting" disclaimers. The health lead forms do not consistently say the quote is not an insurance contract.

### 5.4 Plan comparison table only on homepage
`index.html` has the only plan-comparison table. `/expat-health-insurance` promotes plan tiers in copy but never shows them side-by-side. Visitor who lands on `/expat-health-insurance` from an ad has to click Home to compare.

### 5.5 Three commented-out H1 A/B variants on `find-my-plan`
Not a real SEO problem (they're inside HTML comments) but it is dead code polluting the file and encouraging future accidental duplication.

### 5.6 Thank-you page conversion-tracking fine
`thank-you.html` fires `fbq('track','Lead')` with `content_name` based on the `?src=` query param, so EmailJS → thank-you redirect correctly logs the conversion. Confirmed working.

---

## 6. Current accessibility issues

### 6.1 Form labels
Spot-check of `life-insurance-quote.html` and `find-my-plan.html` form fields: `<label>` tags are present with `for=` references matching input `id`s. Good baseline.

### 6.2 Focus states
Most inputs have `:focus` styles via the design tokens. Buttons generally do not have a visible focus ring beyond the browser default — add explicit `:focus-visible` styles.

### 6.3 Colour contrast
Teal `#0FB9B1` on white has a contrast ratio of ~2.6:1 — **fails WCAG AA for body text** when used as a text colour. Mostly used for accents and CTAs where it's fine, but any teal body copy must be audited.
`#6B7280` (grey) on white = 4.65:1 — passes AA for body text.

### 6.4 Decorative images
Some hero/background images are implemented as CSS `background-image`, which is correct (no alt needed). Content images in blog posts not fully audited yet — flagged for Phase 11.

### 6.5 Reduced-motion
No `@media (prefers-reduced-motion)` queries anywhere. Site uses `transition: transform .2s` and smooth-scroll — fine for most but should respect user preference.

### 6.6 Keyboard navigation
`<details>` accordions on FAQ are natively keyboard-accessible. Custom chip radio groups on `/life-insurance/quote` wrap native `<input type="radio">` so they inherit keyboard support. **No obvious keyboard traps found.**

### 6.7 ARIA landmarks
`<header>`, `<nav>`, `<main>`, `<footer>` used inconsistently. Some pages wrap the whole body in `<section>` tags instead. Fix during Phase 11.

---

## 7. Current performance risks

### 7.1 Google Fonts blocking load
Every page loads Inter from `fonts.googleapis.com` with no `font-display` directive (lives in the Google CSS). Preconnect is set up correctly, but a `rel="preload"` for the specific woff2 would improve LCP.

### 7.2 EmailJS SDK on every form page
Loaded synchronously from CDN on 5 pages. Could `defer` the script tag on the form pages so it doesn't block render.

### 7.3 Meta Pixel on every page
Loaded synchronously on 17 pages. Standard pattern; acceptable.

### 7.4 Hero images not responsive
Single JPEG served to desktop and mobile. No `srcset` or `<picture>` with WebP/AVIF.

### 7.5 Inline CSS size
`index.html` is **200 KB** — most of that is inline CSS and JS plus the chatbot dialogue data. Could be externalised into a shared CSS file once, cached across pages. Low priority given no SPA.

### 7.6 No service worker / offline
Not relevant for a brochure site, but no manifest-driven install prompt either beyond the basic `site.webmanifest`.

---

## 8. Missing trust and insurance disclosures

### 8.1 Who contacts the customer after a form submit
Thank-you page says *"A specialist from Regency for Expats will be in touch within 24 hours"*. **Good** — this is now consistent after the earlier cleanup.
However, the actual quote forms on the main pages still say *"A specialist will call within 24 hours"* without naming Regency for Expats. Should be consistent across all forms.

### 8.2 Lead-generation disclosure
No page clearly states *"Expat Protect Hub is a referral/lead-generation service, not an authorised insurer. Policies are provided by Regency for Expats."* This is the single highest-priority insurance-transparency gap.

### 8.3 Underwriter / regulator information
`life-insurance.html` names "Regency Assurance" as the underwriter. **No page names a regulatory authority** (which jurisdiction? FCA? MAS? none at all?). The brief says "do not invent" — so this needs a human-confirmed statement from the business.

### 8.4 Policy wording / Terms of insurance
No downloadable policy wording document is linked anywhere. Life-insurance benefits schedule is shown but not linked to a signed policy document. Flag for TODO content from the business.

### 8.5 Complaints and ADR
No complaints procedure. UK/EU regulations typically require one. **TODO for the business**.

### 8.6 Marketing claims that may be unsupported
Grepped across the live pages. The following claims appear and should be reviewed:

| Claim | Pages | Notes |
|---|---|---|
| **"800+ hospitals worldwide"** | index, expat-health-insurance, find-my-plan | Need Regency confirmation of exact network size |
| **"30,000+ expats worldwide"** | index, expat-health, find-my-plan, free-guide, blog | Needs source |
| **"98% claims paid"** | expat-health-insurance | Needs source |
| **"Rated 4.9/5 by expats"** | expat-health-insurance | Should either show real reviews with Review/AggregateRating schema or be removed |
| **"100% acceptance"** | ~10 files (in hero) | Only true for guaranteed-issue plans up to certain ages — may be misleading |
| **"Zero medical questions"** | index (hero stat) | Same caveat as above |
| **"Zero waiting periods"** | index (hero stat) | Rarely literally true — most plans have waiting periods for maternity, dental, chronic conditions |
| **"Same-day activation"** | index, expat-health, find-my-plan | Depends on underwriting — can be slower |
| **"120+ countries"** | 12 files | Need Regency confirmation |
| **"Underwritten by A-rated insurer"** | expat-health-insurance, terms | Vague — which insurer, which rating agency? |
| **"No medical exam for standard cases"** | find-my-plan only (already removed from life pages per earlier instruction) | OK as-is but check for find-my-plan |

**None of these are legally safe without written confirmation from the business.** Phase 2 of the brief wants me to flag them as TODO rather than remove silently.

---

## 9. Existing analytics events

Only two custom conversion events:
- `life-insurance-quote.html:828` → `fbq('track', 'Lead', { content_name: 'Life Insurance Quote' })` fires on submit success
- `thank-you.html:85` → `fbq('track', 'Lead', { content_name: src })` fires on arrival with `?src=` query param

Everything else is `fbq('track', 'PageView')` only.

**Missing events** per the brief:
- `view_plan_comparison`
- `start_quote` (fires when user begins filling the form — currently nothing fires until submit)
- `complete_quote` (currently only on `life-insurance-quote`, not on main health quote)
- `whatsapp_click` (there is no WhatsApp link to click)
- `phone_click`
- `download_policy_wording`
- `view_life_insurance`
- `article_to_quote_click` (blog → quote funnel tracking)

**No consent-management layer.** Meta Pixel fires on every page view with no GDPR/UK-GDPR consent gate. This is a real legal risk for EU/UK traffic. **TODO: add consent management**.

---

## 10. Potentially risky / unsupported marketing claims

See §8.6 above. Consolidated priority list for human review:

**HIGH — probably needs removing or softening:**
1. "98% claims paid" (unverifiable statistic)
2. "Rated 4.9/5 by expats" (no visible reviews backing this up)
3. "30,000+ expats worldwide" (no source given)
4. "100% acceptance" + "Zero waiting periods" + "Zero medical questions" homepage stats (likely overstate the typical plan)
5. "Underwritten by A-rated insurer" without naming the insurer/agency

**MEDIUM — likely true but should be sourced:**
6. "800+ hospitals worldwide" (true for the main network, but add "within partner network" caveat)
7. "120+ countries" (standard for international plans but still worth confirming the exact number)
8. "Same-day activation" (true for standard underwriting but not always)

**LOW — defensible with light rewording:**
9. "24/7 multilingual support" (easy to verify from Regency)

---

## 11. Recommended implementation plan

Phased so each delivery is independently shippable and the user can veto specific items.

### Phase 1 (this doc) — ✅ complete
Audit only.

### Phase 2 — Homepage positioning + trust
- Rewrite homepage hero + direct-answer paragraph (brief Phase 2 wording).
- Add visible "**Who contacts you**" and "**Expat Protect Hub is a lead-generation service, policies underwritten by Regency Assurance**" disclosures to hero and footer.
- **Flag every risky claim from §10 as `<!-- TODO: confirm with business -->` comments inline**, don't delete yet.

### Phase 3 — Consolidate plan comparison
- Keep single table on `/expat-health-insurance`.
- Add "Included / Not included / Optional / per person per plan year" labelling.
- Add "subject to policy terms" footnote.
- Add "best suited to" blurb above each plan column.
- Make horizontally scrollable with ARIA scroll alert on narrow screens.

### Phase 5 — Information architecture (templated, not populated)
- Create reusable service-page HTML template.
- Build `/international-health-insurance` as an alias/canonical for `/expat-health-insurance` **only if business confirms** no SEO conflict (otherwise consolidate under one URL).
- Draft templates for `/health-insurance-for-retirees`, `/health-insurance-for-digital-nomads`, `/family-health-insurance`, `/evacuation-repatriation-insurance`, `/guides/` with TODO content blocks.
- **Do not publish empty pages** — leave them in `/drafts/` until the business supplies copy.

### Phase 6 — AIO content on existing pages
- Add direct-answer `<div class="direct-answer">` block to each service page.
- Reshape H2s into questions (keep existing marketing H3s underneath).
- Add FAQ sections to `/expat-health-insurance` and `/life-insurance` using the question list in Phase 6 of the brief.
- Add author/updated-date blocks to blog posts (**business must supply author identity**).

### Phase 7 — Metadata + structured data
- Fill the two empty descriptions.
- Add `<meta robots="index,follow">` explicitly to every indexable page.
- Add BreadcrumbList JSON-LD + visible breadcrumb UI to all pages below the hero.
- Add FAQPage JSON-LD wherever an FAQ renders.
- Add Service JSON-LD to `/expat-health-insurance` and `/life-insurance`.
- Add Article JSON-LD to blog posts (headline, author, dates, image).
- **Do NOT add Review / AggregateRating** until real reviews exist.

### Phase 8 — Technical SEO
- Create branded `/404.html`.
- Add `lastmod` dates to sitemap entries.
- Add visible breadcrumb UI.
- Audit image `alt` text on blog posts.
- Add `width`/`height`/`loading="lazy"` attributes to content images.

### Phase 9 — Quote form UX
- Add WhatsApp field alternative to `phone` (user picks preferred contact method).
- Add "Preferred contact method" radio (Phone / Email / WhatsApp).
- Add "By submitting this form you consent to be contacted by Regency for Expats. This is not an insurance contract." microcopy under every submit button.
- Unify field names (`current_country` everywhere, drop `nationality`).
- Add `start_quote` event on first field focus.

### Phase 10 — Analytics events + consent
- Standardise events listed in brief Phase 10.
- **Add a cookie-consent banner** (minimal, GDPR-compliant). Gate Meta Pixel + EmailJS behind consent. Recommend an open-source lightweight consent manager (Klaro, Osano free tier, or a 100-line in-house one) — **business must choose**.

### Phase 11 — Accessibility + performance
- Add `:focus-visible` styles to all CTAs.
- Add `@media (prefers-reduced-motion: reduce)` rules.
- Add image `width`/`height`/`loading="lazy"`.
- Add `<picture>` + WebP alternatives for hero images.
- Add `rel="preload"` for primary woff2.
- Externalise shared CSS tokens into one file.

### Phase 12 — Verification + report
- Run every route locally (preview_start).
- Validate every JSON-LD block (Google Rich Results test).
- Lighthouse pass on homepage + one service page + one blog post.
- Deliver `IMPLEMENTATION-REPORT.md` summarising everything, TODOs, and claims flagged for human review.

---

## 12. Files that will be changed

Grouped by the phase that touches them. Nothing outside this list will be touched without explicit approval.

| Phase | Files |
|---|---|
| **Phase 2** | `index.html` (hero + direct-answer), all service pages (footer disclosure block) |
| **Phase 3** | `expat-health-insurance.html` (add consolidated plan table), `index.html` (keep existing table or link to new one — business decides) |
| **Phase 5** | New: `_templates/service-page.html` (not deployed), plus **TODO content pages** in `/drafts/` (not deployed). May add `/international-health-insurance` as a 301 to `/expat-health-insurance` **only** if business approves. |
| **Phase 6** | `expat-health-insurance.html`, `life-insurance.html`, `faq.html`, 5 blog posts |
| **Phase 7** | All 16 indexable HTML files + `sitemap.xml` |
| **Phase 8** | New: `404.html`. Modified: `netlify.toml`, `sitemap.xml`, `index.html` (breadcrumbs), all service pages (breadcrumbs) |
| **Phase 9** | `index.html`, `expat-health-insurance.html`, `find-my-plan.html`, `free-expat-guide.html`, `life-insurance-quote.html` |
| **Phase 10** | All HTML pages (consent gate + event wiring), new `/assets/consent.js` |
| **Phase 11** | All HTML pages (focus/motion CSS), `/assets/` (image optimisation) |
| **Phase 12** | New: `IMPLEMENTATION-REPORT.md` |

Zero changes to: `expatprotecthub-crm/`, `crm/`, `automation/`, `supabase/`, `lead-tracker/`, `.github/`, `assets/phone-nsn.js`, `_fix_mojibake.py`, the Netlify project settings themselves.

---

## Priority call-outs for business review (before Phase 2 starts)

1. **Lead-generation vs licensed insurer status** — can we say "Expat Protect Hub is a referral/lead-generation service, not an authorised insurer. Policies are provided and underwritten by Regency Assurance"? This single sentence resolves most trust/compliance gaps.
2. **Which of the §10 risky claims can we keep?** — I will mark all of them as TODO and leave them in place while awaiting your call. Ones you can't document get softened or removed in Phase 2.
3. **Author/reviewer identity for blog posts** — pick one person (CEO, head of insurance, or named contributor) whose name appears on every post. Needed for AIO/E-E-A-T.
4. **Consent-management stance** — I'll propose a lightweight banner in Phase 10. Confirm whether you want GDPR-grade consent (Pixel disabled by default) or a lower-friction "notice only" banner (compliant for ROW, risky for EU/UK).
5. **Policy wording document** — do you have a PDF of Regency's policy wording you can link publicly? Needed for Phase 2 trust block.

---

## Nothing has been modified

All findings here are read-only observations. Awaiting approval before starting Phase 2.
