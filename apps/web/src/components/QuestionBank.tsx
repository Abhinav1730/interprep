"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { api, type KitPayload, type Question } from "@/lib/api";

const CATEGORIES = ["technical", "behavioural", "system-design", "company-fit"] as const;

function SortableQuestion({
  question,
  onSave,
  onDelete,
  onMove,
  onPin,
  onSaved,
}: {
  question: Question;
  onSave: (id: string, patch: Partial<Question>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, category: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onSaved: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: question.id });
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(question.prompt);
  const [answer, setAnswer] = useState(question.answer_outline);

  useEffect(() => {
    setPrompt(question.prompt);
    setAnswer(question.answer_outline);
  }, [question.prompt, question.answer_outline]);

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="card p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-1 cursor-grab rounded-lg px-1 text-mute hover:bg-canvas hover:text-ink"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-mute">
            <span className="font-mono">{question.id}</span>
            <span className="rounded-full bg-canvas px-2 py-0.5">d{question.difficulty}</span>
            {question.edited_fields?.length ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-warn">edited</span>
            ) : null}
            {question.pinned ? (
              <span className="rounded-full bg-accent-light px-2 py-0.5 text-accent-dark">pinned</span>
            ) : null}
            {question.origin === "user" ? <span className="rounded-full bg-canvas px-2 py-0.5">yours</span> : null}
          </div>
          {editing ? (
            <div className="space-y-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="input-field"
                rows={3}
              />
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="input-field"
                rows={3}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-primary px-4 py-2 text-xs"
                  onClick={() => {
                    onSave(question.id, { prompt, answer_outline: answer });
                    setEditing(false);
                    onSaved();
                  }}
                >
                  Save
                </button>
                <button className="btn-secondary px-4 py-2 text-xs" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium leading-relaxed">{question.prompt}</p>
              <p className="mt-2 text-sm leading-relaxed text-mute">{question.answer_outline}</p>
            </>
          )}
          <div className="mt-3 flex flex-wrap gap-1">
            <button className="btn-ghost" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="btn-ghost" onClick={() => onPin(question.id, !question.pinned)}>
              {question.pinned ? "Unpin" : "Pin"}
            </button>
            <label className="btn-ghost cursor-pointer">
              Move
              <select
                className="ml-1 bg-transparent text-ink"
                value={question.category}
                onChange={(e) => onMove(question.id, e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn-ghost text-danger hover:bg-red-50" onClick={() => onDelete(question.id)}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function QuestionBank({
  kitId,
  kit,
  onKit,
}: {
  kitId: string;
  kit: KitPayload;
  onKit: (kit: KitPayload) => void;
}) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const grouped = useMemo(() => {
    const map: Record<string, Question[]> = {
      technical: [],
      behavioural: [],
      "system-design": [],
      "company-fit": [],
    };
    for (const q of kit.questions) {
      (map[q.category] ?? map.technical).push(q);
    }
    return map;
  }, [kit.questions]);

  async function refresh(next: KitPayload) {
    onKit(next);
  }

  async function onDragEnd(category: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const list = grouped[category] ?? [];
    const oldIndex = list.findIndex((q) => q.id === active.id);
    const newIndex = list.findIndex((q) => q.id === over.id);
    const reordered = arrayMove(list, oldIndex, newIndex);
    const rebuilt: Question[] = [];
    for (const cat of CATEGORIES) {
      rebuilt.push(...(cat === category ? reordered : kit.questions.filter((q) => q.category === cat)));
    }
    onKit({ ...kit, questions: rebuilt });
    await api(`/kits/${kitId}/questions/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ ids: rebuilt.map((q) => q.id) }),
    });
  }

  return (
    <div className="space-y-10">
      {CATEGORIES.map((category) => {
        const list = grouped[category] ?? [];
        return (
          <section key={category} id={`questions-${category}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-serif text-lg font-semibold capitalize">{category.replace("-", " ")} questions</h3>
              <div className="flex gap-2">
                <button
                  className="btn-secondary px-4 py-2 text-xs"
                  onClick={async () => {
                    const data = await api<{ kit: { kit: KitPayload } }>(`/kits/${kitId}/questions`, {
                      method: "POST",
                      body: JSON.stringify({ category, prompt: "New question", answer_outline: "Add an outline." }),
                    });
                    refresh(data.kit.kit);
                    toast.success("Question added");
                  }}
                >
                  Add
                </button>
                <button
                  className="btn-secondary px-4 py-2 text-xs"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Regenerate questions?",
                      message: `Replace unpinned ${category.replace("-", " ")} questions. Edited and pinned items are kept.`,
                      confirmLabel: "Regenerate",
                    });
                    if (!ok) return;
                    try {
                      const data = await api<{ kit: { kit: KitPayload } }>(`/kits/${kitId}/regenerate/${category}`, {
                        method: "POST",
                      });
                      refresh(data.kit.kit);
                      toast.success("Questions regenerated");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Regenerate failed");
                    }
                  }}
                >
                  Regenerate
                </button>
              </div>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(category, e)}>
              <SortableContext items={list.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {list.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-mute">
                      No questions in this category yet.
                    </p>
                  ) : null}
                  {list.map((q) => (
                    <SortableQuestion
                      key={q.id}
                      question={q}
                      onSave={async (id, patch) => {
                        const data = await api<{ kit: { kit: KitPayload } }>(`/kits/${kitId}/questions/${id}`, {
                          method: "PATCH",
                          body: JSON.stringify(patch),
                        });
                        refresh(data.kit.kit);
                      }}
                      onSaved={() => toast.success("Question saved")}
                      onDelete={async (id) => {
                        const ok = await confirm({
                          title: "Delete question?",
                          message: "This cannot be undone.",
                          confirmLabel: "Delete",
                          danger: true,
                        });
                        if (!ok) return;
                        const data = await api<{ kit: { kit: KitPayload } }>(`/kits/${kitId}/questions/${id}`, {
                          method: "DELETE",
                        });
                        refresh(data.kit.kit);
                        toast.success("Question deleted");
                      }}
                      onMove={async (id, nextCat) => {
                        const data = await api<{ kit: { kit: KitPayload } }>(`/kits/${kitId}/questions/${id}/move`, {
                          method: "PATCH",
                          body: JSON.stringify({ category: nextCat }),
                        });
                        refresh(data.kit.kit);
                      }}
                      onPin={async (id, pinned) => {
                        const data = await api<{ kit: { kit: KitPayload } }>(`/kits/${kitId}/questions/${id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ pinned }),
                        });
                        refresh(data.kit.kit);
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        );
      })}
    </div>
  );
}
