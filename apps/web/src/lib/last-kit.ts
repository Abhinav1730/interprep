const LEGACY_KEY = "interprep-last-kit";

function keyFor(userId: string) {
  return `interprep-last-kit:${userId}`;
}

export function saveLastKit(userId: string, id: string, label: string) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify({ id, label, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function loadLastKit(userId: string): { id: string; label: string } | null {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id: string; label: string };
    if (!parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLegacyLastKit() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}
