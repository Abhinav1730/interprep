"use client";

import { ConfirmProvider } from "@/components/ConfirmDialog";
import { GenerationTrackerProvider } from "@/components/GenerationTracker";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/lib/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <GenerationTrackerProvider>{children}</GenerationTrackerProvider>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
