import type { PublicDiscussion } from "@interprep/shared";
import { extractPage, type ExtractedPage } from "./html.js";
import { fetchText } from "./fetchPage.js";
import { rankLinks } from "./ranker.js";
import { loadRobots } from "./robots.js";
import { searchPublicDiscussions } from "./publicSearch.js";
import {
  assertFetchableUrl,
  assertResolvableFetchableUrl,
  evaluationUrlPolicy,
  sameRegistrableHost,
  urlKey,
  type UrlPolicy,
} from "./urlPolicy.js";

export type CrawledPage = ExtractedPage & {
  sourceType: "company_site";
};

export type ResearchBundle = {
  startUrl: string;
  pages: CrawledPage[];
  pagesUsed: string[];
  robotsHonored: boolean;
  publicDiscussions: PublicDiscussion[];
  hiringEvidence: string;
  hiringFound: boolean;
  error?: { code: string; message: string };
};

const MAX_PAGES = 8;
const CRAWL_DELAY_MS = 350;
const HIRING_HINT = /interview|hiring process|recruiting|take-home|on-site|onsite|system design round|phone screen/i;

function crawlDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, CRAWL_DELAY_MS));
}

function hiringSnippet(pages: CrawledPage[]): { found: boolean; text: string } {
  for (const page of pages) {
    if (HIRING_HINT.test(`${page.url} ${page.title} ${page.text}`)) {
      const idx = page.text.search(HIRING_HINT);
      const slice = page.text.slice(Math.max(0, idx - 80), idx + 600).trim();
      return { found: true, text: slice || page.text.slice(0, 600) };
    }
  }
  return {
    found: false,
    text: "Hiring process information was not found on the company's public website.",
  };
}

export async function researchCompany(args: {
  companyUrl: string;
  roleHint?: string;
  policy?: UrlPolicy;
  fetchImpl?: typeof fetch;
  includePublicSearch?: boolean;
  onPage?: (page: CrawledPage) => void;
}): Promise<ResearchBundle> {
  const policy = args.policy ?? evaluationUrlPolicy();
  const fetchImpl = args.fetchImpl ?? fetch;
  const includePublicSearch = args.includePublicSearch !== false;

  let start: URL;
  try {
    start = await assertResolvableFetchableUrl(args.companyUrl, policy);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid company URL";
    return {
      startUrl: args.companyUrl,
      pages: [],
      pagesUsed: [],
      robotsHonored: true,
      publicDiscussions: [],
      hiringEvidence: "Hiring process information was not found on the company's public website.",
      hiringFound: false,
      error: { code: "INVALID_URL", message },
    };
  }

  const origin = `${start.protocol}//${start.host}`;
  const robots = await loadRobots(origin, fetchImpl);
  const visited = new Set<string>();
  const pages: CrawledPage[] = [];
  const queue: Array<{ url: string; score: number; hop: number }> = [
    { url: start.toString(), score: 100, hop: 0 },
  ];

  let fetchFailures = 0;

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    queue.sort((a, b) => b.score - a.score);
    const next = queue.shift();
    if (!next) break;
    const key = urlKey(next.url);
    if (visited.has(key)) continue;
    visited.add(key);

    let target: URL;
    try {
      target = assertFetchableUrl(next.url, policy);
    } catch {
      continue;
    }
    if (!sameRegistrableHost(start, target)) continue;
    if (!robots.isAllowed(target.toString())) continue;

    try {
      if (pages.length > 0) await crawlDelay();
      await assertResolvableFetchableUrl(target.toString(), policy);
      const fetched = await fetchText(target.toString(), policy, fetchImpl);
      if (fetched.status >= 400) {
        fetchFailures += 1;
        continue;
      }
      const extracted = extractPage(fetched.body, fetched.url);
      const page: CrawledPage = { ...extracted, sourceType: "company_site" };
      pages.push(page);
      args.onPage?.(page);

      if (next.hop < 1) {
        const ranked = rankLinks(
          extracted.links.filter((l) => {
            try {
              const u = new URL(l.url);
              return sameRegistrableHost(start, u);
            } catch {
              return false;
            }
          }),
        );
        for (const link of ranked.slice(0, 12)) {
          const k = urlKey(link.url);
          if (!visited.has(k)) {
            queue.push({ url: link.url, score: link.score, hop: next.hop + 1 });
          }
        }
      }
    } catch {
      fetchFailures += 1;
    }
  }

  let publicDiscussions: PublicDiscussion[] = [];
  if (includePublicSearch) {
    publicDiscussions = await searchPublicDiscussions(
      start.toString(),
      args.roleHint ?? "",
      fetchImpl,
    );
  }

  const hiring = hiringSnippet(pages);
  const unreachable = pages.length === 0;
  return {
    startUrl: start.toString(),
    pages,
    pagesUsed: pages.map((p) => p.url),
    robotsHonored: true,
    publicDiscussions,
    hiringEvidence: hiring.text,
    hiringFound: hiring.found,
    error: unreachable
      ? {
          code: "COMPANY_UNREACHABLE",
          message:
            fetchFailures > 0
              ? "Company site unreachable after retries."
              : "No usable pages were retrieved from the company website.",
        }
      : undefined,
  };
}
