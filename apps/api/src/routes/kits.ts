import { Router, type Request, type Response } from "express";
import {
  applyFlashcardEdit,
  applyQuestionEdit,
  buildSchedule,
  buildWeakSpots,
  computeCoverage,
  kitInputSchema,
  mergeRegeneratedFlashcards,
  mergeRegeneratedQuestions,
  nextId,
  orderFlashcardsForPractice,
  parseKit,
  QUESTION_CATEGORIES,
  type Flashcard,
  type Kit,
  type Question,
  type QuestionCategory,
} from "@interprep/shared";
import { generateKit } from "@interprep/pipeline";
import { generateFlashcards, generateQuestionsForCategory, extractCompany } from "@interprep/pipeline";
import { KitModel } from "../models/Kit.js";
import { PracticeRecord } from "../models/Practice.js";
import { inputHash } from "@interprep/shared";
import { initialProgress } from "@interprep/shared";
import type { AuthedRequest } from "../middleware/auth.js";
import { cardMetaForUser, listKitsForUser } from "../services/kitsList.js";

export const kitsRouter = Router();

function serialize(doc: { toObject: () => Record<string, unknown> } | Record<string, unknown>) {
  const raw = typeof (doc as { toObject?: () => Record<string, unknown> }).toObject === "function"
    ? (doc as { toObject: () => Record<string, unknown> }).toObject()
    : (doc as Record<string, unknown>);
  return {
    id: String(raw._id),
    status: raw.status,
    input: raw.input,
    kit: raw.kit,
    generation: raw.generation,
    error: raw.error,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function asAuth(req: Request): AuthedRequest {
  return req as unknown as AuthedRequest;
}

async function ownedKit(req: Request, res: Response, id: string) {
  const kit = await KitModel.findOne({ _id: id, userId: asAuth(req).userId });
  if (!kit) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found" } });
    return null;
  }
  return kit;
}

const running = new Set<string>();

function rebuildSchedule(kit: Kit, days: number) {
  kit.schedule = buildSchedule({
    daysAvailable: days,
    questions: kit.questions,
    requirements: kit.role.requirements,
  });
}

async function runGeneration(kitId: string, input: { jd: string; company_url: string; days: number }) {
  if (running.has(kitId)) return;
  running.add(kitId);
  try {
    const result = await generateKit(input, {
      onProgress: async (generation) => {
        await KitModel.findByIdAndUpdate(kitId, {
          status: generation.status,
          generation,
          error: generation.error ?? null,
        });
      },
    });
    await KitModel.findByIdAndUpdate(kitId, {
      status: result.status === "ok" ? "completed" : "failed",
      kit: result.kit,
      error: result.error ?? null,
    });
  } catch (err) {
    await KitModel.findByIdAndUpdate(kitId, {
      status: "failed",
      error: {
        code: "PIPELINE_FAILED",
        message: err instanceof Error ? err.message : "Generation failed",
      },
    });
  } finally {
    running.delete(kitId);
  }
}

kitsRouter.get("/", async (req, res) => {
  const { userId } = asAuth(req);
  const kits = await listKitsForUser(userId);
  res.json({ kits });
});

kitsRouter.get("/card-meta", async (req, res) => {
  const { userId } = asAuth(req);
  const meta = await cardMetaForUser(userId);
  res.json({ meta });
});

kitsRouter.post("/", async (req, res) => {
  const { userId } = asAuth(req);
  const parsed = kitInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message } });
    return;
  }
  const hash = inputHash(parsed.data.jd, parsed.data.company_url);
  const existing = await KitModel.findOne({
    userId,
    inputHash: hash,
    status: "completed",
    kit: { $ne: null },
  });
  if (existing && req.body.force !== true) {
    res.status(200).json({ kit: serialize(existing), reused: true });
    return;
  }

  const progress = { ...initialProgress(), status: "generating", startedAt: new Date().toISOString() };
  const created = await KitModel.create({
    userId,
    status: "generating",
    input: {
      jd: parsed.data.jd,
      companyUrl: parsed.data.company_url,
      days: parsed.data.days,
    },
    inputHash: hash,
    generation: progress,
  });
  void runGeneration(String(created._id), parsed.data);
  res.status(202).json({ kit: serialize(created), reused: false });
});

kitsRouter.get("/:id", async (req, res) => {
  const kit = await ownedKit(req, res, req.params.id);
  if (!kit) return;
  res.json({ kit: serialize(kit) });
});

kitsRouter.get("/:id/progress", async (req, res) => {
  const kit = await ownedKit(req, res, req.params.id);
  if (!kit) return;
  res.json({
    status: kit.status,
    generation: kit.generation,
    error: kit.error,
  });
});

