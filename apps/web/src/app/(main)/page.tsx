"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { KitCardSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { PLATFORM } from "@/lib/platform";
import { loadLastKit } from "@/lib/last-kit";
import { kitStatusClass, kitStatusLabel } from "@/lib/kit-status";
import { api, type KitSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type KitCardMeta = {
  practiced?: number;
  totalFlashcards?: number;
  todayFocus?: string;
};

export default function DashboardPage() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const { user, kits, setKits } = useAuth();
  const [meta, setMeta] = useState<Record<string, KitCardMeta>>({});
  const [lastKit, setLastKit] = useState<{ id: string; label: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || kits === null) return;
    const saved = loadLastKit(user.id);
    if (saved && kits.some((k) => k.id === saved.id)) {
      setLastKit(saved);
    } else {
      setLastKit(null);
    }
  }, [user?.id, kits]);

  useEffect(() => {
    if (!kits?.length) return;
    api<{ meta: Record<string, KitCardMeta> }>("/kits/card-meta")
      .then((data) => setMeta(data.meta))
      .catch(() => {
        // card extras are optional; dashboard still works without them
      });
  }, [kits]);

  async function deleteKit(e: React.MouseEvent, kit: KitSummary) {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete kit?",
      message: `Remove "${kit.company || "Company"} · ${kit.title || "Role"}" permanently?`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setDeletingId(kit.id);
    try {
      await api(`/kits/${kit.id}`, { method: "DELETE" });
      setKits(kits?.filter((k) => k.id !== kit.id) ?? []);
      setMeta((prev) => {
        const next = { ...prev };
        delete next[kit.id];
        return next;
      });
      toast.success("Kit deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete kit");
    } finally {
      setDeletingId(null);
    }
  }

  const email = user?.email ?? "";
  const completed = kits?.filter((k) => k.status === "completed").length ?? 0;

  return (
    <div className="px-5 py-6 sm:px-8 lg:py-8">
      <div className="mx-auto max-w-content">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="brand-mark">Dashboard</p>
            <h1 className="page-title mt-1 text-2xl sm:text-3xl">
              Welcome back{email ? `, ${email.split("@")[0]}` : ""}
            </h1>
            <p className="mt-2 text-sm text-mute">Build, edit, and practice interview kits tailored to each role.</p>
          </div>
          <Link href="/kits/new" className="btn-primary hidden sm:inline-flex">
            New kit
          </Link>
        </div>

        {lastKit ? (
          <Link
            href={`/kits/${lastKit.id}?tab=overview`}
            className="card mt-6 flex items-center justify-between gap-4 p-4 transition hover:border-accent/30 hover:shadow-soft"
          >
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-accent-dark">Continue where you left off</p>
              <p className="mt-1 font-medium">{lastKit.label}</p>
            </div>
            <span className="btn-secondary shrink-0 px-4 py-2 text-xs">Open kit</span>
          </Link>
        ) : null}

        {kits === null ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <KitCardSkeleton />
            <KitCardSkeleton />
            <KitCardSkeleton />
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-mute">Total kits</p>
              <p className="mt-1 font-serif text-3xl font-semibold">{kits.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-mute">Ready to study</p>
              <p className="mt-1 font-serif text-3xl font-semibold">{completed}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-mute">In progress</p>
              <p className="mt-1 font-serif text-3xl font-semibold">{kits.length - completed}</p>
            </div>
          </div>
        )}

        <section className="mt-10">
          <h2 className="section-title">Everything Interprep covers</h2>
          <p className="mt-2 max-w-2xl text-sm text-mute">
            Every kit you generate includes all of these — open a kit to use them.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PLATFORM.map((item) => (
              <div key={item.label} className="card p-4">
                <p className="text-sm font-semibold text-ink">{item.label}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-mute">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="section-title">Your interview kits</h2>
            <Link href="/kits/new" className="btn-primary inline-flex sm:hidden">
              New kit
            </Link>
          </div>

          {kits === null ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <KitCardSkeleton />
              <KitCardSkeleton />
              <KitCardSkeleton />
            </ul>
          ) : kits.length === 0 ? (
            <div className="card flex flex-col items-center p-8 text-center sm:p-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-light">
                <span className="font-serif text-2xl font-semibold text-accent-dark">1</span>
              </div>
              <h3 className="section-title mt-6">Start your first prep kit</h3>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-mute">
                Paste a job description and company URL. We&apos;ll research the role, build questions, flashcards, and
                a day-by-day study plan.
              </p>
              <Link href="/kits/new" className="btn-primary mt-8">
                Create your first kit
              </Link>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {kits.map((kit) => {
                const m = meta[kit.id];
                const practicePct =
                  m?.totalFlashcards && m.practiced != null
                    ? Math.round((m.practiced / m.totalFlashcards) * 100)
                    : null;
                return (
                  <li key={kit.id} className="group relative">
                    <Link
                      href={`/kits/${kit.id}${kit.status === "completed" ? "?tab=overview" : ""}`}
                      className="card flex h-full flex-col p-5 transition hover:border-accent/30 hover:shadow-soft"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 pr-8">
                          <p className="truncate font-medium text-ink group-hover:text-accent-dark">
                            {kit.company || "Company"}
                          </p>
                          <p className="mt-0.5 truncate text-sm text-mute">{kit.title || "Role"}</p>
                        </div>
                        <span className={`status-badge shrink-0 ${kitStatusClass(kit.status)}`}>
                          {(kit.status === "generating" || kit.status === "queued") && (
                            <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                          )}
                          {kitStatusLabel(kit.status)}
                        </span>
                      </div>

                      {kit.status === "completed" && m?.todayFocus ? (
                        <p className="mt-3 rounded-xl bg-accent-light/60 px-3 py-2 text-xs text-accent-dark">
                          <span className="font-medium">Today:</span> {m.todayFocus}
                        </p>
                      ) : null}

                      <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-xs text-mute">
                        <span>
                          {kit.days} day{kit.days === 1 ? "" : "s"} to interview
                          {practicePct != null ? ` · ${practicePct}% practiced` : ""}
                        </span>
                        <span className="hidden sm:inline">{new Date(kit.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </Link>
                    <button
                      type="button"
                      aria-label="Delete kit"
                      disabled={deletingId === kit.id}
                      onClick={(e) => deleteKit(e, kit)}
                      className="absolute right-3 top-3 rounded-full p-1.5 text-mute opacity-0 transition hover:bg-red-50 hover:text-danger group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
