import { describe, expect, it } from "vitest";
import { mergeRegeneratedQuestions } from "@interprep/shared";
import type { Question } from "@interprep/shared";

describe("regeneration merge", () => {
  const existing: Question[] = [
    {
      id: "q1",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Old 1",
      answer_outline: "A",
      difficulty: 1,
      origin: "generated",
    },
    {
      id: "q2",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Edited prompt",
      answer_outline: "A",
      difficulty: 2,
      edited_fields: ["prompt"],
      origin: "generated",
    },
  ];

  it("keeps edited questions when regenerating a category", () => {
    const regenerated: Question[] = [
      {
        id: "q9",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Brand new",
        answer_outline: "B",
        difficulty: 2,
      },
    ];
    const merged = mergeRegeneratedQuestions(existing, regenerated, "technical");
    expect(merged.some((q) => q.id === "q2" && q.prompt === "Edited prompt")).toBe(true);
    expect(merged.some((q) => q.prompt === "Brand new")).toBe(true);
    expect(merged.some((q) => q.id === "q1")).toBe(false);
  });
});
