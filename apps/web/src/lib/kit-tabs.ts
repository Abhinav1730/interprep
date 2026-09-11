export const KIT_TABS = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "company", label: "Company", icon: "company" },
  { id: "role", label: "Role", icon: "role" },
  { id: "questions", label: "Questions", icon: "questions" },
  { id: "flashcards", label: "Flashcards", icon: "flashcards" },
  { id: "plan", label: "Plan", icon: "plan" },
  { id: "weak", label: "Weak spots", icon: "weak" },
  { id: "practice", label: "Practice", icon: "practice" },
] as const;

export type KitTabId = (typeof KIT_TABS)[number]["id"];

export function parseKitTab(value: string | null): KitTabId {
  if (value && KIT_TABS.some((t) => t.id === value)) return value as KitTabId;
  return "overview";
}

export const CONFIDENCE_LABELS: Record<number, string> = {
  1: "No idea",
  2: "Struggled",
  3: "Okay",
  4: "Good",
  5: "Easy",
};
