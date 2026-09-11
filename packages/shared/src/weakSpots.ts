import type { Flashcard, Question, Requirement } from "./types.js";

export type PracticeRecord = {
  flashcardId: string;
  confidence: number;
  covered: boolean;
  updatedAt: string;
};

export type WeakSpot = {
  key: string;
  label: string;
  kind: "requirement" | "category";
  averageConfidence: number | null;
  sampleSize: number;
  status: "weak" | "ok" | "strong" | "unpracticed";
};

function statusFrom(avg: number | null, sample: number): WeakSpot["status"] {
  if (sample === 0 || avg === null) return "unpracticed";
  if (avg <= 2.5) return "weak";
  if (avg <= 3.5) return "ok";
  return "strong";
}

export function orderFlashcardsForPractice(
  flashcards: Flashcard[],
  records: PracticeRecord[],
): Flashcard[] {
  const byId = new Map(records.map((r) => [r.flashcardId, r]));
  return [...flashcards].sort((a, b) => {
    const ra = byId.get(a.id);
    const rb = byId.get(b.id);
    const sa = ra ? ra.confidence : 0.5;
    const sb = rb ? rb.confidence : 0.5;
    if (sa !== sb) return sa - sb;
    return a.id.localeCompare(b.id);
  });
}

export function buildWeakSpots(args: {
  requirements: Requirement[];
  questions: Question[];
  flashcards: Flashcard[];
  records: PracticeRecord[];
}): WeakSpot[] {
  const recByCard = new Map(args.records.map((r) => [r.flashcardId, r]));
  const spots: WeakSpot[] = [];

  for (const req of args.requirements) {
    const cards = args.flashcards.filter((f) => f.requirement_ids.includes(req.id));
    const confidences = cards
      .map((c) => recByCard.get(c.id)?.confidence)
      .filter((n): n is number => typeof n === "number");
    const avg =
      confidences.length > 0
        ? confidences.reduce((s, n) => s + n, 0) / confidences.length
        : null;
    spots.push({
      key: req.id,
      label: req.text,
      kind: "requirement",
      averageConfidence: avg,
      sampleSize: confidences.length,
      status: statusFrom(avg, confidences.length),
    });
  }

  const categories = ["technical", "behavioural", "system-design", "company-fit"] as const;
  for (const cat of categories) {
    const qids = new Set(args.questions.filter((q) => q.category === cat).flatMap((q) => q.requirement_ids));
    const cards = args.flashcards.filter((f) => f.requirement_ids.some((id) => qids.has(id)));
    const confidences = cards
      .map((c) => recByCard.get(c.id)?.confidence)
      .filter((n): n is number => typeof n === "number");
    const avg =
      confidences.length > 0
        ? confidences.reduce((s, n) => s + n, 0) / confidences.length
        : null;
    spots.push({
      key: cat,
      label: cat,
      kind: "category",
      averageConfidence: avg,
      sampleSize: confidences.length,
      status: statusFrom(avg, confidences.length),
    });
  }

  const rank = { weak: 0, unpracticed: 1, ok: 2, strong: 3 };
  return spots.sort((a, b) => rank[a.status] - rank[b.status]);
}
