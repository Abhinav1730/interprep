"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, type KitSummary } from "@/lib/api";

type CommandItem = { label: string; href?: string; action?: () => void; group: string };

export function CommandPalette({ open, onClose, kits }: { open: boolean; onClose: () => void; kits: KitSummary[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const items = useMemo(() => {
    const base: CommandItem[] = [
      { label: "My kits", href: "/", group: "Navigate" },
      { label: "New kit", href: "/kits/new", group: "Navigate" },
    ];
    for (const kit of kits) {
      if (kit.status === "completed") {
        base.push({
          label: `${kit.company || "Company"} · ${kit.title || "Role"}`,
          href: `/kits/${kit.id}?tab=overview`,
          group: "Kits",
        });
      } else if (kit.status === "generating" || kit.status === "queued") {
        base.push({ label: `Building: ${kit.company || kit.title || kit.id}`, href: `/kits/${kit.id}`, group: "Kits" });
      }
    }
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((item) => item.label.toLowerCase().includes(q));
  }, [kits, query]);

  if (!open) return null;

  function run(item: CommandItem) {
    onClose();
    if (item.href) router.push(item.href);
    else item.action?.();
  }

  return (
    <div className="fixed inset-0 z-[90] bg-ink/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card mx-auto mt-[12vh] max-w-lg overflow-hidden shadow-soft" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search kits and pages…"
          className="w-full border-b border-line px-4 py-3 text-sm outline-none"
        />
        <ul className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 ? (
            <li className="px-3 py-4 text-sm text-mute">No matches</li>
          ) : (
            items.map((item) => (
              <li key={`${item.group}-${item.label}`}>
                <button
                  type="button"
                  className="flex w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-canvas"
                  onClick={() => run(item)}
                >
                  <span className="text-mute">{item.group} · </span>
                  <span className="ml-1">{item.label}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="border-t border-line px-4 py-2 text-xs text-mute">⌘K or Ctrl+K · Esc to close</p>
      </div>
    </div>
  );
}

export function KeyboardShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const shortcuts = [
    { keys: "⌘ K / Ctrl K", desc: "Open command palette" },
    { keys: "?", desc: "Show keyboard shortcuts" },
    { keys: "Esc", desc: "Close dialogs and menus" },
    { keys: "Space / Enter", desc: "Reveal flashcard (practice mode)" },
    { keys: "1 – 5", desc: "Rate confidence after reveal (practice)" },
    { keys: "← →", desc: "Previous / next card (practice)" },
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/40" />
      <div className="card relative max-w-md p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-lg font-semibold">Keyboard shortcuts</h3>
        <ul className="mt-4 space-y-2">
          {shortcuts.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-mute">{s.desc}</span>
              <kbd className="rounded-lg bg-canvas px-2 py-1 font-mono text-xs">{s.keys}</kbd>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-secondary mt-6 w-full py-2 text-sm" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
