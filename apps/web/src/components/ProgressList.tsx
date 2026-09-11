"use client";

import type { Generation } from "@/lib/api";

export function ProgressList({ generation }: { generation?: Generation | null }) {
  const steps = generation?.steps ?? [];
  return (
    <div className="rounded-2xl border border-line bg-panel p-6 shadow-soft">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Generating</p>
      <h2 className="mt-2 text-xl font-semibold">Building your preparation kit</h2>
      <p className="mt-1 text-sm text-mute">
        Research, extraction, and question categories run as separate steps. Coverage and scheduling are computed in code.
      </p>
      <ol className="mt-6 space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-3 text-sm">
            <span
              className={
                step.state === "done"
                  ? "text-accent"
                  : step.state === "active"
                    ? "text-warn"
                    : step.state === "error"
                      ? "text-danger"
                      : "text-mute"
              }
            >
              {step.state === "done" ? "✓" : step.state === "active" ? "●" : step.state === "error" ? "!" : "○"}
            </span>
            <span className={step.state === "pending" ? "text-mute" : ""}>{step.label}</span>
          </li>
        ))}
      </ol>
      {generation?.error ? (
        <p className="mt-4 text-sm text-danger">{generation.error.message}</p>
      ) : null}
    </div>
  );
}
