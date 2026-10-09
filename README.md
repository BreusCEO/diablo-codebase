<p align="center">
  <img src="public/icon.svg" width="88" alt="Diablo AI" />
</p>

<h1 align="center">Diablo AI</h1>

<p align="center"><b>AI that evolves AI.</b><br/>The research engine that tells you <i>why</i> your AI got better or worse, and proves it.</p>

<p align="center">
  <a href="https://app.diablo.pnoia.dev"><b>Live product</b></a> ·
  <a href="https://diablo.pnoia.dev">Website</a> ·
  <a href="https://diablo.pnoia.dev/demo.mp4">72-second demo</a> ·
  <a href="docs/runs/2026-10-09-production-run.md">A real run, recorded</a> ·
  <a href="docs/BENCHMARK.md">Benchmark</a>
</p>

---

## Every company now ships AI. Nobody can explain it.

Prompts, models, tools and retrieval change every week. When quality drops, today's tools say **that** a number moved. They cannot say **which change** moved it, or whether the drop is even real. So teams guess, roll back everything, or ship the regression. Each wrong guess costs engineering weeks and customer trust.

**Diablo answers the question nobody else can: "which change caused this, and how sure are we?"**

## How it works

Ask a question in plain language. Diablo turns it into **competing hypotheses**, designs **one controlled experiment per hypothesis**, runs your AI on the same items in both arms, and returns a **verdict per cause**: effect size, 95% confidence interval, exact test, multiple-comparison correction and an evidence grade, each traceable to the raw outputs.

> **The AI reasons. The system measures.**
> The model (Claude Opus 5.5) plans the investigation and explains the result. Code runs the experiments and computes every number. A grounding checker rejects any number the model tries to write itself. Diablo cannot hallucinate a result.

## Proof, not promises

**It works on a real model, live in production.** On 9 Oct 2026, Claude Opus 5.5 planned an investigation into a system with two changes shipped at once. Claude Haiku 4.5 was the system under test, and code ran 120 paired calls. Diablo found the planted cause: the prompt change took accuracy from **40/40 to 0/40** (exact McNemar p < 0.001). It cleared the innocent temperature change (40/40 to 39/40, no clear effect). On the first draft, the checker caught the model writing a number by hand and forced a rewrite. [Full event log →](docs/runs/2026-10-09-production-run.md)

**It doesn't cry wolf.** Across a seeded benchmark of **45,000** simulated regressions with a known planted cause, Diablo's protocol:
- named the right cause **97.3%** of the time when it named one;
- raised a false alarm on only **1.1%** of no-cause scenarios, against **81%** for the common "blame the biggest drop" approach.

[Method and every number →](docs/BENCHMARK.md)

**It's engineered like infrastructure.** The statistics engine matches SciPy and statsmodels to within 5×10⁻⁵. There are 294 unit tests, plus an end-to-end browser suite with accessibility checks. Google sign-in has signature-verified tokens, and there is no hallucination path to a published number.

## The economics

| | |
|---|---|
| Model cost of that real investigation (123 calls) | **≈ $0.20** |
| Planned price (free during early access) | Pro **$49**/month · Team **$199**/workspace/month · Enterprise custom |
| What it replaces | Days of an ML engineer's time per regression, and the cost of shipping the wrong fix |

No training data, no fine-tuning, no data warehouse. Diablo needs API access to the system under test and a set of prompts. Statistics run locally, at zero marginal cost.

## Why now

- **AI is moving from demos to operations.** The hard problem is no longer building a model but knowing what a change did to it.
- **Models update monthly, and agents add tools weekly.** Every update is an uncontrolled experiment unless something measures it.
- **Buyers and regulators are starting to ask for evidence, not anecdotes.** Diablo produces it by construction.

## Where it goes: AI that evolves AI

1. **Now: investigations on demand.** Ask why something changed and get a verdict with proof. *(Live.)*
2. **Next: connect any AI system.** Point Diablo at your own model, agent or app endpoint, so findings persist into a knowledge base of causes, failure modes and fixes that compounds with every investigation.
3. **Then: autonomous discovery.** Diablo notices that behaviour changed, investigates on its own, and verifies a fix before anyone files a ticket.
4. **Ultimately: a self-improving investigator.** Every verified investigation becomes training data, so Diablo learns to investigate better. Any new version is promoted only if it beats the current one on a held-out benchmark. Every change stays explicit, testable and reversible.

**Who it's for:** every company that ships AI. That includes telecoms running support assistants, startups shipping agents, and labs comparing model versions. *(Target segments, not current customers.)*

