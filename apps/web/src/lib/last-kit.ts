const KEY = "interprep-last-kit";

export function saveLastKit(id: string, label: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id, label, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function loadLastKit(): { id: string; label: string } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id: string; label: string };
    if (!parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}
