# Engine plan: which screen uses which engine data

| Screen | Data | Source now |
|---|---|---|
| Home (real workspace) | Question → live run | `/live?q=…` → `POST /api/live/run` (NDJSON progress) |
| Home (demo workspace) | Sample investigation | `src/lib/data/mock` (labelled "Demo data") |
| `/live` | Stages, calls, plan, verdicts, Δ, CI, p, Holm p, grounded conclusion, run record | `src/lib/live/investigate.ts` events and result |
| Investigation workspace (after "Open in workspace") | Hypotheses, experiments, runs, samples, graph, evidence, report | the live result converted to the app's `Investigation` type |
| Settings → Reasoning model | Claude or Gemini (team only) | `GET /api/live/options`, server-enforced in `/api/live/run` |
| Report | Facts and verdicts computed by code; interpretation grounded with `{{F#}}` | `src/lib/live/grounding.ts`, `derive.ts`, `validity.ts` |

Next: persist sessions, events and knowledge in Postgres; widen experiment types and testbed targets (see README "Not yet implemented").
