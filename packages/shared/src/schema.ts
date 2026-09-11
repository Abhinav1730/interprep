import { z } from "zod";
import { QUESTION_CATEGORIES, REQUIREMENT_KINDS, REQUIREMENT_PRIORITIES } from "./types.js";
import type { Kit } from "./types.js";

export const requirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(REQUIREMENT_KINDS),
  priority: z.enum(REQUIREMENT_PRIORITIES),
});

export const questionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string().min(1)).min(1),
  category: z.enum(QUESTION_CATEGORIES),
  prompt: z.string().min(1),
  answer_outline: z.string().min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  pinned: z.boolean().optional(),
  edited_fields: z.array(z.string()).optional(),
  origin: z.enum(["generated", "user"]).optional(),
  generated: z
    .object({
      prompt: z.string(),
      answer_outline: z.string(),
      category: z.enum(QUESTION_CATEGORIES),
    })
    .optional(),
});

export const flashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string().min(1)).min(1),
  pinned: z.boolean().optional(),
  edited_fields: z.array(z.string()).optional(),
  origin: z.enum(["generated", "user"]).optional(),
  generated: z
    .object({
      front: z.string(),
      back: z.string(),
    })
    .optional(),
});

export const scheduleDaySchema = z.object({
  day: z.number().int().positive(),
  focus: z.string().min(1),
  question_ids: z.array(z.string()),
  minutes: z.number().int().nonnegative(),
});

export const scheduleSchema = z.object({
  days_available: z.number().int().positive(),
  days: z.array(scheduleDaySchema).min(1),
});

export const coverageSchema = z.object({
  uncovered_requirement_ids: z.array(z.string()),
  passes: z.number().int().nonnegative(),
});

export const sourceRefSchema = z.object({
  url: z.string().min(1),
  title: z.string().optional(),
});

export const publicDiscussionSchema = z.object({
  url: z.string().min(1),
  title: z.string(),
  content: z.string(),
  type: z.literal("public_discussion"),
});

export const kitSourceSchema = z.object({
  company_url: z.string().min(1),
  pages_used: z.array(z.string()),
  public_discussions: z.array(publicDiscussionSchema),
  retrieved_at: z.string().min(1),
});

export const companyBriefSchema = z.object({
  name: z.string().min(1),
  summary: z.string().min(1),
  products: z.array(z.string()),
  culture: z.string(),
  engineering: z.string(),
  hiring_process: z.string().min(1),
  hiring_process_found: z.boolean(),
  sources: z.array(sourceRefSchema),
});

export const roleSchema = z.object({
  title: z.string().min(1),
  seniority: z.string().min(1),
  responsibilities: z.array(z.string()),
  requirements: z.array(requirementSchema),
});

export const kitSchema = z.object({
  source: kitSourceSchema,
  company_brief: companyBriefSchema,
  role: roleSchema,
  questions: z.array(questionSchema),
  flashcards: z.array(flashcardSchema),
  schedule: scheduleSchema,
  coverage: coverageSchema,
});

export const kitInputSchema = z.object({
  jd: z.string().min(1, "Job description is required"),
  company_url: z.string().min(1, "Company URL is required"),
  days: z.number().int().positive("Days until interview must be a positive integer"),
});

export const evaluateCaseSchema = kitInputSchema.extend({
  id: z.string().min(1),
});

export type SemanticIssue = {
  path: string;
  message: string;
};

export function collectSemanticIssues(kit: Kit): SemanticIssue[] {
  const issues: SemanticIssue[] = [];
  const requirementIds = new Set<string>();

  for (const [i, req] of kit.role.requirements.entries()) {
    if (requirementIds.has(req.id)) {
      issues.push({ path: `role.requirements[${i}].id`, message: `Duplicate requirement id ${req.id}` });
    }
    requirementIds.add(req.id);
  }

  const questionIds = new Set<string>();
  for (const [i, q] of kit.questions.entries()) {
    if (questionIds.has(q.id)) {
      issues.push({ path: `questions[${i}].id`, message: `Duplicate question id ${q.id}` });
    }
    questionIds.add(q.id);
    for (const rid of q.requirement_ids) {
      if (!requirementIds.has(rid)) {
        issues.push({
          path: `questions[${i}].requirement_ids`,
          message: `Unknown requirement id ${rid}`,
        });
      }
    }
    if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 3) {
      issues.push({ path: `questions[${i}].difficulty`, message: "difficulty must be 1, 2, or 3" });
    }
  }

  const flashcardIds = new Set<string>();
  for (const [i, f] of kit.flashcards.entries()) {
    if (flashcardIds.has(f.id)) {
      issues.push({ path: `flashcards[${i}].id`, message: `Duplicate flashcard id ${f.id}` });
    }
    flashcardIds.add(f.id);
    for (const rid of f.requirement_ids) {
      if (!requirementIds.has(rid)) {
        issues.push({
          path: `flashcards[${i}].requirement_ids`,
          message: `Unknown requirement id ${rid}`,
        });
      }
    }
  }

  if (kit.schedule.days_available !== kit.schedule.days.length) {
    issues.push({
      path: "schedule.days_available",
      message: `days_available (${kit.schedule.days_available}) must equal days.length (${kit.schedule.days.length})`,
    });
  }

  for (const [i, day] of kit.schedule.days.entries()) {
    if (day.day !== i + 1) {
      issues.push({ path: `schedule.days[${i}].day`, message: `Expected day ${i + 1}` });
    }
    if (!Number.isInteger(day.minutes)) {
      issues.push({ path: `schedule.days[${i}].minutes`, message: "minutes must be an integer" });
    }
    for (const qid of day.question_ids) {
      if (!questionIds.has(qid)) {
        issues.push({
          path: `schedule.days[${i}].question_ids`,
          message: `Unknown question id ${qid}`,
        });
      }
    }
  }

  return issues;
}

export function parseKit(data: unknown): Kit {
  const parsed = kitSchema.parse(data);
  const issues = collectSemanticIssues(parsed);
  if (issues.length > 0) {
    const err = new Error(issues.map((i) => `${i.path}: ${i.message}`).join("; "));
    err.name = "KitSemanticError";
    throw err;
  }
  return parsed;
}

export function safeParseKit(data: unknown): {
  success: boolean;
  data?: Kit;
  error?: { issues: Array<{ path: string; message: string }> };
} {
  const parsed = kitSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
    };
  }
  const issues = collectSemanticIssues(parsed.data);
  if (issues.length > 0) {
    return { success: false, error: { issues } };
  }
  return { success: true, data: parsed.data };
}
