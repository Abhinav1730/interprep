"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { TAB_ICONS } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { api, type KitPayload } from "@/lib/api";
import { KIT_TABS, parseKitTab, type KitTabId } from "@/lib/kit-tabs";
import { saveLastKit } from "@/lib/last-kit";
import { todayScheduleFocus } from "@/lib/study-day";
import { QuestionBank } from "./QuestionBank";

const QUESTION_CATEGORIES = ["technical", "behavioural", "system-design", "company-fit"] as const;

const REGENERATE_LABELS: Record<string, string> = {
  company: "company brief",
  flashcards: "flashcards",
  schedule: "study schedule",
  technical: "technical questions",
  behavioural: "behavioural questions",
  "system-design": "system design questions",
  "company-fit": "company fit questions",
};

type WeakSpot = {
  key: string;
  label: string;
  status: string;
  averageConfidence: number | null;
};

export function KitWorkspace({
  kitId,
  initial,
  createdAt,
}: {
  kitId: string;
  initial: KitPayload;
  createdAt?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { confirm } = useConfirm();
  const activeTab = parseKitTab(searchParams.get("tab"));

  const [kit, setKit] = useState(initial);
  const [palette, setPalette] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [weak, setWeak] = useState<WeakSpot[]>([]);
  const [practicedIds, setPracticedIds] = useState<Set<string>>(new Set());

  const setTab = useCallback(
    (tab: KitTabId) => {
      router.replace(`/kits/${kitId}?tab=${tab}`, { scroll: false });
      setMobileNav(false);
    },
    [kitId, router],
  );

  useEffect(() => {
    saveLastKit(kitId, `${kit.company_brief.name} · ${kit.role.title}`);
  }, [kitId, kit.company_brief.name, kit.role.title]);

  useEffect(() => {
    api<{
      weakSpots: WeakSpot[];
      records: Array<{ flashcardId: string }>;
    }>(`/kits/${kitId}/practice`)
      .then((p) => {
        setWeak(p.weakSpots || []);
        setPracticedIds(new Set((p.records || []).map((r) => r.flashcardId)));
      })
      .catch(() => undefined);
  }, [kitId]);

  const must = kit.role.requirements.filter((r) => r.priority === "must");
  const uncoveredMust = kit.coverage.uncovered_requirement_ids.filter((id) => must.some((r) => r.id === id));
  const covered = must.length - uncoveredMust.length;
  const coveragePct = must.length ? Math.round((covered / must.length) * 100) : 100;

  const { dayNum, day: todayDay, totalDays } = todayScheduleFocus(kit, createdAt);
  const unpracticedCount = Math.max(0, kit.flashcards.length - practicedIds.size);

  const questionById = useMemo(() => new Map(kit.questions.map((q) => [q.id, q])), [kit.questions]);

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

  async function regenerate(section: string) {
    const label = REGENERATE_LABELS[section] || section;
    const ok = await confirm({
      title: "Regenerate section?",
      message: `Replace the current ${label}? Existing edits may be lost.`,
      confirmLabel: "Regenerate",
    });
    if (!ok) return;

    setBusy(section);
    try {
      const data = await api<{ kit: { kit: KitPayload } }>(`/kits/${kitId}/regenerate/${section}`, {
        method: "POST",
      });
      setKit(data.kit.kit);
      toast.success(`${label.charAt(0).toUpperCase()}${label.slice(1)} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setBusy(null);
    }
  }

  async function regenerateQuestions() {
    const ok = await confirm({
      title: "Regenerate questions?",
      message:
        "Generate new questions to improve coverage of uncovered requirements? Existing question edits may be lost.",
      confirmLabel: "Regenerate",
    });
    if (!ok) return;

    setBusy("questions");
    try {
      let next = kit;
      for (const category of QUESTION_CATEGORIES) {
        const data = await api<{ kit: { kit: KitPayload } }>(`/kits/${kitId}/regenerate/${category}`, {
          method: "POST",
        });
        next = data.kit.kit;
      }
      setKit(next);
      toast.success("Questions regenerated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not regenerate questions");
    } finally {
      setBusy(null);
    }
  }

  function tabBadge(tabId: KitTabId): string | null {
    switch (tabId) {
      case "questions":
        return String(kit.questions.length);
      case "flashcards":
        return String(kit.flashcards.length);
      case "weak":
        return weak.length > 0 ? String(weak.length) : null;
      case "plan":
        return `Day ${dayNum}`;
      case "practice":
        return unpracticedCount > 0 ? String(unpracticedCount) : null;
      default:
        return null;
    }
  }

  const currentTabMeta = KIT_TABS.find((t) => t.id === activeTab)!;

  function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        <div className="px-1">
          <p className="brand-mark">Kit workspace</p>
          <p className="mt-2 truncate text-sm font-semibold text-ink">{kit.company_brief.name}</p>
          <p className="truncate text-xs text-mute">{kit.role.title}</p>
        </div>

        <nav className="mt-6 space-y-1">
          {KIT_TABS.map((item) => {
            const Icon = TAB_ICONS[item.icon];
            const badge = tabBadge(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  onNavigate?.();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  activeTab === item.id ? "nav-link-active" : "nav-link"
                }`}
              >
                {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {badge ? (
                  <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium text-mute">
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="mt-6">
          <div className="rounded-2xl border border-line bg-canvas p-3">
            <p className="text-xs font-medium text-mute">Coverage</p>
            <p className="mt-1 text-sm font-medium">
              {covered}/{must.length} must-haves
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${coveragePct}%` }} />
            </div>
          </div>
        </div>
      </>
    );
  }

  function PanelHeader({ title, action }: { title: string; action?: ReactNode }) {
    return (
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="brand-mark">{currentTabMeta.label}</p>
          <h2 className="section-title mt-1">{title}</h2>
        </div>
        {action}
      </div>
    );
  }

  function renderPanel() {
    switch (activeTab) {
      case "overview":
        return (
          <>
            <PanelHeader title="Overview" />
            <div className="space-y-4">
              <div className="card p-5 sm:p-6">
                <p className="text-xs font-medium uppercase tracking-wide text-mute">Today&apos;s focus</p>
                <p className="mt-2 font-serif text-xl font-semibold">
                  Day {dayNum} of {totalDays}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-mute">{todayDay?.focus ?? "Review your kit"}</p>
                {todayDay?.minutes ? (
                  <p className="mt-2 text-xs text-mute">~{todayDay.minutes} min planned</p>
                ) : null}
              </div>

              <div className="card p-5 sm:p-6">
                <p className="text-xs font-medium uppercase tracking-wide text-mute">Coverage</p>
                <p className="mt-2 text-sm font-medium">
                  {covered}/{must.length} must-have requirements covered
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${coveragePct}%` }} />
                </div>
                <p className="mt-2 text-xs text-mute">{coveragePct}% of must-haves have practice questions</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href={`/kits/${kitId}/practice`} className="btn-primary">
                  Start practice
                </Link>
                <button type="button" className="btn-secondary" onClick={() => setTab("plan")}>
                  View plan
                </button>
                <button type="button" className="btn-secondary" onClick={() => setTab("weak")}>
                  Weak spots
                </button>
              </div>

              {uncoveredMust.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
                  <p className="text-sm font-medium text-amber-900">Coverage gaps</p>
                  <p className="mt-1 text-sm leading-relaxed text-amber-800/90">
                    {uncoveredMust.length} must-have requirement{uncoveredMust.length === 1 ? "" : "s"} still lack
                    questions. Regenerate questions to improve coverage.
                  </p>
                  <button
                    type="button"
                    className="btn-secondary mt-4"
                    onClick={() => regenerateQuestions()}
                    disabled={busy === "questions"}
                  >
                    {busy === "questions" ? "Regenerating…" : "Regenerate questions"}
                  </button>
                </div>
              ) : null}
            </div>
          </>
        );

      case "company":
        return (
          <>
            <PanelHeader
              title="Company brief"
              action={
                <button className="btn-ghost" onClick={() => regenerate("company")} disabled={busy === "company"}>
                  {busy === "company" ? "Regenerating…" : "Regenerate"}
                </button>
              }
            />
            <div className="card p-5 sm:p-6">
              <p className="text-sm leading-relaxed">{kit.company_brief.summary}</p>
              {kit.company_brief.products.length ? (
                <p className="mt-4 text-sm text-mute">Products: {kit.company_brief.products.join(", ")}</p>
              ) : null}
              <p className="mt-4 text-sm">
                <span className="font-medium text-ink">Hiring process: </span>
                <span className="text-mute">{kit.company_brief.hiring_process}</span>
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-mute">
                {kit.company_brief.sources.map((s) => (
                  <li key={s.url}>
                    <a
                      className="text-accent-dark underline underline-offset-2 hover:text-accent"
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </>
        );

      case "role":
        return (
          <>
            <PanelHeader title="Role breakdown" />
            <div className="card p-5 sm:p-6">
              <p className="text-sm text-mute">
                {kit.role.title} · {kit.role.seniority}
              </p>
              <ul className="mt-4 space-y-3">
                {kit.role.requirements.map((r) => {
                  const done = !kit.coverage.uncovered_requirement_ids.includes(r.id);
                  return (
                    <li key={r.id} className="flex gap-3 text-sm">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                          done ? "bg-accent text-white" : "border border-line text-mute"
                        }`}
                      >
                        {done ? "✓" : ""}
                      </span>
                      <span className="leading-relaxed">
                        <span className="font-mono text-[10px] text-mute">{r.id}</span> {r.text}{" "}
                        <span className="text-mute">· {r.priority}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        );

      case "questions":
        return (
          <>
            <PanelHeader title="Question bank" />
            <QuestionBank kitId={kitId} kit={kit} onKit={setKit} />
          </>
        );

      case "flashcards":
        return (
          <>
            <PanelHeader
              title="Flashcards"
              action={
                <button
                  className="btn-ghost"
                  onClick={() => regenerate("flashcards")}
                  disabled={busy === "flashcards"}
                >
                  {busy === "flashcards" ? "Regenerating…" : "Regenerate"}
                </button>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {kit.flashcards.map((card) => (
                <div key={card.id} className="card p-5 transition hover:shadow-soft">
                  <p className="text-sm font-medium leading-relaxed">{card.front}</p>
                  <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-mute">{card.back}</p>
                </div>
              ))}
            </div>
          </>
        );

      case "plan":
        return (
          <>
            <PanelHeader
              title="Study schedule"
              action={
                <button
                  className="btn-ghost"
                  onClick={() => regenerate("schedule")}
                  disabled={busy === "schedule"}
                >
                  {busy === "schedule" ? "Regenerating…" : "Regenerate"}
                </button>
              }
            />
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-line bg-canvas text-xs font-medium uppercase tracking-wide text-mute">
                    <tr>
                      <th className="px-4 py-3 sm:px-5">Day</th>
                      <th className="px-4 py-3 sm:px-5">Focus</th>
                      <th className="hidden px-4 py-3 md:table-cell sm:px-5">Questions</th>
                      <th className="px-4 py-3 sm:px-5">Min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kit.schedule.days.map((scheduleDay) => (
                      <tr
                        key={scheduleDay.day}
                        className="cursor-pointer border-b border-line transition last:border-0 hover:bg-canvas"
                        onClick={() => setTab("questions")}
                      >
                        <td className="px-4 py-3 font-mono text-xs sm:px-5">{scheduleDay.day}</td>
                        <td className="px-4 py-3 sm:px-5">{scheduleDay.focus}</td>
                        <td className="hidden max-w-xs truncate px-4 py-3 text-mute md:table-cell sm:px-5">
                          {scheduleDay.question_ids
                            .map((id) => questionById.get(id)?.prompt.slice(0, 48) || id)
                            .join(" · ")}
                        </td>
                        <td className="px-4 py-3 sm:px-5">{scheduleDay.minutes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );

      case "weak":
        return (
          <>
            <PanelHeader title="Weak spots" />
            {weak.length === 0 ? (
              <div className="card p-5 sm:p-6">
                <p className="text-sm leading-relaxed text-mute">
                  Practice flashcards to populate this report. Low-confidence cards are scheduled first in the next
                  session.
                </p>
                <Link href={`/kits/${kitId}/practice`} className="btn-primary mt-4 inline-flex">
                  Start practicing
                </Link>
              </div>
            ) : (
              <>
                <ul className="card divide-y divide-line overflow-hidden">
                  {weak.slice(0, 10).map((spot) => (
                    <li key={spot.key} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between sm:px-5">
                      <span className="text-sm font-medium">{spot.label}</span>
                      <span className="text-sm text-mute">
                        {spot.status}
                        {spot.averageConfidence != null ? ` · ${spot.averageConfidence.toFixed(1)}/5` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link href={`/kits/${kitId}/practice`} className="btn-primary mt-4 inline-flex">
                  Open practice mode
                </Link>
              </>
            )}
          </>
        );

      case "practice":
        return (
          <>
            <PanelHeader title="Practice mode" />
            <div className="card p-6 sm:p-8">
              <p className="text-sm leading-relaxed text-mute">
                Review flashcards one at a time, rate your confidence from 1–5, and build a weak-spots report. Cards you
                rate low appear first in your next session.
              </p>
              <dl className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-canvas p-4">
                  <dt className="text-xs text-mute">Flashcards</dt>
                  <dd className="mt-1 font-serif text-2xl font-semibold">{kit.flashcards.length}</dd>
                </div>
                <div className="rounded-2xl bg-canvas p-4">
                  <dt className="text-xs text-mute">Weak spots tracked</dt>
                  <dd className="mt-1 font-serif text-2xl font-semibold">{weak.length}</dd>
                </div>
                <div className="rounded-2xl bg-canvas p-4">
                  <dt className="text-xs text-mute">Unpracticed</dt>
                  <dd className="mt-1 font-serif text-2xl font-semibold">{unpracticedCount}</dd>
                </div>
              </dl>
              <Link href={`/kits/${kitId}/practice`} className="btn-primary mt-8 inline-flex">
                Start practice session
              </Link>
            </div>
          </>
        );

      default:
        return null;
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-panel/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <button type="button" className="btn-secondary px-4 py-2 text-xs" onClick={() => setMobileNav(true)}>
            Sections
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{kit.company_brief.name}</p>
            <p className="truncate text-xs text-mute">{currentTabMeta.label}</p>
          </div>
          {activeTab === "practice" || activeTab === "weak" ? (
            <Link href={`/kits/${kitId}/practice`} className="btn-primary px-4 py-2 text-xs">
              Practice
            </Link>
          ) : (
            <span className="w-16" />
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {KIT_TABS.map((item) => {
            const badge = tabBadge(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  activeTab === item.id ? "bg-accent text-white" : "bg-canvas text-mute"
                }`}
              >
                {item.label}
                {badge ? <span className="opacity-80">· {badge}</span> : null}
              </button>
            );
          })}
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[220px_1fr]">
        <aside className="hidden border-r border-line lg:block">
          <div className="sticky top-0 max-h-dvh overflow-y-auto p-4">
            <SidebarNav />
          </div>
        </aside>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <header className="mb-6 hidden lg:block">
            <h1 className="page-title">
              {kit.company_brief.name} · {kit.role.title}
            </h1>
            <p className="mt-2 text-sm text-mute">
              {kit.role.seniority} · {kit.schedule.days_available}-day study plan · {coveragePct}% coverage
            </p>
          </header>
          {renderPanel()}
        </main>
      </div>

      {mobileNav ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[min(280px,88vw)] flex-col bg-panel shadow-soft">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-semibold">Kit sections</p>
              <button type="button" className="btn-ghost" onClick={() => setMobileNav(false)}>
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <SidebarNav onNavigate={() => setMobileNav(false)} />
            </div>
          </aside>
        </div>
      ) : null}

      {palette ? (
        <div className="fixed inset-0 z-50 bg-ink/30 p-4 backdrop-blur-sm" onClick={() => setPalette(false)}>
          <div className="card mx-auto mt-16 max-w-md overflow-hidden p-2" onClick={(e) => e.stopPropagation()}>
            <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-mute">Jump to section</p>
            {KIT_TABS.map((item) => {
              const Icon = TAB_ICONS[item.icon];
              const badge = tabBadge(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-canvas"
                  onClick={() => {
                    setTab(item.id);
                    setPalette(false);
                  }}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0 text-mute" /> : null}
                  <span className="flex-1">{item.label}</span>
                  {badge ? <span className="text-xs text-mute">{badge}</span> : null}
                </button>
              );
            })}
            <Link
              href="/"
              className="block rounded-xl px-3 py-2.5 text-sm text-mute transition hover:bg-canvas"
              onClick={() => setPalette(false)}
            >
              All kits
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
