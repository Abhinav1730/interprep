export function sequentialIds(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
}

export function nextId(prefix: string, existing: string[]): string {
  const nums = existing
    .map((id) => {
      const match = id.match(new RegExp(`^${prefix}(\\d+)$`));
      return match ? Number(match[1]) : 0;
    })
    .filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `${prefix}${max + 1}`;
}

export function assignRequirementIds<T extends { text: string }>(
  items: T[],
): Array<T & { id: string }> {
  return items.map((item, i) => ({ ...item, id: `r${i + 1}` }));
}
