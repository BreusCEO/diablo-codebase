# Diablo AI

**Diablo AI lets companies understand what is actually happening inside their AI systems: not just *that* a score moved, but *which change* moved it, and how sure they can be.**

- Live demo: https://diablo.pnoia.dev (click "Enter demo workspace"; no account needed)
- Code: https://github.com/wcissor/diablo
- Every number in this document is reproduced by `npm test` (`src/lib/submission-claims.test.ts`).

## Summary

**Problem.** Teams that ship AI change prompts, models, temperatures, tools and retrieval every week. When quality drops, an eval dashboard says *that* a score moved. It does not say which change caused it, or whether the drop is real or noise. **Who has it.** Every company that integrates AI: a telecom such as Azercell running a support assistant, a startup shipping an agent, a frontier lab such as Anthropic or OpenAI comparing model versions. These are target segments; none of them is a customer or partner. **What Diablo does.** It turns a question ("why did it get worse?") into competing hypotheses and controlled experiments. It then gives a verdict per hypothesis, with an effect size, a 95% confidence interval, an exact test and a validity grade, and every claim traces back to raw outputs. The rule: **the AI reasons, the system measures.** The model proposes; it can never write a number. **Proof.** The live prototype runs the full loop on demo data. Its statistics engine is real and checked against SciPy reference values: 51 unit tests and 26 end-to-end tests pass. **Next.** Put a real reasoning model (GLM-5.3) and a real target-system connector behind the existing provider interface, then run the first investigation on a live system.

## 1. Value for the user

**The specific problem.** An assistant's accuracy drops after a release that changed two things. The team needs to know which change to revert, and needs proof that holds up in review.

