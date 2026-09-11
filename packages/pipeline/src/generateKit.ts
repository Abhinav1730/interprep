import {
  assignRequirementIds,
  buildSchedule,
  computeCoverage,
  coverageSummary,
  fallbackQuestionForRequirement,
  nextId,
  parseKit,
  type EvaluateResult,
  type Flashcard,
  type GenerationProgress,
  type GenerationStepId,
  type Kit,
  type KitInput,
  type Question,
  type QuestionCategory,
  type Requirement,
  completeProgress,
  failProgress,
  initialProgress,
  markStep,
} from "@interprep/shared";
import { researchCompany, type ResearchBundle } from "@interprep/retrieval";
import {
  extractCompany,
  extractRole,
  generateFlashcards,
  generateGapQuestions,
  generateQuestionsForCategory,
  type Extraction,
} from "./generate.js";

const MAX_COVERAGE_PASSES = 3;
const HIRING_NOT_FOUND =
  "Hiring process information was not found on the company's public website.";

export type ProgressListener = (progress: GenerationProgress) => void | Promise<void>;

function heuristicExtraction(jd: string): Extraction {
  const lines = jd
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•]\s+/, "").trim())
    .filter((l) => l.length > 8 && l.length < 220);
  const titleMatch = jd.match(/(?:title|role)\s*[:\-]\s*(.+)/i) || jd.match(/^(.{8,80})$/m);
  const reqs = (lines.length ? lines.slice(0, 8) : [jd.slice(0, 160) || "Role skills as described in the posting"]).map(
    (text) => {
      const nice = /preferred|nice to have|bonus|plus|a plus/i.test(text);
      const behavioural = /mentor|communicat|lead|collaborat|stakeholder|culture/i.test(text);
      const system = /distribut|scalab|architect|system design/i.test(text);
      return {
        text,
        kind: (system
          ? "system-design"
          : behavioural
            ? "behavioural"
            : "technical") as Extraction["requirements"][number]["kind"],
        priority: nice ? ("nice" as const) : ("must" as const),
      };
    },
  );
  return {
    title: titleMatch?.[1]?.trim() || "Software Engineer",
    seniority: /senior|staff|principal|junior|intern/i.exec(jd)?.[0] || "unspecified",
    responsibilities: lines.slice(0, 5),
    requirements: reqs,
  };
}

function heuristicCompany(research: ResearchBundle) {
  const homepage = research.pages[0];
  let hostName = "Company";
  try {
    hostName = new URL(research.startUrl).hostname.replace(/^www\./, "");
  } catch {
    hostName = "Company";
  }
  const summaryBase = homepage?.text.slice(0, 400) || "Limited public company information was retrieved.";
  return {
    name: homepage?.title?.split("|")[0]?.trim() || hostName,
    summary:
      research.pages.length === 0
        ? "The company website was unreachable or returned no usable pages. Company facts are limited; questions are grounded in the job description."
        : summaryBase,
    products: [] as string[],
    culture: "",
    engineering: "",
    hiring_process: research.hiringFound ? research.hiringEvidence : HIRING_NOT_FOUND,
    hiring_process_found: research.hiringFound,
  };
}

function requirementsForCategory(reqs: Requirement[], category: QuestionCategory): Requirement[] {
  if (category === "technical") {
    return reqs.filter((r) => r.kind === "technical" || r.kind === "other");
  }
  if (category === "behavioural") return reqs.filter((r) => r.kind === "behavioural");
  if (category === "system-design") {
    const hit = reqs.filter((r) => r.kind === "system-design" || /distribut|scalab|architect/i.test(r.text));
    return hit.length ? hit : reqs.filter((r) => r.priority === "must").slice(0, 2);
  }
  return reqs;
}

function stampQuestions(
  raw: Array<{ prompt: string; answer_outline: string; difficulty: 1 | 2 | 3; requirement_ids: string[] }>,
  category: QuestionCategory,
  validIds: Set<string>,
  existing: string[],
): Question[] {
  const out: Question[] = [];
  let ids = [...existing];
  for (const item of raw) {
    const reqIds = item.requirement_ids.filter((id) => validIds.has(id));
    if (!reqIds.length) continue;
    const difficulty = item.difficulty === 1 || item.difficulty === 2 || item.difficulty === 3 ? item.difficulty : 2;
    const id = nextId("q", ids);
    ids.push(id);
    out.push({
      id,
      requirement_ids: reqIds,
      category,
      prompt: item.prompt,
      answer_outline: item.answer_outline,
      difficulty,
      origin: "generated",
      generated: {
        prompt: item.prompt,
        answer_outline: item.answer_outline,
        category,
      },
    });
  }
  return out;
}

