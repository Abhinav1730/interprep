"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError, api, type Flashcard, type KitRecord } from "@/lib/api";
import { CONFIDENCE_LABELS } from "@/lib/kit-tabs";

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
  const [sessionDone, setSessionDone] = useState(false);
  const [ratedCount, setRatedCount] = useState(0);
  const [confidenceSum, setConfidenceSum] = useState(0);

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
  const progressPct = ordered.length ? Math.round(((index + 1) / ordered.length) * 100) : 0;
  const avgConfidence = ratedCount ? (confidenceSum / ratedCount).toFixed(1) : "—";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (sessionDone || !card) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(ordered.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setRevealed(true);
      }
      if (e.key === "Escape") router.push(`/kits/${params.id}?tab=practice`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ordered.length, params.id, router, sessionDone, card]);

  async function rate(confidence: number) {
    if (!card || sessionDone) return;
    const currentCard = card;
    const currentIndex = index;
    const next = await api<PracticeState>(`/kits/${params.id}/practice`, {
      method: "POST",
      body: JSON.stringify({ flashcardId: currentCard.id, confidence }),
    });
    setPractice(next);
    setRatedCount((c) => c + 1);
    setConfidenceSum((s) => s + confidence);
    setRevealed(false);
    if (currentIndex >= ordered.length - 1) {
      setSessionDone(true);
    } else {
      setIndex((i) => i + 1);
    }
  }

  useEffect(() => {
    if (!revealed || sessionDone) return;
    function onDigit(e: KeyboardEvent) {
      if (e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        void rate(Number(e.key));
      }
    }
    window.addEventListener("keydown", onDigit);
    return () => window.removeEventListener("keydown", onDigit);
  }, [revealed, sessionDone, card, index, ordered.length]);

  if (!kit?.kit) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6">
        <p className="text-sm text-mute">Loading practice…</p>
      </div>
    );
  }

  if (!card && !sessionDone) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6">
        <div className="card max-w-md p-8 text-center">
          <h1 className="section-title">No flashcards yet</h1>
          <p className="mt-2 text-sm text-mute">Generate or add flashcards in your kit first.</p>
          <Link href={`/kits/${params.id}?tab=flashcards`} className="btn-primary mt-6 inline-flex">
            Go to flashcards
          </Link>
        </div>
      </div>
    );
  }

  if (sessionDone) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6 py-10">
        <div className="card max-w-lg p-8 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-light">
            <span className="text-2xl text-accent-dark">✓</span>
          </div>
          <h1 className="section-title mt-6">Session complete</h1>
          <p className="mt-2 text-sm text-mute">Nice work — low-confidence cards will appear first next time.</p>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-left">
            <div className="rounded-2xl bg-canvas p-4">
              <dt className="text-xs text-mute">Cards rated</dt>
              <dd className="mt-1 font-serif text-2xl font-semibold">{ratedCount}</dd>
            </div>
            <div className="rounded-2xl bg-canvas p-4">
              <dt className="text-xs text-mute">Avg confidence</dt>
              <dd className="mt-1 font-serif text-2xl font-semibold">{avgConfidence}/5</dd>
            </div>
          </dl>
          {(practice?.weakSpots ?? []).slice(0, 3).length > 0 ? (
            <div className="mt-6 text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-mute">Top weak spots</p>
              <ul className="mt-2 space-y-1 text-sm">
                {(practice?.weakSpots ?? []).slice(0, 3).map((s) => (
                  <li key={s.key} className="text-mute">
                    {s.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              Practice again
            </button>
            <Link href={`/kits/${params.id}?tab=weak`} className="btn-secondary">
              View weak spots
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const reqLabel = card.requirement_ids?.length
    ? kit.kit!.role.requirements.find((r) => r.id === card.requirement_ids[0])?.text.slice(0, 80)
    : null;

  return (
    <div className="flex flex-col">
      <header className="border-b border-line bg-panel shadow-nav">
        <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="min-w-0">
            <p className="brand-mark">Practice</p>
            <p className="mt-1 text-sm font-medium">
              Card {index + 1} of {ordered.length}
            </p>
          </div>
          <Link href={`/kits/${params.id}?tab=practice`} className="btn-secondary shrink-0 px-4 py-2 text-xs">
            Back to kit
          </Link>
        </div>
        <div className="mx-auto max-w-content px-5 pb-3 sm:px-8">
          <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-content flex-1 gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)] lg:py-8">
        <div className="flex min-h-0 flex-col">
          <div className="card flex flex-1 items-center justify-center p-6 text-center sm:p-12 lg:min-h-[360px]">
            <div className="max-w-xl">
              {reqLabel ? <p className="mb-4 text-xs text-mute">Covers: {reqLabel}…</p> : null}
              <p className="font-serif text-2xl font-semibold leading-snug sm:text-3xl">{card.front}</p>
              {revealed ? (
                <p className="mt-8 border-t border-line pt-8 text-lg leading-relaxed text-mute">{card.back}</p>
              ) : (
                <p className="mt-6 text-sm text-mute">Tap reveal, press Space, or use keys 1–5 after reveal</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            {!revealed ? (
              <button className="btn-primary px-8" onClick={() => setRevealed(true)}>
                Reveal answer
              </button>
            ) : (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-mute">How confident are you?</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} — ${CONFIDENCE_LABELS[n]}`}
                      className="flex min-w-[4.5rem] flex-col items-center rounded-2xl border border-line bg-panel px-3 py-2 transition hover:border-accent hover:bg-accent-light"
                      onClick={() => rate(n)}
                    >
                      <span className="text-lg font-semibold">{n}</span>
                      <span className="text-[10px] text-mute">{CONFIDENCE_LABELS[n]}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <section className="card h-fit p-5 sm:p-6">
          <h2 className="font-serif text-lg font-semibold">Weak spots</h2>
          <p className="mt-1 text-xs text-mute">Updates as you rate cards</p>
          <ul className="mt-4 space-y-0 divide-y divide-line">
            {(practice?.weakSpots ?? []).slice(0, 8).map((spot) => (
              <li key={spot.key} className="flex flex-col gap-0.5 py-3 first:pt-0 sm:flex-row sm:justify-between">
                <span className="text-sm">{spot.label}</span>
                <span className="text-xs text-mute sm:text-sm">
                  {spot.status}
                  {spot.averageConfidence != null ? ` · ${spot.averageConfidence.toFixed(1)}/5` : ""}
                </span>
              </li>
            ))}
            {(practice?.weakSpots ?? []).length === 0 ? (
              <li className="py-3 text-sm text-mute">Rate cards to build your weak-spot report.</li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