kitsRouter.delete("/:id", async (req, res) => {
  const kit = await ownedKit(req, res, req.params.id);
  if (!kit) return;
  await KitModel.deleteOne({ _id: kit._id });
  await PracticeRecord.deleteMany({ kitId: kit._id });
  res.json({ ok: true });
});

kitsRouter.patch("/:id", async (req, res) => {
  const doc = await ownedKit(req, res, req.params.id);
  if (!doc) return;
  if (!doc.kit) {
    res.status(409).json({ error: { code: "NOT_READY", message: "Kit is still generating" } });
    return;
  }
  const kit = doc.kit as Kit;
  if (req.body.company_brief) {
    kit.company_brief = { ...kit.company_brief, ...req.body.company_brief };
  }
  if (req.body.role) {
    kit.role = { ...kit.role, ...req.body.role };
  }
  doc.kit = kit;
  doc.markModified("kit");
  await doc.save();
  res.json({ kit: serialize(doc) });
});

kitsRouter.post("/:id/questions", async (req, res) => {
  const doc = await ownedKit(req, res, req.params.id);
  if (!doc?.kit) {
    if (!res.headersSent) res.status(409).json({ error: { code: "NOT_READY", message: "Kit is still generating" } });
    return;
  }
  const kit = doc.kit as Kit;
  const id = nextId("q", kit.questions.map((q) => q.id));
  const question: Question = {
    id,
    requirement_ids: req.body.requirement_ids?.length ? req.body.requirement_ids : [kit.role.requirements[0]?.id].filter(Boolean),
    category: req.body.category ?? "technical",
    prompt: req.body.prompt || "New question",
    answer_outline: req.body.answer_outline || "Add an answer outline.",
    difficulty: req.body.difficulty ?? 2,
    origin: "user",
    pinned: true,
  };
  kit.questions.push(question);
  kit.coverage = computeCoverage(kit.role.requirements, kit.questions, kit.coverage.passes, { mustOnly: true });
  rebuildSchedule(kit, (doc.input as { days: number }).days);
  doc.kit = kit;
  doc.markModified("kit");
  await doc.save();
  res.status(201).json({ kit: serialize(doc) });
});

kitsRouter.patch("/:id/questions/reorder", async (req, res) => {
  const doc = await ownedKit(req, res, req.params.id);
  if (!doc?.kit) {
    if (!res.headersSent) {
      res.status(409).json({ error: { code: "NOT_READY", message: "Kit is still generating" } });
    }
    return;
  }
  const order = req.body.ids as string[] | undefined;
  if (!Array.isArray(order)) {
    res.status(400).json({ error: { code: "INVALID_INPUT", message: "ids array required" } });
    return;
  }
  const kit = doc.kit as Kit;
  const map = new Map(kit.questions.map((q) => [q.id, q]));
  const next: Question[] = [];
  for (const id of order) {
    const q = map.get(id);
    if (q) {
      next.push(q);
      map.delete(id);
    }
  }
  next.push(...map.values());
  kit.questions = next;
  doc.kit = kit;
  doc.markModified("kit");
  await doc.save();
  res.json({ kit: serialize(doc) });
});

kitsRouter.patch("/:id/questions/:qid", async (req, res) => {
  const doc = await ownedKit(req, res, req.params.id);
  if (!doc?.kit) {
    if (!res.headersSent) {
      res.status(409).json({ error: { code: "NOT_READY", message: "Kit is still generating" } });
    }
    return;
  }
  const kit = doc.kit as Kit;
  const idx = kit.questions.findIndex((q) => q.id === req.params.qid);
  if (idx < 0) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Question not found" } });
    return;
  }
  kit.questions[idx] = applyQuestionEdit(kit.questions[idx]!, req.body);
  doc.kit = kit;
  doc.markModified("kit");
  await doc.save();
  res.json({ kit: serialize(doc) });
});

kitsRouter.delete("/:id/questions/:qid", async (req, res) => {
  const doc = await ownedKit(req, res, req.params.id);
  if (!doc?.kit) {
    if (!res.headersSent) {
      res.status(409).json({ error: { code: "NOT_READY", message: "Kit is still generating" } });
    }
    return;
  }
  const kit = doc.kit as Kit;
  kit.questions = kit.questions.filter((q) => q.id !== req.params.qid);
  kit.coverage = computeCoverage(kit.role.requirements, kit.questions, kit.coverage.passes, { mustOnly: true });
  rebuildSchedule(kit, (doc.input as { days: number }).days);
  doc.kit = kit;
  doc.markModified("kit");
  await doc.save();
  res.json({ kit: serialize(doc) });
});

