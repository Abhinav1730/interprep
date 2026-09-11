import type { Flashcard, Question, QuestionCategory } from "./types.js";

export function isProtectedQuestion(q: Question): boolean {
  return q.pinned === true || q.origin === "user" || (q.edited_fields?.length ?? 0) > 0;
}

export function isProtectedFlashcard(f: Flashcard): boolean {
  return f.pinned === true || f.origin === "user" || (f.edited_fields?.length ?? 0) > 0;
}

export function mergeRegeneratedQuestions(
  existing: Question[],
  regenerated: Question[],
  category: QuestionCategory,
): Question[] {
  const keep = existing.filter((q) => q.category === category && isProtectedQuestion(q));
  const others = existing.filter((q) => q.category !== category);
  const keepIds = new Set(keep.map((q) => q.id));
  const fresh = regenerated.filter((q) => q.category === category && !keepIds.has(q.id));
  return [...others, ...keep, ...fresh];
}

export function mergeRegeneratedFlashcards(existing: Flashcard[], regenerated: Flashcard[]): Flashcard[] {
  const keep = existing.filter(isProtectedFlashcard);
  const keepIds = new Set(keep.map((f) => f.id));
  const fresh = regenerated.filter((f) => !keepIds.has(f.id));
  return [...keep, ...fresh];
}

export function applyFlashcardEdit(
  flashcard: Flashcard,
  patch: Partial<Pick<Flashcard, "front" | "back" | "requirement_ids" | "pinned">>,
): Flashcard {
  const generated = flashcard.generated ?? {
    front: flashcard.front,
    back: flashcard.back,
  };
  const edited = new Set(flashcard.edited_fields ?? []);
  if (patch.front !== undefined && patch.front !== generated.front) edited.add("front");
  if (patch.back !== undefined && patch.back !== generated.back) edited.add("back");
  return {
    ...flashcard,
    ...patch,
    generated,
    edited_fields: [...edited],
  };
}

export function applyQuestionEdit(
  question: Question,
  patch: Partial<Pick<Question, "prompt" | "answer_outline" | "category" | "difficulty" | "requirement_ids" | "pinned">>,
): Question {
  const generated = question.generated ?? {
    prompt: question.prompt,
    answer_outline: question.answer_outline,
    category: question.category,
  };
  const edited = new Set(question.edited_fields ?? []);
  if (patch.prompt !== undefined && patch.prompt !== generated.prompt) edited.add("prompt");
  if (patch.answer_outline !== undefined && patch.answer_outline !== generated.answer_outline) {
    edited.add("answer_outline");
  }
  if (patch.category !== undefined && patch.category !== generated.category) edited.add("category");
  return {
    ...question,
    ...patch,
    generated,
    edited_fields: [...edited],
  };
}
