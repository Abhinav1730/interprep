export { QUESTION_CATEGORIES, REQUIREMENT_KINDS, REQUIREMENT_PRIORITIES, GENERATION_STEPS } from "./types.js";
export type {
  QuestionCategory,
  RequirementKind,
  RequirementPriority,
  PublicDiscussion,
  SourceRef,
  Requirement,
  Question,
  Flashcard,
  ScheduleDay,
  Schedule,
  Coverage,
  CompanyBrief,
  Role,
  KitSource,
  Kit,
  KitInput,
  EvaluateCase,
  KitError,
  EvaluateResult,
  GenerationStepId,
  StepState,
  GenerationProgress,
} from "./types.js";

export {
  kitSchema,
  kitInputSchema,
  evaluateCaseSchema,
  questionSchema,
  flashcardSchema,
  requirementSchema,
  scheduleSchema,
  coverageSchema,
  parseKit,
  safeParseKit,
  collectSemanticIssues,
} from "./schema.js";

export {
  coveredRequirementIds,
  uncoveredRequirementIds,
  computeCoverage,
  mustHaveRequirements,
  coverageSummary,
} from "./coverage.js";

export { buildSchedule, questionScore } from "./schedule.js";
export { normalizeJd, canonicalizeCompanyUrl, inputHash } from "./hash.js";
export { sequentialIds, nextId, assignRequirementIds } from "./ids.js";
export { initialProgress, markStep, completeProgress, failProgress } from "./progress.js";
export {
  isProtectedQuestion,
  isProtectedFlashcard,
  mergeRegeneratedQuestions,
  mergeRegeneratedFlashcards,
  applyQuestionEdit,
  applyFlashcardEdit,
} from "./merge.js";
export { orderFlashcardsForPractice, buildWeakSpots } from "./weakSpots.js";
export type { PracticeRecord, WeakSpot } from "./weakSpots.js";
export { fallbackQuestionForRequirement } from "./fallback.js";
