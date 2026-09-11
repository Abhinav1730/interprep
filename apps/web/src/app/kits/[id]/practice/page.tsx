"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError, api, type Flashcard, type KitRecord } from "@/lib/api";

type PracticeState = {
  order: string[];
  records: Array<{ flashcardId: string; confidence: number }>;
  weakSpots: Array<{
    key: string;
    label: string;
    status: string;
    averageConfidence: number | null;
    sampleSize: number;
  }>;
};

export default function PracticePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [kit, setKit] = useState<KitRecord | null>(null);
  const [practice, setPractice] = useState<PracticeState | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ kit: KitRecord }>(`/kits/${params.id}`),
      api<PracticeState>(`/kits/${params.id}/practice`),
    ])
      .then(([k, p]) => {
        setKit(k.kit);
        setPractice(p);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace("/login");
      });
  }, [params.id, router]);

  const cards = kit?.kit?.flashcards ?? [];
  const ordered: Flashcard[] = useMemo(() => {
    if (!practice) return cards;
    const map = new Map(cards.map((c) => [c.id, c]));
    return practice.order.map((id) => map.get(id)).filter((c): c is Flashcard => Boolean(c));
  }, [cards, practice]);

  const card = ordered[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setIndex((i) => Math.min(ordered.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setRevealed(true);
      }
      if (e.key === "Escape") router.push(`/kits/${params.id}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ordered.length, params.id, router]);

  async function rate(confidence: number) {
    if (!card) return;
    const next = await api<PracticeState>(`/kits/${params.id}/practice`, {
      method: "POST",
      body: JSON.stringify({ flashcardId: card.id, confidence }),
    });
    setPractice(next);
    setRevealed(false);
    setIndex((i) => Math.min(ordered.length - 1, i + 1));
  }

  if (!kit?.kit) return <p className="p-8 text-mute">Loading practice…</p>;
  if (!card) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <h1 className="text-2xl font-semibold">No flashcards yet</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
        Flashcard {index + 1} / {ordered.length}
      </p>
      <div className="mt-6 min-h-48 rounded-2xl border border-line bg-panel p-8 text-center shadow-soft">
        <p className="text-xl font-medium">{card.front}</p>
        {revealed ? <p className="mt-6 text-mute">{card.back}</p> : null}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {!revealed ? (
          <button className="rounded-lg bg-accent px-5 py-2 text-sm text-canvas" onClick={() => setRevealed(true)}>
            Reveal answer
          </button>
        ) : (
          [1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className="h-10 w-10 rounded-lg border border-line hover:border-accent"
              onClick={() => rate(n)}
            >
              {n}
            </button>
          ))
        )}
      </div>
      <section className="mt-12">
        <h2 className="text-lg font-medium">Weak spots</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(practice?.weakSpots ?? []).slice(0, 8).map((spot) => (
            <li key={spot.key} className="flex justify-between border-b border-line py-2">
              <span>{spot.label}</span>
              <span className="text-mute">
                {spot.status}
                {spot.averageConfidence != null ? ` · ${spot.averageConfidence.toFixed(1)}/5` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