async function step(
  progress: GenerationProgress,
  listener: ProgressListener | undefined,
  id: GenerationStepId,
  fn: () => Promise<void> | void,
): Promise<GenerationProgress> {
  let next = markStep(progress, id, "active");
  await listener?.(next);
  await fn();
  next = markStep(next, id, "done");
  await listener?.(next);
  return next;
}

export async function generateKit(
  input: KitInput,
  options: { onProgress?: ProgressListener; includePublicSearch?: boolean } = {},
): Promise<EvaluateResult> {
  let progress: GenerationProgress = {
    ...initialProgress(),
    status: "generating",
    startedAt: new Date().toISOString(),
  };
  await options.onProgress?.(progress);

  try {
    progress = await step(progress, options.onProgress, "read_jd", () => undefined);

    let extraction: Extraction = heuristicExtraction(input.jd);
    let research!: ResearchBundle;

    progress = markStep(progress, "extract_requirements", "active");
    await options.onProgress?.(progress);
    progress = markStep(progress, "crawl", "active");
    await options.onProgress?.(progress);

    const [extracted, crawled] = await Promise.all([
      extractRole(input.jd).catch(() => extraction),
      researchCompany({
        companyUrl: input.company_url,
        roleHint: extraction.title,
        includePublicSearch: options.includePublicSearch,
      }),
    ]);
    extraction = extracted;
    research = crawled;

    progress = markStep(progress, "extract_requirements", "done");
    progress = markStep(progress, "crawl", research.pages.length ? "done" : "skipped");
    await options.onProgress?.(progress);

    if (!extraction.requirements.length) {
      const error = {
        code: "EXTRACTION_FAILED",
        message: "Could not extract any requirements from the job description.",
      };
      const failed = failProgress(progress, error);
      await options.onProgress?.(failed);
      return { id: "", status: "failed", kit: null, error };
    }

    const requirements: Requirement[] = assignRequirementIds(extraction.requirements);
    const validIds = new Set(requirements.map((r) => r.id));

    const excerpts = research.pages
      .map((p) => `URL: ${p.url}\nTITLE: ${p.title}\n${p.text.slice(0, 2500)}`)
      .join("\n\n")
      .slice(0, 24_000);

    progress = await step(progress, options.onProgress, "company_info", () => undefined);
    let company = heuristicCompany(research);
    try {
      company = await extractCompany({
        excerpts: `${excerpts}\n\nPUBLIC DISCUSSIONS:\n${JSON.stringify(research.publicDiscussions)}`,
        hiringFound: research.hiringFound,
        hiringEvidence: research.hiringEvidence,
      });
    } catch {
      company = heuristicCompany(research);
    }
    if (!research.hiringFound) {
      company.hiring_process_found = false;
      company.hiring_process = HIRING_NOT_FOUND;
    }

    progress = await step(progress, options.onProgress, "hiring", () => undefined);
    progress = await step(progress, options.onProgress, "public_research", () => undefined);

    const companySummary = `${company.name}: ${company.summary}`;
    const categories: QuestionCategory[] = ["technical", "behavioural", "system-design", "company-fit"];
    const stepIds: GenerationStepId[] = ["technical", "behavioural", "system_design", "company_fit"];
    let questions: Question[] = [];

    for (let i = 0; i < categories.length; i++) {
      const category = categories[i]!;
      const sid = stepIds[i]!;
      progress = markStep(progress, sid, "active");
      await options.onProgress?.(progress);
      const subset = requirementsForCategory(requirements, category);
      if (subset.length === 0 && category !== "company-fit") {
        progress = markStep(progress, sid, "skipped");
        await options.onProgress?.(progress);
        continue;
      }
      const generated = await generateQuestionsForCategory({
        category,
        requirements: subset.length ? subset : requirements,
        companySummary,
        hiringProcess: company.hiring_process,
      });
      questions = [
        ...questions,
        ...stampQuestions(generated.questions, category, validIds, questions.map((q) => q.id)),
      ];
      progress = markStep(progress, sid, "done");
      await options.onProgress?.(progress);
    }

    let passes = 1;
    progress = markStep(progress, "coverage", "active");
    await options.onProgress?.(progress);
    let coverage = computeCoverage(requirements, questions, passes, { mustOnly: true });

    while (coverage.uncovered_requirement_ids.length > 0 && passes < MAX_COVERAGE_PASSES) {
      const missing = requirements.filter((r) => coverage.uncovered_requirement_ids.includes(r.id));
      const gap = await generateGapQuestions({
        requirements: missing,
        companySummary,
        hiringProcess: company.hiring_process,
      });
      const added: Question[] = [];
      let ids = questions.map((q) => q.id);
      for (const item of gap.questions) {
        const reqIds = item.requirement_ids.filter((id) => validIds.has(id));
        if (!reqIds.length) continue;
        const category =
          item.category === "technical" ||
          item.category === "behavioural" ||
          item.category === "system-design" ||
          item.category === "company-fit"
            ? item.category
            : "technical";
        const difficulty = item.difficulty === 1 || item.difficulty === 2 || item.difficulty === 3 ? item.difficulty : 2;
        const id = nextId("q", ids);
        ids.push(id);
        added.push({
          id,
          requirement_ids: reqIds,
          category,
          prompt: item.prompt,
          answer_outline: item.answer_outline,
          difficulty,
          origin: "generated",
          generated: { prompt: item.prompt, answer_outline: item.answer_outline, category },
        });
      }
      questions = [...questions, ...added];
      passes += 1;
      coverage = computeCoverage(requirements, questions, passes, { mustOnly: true });
    }

    if (coverage.uncovered_requirement_ids.length > 0) {
      const missing = requirements.filter((r) => coverage.uncovered_requirement_ids.includes(r.id));
      for (const req of missing) {
        questions.push(fallbackQuestionForRequirement(req, nextId("q", questions.map((q) => q.id))));
      }
      passes += 1;
      coverage = computeCoverage(requirements, questions, passes, { mustOnly: true });
    }
    progress = markStep(progress, "coverage", "done");
    await options.onProgress?.(progress);

    progress = markStep(progress, "flashcards", "active");
    await options.onProgress?.(progress);
    let flashcards: Flashcard[] = [];
    const generatedCards = await generateFlashcards({
      requirements: requirements.map((r) => ({ id: r.id, text: r.text })),
      questions: questions.map((q) => ({
        prompt: q.prompt,
        answer_outline: q.answer_outline,
        requirement_ids: q.requirement_ids,
      })),
    });
    let fids: string[] = [];
    for (const card of generatedCards.flashcards) {
      const reqIds = card.requirement_ids.filter((id) => validIds.has(id));
      if (!reqIds.length) continue;
      const id = nextId("f", fids);
      fids.push(id);
      flashcards.push({
        id,
        front: card.front,
        back: card.back,
        requirement_ids: reqIds,
        origin: "generated",
        generated: { front: card.front, back: card.back },
      });
    }
    if (flashcards.length === 0) {
      for (const q of questions.slice(0, 12)) {
        const id = nextId("f", flashcards.map((f) => f.id));
        flashcards.push({
          id,
          front: q.prompt,
          back: q.answer_outline,
          requirement_ids: q.requirement_ids,
          origin: "generated",
          generated: { front: q.prompt, back: q.answer_outline },
        });
      }
    }
    progress = markStep(progress, "flashcards", "done");
    await options.onProgress?.(progress);

    progress = await step(progress, options.onProgress, "schedule", () => undefined);
    const schedule = buildSchedule({
      daysAvailable: input.days,
      questions,
      requirements,
    });

    const kit: Kit = {
      source: {
        company_url: research.startUrl,
        pages_used: research.pagesUsed,
        public_discussions: research.publicDiscussions,
        retrieved_at: new Date().toISOString(),
      },
      company_brief: {
        name: company.name,
        summary: company.summary,
        products: company.products,
        culture: company.culture,
        engineering: company.engineering,
        hiring_process: company.hiring_process_found ? company.hiring_process : HIRING_NOT_FOUND,
        hiring_process_found: Boolean(company.hiring_process_found && research.hiringFound),
        sources: research.pages.map((p) => ({ url: p.url, title: p.title })),
      },
      role: {
        title: extraction.title,
        seniority: extraction.seniority,
        responsibilities: extraction.responsibilities,
        requirements,
      },
      questions,
      flashcards,
      schedule,
      coverage: {
        ...coverage,
        uncovered_requirement_ids: coverageSummary(requirements, questions).uncoveredMustIds,
      },
    };

    progress = markStep(progress, "validate", "active");
    await options.onProgress?.(progress);
    const validated = parseKit(kit);
    progress = completeProgress(markStep(progress, "validate", "done"));
    await options.onProgress?.(progress);

    return { id: "", status: "ok", kit: validated };
  } catch (err) {
    const error = {
      code: (err as { code?: string }).code || "PIPELINE_FAILED",
      message: err instanceof Error ? err.message : "Kit generation failed",
    };
    const failed = failProgress(progress, error);
    await options.onProgress?.(failed);
    return { id: "", status: "failed", kit: null, error };
  }
}
