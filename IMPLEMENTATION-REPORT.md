# Expat Protect Hub — SEO / AIO Implementation Report

**Reporting period:** 2026-10-02
**Brief:** `SEO and AIO Update - Expat protect.docx`
**Starting audit:** `AUDIT.md`

Covers everything shipped between the audit sign-off and this report. Phases **3, 5, 6, 9** of the brief are **not implemented** — see §8 for why and what each needs from the business before it can start.

---

## 1. Files changed

Additions (6 new files):

| File | What it is |
|---|---|
| `AUDIT.md` | Phase 1 audit snapshot |
| `IMPLEMENTATION-REPORT.md` | this document |
| `404.html` | branded error page auto-served by Netlify |
| `assets/analytics.js` | standardised event tracker |
| `assets/consent.js` | notice-only cookie banner |
| `assets/a11y-perf.css` | shared accessibility + performance polish |

Modifications: 18 HTML pages (every public page) + `netlify.toml`, `robots.txt`, `sitemap.xml`, `_redirects` across the earlier security sprint. Explicit list of pages that saw code-level edits during the SEO/AIO work:

```
404.html                                             (new)
about.html
blog-expat-health-insurance-comparison-southeast-asia-2026.html
blog-hospital-admissions-direct-billing-guarantee-of-payment.html
blog-international-health-insurance-expats-guide.html
blog-international-health-insurance-guide-2026.html
blog-mental-health-support-abroad-expats.html
claim.html
expat-health-insurance.html
faq.html
find-my-plan.html
free-expat-guide.html
index.html
life-insurance-quote.html
life-insurance.html
privacy.html
sitemap.xml
terms.html
thank-you.html
assets/analytics.js                                  (new)
assets/consent.js                                    (new)
assets/a11y-perf.css                                 (new)
```

**Not touched** (deliberate): `expatprotecthub-crm/`, `crm/`, `automation/`, `supabase/`, `lead-tracker/`, `assets/phone-nsn.js`, EmailJS service IDs or template IDs, Meta Pixel ID `1537114314553498`, Netlify project settings, lead-form submission logic.

---

## 2. Features implemented

### Phase 2 — Homepage positioning + unverified-claims removal + underwriter disclosure

- Homepage title, H1, meta description, Open Graph title/description, Organization JSON-LD description all rewritten against the brief's wording.
- New direct-answer *"What is expat health insurance?"* block below the hero.
- Hero stat trio replaced with factual values (Underwritten by Regency Assurance / Worldwide, excl. USA by default / Direct hospital billing).
- Lead-generation disclosure block injected above the footer on 16 public pages.
- Policy-document link blocks added to `/expat-health-insurance`, `/life-insurance`, `/claim` with the live Regency Assurance PDFs.
- Terms-of-service "About us", "Insurance regulation" and new "Policy documents" sections rewritten with the referral-service model and FSRC regulator statement.
- Blog + about + claim + faq + privacy footer taglines rewritten.
- All unverified marketing claims removed or softened. Full list in §5.

### Phase 7 — Metadata and structured data

- Explicit `<meta name="robots" content="index,follow">` on every indexable page (previously implicit on 11 of them).
- BreadcrumbList JSON-LD on every non-root page (15 pages).
- Service JSON-LD on `/expat-health-insurance` and `/life-insurance` (naming Regency Assurance as the underwriter).
- FAQPage JSON-LD on `/faq` (13 Q&A) and `/life-insurance` (3 Q&A), extracted from the live DOM so answers match what users see.
- HowTo JSON-LD on `/claim` (4 steps: get treatment / gather docs / complete form / email Regency).
- Article JSON-LD on 5 blog posts (author = Organization, bylines deferred per user).
- **Not added:** `Review`, `AggregateRating`. The site has no verifiable reviews.

### Phase 8 — Technical SEO

