import type { Question, QuestionCategory, Requirement } from "./types.js";

export function fallbackQuestionForRequirement(
  req: Requirement,
  id: string,
): Question {
  const category: QuestionCategory =
    req.kind === "behavioural"
      ? "behavioural"
      : req.kind === "system-design"
        ? "system-design"
        : req.kind === "company-fit"
          ? "company-fit"
          : "technical";

  const prompts: Record<QuestionCategory, { prompt: string; outline: string }> = {
    technical: {
      prompt: `Walk through how you have applied “${req.text}” in a real system. What trade-offs did you make?`,
      outline:
        "State the context, the constraint, the approach, the trade-off, and how you validated the result. Stay specific to the stated requirement; do not invent extra stack.",
    },
    behavioural: {
      prompt: `Tell me about a time that demonstrates “${req.text}”. What did you do, and what changed?`,
      outline: "Use a STAR structure. Keep the story tied to the requirement. Include the outcome and what you would repeat.",
    },
    "system-design": {
      prompt: `Design a system where “${req.text}” is a first-class constraint. How would you decompose it?`,
      outline: "Clarify requirements, sketch components, call out bottlenecks, failure modes, and how you would evolve the design.",
    },
    "company-fit": {
      prompt: `How would “${req.text}” show up in your first 90 days in this role?`,
      outline: "Connect the requirement to the company’s stated work. If company evidence is thin, say so and stay with the JD.",
    },
  };

  const body = prompts[category];
  return {
    id,
    requirement_ids: [req.id],
    category,
    prompt: body.prompt,
    answer_outline: body.outline,
    difficulty: req.priority === "must" ? 2 : 1,
    origin: "generated",
    generated: {
      prompt: body.prompt,
      answer_outline: body.outline,
      category,
    },
  };
}
