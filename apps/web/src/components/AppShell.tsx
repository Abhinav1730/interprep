"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CommandPalette, KeyboardShortcutsHelp } from "@/components/CommandPalette";
import { IconChevronLeft, IconChevronRight, IconGrid, IconSparkle } from "@/components/icons";
import { api, type KitSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  isKitWorkspacePath,
  loadSidebarCollapsed,
  saveSidebarCollapsed,
} from "@/lib/sidebar";

const NAV = [
  { href: "/", label: "My kits", Icon: IconGrid },
  { href: "/kits/new", label: "New kit", Icon: IconSparkle },
] as const;

function SidebarContent({
  pathname,
  user,
  kitCount,
  accountOpen,
  onAccountToggle,
  onNavigate,
  onLogout,
  loggingOut,
  onShowShortcuts,
  collapsed,
  canCollapse,
  onToggleCollapse,
}: {
  pathname: string;
  user: { id: string; email: string; createdAt?: string } | null;
  kitCount: number;
  accountOpen: boolean;
  onAccountToggle: () => void;
  onNavigate?: () => void;
  onLogout: () => void;
  loggingOut: boolean;
  onShowShortcuts: () => void;
  collapsed: boolean;
  canCollapse: boolean;
  onToggleCollapse: () => void;
}) {
  const initial = user?.email?.[0]?.toUpperCase() ?? "?";
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

  return (
    <div className="flex h-full flex-col">
      <div>
        <div className={`flex items-start gap-2 ${collapsed ? "flex-col items-center" : "justify-between"}`}>
          <Link
            href="/"
            className={`block py-2 ${collapsed ? "px-0 text-center" : "px-3"}`}
            onClick={onNavigate}
            title={collapsed ? "Interprep" : undefined}
          >
            {collapsed ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-white">
                I
              </span>
            ) : (
              <>
                <p className="brand-mark">Interprep</p>
                <p className="mt-1 text-xs text-mute">AI interview prep kits</p>
              </>
            )}
          </Link>

          {canCollapse ? (
            <button
              type="button"
              className={`btn-ghost shrink-0 rounded-xl p-2 text-mute hover:text-ink ${collapsed ? "mt-1" : ""}`}
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <IconChevronRight className="h-4 w-4" /> : <IconChevronLeft className="h-4 w-4" />}
            </button>
          ) : null}
        </div>

        <nav className={`space-y-1 ${collapsed ? "mt-4" : "mt-6"}`}>
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={`flex items-center rounded-xl text-sm transition ${
                  collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
                } ${active ? "nav-link-active" : "nav-link"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed ? item.label : null}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          className={`nav-link mt-4 w-full ${collapsed ? "justify-center px-0 py-2.5" : "text-left"}`}
          onClick={onShowShortcuts}
          title={collapsed ? "Keyboard shortcuts" : undefined}
        >
          <span className="font-mono text-xs">?</span>
          {!collapsed ? <span className="ml-3 text-sm">Keyboard shortcuts</span> : null}
        </button>
      </div>

      <div className={`relative mt-auto border-t border-line pt-4 ${collapsed ? "flex justify-center" : ""}`}>
        <button
          type="button"
          onClick={onAccountToggle}
          title={collapsed ? user?.email ?? "Account" : undefined}
          className={`flex items-center rounded-xl text-left transition hover:bg-canvas ${
            collapsed ? "justify-center p-2" : "w-full gap-3 px-3 py-2.5"
          }`}
          aria-expanded={accountOpen}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
            {initial}
          </span>
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">Account</span>
                <span className="block truncate text-xs text-mute">{user?.email ?? "Loading…"}</span>
              </span>
              <span className="text-xs text-mute">{accountOpen ? "▲" : "▼"}</span>
            </>
          ) : null}
        </button>

        {accountOpen ? (
          <div
            className={
              collapsed
                ? "absolute bottom-0 left-full z-50 ml-3 w-64 rounded-2xl border border-line bg-panel p-4 shadow-soft"
                : "mt-2 rounded-2xl border border-line bg-canvas p-4"
            }
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-mute">Account details</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-mute">Email</dt>
                <dd className="mt-0.5 break-all font-medium">{user?.email ?? "—"}</dd>
              </div>
              {memberSince ? (
                <div>
                  <dt className="text-xs text-mute">Member since</dt>
                  <dd className="mt-0.5 font-medium">{memberSince}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs text-mute">Interview kits</dt>
                <dd className="mt-0.5 font-medium">{kitCount}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={onLogout}
              disabled={loggingOut}
              className="btn-secondary mt-4 w-full py-2 text-xs"
            >
              {loggingOut ? "Signing out…" : "Log out"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, kits, clear, refresh } = useAuth();
  const [mobileNav, setMobileNav] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sidebarCollapsedPref, setSidebarCollapsedPref] = useState(false);

  const canCollapseSidebar = isKitWorkspacePath(pathname);
  const sidebarCollapsed = canCollapseSidebar && sidebarCollapsedPref;

  useEffect(() => {
    setSidebarCollapsedPref(loadSidebarCollapsed());
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      // 401 redirect handled in refresh
    });
  }, [refresh]);

  useEffect(() => {
    setMobileNav(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
      if (e.key === "Escape") {
        setMobileNav(false);
        setAccountOpen(false);
        setCommandOpen(false);
        setShortcutsOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const kitCount = kits?.length ?? 0;

  async function logout() {
    setLoggingOut(true);
    try {
      await api("/auth/logout", { method: "POST" });
      clear();
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  function toggleSidebarCollapsed() {
    setSidebarCollapsedPref((value) => {
      const next = !value;
      saveSidebarCollapsed(next);
      if (next) setAccountOpen(false);
      return next;
    });
  }

  const sidebarProps = {
    pathname,
    user,
    kitCount,
    accountOpen,
    onAccountToggle: () => setAccountOpen((v) => !v),
    onLogout: logout,
    loggingOut,
    onShowShortcuts: () => setShortcutsOpen(true),
    collapsed: sidebarCollapsed,
    canCollapse: canCollapseSidebar,
    onToggleCollapse: toggleSidebarCollapsed,
  };

  return (
    <div className="min-h-dvh">
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-panel transition-[width] duration-200 ease-out lg:block ${
          sidebarCollapsed ? "lg:w-[72px]" : "lg:w-[260px]"
        }`}
      >
        <div className="flex h-dvh flex-col overflow-y-auto overflow-x-visible p-4">
          <SidebarContent {...sidebarProps} />
        </div>
      </aside>

      <div
        className={`flex min-h-dvh flex-col transition-[padding-left] duration-200 ease-out ${
          sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"
        }`}
      >
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-panel/95 px-4 py-3 shadow-nav backdrop-blur lg:hidden">
          <button type="button" className="btn-secondary px-4 py-2 text-xs" onClick={() => setMobileNav(true)}>
            Menu
          </button>
          <p className="truncate text-sm font-semibold">Interprep</p>
          <Link href="/kits/new" className="btn-primary px-4 py-2 text-xs">
            New
          </Link>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>
      </div>

      {mobileNav ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[min(280px,88vw)] flex-col bg-panel shadow-soft">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-semibold">Menu</p>
              <button type="button" className="btn-ghost" onClick={() => setMobileNav(false)}>
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <SidebarContent
                {...sidebarProps}
                canCollapse={false}
                collapsed={false}
                onNavigate={() => setMobileNav(false)}
              />
            </div>
          </aside>
        </div>
      ) : null}

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} kits={kits ?? []} />
      <KeyboardShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