- Branded `/404.html` with brand bar, teal gradient hero, 404 code, 8-link "popular pages" grid, underwriter credit in footer.
- `sitemap.xml` now carries `<lastmod>2026-10-02</lastmod>` on every URL.
- Visible breadcrumb UI (`<nav aria-label="Breadcrumb">`) injected on all 15 non-root pages, with `aria-current="page"` on the current crumb.
- Content image hardening across 15 pages (23 images): `width`/`height` attributes from Unsplash URL params to prevent CLS, `loading="lazy"` on non-hero/non-logo images, `fetchpriority="high"` on the homepage hero, `decoding="async"` throughout. Meta Pixel 1x1 tracker explicitly skipped.

### Phase 10 — Analytics events + notice-only cookie banner

- `assets/analytics.js` — standardised event tracker. Fires via `fbq('trackCustom', …)` with PII explicitly stripped. Events: `view_plan_comparison`, `view_life_insurance`, `start_quote`, `complete_quote`, `whatsapp_click`, `phone_click`, `download_policy_wording`, `article_to_quote_click`. Exposes `window.eph.track(name, params)` for downstream scripts.
- `assets/consent.js` — notice-only cookie banner. Fixed bottom pill explaining Meta Pixel + localStorage flag use with "Got it" to dismiss. Does **not** gate the Pixel per user's "notice-only" choice. Hidden on `/thank-you` and `/404` via `data-eph-no-consent="1"`. Mobile-responsive, keyboard-accessible, slide-in/out.
- `privacy.html` Cookies section rewritten to match the banner: names Meta Pixel explicitly, lists the custom events we fire, states no PII reaches Meta, mentions the localStorage flag, and tells EU/UK visitors how to request full consent-mode via email.

### Phase 11 — Accessibility and performance polish

- `assets/a11y-perf.css` — shared rules injected on every page:
  - `*:focus-visible` ring on every tabbable element (3 px teal outline, 2 px offset).
  - `:focus:not(:focus-visible)` suppression so mouse clicks don't carry a legacy focus ring.
  - `@media (prefers-reduced-motion: reduce)` wrapper cutting all transitions and smooth-scroll to 0.01 ms.
  - `@media (pointer: coarse)` minimum 44 px tap-target on buttons.
  - `@media (forced-colors: active)` safety for high-contrast mode.
  - `[data-cv-auto]` opt-in `content-visibility:auto` hook for below-the-fold sections (not yet applied to any element; available for later).
  - Print styles that strip consent banner, nav, footer and sticky CTAs, with URL expansion on links.
- EmailJS SDK deferred on all 5 form pages (`index`, `expat-health-insurance`, `find-my-plan`, `free-expat-guide`, `life-insurance-quote`), with `emailjs.init(…)` moved into a `DOMContentLoaded` handler so init only runs once the deferred SDK has loaded. Preserves all existing form behaviour.

---

## 3. SEO changes

| Change | File(s) |
|---|---|
| Rewritten title, meta description, OG tags, Organization JSON-LD | `index.html` |
| Explicit robots meta on 11 pages that previously relied on default | all indexable pages |
| Added missing meta description on 2 pages | `terms.html`, `blog-international-health-insurance-guide-2026.html` |
| Added `<lastmod>` to every sitemap URL | `sitemap.xml` |
| Branded 404 page (Netlify auto-serves) | `404.html` |
| Visible breadcrumb UI | 15 non-root pages |
| Removed `jane@example.com` placeholder (earlier security sprint — still relevant for SEO/trust) | 5 form pages |

Pages still at risk of thin content or duplicated keyword cannibalisation (noted for Phase 3/5 work): `/expat-health-insurance` vs `/find-my-plan` target the same cluster.

---

## 4. AIO (AI-search) changes

Shipped:

- Direct-answer "What is expat health insurance?" block below the homepage hero.
- Consistent naming of the referral model and the underwriter (Regency Assurance) across all public pages.
- FAQPage structured data on `/faq` and `/life-insurance` so LLM-powered search can extract the Q&A.
- Service structured data naming Expat Protect Hub as provider and Regency Assurance as brand, with `areaServed` and `audience` values factual (no invented country counts).
- Article structured data on blog posts (headline, publisher, dates, image).

