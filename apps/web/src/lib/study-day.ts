import type { KitPayload } from "@/lib/api";

/** Estimate which schedule day the user is on from kit creation date. */
export function currentStudyDay(daysAvailable: number, createdAt?: string): number {
  if (!createdAt) return 1;
  const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
  return Math.min(daysAvailable, Math.max(1, elapsed + 1));
}

export function todayScheduleFocus(kit: KitPayload, createdAt?: string) {
  const dayNum = currentStudyDay(kit.schedule.days_available, createdAt);
  const day = kit.schedule.days.find((d) => d.day === dayNum) ?? kit.schedule.days[0];
  return { dayNum, day, totalDays: kit.schedule.days_available };
}
