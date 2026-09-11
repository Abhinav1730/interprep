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
import { api, type KitPayload, type Question } from "@/lib/api";

const CATEGORIES = ["technical", "behavioural", "system-design", "company-fit"] as const;

function SortableQuestion({
  question,
  onSave,
  onDelete,
  onMove,
  onPin,
}: {
  question: Question;
  onSave: (id: string, patch: Partial<Question>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, category: string) => void;
  onPin: (id: string, pinned: boolean) => void;
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
      className="rounded-xl border border-line bg-canvas/60 p-4"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-1 cursor-grab text-mute"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-mute">
            <span>{question.id}</span>
            <span>d{question.difficulty}</span>
            {question.edited_fields?.length ? <span className="text-warn">edited</span> : null}
            {question.pinned ? <span className="text-accent">pinned</span> : null}
            {question.origin === "user" ? <span>yours</span> : null}
          </div>
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full rounded-lg border border-line bg-panel p-2 text-sm"
                rows={3}
              />
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="w-full rounded-lg border border-line bg-panel p-2 text-sm"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  className="rounded-md bg-accent px-3 py-1 text-xs text-canvas"
                  onClick={() => {
                    onSave(question.id, { prompt, answer_outline: answer });
                    setEditing(false);
                  }}
                >
                  Save
                </button>
                <button className="rounded-md border border-line px-3 py-1 text-xs" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium">{question.prompt}</p>
              <p className="mt-2 text-sm text-mute">{question.answer_outline}</p>
            </>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button className="text-mute hover:text-ink" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="text-mute hover:text-ink" onClick={() => onPin(question.id, !question.pinned)}>
              {question.pinned ? "Unpin" : "Pin"}
            </button>
            <label className="text-mute">
              Move
              <select
                className="ml-1 bg-transparent"
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
            <button className="text-danger" onClick={() => onDelete(question.id)}>
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
    <div className="space-y-8">
      {CATEGORIES.map((category) => {
        const list = grouped[category] ?? [];
        return (
          <section key={category} id={`questions-${category}`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium capitalize">{category.replace("-", " ")} questions</h3>
              <div className="flex gap-2">
                <button
                  className="rounded-md border border-line px-3 py-1 text-xs"
                  onClick={async () => {
                    const data = await api<{ kit: { kit: KitPayload } }>(`/kits/${kitId}/questions`, {
                      method: "POST",
                      body: JSON.stringify({ category, prompt: "New question", answer_outline: "Add an outline." }),
                    });
                    refresh(data.kit.kit);
                  }}
                >
                  Add
                </button>
                <button
                  className="rounded-md border border-line px-3 py-1 text-xs"
                  onClick={async () => {
                    const data = await api<{ kit: { kit: KitPayload } }>(`/kits/${kitId}/regenerate/${category}`, {
                      method: "POST",
                    });
                    refresh(data.kit.kit);
                  }}
                >
                  Regenerate
                </button>
              </div>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(category, e)}>
              <SortableContext items={list.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {list.length === 0 ? <p className="text-sm text-mute">No questions in this category yet.</p> : null}
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
                      onDelete={async (id) => {
                        const data = await api<{ kit: { kit: KitPayload } }>(`/kits/${kitId}/questions/${id}`, {
                          method: "DELETE",
                        });
                        refresh(data.kit.kit);
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
