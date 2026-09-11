import { GENERATION_STEPS, type GenerationProgress, type GenerationStepId, type KitError } from "./types.js";

export function initialProgress(): GenerationProgress {
  return {
    status: "queued",
    currentStep: null,
    steps: GENERATION_STEPS.map((s) => ({
      id: s.id,
      label: s.label,
      state: "pending",
    })),
  };
}

export function markStep(
  progress: GenerationProgress,
  stepId: GenerationStepId,
  state: "active" | "done" | "error" | "skipped",
  message?: string,
): GenerationProgress {
  const steps = progress.steps.map((s) => {
    if (s.id !== stepId) return s;
    return { ...s, state };
  });
  return {
    ...progress,
    status: state === "error" ? "failed" : "generating",
    currentStep: state === "active" ? stepId : progress.currentStep,
    steps,
    message,
  };
}

export function completeProgress(progress: GenerationProgress): GenerationProgress {
  return {
    ...progress,
    status: "completed",
    currentStep: null,
    completedAt: new Date().toISOString(),
    steps: progress.steps.map((s) =>
      s.state === "pending" ? { ...s, state: "done" } : s,
    ),
  };
}

export function failProgress(progress: GenerationProgress, error: KitError): GenerationProgress {
  return {
    ...progress,
    status: "failed",
    error,
    completedAt: new Date().toISOString(),
    steps: progress.steps.map((s) =>
      s.state === "active" ? { ...s, state: "error" } : s,
    ),
  };
}
