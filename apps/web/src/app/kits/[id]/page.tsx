"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApiError, api, type KitRecord } from "@/lib/api";
import { useGenerationTracker } from "@/components/GenerationTracker";
import { KitWorkspace } from "@/components/KitWorkspace";
import { ProgressList } from "@/components/ProgressList";

function KitPageContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { track, dismiss } = useGenerationTracker();
  const [record, setRecord] = useState<KitRecord | null>(null);
  const [error, setError] = useState("");
  const statusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    async function load() {
      try {
        const data = await api<{ kit: KitRecord }>(`/kits/${params.id}`);
        setRecord(data.kit);
        statusRef.current = data.kit.status;
        if (data.kit.status === "generating" || data.kit.status === "queued") {
          timer = setInterval(async () => {
            const next = await api<{ kit: KitRecord }>(`/kits/${params.id}`);
            setRecord(next.kit);
            statusRef.current = next.kit.status;
            if (next.kit.status === "completed" || next.kit.status === "failed") {
              if (timer) clearInterval(timer);
            }
          }, 1500);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.replace("/login");
        else setError(err instanceof Error ? err.message : "Failed to load kit");
      }
    }
    load();
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [params.id, router]);

  useEffect(() => {
    const generating = record?.status === "generating" || record?.status === "queued";
    if (!generating) return;
    return () => {
      const status = statusRef.current;
      if (status === "generating" || status === "queued") {
        track(params.id);
      }
    };
  }, [params.id, record?.status, track]);

  useEffect(() => {
    if (record?.status === "completed" && record.kit) {
      dismiss(params.id);
    }
  }, [record?.status, record?.kit, params.id, dismiss]);

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="card max-w-md p-8 text-center">
          <p className="text-sm text-danger">{error}</p>
          <Link href="/" className="btn-secondary mt-4 inline-flex">
            Back to kits
          </Link>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <p className="text-sm text-mute">Loading kit…</p>
      </div>
    );
  }

  if (record.status === "generating" || record.status === "queued") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-8 sm:px-8">
        <ProgressList generation={record.generation} />
        <p className="mt-6 max-w-md text-center text-sm text-mute">
          You can leave this page — generation continues in the background. Use the widget in the bottom-right to check
          progress.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary">
            Continue browsing
          </Link>
          <Link href="/kits/new" className="btn-secondary">
            Create another kit
          </Link>
        </div>
      </div>
    );
  }

  if (record.status === "failed" || !record.kit) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="card max-w-lg p-8 sm:p-10">
          <h1 className="section-title">Generation failed</h1>
          <p className="mt-3 text-sm leading-relaxed text-danger">
            {record.error?.message || "The pipeline could not produce a kit."}
          </p>
          <Link href="/kits/new" className="btn-primary mt-6 inline-flex">
            Try again
          </Link>
        </div>
      </div>
    );
  }

  return <KitWorkspace kitId={record.id} initial={record.kit} createdAt={record.createdAt} />;
}

export default function KitPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center px-6">
          <p className="text-sm text-mute">Loading kit…</p>
        </div>
      }
    >
      <KitPageContent />
    </Suspense>
  );
}
