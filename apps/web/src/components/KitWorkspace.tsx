"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, type KitPayload } from "@/lib/api";
import { QuestionBank } from "./QuestionBank";

const NAV = [
  { href: "#company", label: "Company" },
  { href: "#role", label: "Role" },
  { href: "#questions", label: "Questions" },
  { href: "#flashcards", label: "Flashcards" },
  { href: "#plan", label: "Plan" },
  { href: "#weak", label: "Weak spots" },
];

export function KitWorkspace({
  kitId,
  initial,
}: {
  kitId: string;
  initial: KitPayload;
}) {
  const [kit, setKit] = useState(initial);
  const [palette, setPalette] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [weak, setWeak] = useState<
    Array<{ key: string; label: string; status: string; averageConfidence: number | null }>
  >([]);

  useEffect(() => {
    api<{
      weakSpots: Array<{ key: string; label: string; status: string; averageConfidence: number | null }>;
    }>(`/kits/${kitId}/practice`)
      .then((p) => setWeak(p.weakSpots || []))
      .catch(() => undefined);
  }, [kitId]);

  const must = kit.role.requirements.filter((r) => r.priority === "must");
  const covered = must.length - kit.coverage.uncovered_requirement_ids.filter((id) =>
    must.some((r) => r.id === id),
  ).length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
      if (e.key === "Escape") {
        setPalette(false);
        setMobileNav(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const questionById = useMemo(() => new Map(kit.questions.map((q) => [q.id, q])), [kit.questions]);

  async function regenerate(section: string) {
    setBusy(section);
    try {
      const data = await api<{ kit: { kit: KitPayload } }>(`/kits/${kitId}/regenerate/${section}`, {
        method: "POST",
      });
      setKit(data.kit.kit);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="hidden border-r border-line p-5 lg:block">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Interprep</p>
        <p className="mt-3 text-sm font-medium">{kit.company_brief.name}</p>
        <p className="text-xs text-mute">{kit.role.title}</p>
        <nav className="mt-8 space-y-2 text-sm">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="block text-mute hover:text-ink">
              {item.label}
            </a>
          ))}
          <Link href={`/kits/${kitId}/practice`} className="block text-accent">
            Practice
          </Link>
          <Link href="/" className="block text-mute hover:text-ink">
            All kits
          </Link>
        </nav>
        <p className="mt-10 text-xs text-mute">⌘K command palette</p>
      </aside>

      <main className="px-4 py-6 lg:px-10">
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <button className="rounded-md border border-line px-3 py-1" onClick={() => setMobileNav(true)}>
            Menu
          </button>
          <Link href={`/kits/${kitId}/practice`} className="text-sm text-accent">
            Practice
          </Link>
        </div>

        <header className="mb-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Interview prep</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {kit.company_brief.name} · {kit.role.title}
          </h1>
          <p className="mt-1 text-sm text-mute">
            {kit.role.seniority} · {kit.schedule.days_available} day plan
          </p>
        </header>

        <div className="mb-8 rounded-xl border border-line bg-panel px-4 py-3 text-sm">
          Coverage {covered} / {must.length} must-have requirements
          {kit.coverage.uncovered_requirement_ids.length === 0 ? (
            <span className="ml-2 text-accent">complete</span>
          ) : (
            <span className="ml-2 text-warn">gaps remain after {kit.coverage.passes} pass(es)</span>
          )}
        </div>

        <section id="company" className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-medium">Company brief</h2>
            <button className="text-xs text-mute" onClick={() => regenerate("company")} disabled={busy === "company"}>
              {busy === "company" ? "Regenerating…" : "Regenerate"}
            </button>
          </div>
          <div className="rounded-2xl border border-line bg-panel p-5">
            <p>{kit.company_brief.summary}</p>
            {kit.company_brief.products.length ? (
              <p className="mt-3 text-sm text-mute">Products: {kit.company_brief.products.join(", ")}</p>
            ) : null}
            <p className="mt-4 text-sm">
              <span className="text-mute">Hiring process: </span>
              {kit.company_brief.hiring_process}
            </p>
            <ul className="mt-4 space-y-1 text-xs text-mute">
              {kit.company_brief.sources.map((s) => (
                <li key={s.url}>
                  <a className="underline" href={s.url} target="_blank" rel="noreferrer">
                    {s.title || s.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="role" className="mb-10">
          <h2 className="mb-3 text-xl font-medium">Role breakdown</h2>
          <div className="rounded-2xl border border-line bg-panel p-5">
            <p className="text-sm text-mute">
              {kit.role.title} · {kit.role.seniority}
            </p>
            <ul className="mt-4 space-y-2">
              {kit.role.requirements.map((r) => {
                const done = !kit.coverage.uncovered_requirement_ids.includes(r.id);
                return (
                  <li key={r.id} className="flex gap-3 text-sm">
                    <span className={done ? "text-accent" : "text-mute"}>{done ? "✓" : "○"}</span>
                    <span>
                      <span className="font-mono text-xs text-mute">{r.id}</span> {r.text}{" "}
                      <span className="text-mute">· {r.priority}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section id="questions" className="mb-10">
          <h2 className="mb-4 text-xl font-medium">Question bank</h2>
          <QuestionBank kitId={kitId} kit={kit} onKit={setKit} />
        </section>

        <section id="flashcards" className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-medium">Flashcards</h2>
            <button className="text-xs text-mute" onClick={() => regenerate("flashcards")}>
              Regenerate
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {kit.flashcards.map((card) => (
              <div key={card.id} className="rounded-xl border border-line bg-panel p-4">
                <p className="text-sm font-medium">{card.front}</p>
                <p className="mt-2 text-sm text-mute">{card.back}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="plan" className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-medium">Study schedule</h2>
            <button className="text-xs text-mute" onClick={() => regenerate("schedule")}>
              Regenerate
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-panel text-mute">
                <tr>
                  <th className="px-4 py-2">Day</th>
                  <th className="px-4 py-2">Focus</th>
                  <th className="px-4 py-2">Questions</th>
                  <th className="px-4 py-2">Minutes</th>
                </tr>
              </thead>
              <tbody>
                {kit.schedule.days.map((day) => (
                  <tr key={day.day} className="border-t border-line">
                    <td className="px-4 py-2 font-mono">{day.day}</td>
                    <td className="px-4 py-2">{day.focus}</td>
                    <td className="px-4 py-2 text-mute">
                      {day.question_ids.map((id) => questionById.get(id)?.prompt.slice(0, 48) || id).join(" · ")}
                    </td>
                    <td className="px-4 py-2">{day.minutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="weak" className="mb-16">
          <h2 className="mb-3 text-xl font-medium">Weak spots</h2>
          {weak.length === 0 ? (
            <p className="text-sm text-mute">
              Practice flashcards to populate this report. Low-confidence cards are scheduled first in the next session.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {weak.slice(0, 10).map((spot) => (
                <li key={spot.key} className="flex justify-between rounded-lg border border-line px-3 py-2">
                  <span>{spot.label}</span>
                  <span className="text-mute">
                    {spot.status}
                    {spot.averageConfidence != null ? ` · ${spot.averageConfidence.toFixed(1)}/5` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/kits/${kitId}/practice`} className="mt-3 inline-block text-accent">
            Open practice mode
          </Link>
        </section>
      </main>

      {mobileNav ? (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileNav(false)}>
          <div className="h-full w-64 bg-panel p-5" onClick={(e) => e.stopPropagation()}>
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="block py-2" onClick={() => setMobileNav(false)}>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {palette ? (
        <div className="fixed inset-0 z-50 bg-black/50 p-4" onClick={() => setPalette(false)}>
          <div
            className="mx-auto mt-24 max-w-md rounded-xl border border-line bg-panel p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {NAV.concat([{ href: `/kits/${kitId}/practice`, label: "Practice" }]).map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm hover:bg-canvas"
                onClick={() => setPalette(false)}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
