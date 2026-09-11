"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, type KitRecord } from "@/lib/api";
import { ProgressList, generationProgress } from "@/components/ProgressList";

type TrackedKit = {
  id: string;
  status: string;
  generation: KitRecord["generation"];
  error?: KitRecord["error"];
  label: string;
};

type GenerationTrackerContextValue = {
  track: (kitId: string, label?: string) => void;
  dismiss: (kitId: string) => void;
  tracked: TrackedKit[];
};

const GenerationTrackerContext = createContext<GenerationTrackerContextValue | null>(null);

export function useGenerationTracker() {
  const ctx = useContext(GenerationTrackerContext);
  if (!ctx) throw new Error("useGenerationTracker must be used within GenerationTrackerProvider");
  return ctx;
}

function kitLabel(record: KitRecord) {
  const company = record.kit?.company_brief?.name;
  const title = record.kit?.role?.title;
  if (company && title) return `${company} · ${title}`;
  if (company) return company;
  return "Interview kit";
}

function notifyReady(label: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification("Interview kit ready", { body: label, icon: "/auth-bg.png" });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((p) => {
      if (p === "granted") new Notification("Interview kit ready", { body: label });
    });
  }
}

export function GenerationTrackerProvider({ children }: { children: ReactNode }) {
  const [tracked, setTracked] = useState<Record<string, TrackedKit>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const trackedRef = useRef(tracked);
  const prevStatusRef = useRef<Record<string, string>>({});
  trackedRef.current = tracked;

  const track = useCallback((kitId: string, label?: string) => {
    setTracked((prev) => {
      if (prev[kitId]) return prev;
      return {
        ...prev,
        [kitId]: {
          id: kitId,
          status: "queued",
          generation: { status: "queued", currentStep: null, steps: [] },
          label: label ?? "Interview kit",
        },
      };
    });
  }, []);

  const dismiss = useCallback((kitId: string) => {
    setTracked((prev) => {
      const next = { ...prev };
      delete next[kitId];
      return next;
    });
    setExpandedId((prev) => (prev === kitId ? null : prev));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const ids = Object.keys(trackedRef.current);
      if (ids.length === 0) return;
      for (const id of ids) {
        try {
          const data = await api<{ kit: KitRecord }>(`/kits/${id}`);
          if (cancelled) return;
          const record = data.kit;
          const prev = prevStatusRef.current[id];
          if (record.status === "completed" && prev && prev !== "completed") {
            notifyReady(kitLabel(record));
          }
          prevStatusRef.current[id] = record.status;
          setTracked((prev) => ({
            ...prev,
            [id]: {
              id,
              status: record.status,
              generation: record.generation,
              error: record.error ?? undefined,
              label: kitLabel(record),
            },
          }));
        } catch {
          /* keep last known state */
        }
      }
    }

    poll();
    const timer = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const active = useMemo(() => Object.values(tracked), [tracked]);
  const pathname = usePathname();
  const generating = active.filter((k) => k.status === "generating" || k.status === "queued");
  const visible = active.filter((k) => !(pathname === `/kits/${k.id}` && (k.status === "generating" || k.status === "queued")));
  const primary = visible[0] ?? active[0];

  const value = useMemo(() => ({ track, dismiss, tracked: active }), [track, dismiss, active]);

  if (!primary || visible.length === 0) {
    return <GenerationTrackerContext.Provider value={value}>{children}</GenerationTrackerContext.Provider>;
  }

  return (
    <GenerationTrackerContext.Provider value={value}>
      {children}
      <GenerationWidgetStack
        kits={visible}
        allCount={active.length}
        generatingCount={generating.length}
        expandedId={expandedId}
        onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))}
        onDismiss={dismiss}
      />
    </GenerationTrackerContext.Provider>
  );
}

function GenerationWidgetStack({
  kits,
  allCount,
  generatingCount,
  expandedId,
  onToggle,
  onDismiss,
}: {
  kits: TrackedKit[];
  allCount: number;
  generatingCount: number;
  expandedId: string | null;
  onToggle: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const router = useRouter();
  const primary = kits[0];
  const expanded = kits.find((k) => k.id === expandedId) ?? primary;
  const isGenerating = expanded.status === "generating" || expanded.status === "queued";
  const isComplete = expanded.status === "completed";
  const isFailed = expanded.status === "failed";
  const pct = generationProgress(expanded.generation);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-[min(calc(100vw-2rem),400px)] flex-col items-end gap-3 sm:bottom-6">
      {expandedId ? (
        <div className="card w-full overflow-hidden shadow-soft">
          {kits.length > 1 ? (
            <div className="flex gap-1 overflow-x-auto border-b border-line px-2 py-2">
              {kits.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => onToggle(k.id)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                    k.id === expanded.id ? "bg-accent text-white" : "bg-canvas text-mute"
                  }`}
                >
                  {k.label.slice(0, 24)}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{expanded.label}</p>
              <p className="text-xs text-mute">
                {isComplete ? "Ready to open" : isFailed ? "Generation failed" : "Building kit…"}
              </p>
            </div>
            <button type="button" className="btn-ghost shrink-0" onClick={() => onToggle(expanded.id)}>
              Minimize
            </button>
          </div>
          <div className="max-h-[min(50vh,380px)] overflow-y-auto p-4">
            {isFailed ? (
              <p className="text-sm text-danger">{expanded.error?.message || "The pipeline could not produce a kit."}</p>
            ) : (
              <ProgressList generation={expanded.generation} compact />
            )}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
            {isComplete ? (
              <button
                type="button"
                className="btn-primary flex-1 py-2 text-xs"
                onClick={() => {
                  onDismiss(expanded.id);
                  router.push(`/kits/${expanded.id}?tab=overview`);
                }}
              >
                Open kit
              </button>
            ) : isGenerating ? (
              <button type="button" className="btn-secondary flex-1 py-2 text-xs" onClick={() => router.push(`/kits/${expanded.id}`)}>
                View progress
              </button>
            ) : null}
            {!isGenerating ? (
              <button type="button" className="btn-ghost py-2 text-xs" onClick={() => onDismiss(expanded.id)}>
                Dismiss
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          if (primary.status === "completed") {
            onDismiss(primary.id);
            router.push(`/kits/${primary.id}?tab=overview`);
          } else {
            onToggle(primary.id);
          }
        }}
        className="card flex w-full items-center gap-3 px-4 py-3 shadow-soft transition hover:shadow-md sm:w-auto"
      >
        <span
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            primary.status === "completed"
              ? "bg-accent text-white"
              : primary.status === "failed"
                ? "bg-red-50 text-danger"
                : "bg-accent-light text-accent-dark"
          }`}
        >
          {primary.status === "completed" ? "✓" : primary.status === "failed" ? "!" : `${pct}%`}
          {primary.status === "generating" || primary.status === "queued" ? (
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
          ) : null}
        </span>
        <span className="min-w-0 text-left">
          <span className="block truncate text-sm font-medium">
            {primary.status === "completed"
              ? "Kit ready"
              : primary.status === "failed"
                ? "Kit failed"
                : generatingCount > 1
                  ? `${generatingCount} kits building`
                  : "Generating kit"}
          </span>
          <span className="block truncate text-xs text-mute">
            {allCount > 1 ? `${allCount} tracked · ` : ""}
            {primary.status === "completed" ? "Tap to open" : primary.label}
          </span>
        </span>
      </button>
    </div>
  );
}
