import type { Question, QuestionCategory, Requirement, Schedule, ScheduleDay } from "./types.js";
import { coveredRequirementIds } from "./coverage.js";

const CATEGORY_WEIGHT: Record<QuestionCategory, number> = {
  "system-design": 8,
  technical: 6,
  behavioural: 4,
  "company-fit": 3,
};

export function questionScore(question: Question, requirements: Requirement[]): number {
  const reqById = new Map(requirements.map((r) => [r.id, r]));
  const coversMust = question.requirement_ids.some((id) => reqById.get(id)?.priority === "must");
  return question.difficulty * 10 + (coversMust ? 20 : 0) + (CATEGORY_WEIGHT[question.category] ?? 0);
}

function uniqueQuestionIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function focusForQuestions(questions: Question[]): string {
  if (questions.length === 0) return "Review and light recap";
  const counts = new Map<QuestionCategory, number>();
  for (const q of questions) {
    counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const labels: Record<QuestionCategory, string> = {
    technical: "Core technical",
    behavioural: "Behavioural",
    "system-design": "System design",
    "company-fit": "Company fit",
  };
  return ranked
    .slice(0, 2)
    .map(([cat]) => labels[cat])
    .join(" + ");
}

function minutesFor(questionCount: number, isReview: boolean): number {
  if (questionCount === 0) return 20;
  const per = isReview ? 15 : 25;
  return Math.min(180, Math.max(20, questionCount * per));
}

/**
 * Deterministic schedule: exactly `daysAvailable` days, harder / must-have
 * material earlier, every question appears at least once, every must-have
 * requirement that has a covering question appears on some day.
 */
export function buildSchedule(args: {
  daysAvailable: number;
  questions: Question[];
  requirements: Requirement[];
}): Schedule {
  const daysAvailable = Math.max(1, Math.floor(args.daysAvailable));
  const scored = [...args.questions].sort((a, b) => {
    const diff = questionScore(b, args.requirements) - questionScore(a, args.requirements);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  const buckets: Question[][] = Array.from({ length: daysAvailable }, () => []);

  if (scored.length === 0) {
    const days: ScheduleDay[] = Array.from({ length: daysAvailable }, (_, i) => ({
      day: i + 1,
      focus: i === 0 ? "Role and company review" : "Light recap",
      question_ids: [],
      minutes: 20,
    }));
    return { days_available: daysAvailable, days };
  }

  if (daysAvailable === 1) {
    buckets[0] = scored;
  } else if (scored.length >= daysAvailable) {
    const perDay = Math.ceil(scored.length / daysAvailable);
    let index = 0;
    for (let d = 0; d < daysAvailable; d++) {
      buckets[d] = scored.slice(index, index + perDay);
      index += perDay;
    }
  } else {
    for (let i = 0; i < scored.length; i++) {
      buckets[i]!.push(scored[i]!);
    }
    for (let d = scored.length; d < daysAvailable; d++) {
      const q = scored[d % scored.length]!;
      buckets[d]!.push(q);
    }
  }

  const assignedMust = coveredRequirementIds(buckets.flat());
  const mustIds = args.requirements.filter((r) => r.priority === "must").map((r) => r.id);
  const missingMust = mustIds.filter((id) => !assignedMust.has(id));
  if (missingMust.length > 0) {
    for (const id of missingMust) {
      const covering = scored.find((q) => q.requirement_ids.includes(id));
      if (covering && buckets[0] && !buckets[0].some((q) => q.id === covering.id)) {
        buckets[0].unshift(covering);
      }
    }
  }

  const days: ScheduleDay[] = buckets.map((qs, i) => {
    const isReview = scored.length < daysAvailable && i >= scored.length;
    return {
      day: i + 1,
      focus: isReview ? `Review: ${focusForQuestions(qs)}` : focusForQuestions(qs),
      question_ids: uniqueQuestionIds(qs.map((q) => q.id)),
      minutes: minutesFor(qs.length, isReview),
    };
  });

  return { days_available: daysAvailable, days };
}
