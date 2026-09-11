"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { ApiError, api, type KitRecord } from "@/lib/api";

type BatchCase = {
  id?: string;
  jd: string;
  company_url: string;
  days: number;
};

export default function NewKitPage() {
  const router = useRouter();
  const { confirm } = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"single" | "batch">("single");
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [batchCases, setBatchCases] = useState<BatchCase[]>([]);
  const [batchProgress, setBatchProgress] = useState("");

  useEffect(() => {
    api("/auth/me").catch((err) => {
      if (err instanceof ApiError && err.status === 401) router.replace("/login");
    });
  }, [router]);

  async function createKit(payload: { jd: string; company_url: string; days: number }, force = false) {
    const data = await api<{ kit: KitRecord; reused?: boolean }>("/kits", {
      method: "POST",
      body: JSON.stringify({ ...payload, force }),
    });
    if (data.reused && !force) {
      const ok = await confirm({
        title: "Kit already exists",
        message:
          "You already generated a kit for this job description and company URL. Regenerate from scratch? Choose Cancel to open the existing kit.",
        confirmLabel: "Regenerate",
      });
      if (ok) {
        const forced = await api<{ kit: KitRecord }>("/kits", {
          method: "POST",
          body: JSON.stringify({ ...payload, force: true }),
        });
        return forced.kit;
      }
    }
    return data.kit;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const kit = await createKit({ jd, company_url: companyUrl, days });
      router.push(`/kits/${kit.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start generation");
    } finally {
      setBusy(false);
    }
  }

  async function onBatchFile(file: File) {
    setError("");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) {
        setError("Batch file must be a JSON array of cases.");
        return;
      }
      const cases: BatchCase[] = parsed.map((item, i) => {
        const row = item as Partial<BatchCase>;
        return {
          id: row.id || `case-${i + 1}`,
          jd: String(row.jd || ""),
          company_url: String(row.company_url || ""),
          days: Number(row.days) || 5,
        };
      });
      const invalid = cases.find((c) => !c.jd || !c.company_url || c.days < 1);
      if (invalid) {
        setError("Each case needs jd, company_url, and a positive days value.");
        return;
      }
      setBatchCases(cases);
      setBatchProgress("");
    } catch {
      setError("Could not parse batch file. Use a JSON array of { jd, company_url, days } objects.");
    }
  }

  async function runBatch() {
    if (batchCases.length === 0) return;
    setBusy(true);
    setError("");
    let created: string[] = [];
    try {
      for (let i = 0; i < batchCases.length; i++) {
        const caseItem = batchCases[i]!;
        setBatchProgress(`Creating kit ${i + 1} of ${batchCases.length}…`);
        const kit = await createKit({
          jd: caseItem.jd,
          company_url: caseItem.company_url,
          days: caseItem.days,
        });
        created.push(kit.id);
      }
      setBatchProgress(`Started ${created.length} kits.`);
      router.push(`/kits/${created[created.length - 1]}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch creation failed");
      if (created.length > 0) {
        setBatchProgress(`${created.length} kit(s) were started before the failure.`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-5 py-6 sm:px-8 lg:py-8">
      <div className="mx-auto max-w-content">
        <p className="brand-mark">New kit</p>
        <h1 className="page-title mt-1 text-2xl sm:text-3xl">Generate an interview prep kit</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
          Paste one posting, or upload a JSON file with multiple description-and-company pairs. We research each
          company site, extract requirements, then generate questions in separate passes.
        </p>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            className={mode === "single" ? "btn-primary px-4 py-2 text-xs" : "btn-secondary px-4 py-2 text-xs"}
            onClick={() => setMode("single")}
          >
            Single role
          </button>
          <button
            type="button"
            className={mode === "batch" ? "btn-primary px-4 py-2 text-xs" : "btn-secondary px-4 py-2 text-xs"}
            onClick={() => setMode("batch")}
          >
            Batch upload
          </button>
        </div>

        {mode === "single" ? (
          <form onSubmit={onSubmit} className="card mt-6 flex flex-col gap-6 p-5 sm:p-8">
            <label className="flex flex-col text-sm font-medium text-ink">
              Job description
              <textarea
                required
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                className="input-field mt-1.5 min-h-[32vh] resize-y p-4 leading-relaxed sm:min-h-[36vh]"
                placeholder="Paste the full job description. Do not paste a LinkedIn URL — paste the text."
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-[1fr_160px]">
              <label className="block text-sm font-medium text-ink">
                Company website
                <input
                  required
                  value={companyUrl}
                  onChange={(e) => setCompanyUrl(e.target.value)}
                  className="input-field mt-1.5"
                  placeholder="https://company.com"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                Days until interview
                <input
                  type="number"
                  min={1}
                  max={120}
                  required
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="input-field mt-1.5"
                />
              </label>
            </div>

            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <button disabled={busy} className="btn-primary w-fit">
              {busy ? "Starting…" : "Generate interview kit"}
            </button>
          </form>
        ) : (
          <div className="card mt-6 flex flex-col gap-6 p-5 sm:p-8">
            <div>
              <p className="text-sm font-medium text-ink">Upload cases JSON</p>
              <p className="mt-1 text-sm text-mute">
                Array of objects with <code className="text-xs">jd</code>,{" "}
                <code className="text-xs">company_url</code>, and <code className="text-xs">days</code>. Same format
                as <code className="text-xs">samples/cases.example.json</code>.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="mt-3 block w-full text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onBatchFile(file);
                }}
              />
            </div>

            {batchCases.length > 0 ? (
              <div className="rounded-2xl border border-line bg-canvas p-4">
                <p className="text-sm font-medium">{batchCases.length} cases loaded</p>
                <ul className="mt-3 space-y-2 text-sm text-mute">
                  {batchCases.map((caseItem) => (
                    <li key={caseItem.id}>
                      <span className="font-mono text-xs">{caseItem.id}</span> · {caseItem.days} days ·{" "}
                      {caseItem.jd.slice(0, 72)}
                      {caseItem.jd.length > 72 ? "…" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {batchProgress ? <p className="text-sm text-mute">{batchProgress}</p> : null}
            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <button
              type="button"
              disabled={busy || batchCases.length === 0}
              className="btn-primary w-fit"
              onClick={() => void runBatch()}
            >
              {busy ? "Creating kits…" : `Generate ${batchCases.length || ""} kits`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
