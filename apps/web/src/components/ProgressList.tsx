"use client";

import type { Generation } from "@/lib/api";

export function generationProgress(generation?: Generation | null) {
  const steps = generation?.steps ?? [];
  const done = steps.filter((s) => s.state === "done").length;
  const total = steps.length || 1;
  return Math.round((done / total) * 100);
}

export function ProgressList({
  generation,
  compact = false,
}: {
  generation?: Generation | null;
  compact?: boolean;
}) {
  const steps = generation?.steps ?? [];
  const pct = generationProgress(generation);

  if (compact) {
    return (
      <div>
        <div className="mb-2 flex justify-between text-xs font-medium text-mute">
          <span>Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <ol className="mt-4 space-y-2">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center gap-2 text-xs">
              <StepIcon state={step.state} small />
              <span className={step.state === "pending" ? "text-mute" : "text-ink"}>{step.label}</span>
            </li>
          ))}
        </ol>
        {generation?.error ? <p className="mt-3 text-xs text-danger">{generation.error.message}</p> : null}
      </div>
    );
  }

  return (
    <div className="card mx-auto flex w-full max-w-xl flex-col p-8 sm:p-10">
      <p className="brand-mark">Generating</p>
      <h2 className="section-title mt-2">Building your preparation kit</h2>
      <p className="mt-2 text-sm leading-relaxed text-mute">
        Research, extraction, and question categories run as separate steps. Coverage and scheduling are computed in
        code.
      </p>

      <div className="mt-8">
        <div className="mb-2 flex justify-between text-xs font-medium text-mute">
          <span>Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ol className="mt-8 space-y-3">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-3 text-sm">
            <StepIcon state={step.state} />
            <span className={step.state === "pending" ? "text-mute" : "text-ink"}>{step.label}</span>
          </li>
        ))}
      </ol>

      {generation?.error ? <p className="mt-6 text-sm text-danger">{generation.error.message}</p> : null}
    </div>
  );
}

function StepIcon({ state, small }: { state: string; small?: boolean }) {
  const size = small ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-xs";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-medium ${size} ${
        state === "done"
          ? "bg-accent text-white"
          : state === "active"
            ? "bg-accent-light text-accent-dark ring-2 ring-accent/30"
            : state === "error"
              ? "bg-red-50 text-danger"
              : "bg-canvas text-mute"
      }`}
    >
      {state === "done" ? "✓" : state === "active" ? "●" : state === "error" ? "!" : "○"}
    </span>
  );
}
