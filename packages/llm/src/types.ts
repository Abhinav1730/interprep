export type LlmTask =
  | "requirementExtraction"
  | "companyExtraction"
  | "technicalQuestions"
  | "behaviouralQuestions"
  | "systemDesignQuestions"
  | "companyFitQuestions"
  | "gapQuestions"
  | "flashcards"
  | "jsonRepair";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StructuredRequest = {
  task: LlmTask;
  messages: LlmMessage[];
  temperature?: number;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
};

export type LlmProviderName = "nvidia" | "openrouter";

export interface LlmProvider {
  name: LlmProviderName;
  generateJson(request: StructuredRequest): Promise<unknown>;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function backoffMs(attempt: number): number {
  const base = 1000 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(12_000, base + jitter);
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

export function extractJson(text: string): unknown {
  const stripped = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json\s*/gi, "```")
    .trim();
  const fenced = stripped.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? stripped).trim();
  const start = candidate.search(/[\{\[]/);
  if (start < 0) {
    throw new Error("No JSON object found in model output");
  }
  let depth = 0;
  let end = -1;
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === open) depth += 1;
    if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const slice = end >= 0 ? candidate.slice(start, end + 1) : candidate.slice(start);
  return JSON.parse(slice);
}
