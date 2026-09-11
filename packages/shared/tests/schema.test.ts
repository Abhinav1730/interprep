import { describe, expect, it } from "vitest";
import { kitSchema, safeParseKit, collectSemanticIssues } from "../src/schema.js";
import type { Kit } from "../src/types.js";

function validKit(): Kit {
  return {
    source: {
      company_url: "https://acme.test",
      pages_used: ["https://acme.test/about"],
      public_discussions: [],
      retrieved_at: "2026-09-10T00:00:00.000Z",
    },
    company_brief: {
      name: "Acme",
      summary: "Acme builds widgets.",
      products: ["Widgets"],
      culture: "Collaborative",
      engineering: "Node and Postgres",
      hiring_process:
        "Hiring process information was not found on the company's public website.",
      hiring_process_found: false,
      sources: [{ url: "https://acme.test/about", title: "About" }],
    },
    role: {
      title: "Backend Engineer",
      seniority: "Senior",
      responsibilities: ["Build APIs"],
      requirements: [
        { id: "r1", text: "Node.js", kind: "technical", priority: "must" },
        { id: "r2", text: "Mentoring", kind: "behavioural", priority: "must" },
      ],
    },
    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Explain the Node.js event loop.",
        answer_outline: "Phases, libuv, when CPU work blocks.",
        difficulty: 2,
      },
      {
        id: "q2",
        requirement_ids: ["r2"],
        category: "behavioural",
        prompt: "Tell me about mentoring a junior engineer.",
        answer_outline: "STAR: context, coaching, outcome.",
        difficulty: 2,
      },
    ],
    flashcards: [
      {
        id: "f1",
        front: "What is the Node.js event loop?",
        back: "The loop that schedules I/O callbacks.",
        requirement_ids: ["r1"],
      },
    ],
    schedule: {
      days_available: 2,
      days: [
        { day: 1, focus: "Core technical", question_ids: ["q1"], minutes: 45 },
        { day: 2, focus: "Behavioural", question_ids: ["q2"], minutes: 30 },
      ],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 1,
    },
  };
}

describe("kit structure validation", () => {
  it("accepts a well-formed kit", () => {
    const result = safeParseKit(validKit());
    expect(result.success).toBe(true);
  });

  it("rejects a missing source", () => {
    const kit = validKit() as unknown as Record<string, unknown>;
    delete kit.source;
    const parsed = kitSchema.safeParse(kit);
    expect(parsed.success).toBe(false);
  });

  it("rejects missing questions", () => {
    const kit = validKit() as unknown as Record<string, unknown>;
    delete kit.questions;
    const parsed = kitSchema.safeParse(kit);
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid difficulty", () => {
    const kit = validKit();
    (kit.questions[0] as { difficulty: number }).difficulty = 9;
    const parsed = kitSchema.safeParse(kit);
    expect(parsed.success).toBe(false);
  });

  it("rejects non-integer minutes", () => {
    const kit = validKit();
    kit.schedule.days[0]!.minutes = 30.5;
    const parsed = kitSchema.safeParse(kit);
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown requirement ids on questions", () => {
    const kit = validKit();
    kit.questions[0]!.requirement_ids = ["r99"];
    const issues = collectSemanticIssues(kit);
    expect(issues.some((i) => i.message.includes("Unknown requirement id r99"))).toBe(true);
    expect(safeParseKit(kit).success).toBe(false);
  });

  it("rejects unknown question ids in the schedule", () => {
    const kit = validKit();
    kit.schedule.days[0]!.question_ids = ["q99"];
    const issues = collectSemanticIssues(kit);
    expect(issues.some((i) => i.message.includes("Unknown question id q99"))).toBe(true);
    expect(safeParseKit(kit).success).toBe(false);
  });
});