kitsRouter.post("/:id/flashcards", async (req, res) => {
  const doc = await ownedKit(req, res, req.params.id);
  if (!doc?.kit) {
    if (!res.headersSent) res.status(409).json({ error: { code: "NOT_READY", message: "Kit is still generating" } });
    return;
  }
  const kit = doc.kit as Kit;
  const id = nextId("f", kit.flashcards.map((f) => f.id));
  const flashcard: Flashcard = {
    id,
    front: req.body.front || "New flashcard",
    back: req.body.back || "Add an answer.",
    requirement_ids: req.body.requirement_ids?.length
      ? req.body.requirement_ids
      : [kit.role.requirements[0]?.id].filter(Boolean),
    origin: "user",
    pinned: true,
  };
  kit.flashcards.push(flashcard);
  doc.kit = kit;
  doc.markModified("kit");
  await doc.save();
  res.status(201).json({ kit: serialize(doc) });
});

kitsRouter.patch("/:id/flashcards/:fid", async (req, res) => {
  const doc = await ownedKit(req, res, req.params.id);
  if (!doc?.kit) {
    if (!res.headersSent) {
      res.status(409).json({ error: { code: "NOT_READY", message: "Kit is still generating" } });
    }
    return;
  }
  const kit = doc.kit as Kit;
  const idx = kit.flashcards.findIndex((f) => f.id === req.params.fid);
  if (idx < 0) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Flashcard not found" } });
    return;
  }
  kit.flashcards[idx] = applyFlashcardEdit(kit.flashcards[idx]!, req.body);
  doc.kit = kit;
  doc.markModified("kit");
  await doc.save();
  res.json({ kit: serialize(doc) });
});

kitsRouter.delete("/:id/flashcards/:fid", async (req, res) => {
  const doc = await ownedKit(req, res, req.params.id);
  if (!doc?.kit) {
    if (!res.headersSent) {
      res.status(409).json({ error: { code: "NOT_READY", message: "Kit is still generating" } });
    }
    return;
  }
  const kit = doc.kit as Kit;
  kit.flashcards = kit.flashcards.filter((f) => f.id !== req.params.fid);
  await PracticeRecord.deleteMany({
    kitId: doc._id,
    userId: (asAuth(req)).userId,
    flashcardId: req.params.fid,
  });
  doc.kit = kit;
  doc.markModified("kit");
  await doc.save();
  res.json({ kit: serialize(doc) });
});

kitsRouter.patch("/:id/questions/:qid/move", async (req, res) => {
  const doc = await ownedKit(req, res, req.params.id);
  if (!doc?.kit) {
    if (!res.headersSent) {
      res.status(409).json({ error: { code: "NOT_READY", message: "Kit is still generating" } });
    }
    return;
  }
  const category = req.body.category as QuestionCategory;
  if (!QUESTION_CATEGORIES.includes(category)) {
    res.status(400).json({ error: { code: "INVALID_INPUT", message: "Invalid category" } });
    return;
  }
  const kit = doc.kit as Kit;
  const q = kit.questions.find((item) => item.id === req.params.qid);
  if (!q) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Question not found" } });
    return;
  }
  q.category = category;
  q.edited_fields = [...new Set([...(q.edited_fields ?? []), "category"])];
  q.pinned = true;
  doc.kit = kit;
  doc.markModified("kit");
  await doc.save();
  res.json({ kit: serialize(doc) });
});

