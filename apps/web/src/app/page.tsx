"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api, type KitSummary } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [kits, setKits] = useState<KitSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ user: { email: string } }>("/auth/me")
      .then((me) => {
        setEmail(me.user.email);
        return api<{ kits: KitSummary[] }>("/kits");
      })
      .then((data) => setKits(data.kits))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace("/login");
        else setError(err instanceof Error ? err.message : "Failed to load");
      });
  }, [router]);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-10 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Interprep</p>
          <h1 className="mt-1 text-2xl font-semibold">Interview kits</h1>
          <p className="text-sm text-mute">{email || "…"}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/kits/new"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-canvas"
          >
            New kit
          </Link>
          <button onClick={logout} className="rounded-lg border border-line px-4 py-2 text-sm">
            Log out
          </button>
        </div>
      </header>
      {error ? <p className="text-danger">{error}</p> : null}
      {kits === null ? (
        <p className="text-mute">Loading kits…</p>
      ) : kits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="text-lg font-medium">No kits yet</p>
          <p className="mt-2 text-sm text-mute">Paste a job description and a company URL to generate one.</p>
          <Link href="/kits/new" className="mt-6 inline-block text-accent underline">
            Create your first kit
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {kits.map((kit) => (
            <li key={kit.id}>
              <Link
                href={`/kits/${kit.id}`}
                className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-4 hover:border-accent/40"
              >
                <div>
                  <p className="font-medium">
                    {kit.company || "Company"} · {kit.title || "Role"}
                  </p>
                  <p className="text-sm text-mute">
                    {kit.days} day{kit.days === 1 ? "" : "s"} · {kit.status}
                  </p>
                </div>
                <span className="font-mono text-xs text-mute">{new Date(kit.updatedAt).toLocaleString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
