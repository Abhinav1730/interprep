import { z } from "zod";
import { generateStructured } from "@interprep/llm";
import { REQUIREMENT_KINDS, REQUIREMENT_PRIORITIES, type QuestionCategory } from "@interprep/shared";
import { COMPANY_SYSTEM, EXTRACTION_SYSTEM, FLASHCARD_SYSTEM, QUESTION_SYSTEM, wrapUntrusted } from "./prompts.js";

const extractedReq = z.object({
  text: z.string().min(1),
  kind: z.enum(REQUIREMENT_KINDS),
  priority: z.enum(REQUIREMENT_PRIORITIES),
});

export const extractionSchema = z.object({
  title: z.string().min(1),
  seniority: z.string().min(1),
  responsibilities: z.array(z.string()),
  requirements: z.array(extractedReq).min(1),
});

export type Extraction = z.infer<typeof extractionSchema>;

export async function extractRole(jd: string): Promise<Extraction> {
  return generateStructured(
    {
      task: "requirementExtraction",
      schemaName: "RoleExtraction",
      temperature: 0.1,
      jsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["title", "seniority", "responsibilities", "requirements"],
        properties: {
          title: { type: "string" },
          seniority: { type: "string" },
          responsibilities: { type: "array", items: { type: "string" } },
          requirements: {
            type: "array",
            items: {
              type: "object",
              required: ["text", "kind", "priority"],
              properties: {
                text: { type: "string" },
                kind: { type: "string" },
                priority: { type: "string" },
              },
            },
          },
        },
      },
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM },
        { role: "user", content: wrapUntrusted("JOB DESCRIPTION", jd.slice(0, 20_000)) },
      ],
    },
    extractionSchema,
  );
}

export const companySchema = z.object({
  name: z.string().min(1),
  summary: z.string().min(1),
  products: z.array(z.string()),
  culture: z.string(),
  engineering: z.string(),
  hiring_process: z.string().min(1),
  hiring_process_found: z.boolean(),
});

export async function extractCompany(args: {
  excerpts: string;
  hiringFound: boolean;
  hiringEvidence: string;
}): Promise<z.infer<typeof companySchema>> {
  return generateStructured(
    {
      task: "companyExtraction",
      schemaName: "CompanyBrief",
      temperature: 0.1,
      jsonSchema: {
        type: "object",
        required: ["name", "summary", "products", "culture", "engineering", "hiring_process", "hiring_process_found"],
        properties: {
          name: { type: "string" },
          summary: { type: "string" },
          products: { type: "array", items: { type: "string" } },
          culture: { type: "string" },
          engineering: { type: "string" },
          hiring_process: { type: "string" },
          hiring_process_found: { type: "boolean" },
        },
      },
      messages: [
        { role: "system", content: COMPANY_SYSTEM },
        {
          role: "user",
          content: wrapUntrusted(
            "COMPANY RESEARCH",
            JSON.stringify({
              hiring_process_found: args.hiringFound,
              hiring_evidence: args.hiringEvidence,
              excerpts: args.excerpts.slice(0, 24_000),
            }),
          ),
        },
      ],
    },
    companySchema,
  );
}

const generatedQuestion = z.object({
  prompt: z.string().min(1),
  answer_outline: z.string().min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  requirement_ids: z.array(z.string()).min(1),
});

export const questionsSchema = z.object({
  questions: z.array(generatedQuestion).min(1),
});

export async function generateQuestionsForCategory(args: {
  category: QuestionCategory;
  requirements: Array<{ id: string; text: string; kind: string; priority: string }>;
  companySummary: string;
  hiringProcess: string;
}): Promise<z.infer<typeof questionsSchema>> {
  const task =
    args.category === "technical"
      ? "technicalQuestions"
      : args.category === "behavioural"
        ? "behaviouralQuestions"
        : args.category === "system-design"
          ? "systemDesignQuestions"
          : "companyFitQuestions";
  const temperature =
    args.category === "technical" || args.category === "system-design" ? 0.4 : 0.6;

  try {
    return await generateStructured(
      {
        task,
        schemaName: `${args.category}Questions`,
        temperature,
        jsonSchema: {
          type: "object",
          required: ["questions"],
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                required: ["prompt", "answer_outline", "difficulty", "requirement_ids"],
                properties: {
                  prompt: { type: "string" },
                  answer_outline: { type: "string" },
                  difficulty: { type: "integer" },
                  requirement_ids: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        messages: [
          { role: "system", content: QUESTION_SYSTEM(args.category) },
          {
            role: "user",
            content: wrapUntrusted(
              "CONTEXT",
              JSON.stringify({
                category: args.category,
                requirements: args.requirements,
                company_summary: args.companySummary,
                hiring_process: args.hiringProcess,
              }),
            ),
          },
        ],
      },
      questionsSchema,
    );
  } catch {
    return { questions: [] };
  }
}

export const flashcardsSchema = z.object({
  flashcards: z.array(
    z.object({
      front: z.string().min(1),
      back: z.string().min(1),
      requirement_ids: z.array(z.string()).min(1),
    }),
  ),
});

export async function generateFlashcards(args: {
  requirements: Array<{ id: string; text: string }>;
  questions: Array<{ prompt: string; answer_outline: string; requirement_ids: string[] }>;
}): Promise<z.infer<typeof flashcardsSchema>> {
  try {
    return await generateStructured(
      {
        task: "flashcards",
        schemaName: "Flashcards",
        temperature: 0.2,
        jsonSchema: {
          type: "object",
          required: ["flashcards"],
          properties: {
            flashcards: {
              type: "array",
              items: {
                type: "object",
                required: ["front", "back", "requirement_ids"],
                properties: {
                  front: { type: "string" },
                  back: { type: "string" },
                  requirement_ids: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        messages: [
          { role: "system", content: FLASHCARD_SYSTEM },
          {
            role: "user",
            content: wrapUntrusted(
              "QUESTIONS AND REQUIREMENTS",
              JSON.stringify({
                requirements: args.requirements,
                questions: args.questions.slice(0, 24),
              }),
            ),
          },
        ],
      },
      flashcardsSchema,
    );
  } catch {
    return { flashcards: [] };
  }
}
