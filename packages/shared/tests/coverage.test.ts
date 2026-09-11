import { describe, expect, it } from "vitest";
import { uncoveredRequirementIds, computeCoverage } from "../src/coverage.js";
import type { Question, Requirement } from "../src/types.js";

const requirements: Requirement[] = [
  { id: "r1", text: "React", kind: "technical", priority: "must" },
  { id: "r2", text: "PostgreSQL", kind: "technical", priority: "must" },
  { id: "r3", text: "Mentoring", kind: "behavioural", priority: "must" },
  { id: "r4", text: "AWS", kind: "technical", priority: "nice" },
];

const questions: Question[] = [
  {
    id: "q1",
    requirement_ids: ["r1"],
    category: "technical",
    prompt: "React?",
    answer_outline: "...",
    difficulty: 2,
  },
  {
    id: "q2",
    requirement_ids: ["r3"],
    category: "behavioural",
    prompt: "Mentoring?",
    answer_outline: "...",
    difficulty: 2,
  },
];

describe("coverage checker", () => {
  it("reports uncovered requirement ids from the question graph", () => {
    expect(uncoveredRequirementIds(requirements, questions)).toEqual(["r2", "r4"]);
  });

  it("can restrict uncovered ids to must-have requirements", () => {
    expect(uncoveredRequirementIds(requirements, questions, { mustOnly: true })).toEqual(["r2"]);
  });

  it("treats a question that maps multiple requirements as covering all of them", () => {
    const extra: Question[] = [
      ...questions,
      {
        id: "q3",
        requirement_ids: ["r2", "r4"],
        category: "technical",
        prompt: "Postgres on AWS",
        answer_outline: "...",
        difficulty: 3,
      },
    ];
    const coverage = computeCoverage(requirements, extra, 1, { mustOnly: true });
    expect(coverage.uncovered_requirement_ids).toEqual([]);
    expect(coverage.passes).toBe(1);
  });
});
