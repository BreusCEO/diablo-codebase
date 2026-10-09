/** Fixtures shared by the live engine's unit tests (not used by the app). */

export const GOOD_PLAN = {
  hypotheses: [
    { id: "H1", text: "The shortened system prompt lowers accuracy.", prediction: "decrease", competing: false },
    { id: "H2", text: "The higher temperature, not the prompt, lowers accuracy.", prediction: "decrease", competing: true },
  ],
  experiments: [
    {
      hypothesis: "H1",
      title: "Prompt ablation",
      control: { system_prompt: "full", temperature: "0.2" },
      treatment: { system_prompt: "short", temperature: "0.2" },
      items_per_arm: 40,
      rationale: "Isolates the prompt.",
    },
    {
      hypothesis: "H2",
      title: "Temperature ablation",
      control: { system_prompt: "full", temperature: "0.2" },
      treatment: { system_prompt: "full", temperature: "1.0" },
      items_per_arm: 40,
    },
  ],
};
