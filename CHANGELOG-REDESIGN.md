# Redesign changelog

This documents the fix-and-redesign pass on the prototype, following the brief "Fix and redesign the AI-research dashboard". `AMARANTH_PROJECT_KNOWLEDGE.md` was not in the workspace, so the brief was the only source on what the product means.

## (a) Summary

1. Every audited bug in section 7 is fixed or addressed; the table below says how each was checked.
2. The interface is rebuilt minimal and calm on the existing palette: page not cards, one accent moment per region, Geist/Geist Mono/Newsreader, sentence case, nothing under 12px.
3. Statistics are real: fixtures store counts only, and `src/lib/stats.ts` (tested against the SciPy vectors in the brief) computes every rate, CI, p-value and effect size. E1 now shows p = 0.016 and CI 1.6 to 15.3 pp, not the old typed-in 0.003.
4. A validity rubric (C1–C9, "Rubric v0, draft") and an evidence-strength label replace the undefined "Confidence" meter; "Not recorded" is its own state.
5. The workspace has Session, Overview, Graph, Evidence and Report tabs and a full experiment panel (design, config diff, effect, test, reproducibility).
6. Data goes through a typed `DataProvider`; the only implementation is a seeded `MockProvider`, labelled "Demo data", with validated, debounced storage and no global ticker.
7. Shell: Claude-style sidebar with recents, account menu (appearance, shortcuts, legal, exit demo), mobile drawer, cmdk palette that works on any keyboard layout.
8. Home: the composer has an icon-only Send, an AI system picker that is actually used, starters that fill but never submit.
9. Accessibility and security: 0 serious/critical axe issues on 18 routes in both themes at 375 and 1440 px; security headers and a CSP on every route.
10. Verified with 43 unit tests and 26 Playwright tests (incl. axe, PDF page count, reduced motion, 404 status). 112 screenshots are saved in `qa/after`; I reviewed a cross-section by eye (every main screen, light and dark, at 320/375, 768 and 1440 px) and fixed what I found.

## (b) Bug table

Verification key: **unit** = Vitest; **e2e N** = Playwright test number from section 9 of the brief (files in `e2e/`); **curl** = HTTP check against `next start`; **grep** = source search; **review** = I read the code and looked at screenshots.

