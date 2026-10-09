import { describe, expect, it } from "vitest";
import { DEFAULT_CAPS } from "./budget";
import { draftPlan, validatePlan } from "./draft";
import { LiveError } from "./errors";
import { FakeLLM } from "./llm/fake";
import { GOOD_PLAN } from "./test-fixtures";

const clone = () => structuredClone(GOOD_PLAN) as typeof GOOD_PLAN & Record<string, unknown>;
const problemsOf = (v: unknown) => {
  const r = validatePlan(v, DEFAULT_CAPS);
  return r.ok ? [] : r.problems;
};

describe("plan validation: closed vocabulary from the registry", () => {
  it("accepts a valid plan and numbers its experiments", () => {
    const r = validatePlan(GOOD_PLAN, DEFAULT_CAPS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.experiments.map((e) => [e.id, e.hypothesisId, e.n])).toEqual([
      ["E1", "H1", 40],
      ["E2", "H2", 40],
    ]);
    expect(r.plan.experiments[0].rationale).toBe("Isolates the prompt.");
    expect(r.plan.experiments[1].rationale).toBeNull();
  });

  it("normalises numeric temperatures to the vocabulary, but only exact matches", () => {
    const p = clone();
    (p.experiments[1].treatment as Record<string, unknown>).temperature = 1;
    (p.experiments[0].control as Record<string, unknown>).temperature = 0.2;
    expect(problemsOf(p)).toEqual([]);
    (p.experiments[1].treatment as Record<string, unknown>).temperature = 0.7;
    expect(problemsOf(p).join()).toMatch(/experiments\.1\.treatment\.temperature/);
  });

  it("rejects a factor that is not in the registry", () => {
    const p = clone();
    (p.experiments[0].treatment as Record<string, unknown>).max_tokens = 64;
    expect(problemsOf(p).join()).toMatch(/experiments\.0\.treatment/);
  });

  it("rejects a value that is not in the registry", () => {
    const p = clone();
    p.experiments[0].treatment.system_prompt = "medium";
    expect(problemsOf(p).join()).toMatch(/experiments\.0\.treatment\.system_prompt/);
  });

  it("enforces the budget on items per arm and the number of experiments", () => {
    const p = clone();
    p.experiments[0].items_per_arm = 500;
    expect(problemsOf(p).join()).toMatch(/items_per_arm/);
    const q = clone();
    q.experiments[0].items_per_arm = 3;
    expect(problemsOf(q).join()).toMatch(/items_per_arm/);
    const r = clone();
    r.experiments.push({ ...r.experiments[0], title: "Both", treatment: { system_prompt: "short", temperature: "1.0" } });
    expect(problemsOf(r).join()).toMatch(/experiments/);
  });

  it("needs at least two hypotheses, one of them competing, each tested", () => {
    const one = clone();
    one.hypotheses = [one.hypotheses[0]];
    one.experiments[1].hypothesis = "H1";
    expect(problemsOf(one).join()).toMatch(/at least two/);
    const none = clone();
    none.hypotheses[1].competing = false;
    expect(problemsOf(none).join()).toMatch(/competing/);
    const untested = clone();
    untested.experiments[1].hypothesis = "H1";
    expect(problemsOf(untested).join()).toMatch(/H2 is not tested/);
    const dangling = clone();
    dangling.experiments[1].hypothesis = "H7";
    expect(problemsOf(dangling).join()).toMatch(/No hypothesis H7/);
  });

  it("rejects identical arms and duplicate experiments", () => {
    const same = clone();
    same.experiments[0].treatment = { ...same.experiments[0].control };
    expect(problemsOf(same).join()).toMatch(/identical/);
    const dup = clone();
    dup.experiments[1] = { ...dup.experiments[0], hypothesis: "H2" };
    expect(problemsOf(dup).join()).toMatch(/Duplicate/);
  });

  it("rejects numeric effect sizes in hypotheses", () => {
    const p = clone();
    p.hypotheses[0].text = "The short prompt costs about 30% accuracy.";
    expect(problemsOf(p).join()).toMatch(/direction only/);
  });
});

describe("draft loop: validate and repair, never invent", () => {
  it("returns the first valid plan", async () => {
    const llm = new FakeLLM("reasoner", [JSON.stringify(GOOD_PLAN)]);
    const attempts: boolean[] = [];
    const { plan, attempts: n } = await draftPlan({ llm, caps: DEFAULT_CAPS, onAttempt: (_, ok) => attempts.push(ok) });
    expect(n).toBe(1);
    expect(plan.hypotheses).toHaveLength(2);
    expect(attempts).toEqual([true]);
    expect(llm.calls[0].json).toBe(true);
    expect(llm.calls[0].system).toContain("closed vocabulary");
  });

  it("feeds the validator's problems back and accepts the repaired plan", async () => {
    const bad = clone();
    bad.experiments[0].treatment.system_prompt = "medium";
    const llm = new FakeLLM("reasoner", ["not json at all", JSON.stringify(bad), "```json\n" + JSON.stringify(GOOD_PLAN) + "\n```"]);
    const seen: [number, boolean, string[]][] = [];
    const { attempts } = await draftPlan({ llm, caps: DEFAULT_CAPS, onAttempt: (a, ok, p) => seen.push([a, ok, p]) });
    expect(attempts).toBe(3);
    expect(seen.map(([a, ok]) => [a, ok])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);
    // The second request carries the first reply and why it was rejected.
    const second = llm.calls[1].messages;
    expect(second.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(second[1].content).toBe("not json at all");
    expect(second[2].content).toMatch(/did not contain a JSON object/);
    expect(llm.calls[2].messages.at(-1)!.content).toMatch(/experiments\.0\.treatment\.system_prompt/);
  });

  it("fails clearly after two repairs, without inventing a plan", async () => {
    const llm = new FakeLLM("reasoner", ["{}", "{}", "{}", JSON.stringify(GOOD_PLAN)]);
    const err = await draftPlan({ llm, caps: DEFAULT_CAPS }).catch((e) => e);
    expect(err).toBeInstanceOf(LiveError);
    expect(err.code).toBe("draft-invalid");
    expect(llm.calls).toHaveLength(3); // the fourth (valid) reply is never requested
  });
});