## Team

**Ilham Orujov** and **wcissor**, founding team. Built for the OMNI AI Summit hackathon.

## Honest status

| Works today | Next |
|---|---|
| Live investigations on a real model (Claude Opus 5.5; Gemini as a system-wide alternative in `/admin`) against a built-in testbed; the full workspace (overview, research graph, evidence, report); the real statistics engine and validity rubric; Google sign-in plus a no-account demo workspace (its data is simulated and labelled "Demo data") | Connectors to customers' own AI systems; server-side storage of runs and knowledge; the improve-then-verify loop; more experiment types. See [Not yet implemented](#not-yet-implemented). |

Submission material: [`docs/SUBMISSION.md`](docs/SUBMISSION.md) · [`docs/PITCH.md`](docs/PITCH.md) · [`docs/DISCLOSURE.md`](docs/DISCLOSURE.md) · [`docs/DECISIONS.md`](docs/DECISIONS.md)

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

Every workspace route (`/home`, `/investigations`, `/live`, `/systems`, `/experiments`, `/evidence`, `/reports`, `/datasets`, `/settings`, `/design`) needs a session. There is no database: the session is a signed JWT (HS256, `jose`) in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production) that lasts 7 days.

- **Continue with Google**: OAuth 2.0 Authorization Code flow with PKCE (S256), a `state` and an OpenID Connect `nonce`, done with plain `fetch`. The verifier, state, nonce and return path travel in a 10-minute signed cookie scoped to `/api/auth/google`. The callback checks state, exchanges the code with the verifier, then verifies the ID token: its RS256 signature against Google's published keys (`https://www.googleapis.com/oauth2/v3/certs`, fetched with `jose` and cached), issuer, audience and `azp`, expiry, the nonce from the cookie, and a verified email. If `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are not set, the button is shown disabled with the reason.
- **Enter demo workspace**: a real server session flagged `demo` ("Demo researcher"), so the demo works without a Google account.
- **Email and password** are not offered: they need a user store (hashes, verification, resets), and this app deliberately has no database. Add one before adding them.

How it fits together:

| Path | Role |
| --- | --- |
| `src/proxy.ts` | Verifies the cookie for every workspace route and app API route; redirects to `/` with `?next=`; sends signed-in visitors on `/` on to `?next=` or `/home`; deletes a cookie that fails verification; refuses state-changing app API requests (not GET/HEAD/OPTIONS) from any other origin |
| `src/app/(app)/layout.tsx` | Starts the server-side session read (`getSession()`), hands the promise to `SessionProvider`, and redirects again if it is missing (defence in depth) |
| `src/lib/auth/` | `env` (the only env reads), `session` (sign/verify), `google` (PKCE flow), `dal` (`getSession()`), `http` (cookies, same-origin check), `next-path` (open-redirect guard) |
| `src/app/api/auth/*` | `GET google`, `GET google/callback`, `POST demo`, `POST signout` (POSTs require a same-origin `Origin`) |
| `src/components/auth/SessionProvider.tsx` | `useSession()` and `signOut()` for client components |