| Bug | Status | How it was verified |
|---|---|---|
| A1 composer stuck after returning Home | Fixed: the text is cleared on submit, "pending" comes from the navigation transition, focus runs when Activity shows the route again | e2e 3 |
| A2 sidebar grows on load, reflows main | Fixed: width set by an attribute from the boot script before paint; no width animation | e2e 14 (first paint 56/256 px; at most 2 distinct widths while collapsing) |
| A3 shell hidden until hydration | Fixed: `ShellArrival` deleted; the server HTML contains the shell and Home | curl (raw HTML contains the Primary nav and the headline; no `opacity:0`) |
| A4 graph zoom resets, tiny/clipped nodes, pointer handlers, keyboard | Fixed: view kept per investigation outside the component (refit only on first view or Fit), nodes sized to content and measured, 13px text at 100%, wheel pans, Ctrl/⌘+wheel/pinch zooms, pointercancel and lostpointercapture handled, keyboard and List view | e2e 8 (arrows, Enter opens panel, zoom survives a tab switch); review. The "+N more" collapse for 12+ nodes per layer is implemented but not exercised by a test (no fixture has that many) |
| A5 404 theme and status | Fixed: no `data-theme` in JSX, branded `not-found.tsx`, real 404 for unknown paths and for impossible investigation ids (proxy) | e2e 5, e2e 7, curl |
| A6 `?tab=garbage`, `?node=zzz`, `?fresh=1` | Fixed: whitelisted `?tab=` and `?exp=`; `?fresh` removed | e2e 5 |
| A7 320px overflow, toast width, safe area, mobile nav | Fixed: `viewportFit: "cover"`, responsive toasts, drawer with full parity (settings, account menu, legal) instead of the bottom nav | e2e 13 (no horizontal scroll at 320–1920, both themes), e2e 12 |
| A8 chart labels, units, exponent p, fixed confidence numbers | Fixed: forest plot with 5 pp ticks, labelled zero, axis title, aligned rows, n; `formatP` never prints exponents; meter deleted | unit (formatP/formatPP), review |
| A9 contrast, focus ring, tiny text | Fixed with the allowed token changes; focus ring 2px accent-text | Contrast table below (0 failures), grep (no `text-[8–11px]`), axe |
| A10 two h1 on Report, h3 without h2 | Fixed: the investigation title is the page's only h1; the report's printed title is not a heading on screen | axe (heading rules), e2e 12, review |
| A11 print prints one page | Fixed: print CSS releases the app frame's height and overflow and hides chrome | e2e 16 (A4 PDF of the report has ≥ 2 pages) |
| M1 reduced motion ignored by Motion JS | Fixed: `MotionConfig reducedMotion="user"` (or "always" from Settings) plus the CSS block | e2e 6 (no infinite animation with reduce), e2e 6b |
| M2 theme circle from (0,0) | Fixed: switch is instant; effect removed | review |
| M3 blur animations | Fixed: none left | grep `blur(` = 0 |
| M4 endless decorative animation | Fixed: grain, shimmer and edge flow deleted; only the running pulse loops | grep, e2e 6b |
| M5 layout-property animation, `layout`/`layoutId`, `mode="wait"` | Fixed: none left; tabs switch instantly | grep `layoutId` = 0, review |
| M6 fake waiting (drafting theatre, typewriter, count-up, per-word blur) | Fixed: a new investigation's log arrives 0.6–2.3 s after creation (events have timestamps), answers appear sentence by sentence | e2e 1, e2e "Session", review |
| M7 Mark listeners and blink loop | Fixed: the mark is a static SVG; the reveal is CSS on sign-in only | review |
| M8 pointer toys and view-transition recipes | Fixed: all removed | grep (`magnetic`, `spotlight`, `useTilt` = 0) |
| F1 selected AI system ignored | Fixed: the picker's choice is saved and passed to `createInvestigation` | e2e 1 (stored `systemId` checked) |
| F2 empty submit uses a placeholder | Fixed: empty or whitespace does nothing; Send is aria-disabled with a reason | e2e 2 |
| F3 Tab hijacked in the composer | Fixed: no Tab handling at all | review |
| F4 fabricated results for any topic | Fixed: the mock agent picks topic templates (generic "Template draft" otherwise), runs are simulated from a seeded PRNG, verdicts and conclusions are derived; sample ids are unique | unit (agent, simulator, unique ids), e2e 9 |
| F5 running a proposed experiment duplicates it | Fixed: the same experiment goes proposed → running → complete | e2e 9 |
| F6 canned assistant answer | Fixed: rule-based answers from this investigation's data; the question is echoed; unknown questions get "I can't answer that in demo mode" | e2e "Session" |
| F7 contradictory numbers | Fixed: all from counts; running experiments show no result; sample totals count finished runs only; `trend` and "raises" bug gone | unit (CI contains Δ for every fixture; running E3 has no result) |
| F8 idle ticker, timers, unvalidated JSON, toasts, slug, `?` after `.`, static "8 min ago" | Fixed: one timer per run, progress derived from the clock, zod validation, toasts pause on hover/focus, Unicode-aware slugs, ISO timestamps | e2e 15 (0 writes in 12 s idle), e2e 11, unit (slug, title, relative time, storage recovery) |
| F9 palette: Russian layout, hard-coded ids, dead ends, IME | Fixed: `event.code === "KeyK"`, cmdk (IME-safe), no hard-coded ids, empty state | e2e 4 |
| F10 fake auth | Fixed: one honest "Enter demo workspace", consent line, `AuthProvider` with `DemoAuth` | e2e 12, review |
| F11 dead settings, hard-coded lists, persona, design page in nav | Fixed: settings all work; data from the provider; persona and workspaces removed; `/design` 404s in production | curl (`/design` → 404), review |
| F12 fabricated trace text, dead Compare, local-only evidence sets, sycophancy-only filters | Fixed: removed; outcome labels from each metric; Flag score is stored and feeds C5 | e2e "Evidence" |
| F13 Button defaults | Fixed: `type="button"` by default, `loading` disables, safe props win over `...rest` | review |
| X1 skip link, aria-current, live regions | Fixed | axe, review |
| X2 tabs semantics | Fixed: roving tabindex, arrows, `aria-controls` | e2e 8 |
| X3 palette dialog semantics | Fixed: Radix dialog (aria-modal, trap, Esc, focus restore) + cmdk listbox | e2e 4 |
| X4 menus without keyboard support | Fixed: Radix dropdown menu and popover | e2e 7, e2e 12 |
| X5 progressbar, sparkline name, labels, colour-only status | Fixed: `role="progressbar"`, sparklines removed, every input labelled, visually hidden status text | axe |
| X6 page titles | Fixed: Metadata API on every route; investigations created in the browser set their title from data (the server cannot know them) | review |
| PF1 network-dependent fonts, per-frame state, listeners | Fixed: fonts self-hosted with `next/font/local`; no per-frame React state in the graph during wheel (one state update per event, no RAF loop), no global pointer listeners. Many components are still client components because the data lives in the browser | build without Google Fonts, review |
| S1 security headers | Fixed: CSP, nosniff, referrer policy, permissions policy, frame protection, COOP, HSTS (production, no preload), `poweredByHeader: false` | curl |
| S2 inline theme script under CSP | Addressed: the boot script is a constant; the CSP needs `'unsafe-inline'` for Next's own inline scripts anyway (see the CSP trade-off) | review |
| S3 untrusted storage and URL input | Fixed: zod-validated storage with a visible reset, whitelisted URL params, id pattern check in the proxy, question length capped at 2,000 | unit, e2e 5, e2e 11 |
| S4 dependencies | Kept clean: `npm audit --omit=dev` → 0 vulnerabilities; no secrets, env vars or network calls in `src` | npm audit |
| Cleanup: self-referencing `@theme` shadows, README shortcuts | Fixed | review |

