export const QUESTION_CATEGORIES = [
  "technical",
  "behavioural",
  "system-design",
  "company-fit",
] as const;

export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export const REQUIREMENT_KINDS = [
  "technical",
  "behavioural",
  "system-design",
  "company-fit",
  "other",
] as const;

export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

export const REQUIREMENT_PRIORITIES = ["must", "nice"] as const;
export type RequirementPriority = (typeof REQUIREMENT_PRIORITIES)[number];

export type PublicDiscussion = {
  url: string;
  title: string;
  content: string;
  type: "public_discussion";
};

export type SourceRef = {
  url: string;
  title?: string;
};

export type Requirement = {
  id: string;
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
};

export type Question = {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  pinned?: boolean;
  edited_fields?: string[];
  origin?: "generated" | "user";
  generated?: {
    prompt: string;
    answer_outline: string;
    category: QuestionCategory;
  };
};

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  pinned?: boolean;
  edited_fields?: string[];
  origin?: "generated" | "user";
  generated?: {
    front: string;
    back: string;
  };
};

export type ScheduleDay = {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
};

export type Schedule = {
  days_available: number;
  days: ScheduleDay[];
};

export type Coverage = {
  uncovered_requirement_ids: string[];
  passes: number;
};

export type CompanyBrief = {
  name: string;
  summary: string;
  products: string[];
  culture: string;
  engineering: string;
  hiring_process: string;
  hiring_process_found: boolean;
  sources: SourceRef[];
};

export type Role = {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
};

export type KitSource = {
  company_url: string;
  pages_used: string[];
  public_discussions: PublicDiscussion[];
  retrieved_at: string;
};

export type Kit = {
  source: KitSource;
  company_brief: CompanyBrief;
  role: Role;
  questions: Question[];
  flashcards: Flashcard[];
  schedule: Schedule;
  coverage: Coverage;
};

export type KitInput = {
  jd: string;
  company_url: string;
  days: number;
};

export type EvaluateCase = KitInput & {
  id: string;
};

export type KitError = {
  code: string;
  message: string;
};

export type EvaluateResult = {
  id: string;
  status: "ok" | "failed";
  kit: Kit | null;
  error?: KitError;
};

export const GENERATION_STEPS = [
  { id: "read_jd", label: "Reading job description" },
  { id: "extract_requirements", label: "Extracting requirements" },
  { id: "crawl", label: "Crawling company website" },
  { id: "company_info", label: "Finding company information" },
  { id: "hiring", label: "Looking for hiring process" },
  { id: "public_research", label: "Researching interview discussions" },
  { id: "technical", label: "Generating technical questions" },
  { id: "behavioural", label: "Generating behavioural questions" },
  { id: "system_design", label: "Generating system-design questions" },
  { id: "company_fit", label: "Generating company-fit questions" },
  { id: "coverage", label: "Checking question coverage" },
  { id: "flashcards", label: "Creating flashcards" },
  { id: "schedule", label: "Creating study schedule" },
  { id: "validate", label: "Validating kit" },
] as const;

export type GenerationStepId = (typeof GENERATION_STEPS)[number]["id"];

export type StepState = "pending" | "active" | "done" | "error" | "skipped";

export type GenerationProgress = {
  status: "queued" | "generating" | "completed" | "failed";
  currentStep: GenerationStepId | null;
  steps: Array<{
    id: GenerationStepId;
    label: string;
    state: StepState;
  }>;
  message?: string;
  error?: KitError;
  startedAt?: string;
  completedAt?: string;
};
