"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ApiError, api, type KitSummary } from "@/lib/api";
import { useAuth, type AuthUser } from "@/lib/auth";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { seedSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api<{ user: AuthUser; kits: KitSummary[] }>(
        mode === "login" ? "/auth/login" : "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
      );
      seedSession(data.user, data.kits);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(300px,42%)_1fr]">
      <div className="hidden flex-col justify-between bg-ink px-10 py-12 text-white lg:flex">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Interprep</p>
          <h1 className="mt-8 font-serif text-4xl font-semibold leading-tight tracking-tight">
            Interview prep that stays under your control.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/70">
            Paste a job description. We research the company, extract requirements, and build a kit you can edit,
            practice, and track.
          </p>
        </div>
        <ul className="space-y-3 text-sm text-white/60">
          <li className="flex gap-2">
            <span className="text-accent">✓</span> Company research from public pages
          </li>
          <li className="flex gap-2">
            <span className="text-accent">✓</span> Questions, flashcards, and a daily plan
          </li>
          <li className="flex gap-2">
            <span className="text-accent">✓</span> Practice mode with weak-spot tracking
          </li>
        </ul>
      </div>

      <div className="relative flex min-h-dvh w-full flex-col justify-center overflow-hidden">
        <Image
          src="/auth-bg.png"
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 58vw"
          className="object-cover object-[65%_center] sm:object-center"
          aria-hidden
        />

        {/* Mobile: stronger wash so inputs stay readable on small screens */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-white/92 via-white/86 to-white/94 backdrop-blur-[2px] lg:hidden"
          aria-hidden
        />

        {/* Desktop: fade image in from the right; keep the form side clean */}
        <div
          className="absolute inset-0 hidden bg-gradient-to-r from-white/96 via-white/78 to-white/45 lg:block"
          aria-hidden
        />

        <div className="relative z-10 flex flex-1 flex-col justify-center px-5 py-10 sm:px-8 lg:px-16">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-line/60 bg-white/95 p-6 shadow-card backdrop-blur-md sm:p-8 lg:max-w-lg lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-0">
            <p className="brand-mark lg:hidden">Interprep</p>
            <h2 className="page-title mt-2 lg:mt-0">{mode === "login" ? "Sign in" : "Create an account"}</h2>
            <p className="mt-2 text-sm text-mute">Build interview kits from a job description and a company website.</p>

            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <label className="block text-sm font-medium text-ink">
                Email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field mt-1.5 bg-white"
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                Password
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field mt-1.5 bg-white"
                />
              </label>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? "Working…" : mode === "login" ? "Sign in" : "Register"}
              </button>
            </form>

            <p className="mt-6 text-sm text-mute">
              {mode === "login" ? (
                <>
                  No account?{" "}
                  <Link href="/register" className="font-medium text-accent-dark underline underline-offset-2">
                    Register
                  </Link>
                </>
              ) : (
                <>
                  Already registered?{" "}
                  <Link href="/login" className="font-medium text-accent-dark underline underline-offset-2">
                    Sign in
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
