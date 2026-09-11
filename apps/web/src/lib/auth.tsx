"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, api, type KitSummary } from "@/lib/api";

export type AuthUser = { id: string; email: string; createdAt?: string };

type AuthContextValue = {
  user: AuthUser | null;
  kits: KitSummary[] | null;
  loading: boolean;
  seedSession: (user: AuthUser, kits: KitSummary[]) => void;
  refresh: () => Promise<void>;
  clear: () => void;
  setKits: (kits: KitSummary[]) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [kits, setKits] = useState<KitSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ready = useRef(false);

  const seedSession = useCallback((nextUser: AuthUser, nextKits: KitSummary[]) => {
    setUser(nextUser);
    setKits(nextKits);
    ready.current = true;
    setLoading(false);
  }, []);

  const clear = useCallback(() => {
    setUser(null);
    setKits(null);
    ready.current = false;
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    if (ready.current) return;
    setLoading(true);
    try {
      const [me, data] = await Promise.all([
        api<{ user: AuthUser }>("/auth/me"),
        api<{ kits: KitSummary[] }>("/kits"),
      ]);
      setUser(me.user);
      setKits(data.kits);
      ready.current = true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clear();
        router.replace("/login");
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clear, router]);

  return (
    <AuthContext.Provider value={{ user, kits, loading, seedSession, refresh, clear, setKits }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