Environment variables (see `.env.example`): `AUTH_SECRET` (required in production, 32+ characters: `openssl rand -base64 32`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and optionally `APP_ORIGIN` (the public origin used for the redirect URI; defaults to the request's). The sign-in page renders per request (so that without JavaScript the demo form still carries `?next=` and errors still show) and reads the Google variables when it renders; on Vercel a change to them takes effect on the next deploy.

Google Cloud Console: create an OAuth client of type **Web application** with the authorized redirect URIs `https://app.diablo.pnoia.dev/api/auth/google/callback` and `http://localhost:3123/api/auth/google/callback`. Scopes: `openid`, `email`, `profile`.

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
| `src/lib/live/` | The live engine: LLM port and adapters, target registry, dataset, scorer, paired runner, grounding, abuse guard (see [Live investigations](#live-investigations)) |
| `src/app/(app)/live`, `src/app/api/live/run` | The Live investigation page and its streaming API |
| `src/components/shell/*` | Sidebar, account menu, mobile drawer, command palette, toasts |
| `src/components/research/*` | Workspace tabs, graph, evidence browser, trace viewer, report |
| `src/components/charts/*` | Forest plot, paired rates, curve, heatmap, with table view, CSV and SVG export |
| `src/app/globals.css` | Design tokens (light and dark), focus, reduced motion, print |
| `e2e/`, `qa/` | Playwright tests; screenshot and contrast scripts; `qa/baseline` and `qa/after` screenshots |

## Live investigations

`/live` runs one investigation end to end on a real model, the moment a model key is configured. **The AI reasons. The system measures.** The model proposes hypotheses and experiments and explains the result; code calls the system under test, scores every answer, computes every statistic and checks every number. The model can never put a number into a published result.

**The planted change.** "Helper" is an arithmetic assistant. Helper v2 shipped two changes at once: a shortened system prompt ("reply with the result only") and a higher temperature (0.2 → 1.0). Which change moved accuracy, if either, is not known in advance: the run measures it.

| Stage | Who | What happens |
| --- | --- | --- |
| Draft | model | The reasoning model returns JSON: at least two competing hypotheses and the experiments that test them. Zod validates it against closed vocabularies built from the registry (`src/lib/live/registry.ts`): only the registry's two factors, only their values, items per arm within the budget, every hypothesis tested. A rejected plan goes back with the validator's reasons, at most twice. If no valid plan arrives the run fails; a plan is never invented. |
| Run | code | A paired runner (`runner.ts`) sends the same seeded items to both arms (`dataset.ts`: multi-step integer arithmetic, exact answers computed by code), with a concurrency pool, per-call timeouts and a run deadline. An arm two experiments share is called once per item. The scorer (`scorer.ts`) is code: the integer on the reply's last "Answer:" line (or else its last integer) must equal the exact answer. An empty reply cut off by the output limit leaves its pair out. A failed call leaves its pair out; it is never scored as wrong. |
| Analyze | code | The outcomes become the app's own `Investigation` type, and the existing code does the statistics: exact McNemar and a seeded paired bootstrap per experiment, Holm across experiments, verdicts, checks C1–C9 (`src/lib/data/derive.ts`, `src/lib/stats.ts`, `src/lib/validity.ts`). No new statistics code. |
| Interpret | model | Code builds a fact table (every rate, interval, p-value and verdict). The model writes the conclusion with `{{F1}}`-style placeholders only; a checker (`grounding.ts`) rejects any digit, percent sign or quantity word outside a placeholder and any placeholder not in the table. Code then substitutes the values. If the text fails twice, the page shows a summary built by code and labels it as such. |

The page shows the scenario, the most calls a run can make before you press Run, live stage progress with counts and tokens, then hypotheses with verdicts, each experiment's counts, Δ, 95% CI, exact McNemar p and Holm-adjusted p, the conclusion with a "Numbers checked" badge (or the "Code-built summary" label), the fact table, the run record and every reply. "Open in workspace" adds the run to the browser's investigations, where the graph, evidence browser and report render it like any other; live experiments are never re-run with simulated data.

### Setup

The team's setup is Claude: **Claude Opus 5.5** reasons (plans the experiments, writes the conclusion) and **Claude Haiku 4.5** plays "Helper", the system under test.

1. Create a Claude API key in the Claude Console under Settings → API keys: https://platform.claude.com/settings/keys. Claude API usage is billed to the key's account (there is no free tier beyond a new account's small trial credit).
2. Add it as `ANTHROPIC_API_KEY`: locally in `.env.local`; on Vercel under Project → Settings → Environment Variables, then redeploy. If the key is not scoped to a single workspace, also set `ANTHROPIC_WORKSPACE_ID` (the `wrkspc_…` id from Settings → Workspaces); the API refuses such a key without it.
3. Optional: `DIABLO_REASONING_MODEL` (default `claude-opus-5-5`) and `DIABLO_TARGET_MODEL` (default `claude-haiku-4-5`). Model ids were checked against the Claude models overview and deprecations pages on 9 Oct 2026.

**Why the target is Claude Haiku 4.5 and not Claude Haiku 5.5.** The planted change includes a temperature change (0.2 → 1.0), so the target must accept both temperatures. The Claude API answers a temperature other than 1 with a 400 error on Claude Opus 4.7 and every later model, Claude Haiku 5.5 included (model deprecations page, "API parameter deprecations"). Claude Haiku 4.5 still takes 0 to 1 (it is a legacy model, not deprecated; Anthropic gives at least 60 days' notice before retiring one). Setting a target that rejects temperature, such as `claude-haiku-5-5`, switches live runs off with that reason on `/live` instead of failing mid-run. The reasoning model is never sent a temperature, so Claude Opus 5.5 is fine there.

**Alternatives.** `GEMINI_API_KEY` (Google AI Studio, with a free tier; defaults `gemini-3.8-flash` and `gemini-3.5-flash-lite`) or `ZAI_API_KEY` (Z.ai GLM, OpenAI-compatible; defaults `glm-5.3` and `glm-4.7-flash`). With several keys set, Claude is used first, then Gemini, then Z.ai; `DIABLO_LLM=anthropic|gemini|zai` chooses.

**How the engine calls Claude** (`src/lib/live/llm/anthropic.ts`, plain `fetch`, written against the Claude API docs as read on 9 Oct 2026):

- `POST https://api.anthropic.com/v1/messages` with `x-api-key`, `anthropic-version: 2023-06-01` and, when set, `anthropic-workspace-id`. The key is only ever a request header.
- Body: `model`, `max_tokens` (8,192 to plan, 4,096 for the conclusion, 2,048 per target answer), `system` as a top-level string, `messages`, and `temperature` only on target calls. No `thinking` field: Claude Opus 5.5 always thinks (adaptive, default effort `medium`), and that thinking counts toward `max_tokens` and is billed as output; Claude Haiku 4.5 does not think unless asked.
- JSON: the Claude API has no schema-free JSON mode and current models refuse an assistant prefill, so the prompt asks for one JSON object and the existing zod validate-and-repair loop checks it. Structured outputs (`output_config.format`) are supported on Claude Opus 5.5 but not used yet: the plan's schema should first be tried against the real API.
- The answer is the text blocks joined; `thinking` and `redacted_thinking` blocks are dropped. A reply stopped by `max_tokens` (or a full context window) is a typed bad response that still counts its billed tokens; a `refusal` comes back as an answer with its category.
- Errors: 401 `authentication_error` and 403 `permission_error` → auth; 402 `billing_error` and spend limits (a 429 with `error_code: enforced_spend_limit_reached`, or a 400 for a limit you set) → quota; 404 → model not found (a wrong workspace id → auth); 429 `rate_limit_error` → rate limit; 500 `api_error`, 504 `timeout_error`, 529 `overloaded_error` → server; 400 `invalid_request_error`, 413 `request_too_large` → bad request. Only rate limits and server errors are retried, at most 3 times, waiting `retry-after` when given (never more than 20 s per wait), else 1 s, 2 s, 4 s. Messages name the status, error type and `request-id`, with the key redacted.

Without a key, `/live` says so plainly and `POST /api/live/run` answers 503; nothing is simulated in its place.

### Budget, cost and limits

| Setting | Default | Hard limits |
| --- | --- | --- |
| `LIVE_MAX_EXPERIMENTS` × 2 arms × `LIVE_MAX_ITEMS_PER_ARM` | 2 × 2 × 40 | 2–3 experiments, 10–100 items per arm |
| Model calls per run, at most | 165 (3 to plan, 160 target, 2 to interpret) | the product of the above |
| `LIVE_CONCURRENCY` | 4 target calls in flight | 1–8 |
| `LIVE_TARGET_TIMEOUT_SECONDS`, `LIVE_REASONING_TIMEOUT_SECONDS` | 30, 90 | 5–120, 10–180 |
| `LIVE_RUN_DEADLINE_SECONDS` | 180: no new target calls after this; the finished pairs are analysed | 30–270 (the route allows 300 s in total) |
| `LIVE_DAILY_CALL_CAP` | 500 model calls per UTC day | — |
| `LIVE_COOLDOWN_SECONDS` | 60 between runs of one session | 0–3600 |
| `LIVE_MAX_CONCURRENT_RUNS` | 2 | 1–4 |

**Claude list prices** (USD per million tokens, https://platform.claude.com/docs/en/about-claude/pricing, read 9 Oct 2026; also in `src/lib/live/pricing.ts`):

| Model | Input | Cache hits | Output |
| --- | --- | --- | --- |
| Claude Opus 5.5 (`claude-opus-5-5`) | $4 | $0.20 | $20 |
| Claude Haiku 4.5 (`claude-haiku-4-5`) | $1 | $0.10 | $5 |
| Claude Haiku 5.5 (`claude-haiku-5-5`), prompts up to 100k tokens | $0.10 | $0.01 | $0.50 |

The engine sends no `cache_control`, so its runs pay the base input price. When a run finishes, its run record shows what its measured tokens cost at these prices (reasoning and target separately). No Claude run has been made yet, so there is no measured figure here. What the caps allow at most: output is bounded by `max_tokens` on every call, which at list price is about $0.49 for three planning calls, $0.16 for two conclusion calls and $1.64 for 160 target calls; input, a few thousand tokens per reasoning call and a short prompt per target call, adds roughly another $0.10. So the caps hold one run to roughly $2.40 at most; a typical run, whose target answers are far shorter than 2,048 tokens, should cost a fraction of that, but that is an expectation until a run is measured.

A typical plan (two single-factor ablations against Helper v1) makes about 120 target calls plus 2 to 5 reasoning calls. On Gemini's free tier that costs nothing. Whatever the provider, the per-minute rate limit is what decides speed: a rate limit that outlasts the adapter's own retries pauses the whole pool and puts the call back in the queue, so a slow key gives fewer finished pairs before the deadline, and check C2 then flags the small sample. Retries happen only on 429 and 5xx, with capped backoff. Errors are typed (auth, model not found, rate limit, quota, server, network, timeout, bad response); a bad key, an unknown model or an exhausted quota or spend limit stops the run at once. Keys are read only in `src/lib/live/env.ts`, sent only as a request header, and redacted from every error message.

The run API (`POST /api/live/run`, Node runtime) streams NDJSON events: `start`, `stage`, `draft-attempt`, `plan`, `progress`, `interpret-attempt`, then `result` or `error`. It needs a signed-in session (the proxy checks the cookie, the route checks again through `getSession()`) and a same-origin request. The abuse controls (one run at a time per session, a cooldown, a cap on concurrent runs and a daily call cap) live in memory per server instance (`src/lib/live/guard.ts`): best effort, not a distributed limiter. A cold start resets them, and the provider's own quota remains the final backstop. Leaving the page cancels the run.

### What is real and what is not

- Real, once a key is set: the planning and interpretation calls to the reasoning model, every call to the target model, every reply, every score and every statistic on `/live`.
- Not real anywhere else: the demo workspace's own investigations (seeded, simulated, labelled as such).
- Tested without a key: the whole pipeline runs in unit tests against a scripted fake model and a fake target (`src/lib/live/*.test.ts`), and all three adapters are tested against mocked `fetch` (request shape, response parsing, error classification, retries, timeouts, no key leakage). No key was available while this was built, so the live path has not yet been run against the real Claude, Gemini or Z.ai API; the Claude adapter follows the Claude API docs as read on 9 Oct 2026 but has never received a real response, and the Z.ai adapter in particular is kept small and only covered by mocked tests.
- Results are kept in the browser tab only (the API stores nothing). One target model and one seeded item set: a result holds for that setup.

## Not yet implemented

Against `DIABLO_ENGINE_PROMPT.md`, honestly:

- **Persistence:** no server database. Sessions, events, evidence and knowledge do not survive outside the browser; no crash-resume.
- **Experiment types:** only paired A/B ablation on the planted-change testbed (Helper v1/v2). Probe sets, regression diff on user targets, perturbation, consistency and counterexample search are not built.
- **Targets:** only the built-in model-API testbed. HTTP agents, Python callables and Hugging Face targets are not built.
- **Agents:** planner and analyst roles are covered by the draft and interpret steps; separate critic, improver, verifier and librarian agents are not built.
- **Improve → verify loop, knowledge base, claim linter for full reports, Hugging Face export and training scaffolding, `diablo bench` for the live engine:** not built. (`npm run bench` measures the statistical protocol on simulated data.)
- **LLM judges:** not used; all scoring is programmatic.

## Principles

- Burgundy `#57001A` and cream `#FCF8EF` come from the mark. Burgundy is an accent inside the app (primary buttons, Send, the active row and tab, the selected graph node, the running dot and running edges, links in prose, the focus ring) and the surface of the entrance only.
- Measured vs interpreted: numbers, tables and charts are Geist and Geist Mono on the page. Text the agent writes is Newsreader, after a quiet "Interpretation" label.
- No invented numbers: fixtures store counts; every rate, interval, p-value and effect size is computed by `stats.ts`. "Not recorded" is a state, never a pass.
- Motion explains a state change. Two continuous animations, both meaning "data is arriving": the running dot and the dashes on a running experiment's edges. The entrance reveal is the one expressive moment; the mark's eyes follow the pointer and blink only while you are active. `prefers-reduced-motion`, or Settings → Motion → Reduce, turns all of it off.
- Sentence case, units on every number, nothing under 12px, contrast 4.5:1 for text.

## Shortcuts

`Ctrl K` / `⌘K` command palette · `Ctrl \` / `⌘\` collapse the sidebar · `?` keyboard shortcuts · `Enter` send · `Shift Enter` new line · arrows move between tabs and graph nodes · `+` `−` `0` zoom and fit the graph · `Esc` closes dialogs, menus and the panel.
