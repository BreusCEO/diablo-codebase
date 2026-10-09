# Diablo AI

**Diablo AI lets companies understand what is actually happening inside their AI systems: not just *that* a score moved, but *which change* moved it, and how sure they can be.**

Live demo: **https://diablo.pnoia.dev** (click "Enter demo workspace"; no account needed) · Submission: [`docs/SUBMISSION.md`](docs/SUBMISSION.md) · Stage pitch: [`docs/PITCH.md`](docs/PITCH.md) · Self-assessment: [`docs/SCORECARD.md`](docs/SCORECARD.md)

A question such as "why did it get worse?" becomes competing hypotheses, controlled experiments, evidence and a verdict, with an effect size, a 95% confidence interval, an exact test and a validity grade, traceable to raw outputs. **The AI reasons. The system measures.** The reasoning agent proposes (a rule-based stand-in in this demo); every number is computed from stored counts by `src/lib/stats.ts`.

Proof you can rerun (`npm test`, pinned in `src/lib/submission-claims.test.ts`), on an illustrative example rather than customer data: of two changes shipped together, a new system prompt cost **−15.0 pp** (95% CI −26.3 to −3.8, exact McNemar p = 0.012), while a temperature change showed no clear effect (−1.3 pp, CI −8.8 to +6.3). Revert the prompt and keep the temperature change.

| Works today | Next |
| --- | --- |
| Full investigation loop in the browser on demo data; real statistics engine (Wilson, Newcombe, z, Fisher, exact McNemar, paired bootstrap, Holm); validity rubric C1–C9; 51 unit tests and 26 end-to-end tests pass | A real reasoning model (GLM-5.3 planned) and a connector to a customer's AI system behind the existing `DataProvider` interface; in progress: Python engine with a Gemini provider, Google sign-in |

For every company that integrates AI, from telecoms to startups to frontier labs. These are target segments, not customers.

### About this repository

This repository is the clickable demo. All data is illustrative and lives in your browser; every run is simulated by a seeded mock provider, and every number on screen is derived from stored counts.

## Run it

```bash
npm install
cp .env.example .env.local   # optional in development; see "Sign-in" below
npm run dev -- -p 3123       # http://localhost:3123
```

Checks (all cross-platform, no bash needed):

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # unit tests (Vitest): statistics, validity rubric, slugs, time, storage recovery
npm run build        # production build
npm run test:e2e     # end-to-end + accessibility (Playwright, Chromium) against the production build
npm run check        # typecheck + lint + unit tests + build
npm run check:release  # fails while legal/contact placeholders remain in src/lib/brand.ts
```

First time on a machine: `npx playwright install chromium`. Run `npm run build` before `npm run test:e2e`. The e2e server gets a throwaway `AUTH_SECRET`; a setup project signs in once through the demo route and every spec reuses that session.

Deploying: production is deployed with the Vercel CLI from a local folder, which uploads the working tree and ignores `.gitignore`. The committed `.vercelignore` keeps local env files, QA and test output, `site/` and `engine/` (separate projects) and `learn/` out of the upload. Keep `e2e/` in it: `playwright.config.ts` imports `e2e/helpers`, and `next build` type-checks both. `tsconfig.json` and the ESLint config also skip `learn/`, so a local course folder never breaks the app's checks. Run `npx next build` locally before deploying.

## Sign-in

Every workspace route (`/home`, `/investigations`, `/systems`, `/experiments`, `/evidence`, `/reports`, `/datasets`, `/settings`, `/design`) needs a session. There is no database: the session is a signed JWT (HS256, `jose`) in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production) that lasts 7 days.

- **Continue with Google**: OAuth 2.0 Authorization Code flow with PKCE (S256), a `state` and an OpenID Connect `nonce`, done with plain `fetch`. The verifier, state, nonce and return path travel in a 10-minute signed cookie scoped to `/api/auth/google`. The callback checks state, exchanges the code with the verifier, then verifies the ID token: its RS256 signature against Google's published keys (`https://www.googleapis.com/oauth2/v3/certs`, fetched with `jose` and cached), issuer, audience and `azp`, expiry, the nonce from the cookie, and a verified email. If `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are not set, the button is shown disabled with the reason.
- **Enter demo workspace**: a real server session flagged `demo` ("Demo researcher"), so the demo works without a Google account.
- **Email and password** are not offered: they need a user store (hashes, verification, resets), and this app deliberately has no database. Add one before adding them.

How it fits together:

