import { describe, expect, it } from "vitest";
import { buildSchedule } from "../src/schedule.js";
import type { Question, Requirement } from "../src/types.js";

const requirements: Requirement[] = [
  { id: "r1", text: "Node.js", kind: "technical", priority: "must" },
  { id: "r2", text: "PostgreSQL", kind: "technical", priority: "must" },
  { id: "r3", text: "Mentoring", kind: "behavioural", priority: "must" },
  { id: "r4", text: "AWS", kind: "technical", priority: "nice" },
];

const questions: Question[] = [
  {
    id: "q1",
    requirement_ids: ["r1"],
    category: "technical",
    prompt: "Event loop",
    answer_outline: "...",
    difficulty: 1,
  },
  {
    id: "q2",
    requirement_ids: ["r2"],
    category: "technical",
    prompt: "Indexing",
    answer_outline: "...",
    difficulty: 2,
  },
  {
    id: "q3",
    requirement_ids: ["r1", "r2"],
    category: "system-design",
    prompt: "Job queue",
    answer_outline: "...",
    difficulty: 3,
  },
  {
    id: "q4",
    requirement_ids: ["r3"],
    category: "behavioural",
    prompt: "Mentoring",
    answer_outline: "...",
    difficulty: 2,
  },
  {
    id: "q5",
    requirement_ids: ["r4"],
    category: "technical",
    prompt: "AWS",
    answer_outline: "...",
    difficulty: 1,
  },
];

function allQuestionIds(days: number) {
  const schedule = buildSchedule({ daysAvailable: days, questions, requirements });
  const ids = new Set(schedule.days.flatMap((d) => d.question_ids));
  return { schedule, ids };
}

describe("schedule allocation", () => {
  it("produces exactly 5 days when days=5", () => {
    const { schedule, ids } = allQuestionIds(5);
    expect(schedule.days_available).toBe(5);
    expect(schedule.days).toHaveLength(5);
    expect(schedule.days.map((d) => d.day)).toEqual([1, 2, 3, 4, 5]);
    for (const q of questions) {
      expect(ids.has(q.id)).toBe(true);
    }
    for (const day of schedule.days) {
      expect(Number.isInteger(day.minutes)).toBe(true);
    }
  });

  it("produces exactly 1 day when days=1 and includes every question", () => {
    const { schedule, ids } = allQuestionIds(1);
    expect(schedule.days_available).toBe(1);
    expect(schedule.days).toHaveLength(1);
    expect(schedule.days[0]?.day).toBe(1);
    for (const q of questions) {
      expect(ids.has(q.id)).toBe(true);
    }
  });

  it("produces exactly 60 days when days=60", () => {
    const { schedule, ids } = allQuestionIds(60);
    expect(schedule.days_available).toBe(60);
    expect(schedule.days).toHaveLength(60);
    expect(schedule.days[0]?.day).toBe(1);
    expect(schedule.days[59]?.day).toBe(60);
    for (const q of questions) {
      expect(ids.has(q.id)).toBe(true);
    }
  });

  it("places harder must-have material on earlier days", () => {
    const schedule = buildSchedule({ daysAvailable: 5, questions, requirements });
    const firstIds = schedule.days[0]?.question_ids ?? [];
    expect(firstIds).toContain("q3");
  });

  it("ensures every must-have with a covering question appears in the schedule", () => {
    const schedule = buildSchedule({ daysAvailable: 5, questions, requirements });
    const scheduled = new Set(schedule.days.flatMap((d) => d.question_ids));
    const scheduledReqs = new Set(
      questions.filter((q) => scheduled.has(q.id)).flatMap((q) => q.requirement_ids),
    );
    expect(scheduledReqs.has("r1")).toBe(true);
    expect(scheduledReqs.has("r2")).toBe(true);
    expect(scheduledReqs.has("r3")).toBe(true);
  });
});
