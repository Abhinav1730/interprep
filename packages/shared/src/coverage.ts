import type { Coverage, Question, Requirement } from "./types.js";

export function coveredRequirementIds(questions: Question[]): Set<string> {
  const covered = new Set<string>();
  for (const q of questions) {
    for (const id of q.requirement_ids) {
      covered.add(id);
    }
  }
  return covered;
}

export function uncoveredRequirementIds(
  requirements: Requirement[],
  questions: Question[],
  options: { mustOnly?: boolean } = {},
): string[] {
  const covered = coveredRequirementIds(questions);
  return requirements
    .filter((r) => (options.mustOnly ? r.priority === "must" : true))
    .filter((r) => !covered.has(r.id))
    .map((r) => r.id);
}

export function computeCoverage(
  requirements: Requirement[],
  questions: Question[],
  passes: number,
  options: { mustOnly?: boolean } = { mustOnly: true },
): Coverage {
  return {
    uncovered_requirement_ids: uncoveredRequirementIds(requirements, questions, options),
    passes,
  };
}

export function mustHaveRequirements(requirements: Requirement[]): Requirement[] {
  return requirements.filter((r) => r.priority === "must");
}

export function coverageSummary(requirements: Requirement[], questions: Question[]) {
  const must = mustHaveRequirements(requirements);
  const uncovered = uncoveredRequirementIds(must, questions);
  return {
    mustTotal: must.length,
    mustCovered: must.length - uncovered.length,
    uncoveredMustIds: uncovered,
    complete: uncovered.length === 0,
  };
}