| Path | Role |
| --- | --- |
| `src/proxy.ts` | Verifies the cookie for every workspace route and app API route; redirects to `/` with `?next=`; sends signed-in visitors on `/` on to `?next=` or `/home`; deletes a cookie that fails verification |
| `src/app/(app)/layout.tsx` | Starts the server-side session read (`getSession()`), hands the promise to `SessionProvider`, and redirects again if it is missing (defence in depth) |
| `src/lib/auth/` | `env` (the only env reads), `session` (sign/verify), `google` (PKCE flow), `dal` (`getSession()`), `http` (cookies, same-origin check), `next-path` (open-redirect guard) |
| `src/app/api/auth/*` | `GET google`, `GET google/callback`, `POST demo`, `POST signout` (POSTs require a same-origin `Origin`) |
| `src/components/auth/SessionProvider.tsx` | `useSession()` and `signOut()` for client components |

Environment variables (see `.env.example`): `AUTH_SECRET` (required in production, 32+ characters: `openssl rand -base64 32`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and optionally `APP_ORIGIN` (the public origin used for the redirect URI; defaults to the request's). The sign-in page renders per request (so that without JavaScript the demo form still carries `?next=` and errors still show) and reads the Google variables when it renders; on Vercel a change to them takes effect on the next deploy.

Google Cloud Console: create an OAuth client of type **Web application** with the authorized redirect URIs `https://diablo.pnoia.dev/api/auth/google/callback` and `http://localhost:3123/api/auth/google/callback`. Scopes: `openid`, `email`, `profile`.

## Where things are

| Path | What it is |
| --- | --- |
| `src/app/page.tsx` | Sign-in: burgundy, the mark reveals itself (full once per browser, short after), then a glass card with Continue with Google and Enter demo workspace |
| `src/app/(app)/home` | Home: "What do you want to find out?", the composer, starters, recent investigations |
| `src/app/(app)/investigations/[id]` | Workspace: Session, Overview, Graph, Evidence and Report tabs, and the experiment panel |
| `src/app/(app)/{systems,experiments,datasets,evidence,reports,settings}` | Library pages and settings |
| `src/app/legal/*` | Terms, Privacy and Usage drafts (pending legal review) |
| `src/proxy.ts` | Route protection (see "Sign-in") and real 404s for investigation URLs that cannot exist |
| `src/lib/brand.ts` | Product name, legal entity and contact details (open decisions, one place) |
| `src/lib/stats.ts` | Wilson, Newcombe, z-test, Fisher, McNemar, Cohen's h, bootstrap, Holm, formatting |
| `src/lib/validity.ts` | Validity checks C1–C9 and evidence strength (rubric v0, draft) |
| `src/lib/data/` | Types, derived results, interpretation text, the `DataProvider` interface and hooks |
| `src/lib/data/mock/` | The mock provider: fixtures (counts only), the rule-based agent, the seeded simulator |
| `src/components/shell/*` | Sidebar, account menu, mobile drawer, command palette, toasts |
| `src/components/research/*` | Workspace tabs, graph, evidence browser, trace viewer, report |
| `src/components/charts/*` | Forest plot, paired rates, curve, heatmap, with table view, CSV and SVG export |
| `src/app/globals.css` | Design tokens (light and dark), focus, reduced motion, print |
| `e2e/`, `qa/` | Playwright tests; screenshot and contrast scripts; `qa/baseline` and `qa/after` screenshots |

## Principles

- Burgundy `#57001A` and cream `#FCF8EF` come from the mark. Burgundy is an accent inside the app (primary buttons, Send, the active row and tab, the selected graph node, the running dot and running edges, links in prose, the focus ring) and the surface of the entrance only.
- Measured vs interpreted: numbers, tables and charts are Geist and Geist Mono on the page. Text the agent writes is Newsreader, after a quiet "Interpretation" label.
- No invented numbers: fixtures store counts; every rate, interval, p-value and effect size is computed by `stats.ts`. "Not recorded" is a state, never a pass.
- Motion explains a state change. Two continuous animations, both meaning "data is arriving": the running dot and the dashes on a running experiment's edges. The entrance reveal is the one expressive moment; the mark's eyes follow the pointer and blink only while you are active. `prefers-reduced-motion`, or Settings → Motion → Reduce, turns all of it off.
- Sentence case, units on every number, nothing under 12px, contrast 4.5:1 for text.

## Shortcuts

`Ctrl K` / `⌘K` command palette · `Ctrl \` / `⌘\` collapse the sidebar · `?` keyboard shortcuts · `Enter` send · `Shift Enter` new line · arrows move between tabs and graph nodes · `+` `−` `0` zoom and fit the graph · `Esc` closes dialogs, menus and the panel.