Not reproduced before fixing: none of the ◇ items were run against the old build individually; they were fixed from the code as described in the audit.

## (c) Design decisions

- **Primary buttons are ink, not burgundy.** Burgundy is reserved for Send, the running dot, the selected marker, links in prose and the focus ring, as the brief asks. "Enter demo workspace", Run and dialog confirmations use the ink button.
- **Status is derived, not stored.** Investigation status (draft, running, needs review, complete, replicated, failed) and hypothesis verdicts are computed from experiments, so they cannot go stale. "Needs review" means a finished experiment has a flagged score.
- **Verdicts:** each hypothesis has a predicted direction (increase, decrease, no difference). Supported = every finished linked experiment agrees (CI excludes zero in that direction); rejected = none does; partly = some do.
- **Evidence strength for an investigation is its weakest finished primary experiment.** Conservative by design; documented under "Why".
- **C5 for rule-based scorers is "does not apply"** (shown as –) and counts as passing; a flagged score makes C5 a warning.
- **C7** passes with one primary test; with several, it shows the Holm-adjusted p and warns when an effect does not survive the correction.
- **Independent vs paired:** sycophancy E1 is modelled as independent arms (as the brief's reference vector requires); paired designs (instruction following, several templates) use the exact McNemar test and a seeded paired bootstrap CI. "Logistic regression" (sycophancy E2) became a two-arm comparison (hedged vs confident); "chi-squared" became the equivalent z-test.
- **Fixture rates were kept close to the prototype** (41.3% vs 49.8%, 36.7% vs 54.0%, 2.2% vs 7.3%, 7.5% vs 2.2%, 94.4% vs 92.5%, 97.5% vs 87.5%); the derived statistics are whatever the maths gives. The long-context grid stores 30 cells of 32 items, and the arms are sums of cells.
- **Demo runs take 6 to 11 seconds** so a result arrives while you watch; the seeded E3 run takes 45 minutes and is 62% done when the demo loads.
- **Real 404s via `src/proxy.ts`.** Investigation pages stream (their data lives in the browser), so a `notFound()` inside the page would come after the 200 is sent. The proxy rejects ids that are neither seeded nor shaped like ids the app creates. A well-shaped id that does not exist in this browser still returns 200 with a "not in this browser" message and `noindex`.
- **Slugs are transliterated to ASCII** (Cyrillic, Azerbaijani, Latin diacritics), with "investigation" as the fallback, so URLs stay readable and never need percent-encoding.
- **The logo reveal is CSS**, started by the boot script on `/` only when this browser has not seen it; a click or key skips it; without JS it still completes; under reduced motion it does not run.
- **Session composer:** Enter asks; "Save as note" stores a note. Answers are labelled "Answer · from this investigation's data".
- **Graph opens at 100%** (13px node text) top-aligned; Fit scales to the whole graph.
- **Evidence windowing:** items render 50 at a time with "Show more" and `content-visibility: auto`, rather than a virtual list. The demo has far fewer than 100 items per view.
- **Home's footer is not a landmark** (it sits inside `main`); legal links are also in the account menu and drawer.

## (d) New dependencies

| Package | Why |
|---|---|
| `@radix-ui/react-dialog`, `-dropdown-menu`, `-popover`, `-tooltip` | Accessible dialogs, menus, popover and tooltips (focus trap, Esc, outside click, focus restore, arrow keys) |
| `cmdk` | Command palette and the AI system listbox: combobox/listbox semantics, IME-safe Enter |
| `zod` | Validating anything read back from storage |
| `vitest` (dev) | Unit tests for statistics, validity, slugs, time and storage recovery |
| `@playwright/test` 1.56.1 (dev) | End-to-end tests; pinned to match the installed Chromium build |
| `@axe-core/playwright` (dev) | Accessibility checks in the e2e suite |
| `@types/node` 20 → 22 (dev) | Required by Vitest 5 |

No d3 packages were needed: the charts use a few lines of scale code. Fonts are vendored (OFL) in `src/app/fonts/` instead of adding font packages.

## (e) Open decisions

These are not mine to decide; each lives in one place.

- **Product name.** The code says "Diablo AI"; the project document says "Amaranth" and calls the name undecided. Every user-facing occurrence reads `BRAND` in `src/lib/brand.ts`.
- **Legal entity, address, contact email, governing law, IP terms.** `BRAND.legalEntity`, `address`, `contactEmail`, `governingLaw`, `ipTerms` are `[to be completed]` and show as visible placeholders on the legal pages. "Help and feedback" is hidden while the contact email is a placeholder. `npm run check:release` fails until they are filled.
- **Navigation.** The sidebar groups (Library, Investigations, Recents) are in `src/components/shell/nav.ts`.
- **Rubric v0 thresholds.** `THRESHOLDS` in `src/lib/validity.ts`: at least 30 per arm, judge–human agreement ≥ 0.80, α = 0.05 after Holm. Also open: whether the investigation's strength should be its weakest experiment (current) or something else.
- **CSP trade-off.** Next.js streams its RSC payload in inline scripts whose content changes per page. A nonce would make every route dynamic and is incompatible with Partial Prerendering under Cache Components (Next's own CSP guide says so), and hashes cannot cover per-page payloads. The shipped policy therefore allows `script-src 'self' 'unsafe-inline'` (never `'unsafe-eval'` in production) and `style-src 'self' 'unsafe-inline'` (React style attributes); everything else is locked down (`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `connect-src 'self'`). The only inline script we write is the constant boot script. If the owner prefers a nonce CSP, it costs static rendering.
- **Data-model fields.** Open questions: judge–human agreement as Cohen's κ or % agreement (stored as a 0–1 number either way), what counts as a "primary" test, tokens and cost per run (fields exist; the demo leaves them "Not recorded"), and a field for planned vs actual seeds per arm.
- **Which model powers the research agent** is not hard-coded anywhere; the demo agent is rule-based.

## (f) Known limits

- Investigations live in `sessionStorage` (one tab); preferences in `localStorage`. Nothing syncs across tabs or devices.
- The demo agent understands seven topics by keyword; anything else becomes a generic, clearly labelled template draft.
- Simulated runs have no tokens or cost ("Not recorded"); samples and traces come from a few example items per template, labelled "Simulated".
- A well-shaped but unknown investigation id returns 200 (see design decisions).
- Distribution and timeline charts (COULD) were not built.
- The graph's "+N more" collapse is untested in a browser (no fixture is that large).
- `next build` prints no warnings; `next dev` adds `'unsafe-eval'` to the CSP for React's dev tooling.
- Phases 1–5 landed in one commit because the prototype's components were replaced wholesale and every phase depends on the new primitives and data layer; build, typecheck, lint and unit tests pass at that commit and at every later one.
- The failing-first tests (phase 0) were written against the new UI's roles and labels, so they could not run against the old prototype's markup; I did not run them against the baseline.

## (g) How to run every test

```bash
npm ci
npm run typecheck        # TypeScript
npm run lint             # ESLint, zero eslint-disable comments in src
npm test                 # Vitest: 43 unit tests
npm run build            # production build (no network needed)
npx playwright install chromium   # once per machine
npm run test:e2e         # Playwright: 26 tests incl. axe, PDF, reduced motion, 404 status (starts `next start` itself)
npm run check            # typecheck + lint + test + build
npm run check:release    # fails while legal placeholders remain (expected today)
node qa/contrast.mjs     # contrast table
node qa/capture.mjs qa/after   # screenshots (needs `next start -p 3100` running)
```

All of these were run in this pass and passed, except `check:release`, which fails by design while the five placeholders remain.

## (h) Screenshots

- `qa/baseline/`: the original prototype, 13 routes × 320/768/1440 × light/dark (78 files). Note: the old app scrolled inside `<main>`, so these show the first screen only.
- `qa/after/`: the redesign, full page. 16 routes × 320/768/1440 × light/dark, plus Home and the Overview at 375/1024/1280/1920 × light/dark (112 files). Routes: sign-in (`signin-*`), Home, Investigations, the sycophancy Session and Overview, the long-context Graph, the tool-use Evidence, Report and Overview with the E1 panel open, AI systems, Experiments, Datasets, Reports, Settings, Privacy, and the 404 (`nope-*`).

File names are `<route>-<width>-<theme>.jpg`.

## (i) Suggestions (not built)

- A hypothesis editor (add or edit hypotheses and competing explanations) so C9 can be resolved in the app.
- Real evidence sets that can be named, listed on the Report and exported.
- A distribution chart for continuous scores and a run timeline.
- Per-investigation sharing links once there is a backend.
- A diff view between a run and its replication.
- Keyboard shortcut to jump between tabs (e.g. `1`–`5`) once navigation is decided.

## Contrast

Every text and background pair the UI uses (computed by `qa/contrast.mjs`):

| Theme | Foreground | Background | Ratio | Needs | Pass |
|---|---|---|---|---|---|
| light | ink | bg | 15.70:1 | 4.5:1 | yes |
| light | ink | surface | 16.82:1 | 4.5:1 | yes |
| light | ink | subtle | 14.91:1 | 4.5:1 | yes |
| light | ink | sunken | 14.27:1 | 4.5:1 | yes |
| light | ink-2 | bg | 7.27:1 | 4.5:1 | yes |
| light | ink-2 | surface | 7.79:1 | 4.5:1 | yes |
| light | ink-2 | subtle | 6.91:1 | 4.5:1 | yes |
| light | ink-2 | sunken | 6.61:1 | 4.5:1 | yes |
| light | ink-3 | bg | 4.97:1 | 4.5:1 | yes |
| light | ink-3 | surface | 5.33:1 | 4.5:1 | yes |
| light | ink-3 | subtle | 4.72:1 | 4.5:1 | yes |
| light | ink-3 | sunken | 4.52:1 | 4.5:1 | yes |
| light | accent-text | bg | 11.54:1 | 4.5:1 | yes |
| light | accent-text | surface | 12.36:1 | 4.5:1 | yes |
| light | accent-text | subtle | 10.96:1 | 4.5:1 | yes |
| light | accent-text | sunken | 10.48:1 | 4.5:1 | yes |
| light | ok | bg | 5.82:1 | 4.5:1 | yes |
| light | ok | surface | 6.23:1 | 4.5:1 | yes |
| light | ok | subtle | 5.52:1 | 4.5:1 | yes |
| light | ok | sunken | 5.28:1 | 4.5:1 | yes |
| light | warn | bg | 5.52:1 | 4.5:1 | yes |
| light | warn | surface | 5.91:1 | 4.5:1 | yes |
| light | warn | subtle | 5.24:1 | 4.5:1 | yes |
| light | warn | sunken | 5.01:1 | 4.5:1 | yes |
| light | bad | bg | 8.24:1 | 4.5:1 | yes |
| light | bad | surface | 8.82:1 | 4.5:1 | yes |
| light | bad | subtle | 7.82:1 | 4.5:1 | yes |
| light | bad | sunken | 7.48:1 | 4.5:1 | yes |
| light | accent-ink | accent (Send) | 13.95:1 | 4.5:1 | yes |
| light | bg | ink (primary button) | 15.70:1 | 4.5:1 | yes |
| light | focus ring (accent-text) | bg | 11.54:1 | 3:1 | yes |
| light | focus ring (accent-text) | surface | 12.36:1 | 3:1 | yes |
| light | field border (line-field) | bg | 3.26:1 | 3:1 | yes |
| light | field border (line-field) | surface | 3.49:1 | 3:1 | yes |
| dark | ink | bg | 16.66:1 | 4.5:1 | yes |
| dark | ink | surface | 15.44:1 | 4.5:1 | yes |
| dark | ink | subtle | 16.13:1 | 4.5:1 | yes |
| dark | ink | sunken | 17.17:1 | 4.5:1 | yes |
| dark | ink-2 | bg | 9.14:1 | 4.5:1 | yes |
| dark | ink-2 | surface | 8.48:1 | 4.5:1 | yes |
| dark | ink-2 | subtle | 8.85:1 | 4.5:1 | yes |
| dark | ink-2 | sunken | 9.42:1 | 4.5:1 | yes |
| dark | ink-3 | bg | 5.62:1 | 4.5:1 | yes |
| dark | ink-3 | surface | 5.21:1 | 4.5:1 | yes |
| dark | ink-3 | subtle | 5.44:1 | 4.5:1 | yes |
| dark | ink-3 | sunken | 5.79:1 | 4.5:1 | yes |
| dark | accent-text | bg | 9.25:1 | 4.5:1 | yes |
| dark | accent-text | surface | 8.57:1 | 4.5:1 | yes |
| dark | accent-text | subtle | 8.95:1 | 4.5:1 | yes |
| dark | accent-text | sunken | 9.53:1 | 4.5:1 | yes |
| dark | ok | bg | 8.86:1 | 4.5:1 | yes |
| dark | ok | surface | 8.21:1 | 4.5:1 | yes |
| dark | ok | subtle | 8.57:1 | 4.5:1 | yes |
| dark | ok | sunken | 9.13:1 | 4.5:1 | yes |
| dark | warn | bg | 8.44:1 | 4.5:1 | yes |
| dark | warn | surface | 7.82:1 | 4.5:1 | yes |
| dark | warn | subtle | 8.17:1 | 4.5:1 | yes |
| dark | warn | sunken | 8.70:1 | 4.5:1 | yes |
| dark | bad | bg | 7.87:1 | 4.5:1 | yes |
| dark | bad | surface | 7.30:1 | 4.5:1 | yes |
| dark | bad | subtle | 7.62:1 | 4.5:1 | yes |
| dark | bad | sunken | 8.11:1 | 4.5:1 | yes |
| dark | accent-ink | accent (Send) | 10.37:1 | 4.5:1 | yes |
| dark | bg | ink (primary button) | 16.66:1 | 4.5:1 | yes |
| dark | focus ring (accent-text) | bg | 9.25:1 | 3:1 | yes |
| dark | focus ring (accent-text) | surface | 8.57:1 | 3:1 | yes |
| dark | field border (line-field) | bg | 3.96:1 | 3:1 | yes |
| dark | field border (line-field) | surface | 3.67:1 | 3:1 | yes |

Before the fix:

| Theme | Foreground | Background | Ratio |
|---|---|---|---|
| light | ink-3 (old #9a9390) | bg | 2.82:1 |
| light | ink-2 (old #6e6868) | bg | 5.10:1 |
| dark | ink-3 (old #8a807c) | surface | 4.44:1 |

0 pair(s) below the requirement.

## Brand and motion pass (8 Oct 2026)

The redesign above made the product calm, correct and accessible. This pass keeps all of that (data layer, statistics, validity rubric, tests, accessibility) and restores what the brand spec (`PRODUCT_DASHBOARD_UI_DESIGN.md`) and the owner asked for that the redesign had removed.

| Change | Why (spec section) |
|---|---|
| Entrance is burgundy with the cream mark revealing itself (fragment → horns → face → eyes → crescent → name → sign-in), full once per browser, short afterwards, skippable; content is CSS-timed so it works without JS; "Enter demo workspace" dissolves into the app from the button | §19–23 |
| `LiveMark`: the mark's eyes follow the pointer and blink, only while the user is active (an idle page stays still, see e2e 15) | §20, owner's motion brief |
| Primary buttons are burgundy with cream text (were ink) | §16 |
| Sidebar: burgundy tile with the live mark; Home in the primary list; Datasets and Settings as a quiet secondary list; the active row is a subtle burgundy wash that glides between rows | §6 |
| Page titles in Geist 600 (were Newsreader); Newsreader stays for interpretation and reports, so reasoning still looks different from measurement | §4, §11 |
| Workspace opens on Overview, with the question first; Session (the agent log) is the last tab rather than the default | §8, §11 |
| Tabs: a burgundy marker glides to the selected tab | §26 |
| Graph: nodes arrive layer by layer, edges draw themselves, the selected node is burgundy with cream text, the hovered node's lineage is cream with rose edges, edges into and out of a running experiment carry flowing dashes, the canvas has a quiet dot grid | §9, §26 |
| Home: "Running now" with live progress (derived from the clock, no ticker when nothing runs); burgundy progress fills ease between values; rows get a burgundy hover marker; starters lift on hover | §7, §26 |
| Details panel slides in; content rises in with CSS (no JS needed); everything above stops under reduced motion | §26 |

Tests: e2e 6b now allows the running-edge animation next to the running pulse (both show live data, both stop under reduced motion, which e2e 6 still checks). e2e 4 and 17 failed on an untouched build of `main` in this environment (headless Chromium reports no window focus before the first interaction; Send's fill was read mid-transition); they now check the active element and the settled colour. All 26 e2e tests and 43 unit tests pass.
