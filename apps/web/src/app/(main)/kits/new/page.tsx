"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError, api, type KitRecord } from "@/lib/api";

export default function NewKitPage() {
  const router = useRouter();
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/auth/me").catch((err) => {
      if (err instanceof ApiError && err.status === 401) router.replace("/login");
    });
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api<{ kit: KitRecord }>("/kits", {
        method: "POST",
        body: JSON.stringify({ jd, company_url: companyUrl, days }),
      });
      router.push(`/kits/${data.kit.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start generation");
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
          Paste the posting. We research the company site, extract requirements, then generate questions in separate
          passes. Coverage and scheduling are computed in code.
        </p>

        <form onSubmit={onSubmit} className="card mt-8 flex flex-col gap-6 p-5 sm:p-8">
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
      </div>
    </div>
  );
}