**Worked example** (illustrative, not customer data; computed by the repo's own `stats.ts`). The same 80 prompts, scored correct or incorrect, are compared pairwise against the baseline (69 of 80 correct):

| Change | Correct | Δ vs baseline | 95% CI | Exact McNemar | Verdict |
|---|---|---|---|---|---|
| E1: new system prompt | 57/80 | −15.0 pp | −26.3 to −3.8 pp | p = 0.012 (Holm-adjusted 0.024) | **Cause of the regression** |
| E2: temperature raised | 68/80 | −1.3 pp | −8.8 to +6.3 pp | p > 0.99 | No clear effect |

The CI is a paired bootstrap: 2,000 resamples, seed 1. Discordant pairs: E1 b = 16, c = 4; E2 b = 5, c = 4.

**Outcome.** Revert the system prompt and keep the temperature change. Diablo also states what it cannot claim: E2's interval still allows a drop of up to 8.8 pp, so the verdict is "no clear effect", never "harmless". A dashboard shows only 86.3% → 71.3% and 86.3% → 85.0%, with no interval: the team argues, reverts both, or calls it noise.

## 2. Prototype and use of AI

**The core scenario works end to end in the browser.** Ask a question. Diablo drafts hypotheses and experiments, runs them (simulated), collects evidence, analyses it and concludes. You can then replicate a result, flag a score, read the raw trace and print the report.

| Works today (live, tested) | Next (not built yet) |
|---|---|
| Investigation workspace: Overview, Graph, Evidence, Report and Session tabs; experiment panel with design, config diff, effect, test and reproducibility | Real reasoning model in the loop (GLM-5.3 planned) |
| Statistics engine: Wilson, Newcombe, two-proportion z, Fisher exact, exact McNemar, seeded paired bootstrap, Cohen's h, Holm | Connector that runs a customer's AI system (API endpoint plus config) |
| Validity rubric C1–C9 and an evidence-strength grade; "Not recorded" is never a pass | Persistent knowledge across investigations |
| Verdicts and statuses derived from counts, never typed in | Sample-size planning before a run |
| Rule-based demo agent covering 7 topics (sycophancy, refusal, tool use, long context, calibration, hallucination, instruction following); seeded simulator | Autonomous monitoring ("something changed; investigate") |
| Report export (print/PDF, JSON), chart export (CSV, SVG) | |
| **In progress, not merged:** Python engine with a Gemini provider that turns a question into an experiment plan (branch `feat/gemini-provider`, tests run without a key or network); Google sign-in and protected routes (branch `feat/auth`) | |

**What the AI contributes, and what it may not do.** The reasoning model does the work an experienced evaluator does:

- turn a vague question into testable hypotheses, including a competing explanation;
- choose the experiment that separates them (an ablation, a sweep, a paired comparison);
- read the results and propose the next experiment;
- write the report.

The system does everything numeric: it runs the target, counts outcomes and computes every rate, interval, p-value and verdict from those counts. The AI cannot invent a number, and the code is built to enforce that. Fixtures store counts only, and `derive.ts` computes the rest at render time. In the interface, interpretation is set in a different typeface after an "Interpretation" label, so reasoning never looks like measurement. In today's demo a rule-based agent plays the reasoning role. We say this on screen ("Demo data") and here, so the measurement half can be judged on its own.

## 3. Quality testing

**Commands run on 9 Oct 2026:** `npm test` gave 51 passed; `npx playwright test` (production build) gave 26 passed; `npm run typecheck` and `npm run lint` are clean.

- **Statistics against references.** The Wilson, Newcombe, z-test, Fisher, McNemar and Holm results match SciPy/statsmodels values to within 5×10⁻⁵ (`src/lib/stats.test.ts`).
- **Rubric and derivations.** Missing fields never pass. A judge from the target's own model family fails. Every CI contains its Δ. A running experiment has no result. The simulator is deterministic per run id.
- **End to end.** Ask, run, replicate, flag; keyboard navigation; real 404s; recovery from corrupt storage; the report prints to more than one page. axe reports 0 serious or critical issues on 18 routes, in light and dark, at 375 and 1440 px.

**Failure examples: what goes wrong without Diablo, and what it catches.** All are pinned in `submission-claims.test.ts`.

1. **Fixing the wrong cause.** Long-context demo: the obvious hypothesis ("accuracy falls past 128k tokens") is *rejected*: −1.9 pp, CI −5.1 to +1.3. The competing one ("needle position matters") is *supported*: −10.0 pp, CI −14.3 to −6.0. A team that capped context length would have fixed nothing.
2. **A significant result with no alternative tested.** Sycophancy demo: +8.5 pp, CI 1.6 to 15.3, p = 0.016, but no competing hypothesis was tested. C9 fails, and the evidence stays "Moderate".
3. **A lucky p-value.** A borderline effect (p ≈ 0.03) among two primary tests gets a C7 warning, because it does not survive Holm.
4. **A result that does not replicate.** A reversed replication fails C8, and "Strong" drops to "Moderate".
5. **A judge grading its own family.** C4 fails, and the evidence becomes "Weak".

**Known failures of the prototype itself.** The demo agent recognises 7 topics by keyword; any other question becomes a clearly labelled "Template draft". The Session tab declines questions it cannot answer from the investigation's data ("I can't answer that in demo mode"). Runs are simulated, and tokens and cost show "Not recorded".

**Compared with the current approach** (what each gives by default):

| | Spreadsheet of eval runs | Eval dashboard | Observability / tracing | Diablo |
|---|---|---|---|---|
| Shows that a metric moved | yes | yes | yes | yes |
| Says which change caused it | manual | no | no | yes: one experiment per hypothesis |
| CI and exact test on every comparison | rarely | rarely | no | always |
| Paired design on the same prompts | manual | rarely | no | yes (McNemar, paired bootstrap) |
| Grades whether the result can be trusted | no | no | no | C1–C9 rubric |
| Claim → evidence → raw trace | no | partial | traces only | yes |

## 4. Feasibility

**Data requirements.** No training data and no fine-tuning. A customer provides:

1. access to the AI system: an API endpoint, plus the config of each version (model, system prompt, temperature, tools);
2. an evaluation set of prompts, at least 30 per arm under the rubric (the demo uses 80 to 600), taken from production logs or an existing eval set;
3. a scorer: a rule (exact match, JSON-schema check) or an LLM judge from a different model family, checked against human labels (the demo uses 200; draft threshold: agreement ≥ 0.80).

**Running cost** (estimate; assumptions stated, GLM-5.3 list prices per 1M tokens: $1.40 input, $0.26 cached input, $4.40 output). Assume one investigation takes 12 reasoning steps, each with 10k new input tokens, 20k cached context and 2k output tokens:

- GLM-5.3: 0.12M × $1.40 + 0.24M × $0.26 + 0.024M × $4.40 = $0.168 + $0.062 + $0.106 ≈ **$0.34 per investigation**.
- glm-5.3-flash ($0.15 / $0.03 / $0.50): $0.018 + $0.007 + $0.012 ≈ **$0.04**.
- LLM judging of the worked example on flash: 320 outputs × (1k input + 100 output tokens) = 0.32M × $0.15 + 0.032M × $0.50 ≈ **$0.06**.

The customer's own model calls are extra and depend on their system. Statistics run locally, in milliseconds, for free.

**Stack.** A Next.js 16 app on Vercel (live). All data access goes through one typed `DataProvider` interface (`src/lib/data/provider.ts`); today its only implementation is the in-browser mock. A Python engine is in progress.

**Next step (plan).** Implement an engine-backed `DataProvider`. GLM-5.3 returns hypotheses and experiment designs as JSON, which is validated with the existing zod schemas. Runs call the target system, and `stats.ts` remains the only source of numbers. Then run the first investigation on a real open-weights model and publish the report.

## 5. Originality

- **A new job, not a new dashboard.** Eval tools score and observability tools trace. Diablo *investigates*: question → competing hypotheses → controlled experiments → verdicts. It answers "why", not just "what".
- **"The AI reasons. The system measures."** The separation is enforced in the code and on screen, so an LLM's fluency cannot leak into the numbers.
- **Evidence has a grade.** Every conclusion carries an evidence strength from an explicit rubric: control, sample size, randomisation, judge independence, human agreement, multiple comparisons, replication and competing hypotheses.
- **Where it goes.** Every investigation is meant to leave knowledge behind: known failure modes, causes, and fixes that worked or failed. Later, Diablo should notice regressions on its own and apply the same loop to improve its own research strategy, with every change explicit, testable, reversible and auditable.