async function regenerateSection(doc: InstanceType<typeof KitModel>, section: string) {
  const kit = doc.kit as Kit;
  const requirements = kit.role.requirements;
  const companySummary = `${kit.company_brief.name}: ${kit.company_brief.summary}`;

  if (section === "company") {
    const excerpts = kit.source.pages_used.join("\n");
    try {
      const company = await extractCompany({
        excerpts: `${excerpts}\n${kit.company_brief.summary}`,
        hiringFound: kit.company_brief.hiring_process_found,
        hiringEvidence: kit.company_brief.hiring_process,
      });
      kit.company_brief = {
        ...kit.company_brief,
        ...company,
        sources: kit.company_brief.sources,
        hiring_process: kit.company_brief.hiring_process_found
          ? company.hiring_process
          : kit.company_brief.hiring_process,
      };
    } catch {
      // keep existing brief
    }
  } else if (QUESTION_CATEGORIES.includes(section as QuestionCategory)) {
    const category = section as QuestionCategory;
    const generated = await generateQuestionsForCategory({
      category,
      requirements,
      companySummary,
      hiringProcess: kit.company_brief.hiring_process,
    });
    const stamped: Question[] = generated.questions.map((item, i) => ({
      id: `qtmp${Date.now()}${i}`,
      requirement_ids: item.requirement_ids.filter((id) => requirements.some((r) => r.id === id)),
      category,
      prompt: item.prompt,
      answer_outline: item.answer_outline,
      difficulty: item.difficulty,
      origin: "generated" as const,
      generated: { prompt: item.prompt, answer_outline: item.answer_outline, category },
    })).filter((q) => q.requirement_ids.length);
    kit.questions = mergeRegeneratedQuestions(kit.questions, stamped, category);
  } else if (section === "flashcards") {
    const generated = await generateFlashcards({
      requirements: requirements.map((r) => ({ id: r.id, text: r.text })),
      questions: kit.questions.map((q) => ({
        prompt: q.prompt,
        answer_outline: q.answer_outline,
        requirement_ids: q.requirement_ids,
      })),
    });
    const stamped: Flashcard[] = generated.flashcards.map((c, i) => ({
      id: `ftmp${Date.now()}${i}`,
      front: c.front,
      back: c.back,
      requirement_ids: c.requirement_ids,
      origin: "generated" as const,
      generated: { front: c.front, back: c.back },
    }));
    kit.flashcards = mergeRegeneratedFlashcards(kit.flashcards, stamped);
  } else if (section === "schedule") {
    kit.schedule = buildSchedule({
      daysAvailable: (doc.input as { days: number }).days,
      questions: kit.questions,
      requirements,
    });
  } else {
    throw Object.assign(new Error("Unknown section"), { code: "INVALID_INPUT" });
  }

  kit.coverage = computeCoverage(requirements, kit.questions, kit.coverage.passes, { mustOnly: true });
  doc.kit = parseKit(kit);
  doc.markModified("kit");
  await doc.save();
}

kitsRouter.post("/:id/regenerate/:section", async (req, res) => {
  const doc = await ownedKit(req, res, req.params.id);
  if (!doc?.kit) {
    if (!res.headersSent) res.status(409).json({ error: { code: "NOT_READY", message: "Kit is still generating" } });
    return;
  }
  try {
    await regenerateSection(doc, req.params.section);
    res.json({ kit: serialize(doc) });
  } catch (err) {
    res.status(400).json({
      error: {
        code: (err as { code?: string }).code || "REGENERATE_FAILED",
        message: err instanceof Error ? err.message : "Regenerate failed",
      },
    });
  }
});

kitsRouter.get("/:id/practice", async (req, res) => {
  const doc = await ownedKit(req, res, req.params.id);
  if (!doc?.kit) {
    if (!res.headersSent) {
      res.status(409).json({ error: { code: "NOT_READY", message: "Kit is still generating" } });
    }
    return;
  }
  const kit = doc.kit as Kit;
  const records = await PracticeRecord.find({ kitId: doc._id, userId: (asAuth(req)).userId }).lean();
  const mapped = records.map((r) => ({
    flashcardId: r.flashcardId,
    confidence: r.confidence,
    covered: r.covered,
    updatedAt: r.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  }));
  res.json({
    order: orderFlashcardsForPractice(kit.flashcards, mapped).map((f) => f.id),
    records: mapped,
    weakSpots: buildWeakSpots({
      requirements: kit.role.requirements,
      questions: kit.questions,
      flashcards: kit.flashcards,
      records: mapped,
    }),
  });
});

kitsRouter.post("/:id/practice", async (req, res) => {
  const doc = await ownedKit(req, res, req.params.id);
  if (!doc?.kit) {
    if (!res.headersSent) {
      res.status(409).json({ error: { code: "NOT_READY", message: "Kit is still generating" } });
    }
    return;
  }
  const confidence = Number(req.body.confidence);
  const flashcardId = String(req.body.flashcardId || "");
  if (!flashcardId || !Number.isInteger(confidence) || confidence < 1 || confidence > 5) {
    res.status(400).json({ error: { code: "INVALID_INPUT", message: "flashcardId and confidence 1-5 required" } });
    return;
  }
  await PracticeRecord.findOneAndUpdate(
    { kitId: doc._id, userId: (asAuth(req)).userId, flashcardId },
    { confidence, covered: true },
    { upsert: true, new: true },
  );
  const records = await PracticeRecord.find({ kitId: doc._id, userId: (asAuth(req)).userId }).lean();
  const kit = doc.kit as Kit;
  const mapped = records.map((r) => ({
    flashcardId: r.flashcardId,
    confidence: r.confidence,
    covered: r.covered,
    updatedAt: r.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  }));
  res.json({
    order: orderFlashcardsForPractice(kit.flashcards, mapped).map((f) => f.id),
    records: mapped,
    weakSpots: buildWeakSpots({
      requirements: kit.role.requirements,
      questions: kit.questions,
      flashcards: kit.flashcards,
      records: mapped,
    }),
  });
});
