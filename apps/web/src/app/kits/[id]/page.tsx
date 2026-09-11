"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError, api, type KitRecord } from "@/lib/api";
import { KitWorkspace } from "@/components/KitWorkspace";
import { ProgressList } from "@/components/ProgressList";

export default function KitPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<KitRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    async function load() {
      try {
        const data = await api<{ kit: KitRecord }>(`/kits/${params.id}`);
        setRecord(data.kit);
        if (data.kit.status === "generating" || data.kit.status === "queued") {
          timer = setInterval(async () => {
            const next = await api<{ kit: KitRecord }>(`/kits/${params.id}`);
            setRecord(next.kit);
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

  if (error) return <p className="p-8 text-danger">{error}</p>;
  if (!record) return <p className="p-8 text-mute">Loading kit…</p>;
  if (record.status === "generating" || record.status === "queued") {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <ProgressList generation={record.generation} />
      </div>
    );
  }
  if (record.status === "failed" || !record.kit) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <h1 className="text-2xl font-semibold">Generation failed</h1>
        <p className="mt-3 text-sm text-danger">{record.error?.message || "The pipeline could not produce a kit."}</p>
      </div>
    );
  }
  return <KitWorkspace kitId={record.id} initial={record.kit} />;
}
