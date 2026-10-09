# Repository audit

**Stack.** Next.js 16.4 (App Router, Cache Components), React 19.3, TypeScript, Tailwind 4, motion, zod, jose (signed-cookie sessions), Vitest, Playwright + axe. Public site in `site/` (separate Next.js project). Python learning engine in `engine/`.

**Run.** `npm install`, `npm run dev` (app), `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npx playwright test`, `npm run bench`. Site: `cd site && npm run dev`.

**Works (preserve).** Google sign-in and the demo workspace; protected routes; the investigation workspace (Overview, Graph, Evidence, Report, Session); statistics engine (`src/lib/stats.ts`: Wilson, Newcombe, z, Fisher, exact McNemar, paired bootstrap, Cohen's h, Holm); validity rubric C1–C9 (`src/lib/validity.ts`); derived verdicts (`src/lib/data/derive.ts`); the live engine (`src/lib/live/`): closed-vocabulary plans, paired runner, grounded interpretation; planted-cause benchmark (`src/lib/bench/`).

**Mock data sources.** `src/lib/data/mock/*`: a rule-based demo agent and a seeded run simulator, used by the demo workspace and, before this change, by every Home question.

**Gaps.** No persistent server-side store; a single testbed target (Helper v1/v2); no knowledge base across sessions; no claim linter beyond the interpretation grounding check; no Hugging Face export.

**Risks.** Model rate limits and the 300 s function limit bound a live run; keys pasted in chat should be rotated.