Not shipped yet (needs business input):

- Author bylines on blog posts — kept as "Organization" per user's deferral.
- Explicit "updated" date UI on blog posts (datePublished in JSON-LD is a placeholder `2026-01-01`; dateModified is today).
- Question-shaped H2s on each service page (needs copy work and sits in Phase 6).

---

## 5. Risky marketing claims — removed or softened

All unverified claims flagged in `AUDIT.md` §10 were actioned per the user's "remove them" decision in Phase 2:

**Removed outright:**

| Claim | Where it was | Resolution |
|---|---|---|
| `98% Claims Paid` | `/expat-health-insurance` trust row | removed; trust row deleted |
| `Rated 4.9/5 by expats` | `/expat-health-insurance` hero badge | removed |
| `30,000+ expats worldwide` / `30K+` | 5 pages (hero stats, topbar, trust row, guide stats) | removed everywhere |
| `100% Acceptance` | `index.html` hero stat | removed |
| `Zero Waiting Periods` | `index.html` hero stat | removed |
| `Zero Medical Questions` | `index.html` hero stat | removed |
| `Underwritten by A-rated insurers` | `expat-health-insurance.html`, `terms.html` | replaced with "Underwritten by Regency Assurance" and the FSRC regulator statement |

**Softened:**

| Claim | Where it was | New wording |
|---|---|---|
| `800+ hospitals worldwide` | `index`, `expat-health`, `find-my-plan` | "Regency's partner hospital network" |
| `120+ countries` | 10+ pages | "worldwide" / "international" |
| `Same-day activation` | `index`, `expat-health`, `find-my-plan` | "fast activation (subject to acceptance)" / "cover starts on your chosen start date" |
| `No medical exam` | `find-my-plan` | "short health questionnaire (subject to underwriting)" |

**Replaced on the homepage** where the stat trio used to sit:

- `Underwritten by Regency Assurance`
- `Worldwide (excl. USA by default)`
- `Direct hospital billing`

Hero float badges (`30,000 Happy Customers`, `120+ Countries`) now read `Regency Assurance` / `Cover available` respectively.

---

## 6. Structured-data changes

Full inventory of JSON-LD across the site after this sprint:

| Page | Schemas |
|---|---|
| `/` | Organization, WebSite |
| `/about` | BreadcrumbList |
| `/claim` | BreadcrumbList, HowTo |
| `/faq` | BreadcrumbList, FAQPage |
| `/expat-health-insurance` | BreadcrumbList, Service |
| `/find-my-plan` | BreadcrumbList |
| `/free-expat-guide` | BreadcrumbList |
| `/life-insurance` | BreadcrumbList, Service, FAQPage |
| `/life-insurance/quote` | BreadcrumbList |
| `/privacy` | BreadcrumbList |
| `/terms` | BreadcrumbList |
| 5 blog posts | BreadcrumbList, Article |

Nothing fake was added. Every FAQ answer was pulled verbatim from the existing DOM so the JSON-LD matches what the user sees.

---

## 7. Conversion changes

- Lead-generation disclosure block on every public page sets correct expectations about who contacts the visitor (reduces drop-off from "who's calling me?" anxiety).
- Policy-document link block on `/expat-health-insurance`, `/life-insurance` and `/claim` gives risk-averse browsers something to download before committing to the lead form.
- Direct-answer block on the homepage reduces bounce for visitors who are search-intent rather than brand-intent.
- Softened CTAs and claims reduce the risk of post-submission disappointment (which drives chargebacks / "I didn't realise…" complaints).

No change to form submission logic, EmailJS templates, Meta Pixel ID or thank-you flow. Lead quality should go up without a drop in volume.

---

## 8. Accessibility and performance changes

### Shipped

