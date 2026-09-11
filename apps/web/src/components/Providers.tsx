"use client";

import { ConfirmProvider } from "@/components/ConfirmDialog";
import { GenerationTrackerProvider } from "@/components/GenerationTracker";
import { ToastProvider } from "@/components/Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <GenerationTrackerProvider>{children}</GenerationTrackerProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
