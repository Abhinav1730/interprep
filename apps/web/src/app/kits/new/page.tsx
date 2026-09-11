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
    <div className="mx-auto max-w-3xl px-5 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">New kit</p>
      <h1 className="mt-2 text-3xl font-semibold">Generate an interview prep kit</h1>
      <p className="mt-2 text-sm text-mute">
        Paste the posting. We research the company site, extract requirements, then generate questions in separate passes.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <label className="block text-sm">
          Job description
          <textarea
            required
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            rows={12}
            className="mt-1 w-full rounded-xl border border-line bg-panel p-3"
            placeholder="Paste the full job description. Do not paste a LinkedIn URL — paste the text."
          />
        </label>
        <label className="block text-sm">
          Company website
          <input
            required
            value={companyUrl}
            onChange={(e) => setCompanyUrl(e.target.value)}
            className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2"
            placeholder="https://company.com"
          />
        </label>
        <label className="block text-sm">
          Days until interview
          <input
            type="number"
            min={1}
            max={120}
            required
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="mt-1 w-32 rounded-xl border border-line bg-panel px-3 py-2"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          disabled={busy}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-canvas disabled:opacity-60"
        >
          {busy ? "Starting…" : "Generate interview kit"}
        </button>
      </form>
    </div>
  );
}