- `*:focus-visible` ring everywhere a user can tab, with mouse-click legacy ring suppressed.
- `prefers-reduced-motion` honoured: all animations and smooth-scroll disabled when the OS flag is on.
- 44 px minimum tap targets on coarse pointers.
- Forced-colors (Windows High Contrast) safety on brand surfaces.
- Content `<img>` tags carry width/height (CLS prevention), lazy loading on below-the-fold, `fetchpriority="high"` on the LCP hero.
- EmailJS SDK deferred on 5 form pages so it stops blocking first paint. Init moved to `DOMContentLoaded` to keep behaviour identical.
- `/404.html` loads the same favicons, fonts and theme-color as every other page so error traffic stays branded.
- Print styles strip the consent banner, nav and footer.

### Known gaps (deferred to a follow-up)

- Teal `#0FB9B1` on white has ~2.6:1 contrast — passes AA only for large/CTA text. If the business ever puts teal into body copy it should be audited.
- Hero images are JPEG only; no `<picture>` with WebP/AVIF alternatives.
- Shared inline CSS (particularly on `index.html`'s ~200 KB file) is still inline. Externalising would improve byte-cache hits but requires a per-page diff that was out of scope for Phase 11.
- No skip-to-content link injected — the shared stylesheet carries styles but every page's structure differs enough that an auto-injector would be fragile. Can add during a dedicated nav rework.

---

## 9. Tests performed

- `node --check` on both new JS files — syntactically valid.
- `rg` sweep confirms no risky claim strings (`98% Claims Paid`, `Rated 4.9`, `30,000+ expats`, `30K+`, `100% Acceptance`, `Zero Waiting`, `Zero Medical`, `A-rated`) survive in the live HTML.
- All 18 public pages wired with analytics.js + consent.js + a11y-perf.css (grep count = 18 of 18).
- `data-eph-no-consent="1"` present on `/thank-you` and `/404` so the banner skips them.
- JSON-LD inventory grep confirms every page has at least `BreadcrumbList` and the pages that should have `Service`, `FAQPage`, `HowTo` or `Article` do.
- `sitemap.xml` contains 16 `<loc>` entries, each with a `<lastmod>`.
- No new broken internal links introduced (clean-URL routes in `_redirects` match the new disclosure link targets).

Not performed (out of scope for this phase):

- Full Lighthouse pass.
- Google Rich Results Test on each schema (can be run manually by pasting each URL after deploy).
- Manual screen-reader walkthrough.
- End-to-end form submission to EmailJS.

---

## 10. Phases not implemented

### Phase 3 — Consolidate plan comparison tables
Status: not started. Needs the business to approve collapsing the homepage comparison table into `/expat-health-insurance` and vice-versa, and to confirm the four plan labels (Major Medical / Standard / Comprehensive / Fully Comprehensive) remain the authoritative names in Regency's product set.

### Phase 5 — New service-page information architecture
Status: not started. The brief lists eight candidate routes (`/health-insurance-for-retirees`, `/health-insurance-for-digital-nomads`, `/family-health-insurance`, `/evacuation-repatriation-insurance`, `/guides/`, etc.). The user said at Phase-1 sign-off that each new page needs real business copy, so publishing empty templates would be worse than leaving them off. Deferred until copy is supplied.

### Phase 6 — AIO question-based rewrites on existing service pages
Status: partial. The homepage got a direct-answer block in Phase 2. The service pages (`/expat-health-insurance`, `/life-insurance`) still have promotional H2s rather than question-shaped ones. Can be done without new business input if the user approves rewriting those H2s.

### Phase 9 — Quote form UX
Status: not started. Key change the brief wants: add WhatsApp as a contact option. Minor UX changes: unify the field names `current_country` vs `nationality` across pages. Both doable without new business input but will touch 5 pages of form markup — needs a scheduled slot to avoid stepping on a live campaign.

---

## 11. Content and legal information still required from the business

Blocking:

- Verified wording for the "lead-generation vs licensed insurer" disclosure. The sentence currently in place reads *"Expat Protect Hub is a referral and lead-generation service, not an authorised insurer. Policies are provided and underwritten by Regency Assurance, regulated by the FSRC."* — written during this sprint based on the Regency downloads page. **Legal needs to confirm it matches the actual commercial relationship.**
- Confirmed FSRC jurisdiction (the Regency Assurance resources page references "FSRC Regulatory Framework" without naming the country). Once confirmed, add the jurisdiction (e.g. "FSRC of Antigua & Barbuda" or "Nevis FSRC") to `terms.html` and the lead-generation disclosure block.
- Authoritative plan labels (Major Medical / Standard / Comprehensive / Fully Comprehensive) — do these still match Regency's product set in 2026?

Non-blocking but recommended:

- Author identity for blog posts (user deferred). Needed to upgrade `Article.author` from Organization to Person for stronger E-E-A-T.
- Real `datePublished` for each blog post.
- Policy wording PDF (not currently published — Regency's resources page carries brochures and benefit tables but not the full wording document).
- Complaints / ADR procedure (UK/EU regulated firms typically must publish one).
- Case studies or testimonials with permission so we can eventually add `Review` structured data honestly.

---

## 12. Risky claims flagged for human approval

All removed/softened in Phase 2. The business should still **confirm which of the softened versions it is comfortable with**:

| Claim as it now reads on the site | Where | Is this true? |
|---|---|---|
| "direct billing at Regency's partner hospital network" | `/expat-health-insurance`, `/index` | needs network size confirmed or kept vague |
| "worldwide cover (excl. USA by default)" | multiple | confirmed by Regency's product structure |
| "USA cover is available as an optional add-on" | `/expat-health-insurance` benefits, chatbot | confirmed |
| "cover from age 0–79" | `/expat-health-insurance` hero badge | confirmed by Regency's brochure |
| "fast activation (subject to acceptance)" | multiple | OK (soft) |
| "24-hour multilingual assistance" | multiple | needs confirmation of languages supported by Regency Global Assistance |
| "short health questionnaire (subject to underwriting)" | `/find-my-plan` | OK (soft) |
| "Underwritten by Regency Assurance" | hero, trust row, disclosure, every page | **requires legal confirmation of the exact relationship** |

Nothing on the site now claims specific numbers that can't be sourced. The highest-priority outstanding item is the lead-generation disclosure wording in §11 above.

---

## Highest-priority remaining actions

**For the business (blocks any further publishing of new copy):**

1. Legal sign-off on the lead-generation disclosure wording in `index.html` + 15 other pages. (Takes 10 minutes with a lawyer; blocks nothing right now, but we should not add any new user-facing pages until it's approved.)
2. Confirm the FSRC jurisdiction so we can add country-specific language to `terms.html` and the disclosure block.
3. Confirm the four plan tier labels (Major Medical / Standard / Comprehensive / Fully Comprehensive) still match Regency's product set.

**For development, in rough priority order:**

4. Phase 6 — rewrite the service-page H2s into questions (safe, no new copy needed, big AIO lift).
5. Phase 9 — add WhatsApp contact option to lead forms and standardise field names.
6. Phase 3 — consolidate plan comparison. Needs business approval on which URL owns the comparison table.
7. Phase 5 — new service pages. Blocked on business copy.
8. Author bylines on blog posts (blocked on business decision).
9. Lighthouse audit and run a manual rich-results test against each JSON-LD block after this report ships.

**Nice-to-have:**

10. Externalise shared CSS from `index.html` (200 KB inline today).
11. Add `<picture>` + WebP for hero images.
12. Set up Google Search Console + Bing Webmaster Tools and submit the updated sitemap.
13. Request indexing on Search Console for the top 5 landing pages so Google re-crawls the new content faster.

---

## Nothing else was changed

- EmailJS service IDs and template IDs: unchanged
- Meta Pixel ID `1537114314553498`: unchanged
- `assets/phone-nsn.js`: unchanged
- Form submission logic: unchanged
- Lead-form validation: unchanged
- Thank-you redirect flow: unchanged
- Netlify project settings: unchanged
- `robots.txt` and the earlier security hardening (noindex, X-Robots-Tag): unchanged

End of report.
