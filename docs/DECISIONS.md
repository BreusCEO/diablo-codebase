# Decisions

Recorded as the engine was built against `DIABLO_ENGINE_PROMPT.md` (9 Oct 2026, hackathon day, a two-hour window).

| # | Decision | Why |
|---|---|---|
| 1 | The engine is the TypeScript engine inside the Next.js app (`src/lib/live/`), not a separate Python FastAPI service. | The prompt says to extend an existing backend rather than add a second one. It already had a state machine (DRAFT → RUN → ANALYZE → INTERPRET), providers, a paired runner, real statistics and grounding, and it deploys with the app on Vercel. `engine/` (Python) stays the developer's learning project. |
| 2 | Claude Opus 5.5 is the reasoner for everyone. Team members (`DIABLO_TEAM_EMAILS`) can switch to Google Gemini in Settings. | The team's choice. The server decides (`src/lib/live/team.ts`); the browser can only ask. |
| 3 | The system under test in the planted-change testbed is Claude Haiku 4.5 (Gemini mode: gemini-3.5-flash-lite). | The planted change includes a temperature change; Claude Haiku 5.5 does not accept `temperature`. |
| 4 | Real (Google) workspaces send Home questions to the real engine (`/live?q=…`). The demo workspace keeps its labelled sample flow. | Spec §3: real workspaces never show sample data; demo stays separate and explicit. |
| 5 | The user's question frames the hypotheses but cannot change the allowed factors, sample sizes or budgets. It is passed to the model as quoted data. | Closed vocabularies and pre-registered caps stay in code (core principle; prompt-injection safety). |
| 6 | No database yet. Runs stream to the browser and are saved in the browser workspace via "Open in workspace". | Vercel functions cannot keep SQLite between requests; a hosted Postgres needs the owner to accept a Marketplace integration. Listed under "Not yet implemented". |
| 7 | Keys live only in Vercel environment variables (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`). No key is ever sent to the browser or logged. | Spec §2. |
