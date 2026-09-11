const SCORE_RULES: Array<{ pattern: RegExp; score: number }> = [
  { pattern: /career|job|hiring|interview|recruit/i, score: 10 },
  { pattern: /handbook|culture-book|how-we-work/i, score: 8 },
  { pattern: /engineer|eng-blog|tech-blog|platform/i, score: 6 },
  { pattern: /about|team|people|mission|values/i, score: 5 },
  { pattern: /blog|news|press/i, score: 3 },
  { pattern: /pricing|login|signup|privacy|terms|cookie/i, score: 1 },
];

export function scoreLink(href: string, text = ""): number {
  const haystack = `${href} ${text}`;
  let score = 0;
  for (const rule of SCORE_RULES) {
    if (rule.pattern.test(haystack)) score += rule.score;
  }
  return score;
}

export type RankedLink = {
  url: string;
  text: string;
  score: number;
};

export function rankLinks(links: Array<{ url: string; text: string }>): RankedLink[] {
  const best = new Map<string, RankedLink>();
  for (const link of links) {
    const ranked = { ...link, score: scoreLink(link.url, link.text) };
    const current = best.get(link.url);
    if (!current || ranked.score > current.score) {
      best.set(link.url, ranked);
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
}
