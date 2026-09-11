"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { api, type Flashcard, type KitPayload } from "@/lib/api";

function FlashcardItem({
  card,
  onSave,
  onDelete,
  onPin,
  onSaved,
}: {
  card: Flashcard;
  onSave: (id: string, patch: Partial<Flashcard>) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);

  useEffect(() => {
    setFront(card.front);
    setBack(card.back);
  }, [card.front, card.back]);

  return (
    <article className="card p-5 transition hover:shadow-soft">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-mute">
        <span className="font-mono">{card.id}</span>
        {card.pinned ? (
          <span className="rounded-full bg-accent-light px-2 py-0.5 text-accent-dark">pinned</span>
        ) : null}
      </div>
      {editing ? (
        <div className="space-y-3">
          <textarea value={front} onChange={(e) => setFront(e.target.value)} className="input-field" rows={2} />
          <textarea value={back} onChange={(e) => setBack(e.target.value)} className="input-field" rows={3} />
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary px-4 py-2 text-xs"
              onClick={() => {
                onSave(card.id, { front, back });
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
          <p className="text-sm font-medium leading-relaxed">{card.front}</p>
          <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-mute">{card.back}</p>
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-1">
        <button className="btn-ghost" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button className="btn-ghost" onClick={() => onPin(card.id, !card.pinned)}>
          {card.pinned ? "Unpin" : "Pin"}
        </button>
        <button className="btn-ghost text-danger hover:bg-red-50" onClick={() => onDelete(card.id)}>
          Delete
        </button>
      </div>
    </article>
  );
}

export function FlashcardBank({
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

  async function refresh(next: KitPayload) {
    onKit(next);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-mute">{kit.flashcards.length} flashcards</p>
        <button
          className="btn-secondary px-4 py-2 text-xs"
          onClick={async () => {
            const data = await api<{ kit: { kit: KitPayload } }>(`/kits/${kitId}/flashcards`, {
              method: "POST",
              body: JSON.stringify({ front: "New flashcard", back: "Add an answer." }),
            });
            refresh(data.kit.kit);
            toast.success("Flashcard added");
          }}
        >
          Add flashcard
        </button>
      </div>
      {kit.flashcards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-mute">
          No flashcards yet. Add one or regenerate from your questions.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {kit.flashcards.map((card) => (
            <FlashcardItem
              key={card.id}
              card={card}
              onSave={async (id, patch) => {
                const data = await api<{ kit: { kit: KitPayload } }>(`/kits/${kitId}/flashcards/${id}`, {
                  method: "PATCH",
                  body: JSON.stringify(patch),
                });
                refresh(data.kit.kit);
              }}
              onSaved={() => toast.success("Flashcard saved")}
              onDelete={async (id) => {
                const ok = await confirm({
                  title: "Delete flashcard?",
                  message: "This cannot be undone.",
                  confirmLabel: "Delete",
                  danger: true,
                });
                if (!ok) return;
                const data = await api<{ kit: { kit: KitPayload } }>(`/kits/${kitId}/flashcards/${id}`, {
                  method: "DELETE",
                });
                refresh(data.kit.kit);
                toast.success("Flashcard deleted");
              }}
              onPin={async (id, pinned) => {
                const data = await api<{ kit: { kit: KitPayload } }>(`/kits/${kitId}/flashcards/${id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ pinned }),
                });
                refresh(data.kit.kit);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
