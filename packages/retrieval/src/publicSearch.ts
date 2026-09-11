import type { PublicDiscussion } from "@interprep/shared";
import * as cheerio from "cheerio";
import { USER_AGENT } from "./robots.js";

function companyNameFromUrl(companyUrl: string): string {
  try {
    const host = new URL(companyUrl).hostname.replace(/^www\./, "");
    return host.split(".")[0] || host;
  } catch {
    return companyUrl;
  }
}

export async function searchPublicDiscussions(
  companyUrl: string,
  roleTitle: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PublicDiscussion[]> {
  const company = companyNameFromUrl(companyUrl);
  const queries = [
    `"${company}" interview experience`,
    `"${company}" ${roleTitle || "software engineer"} interview`,
    `"${company}" hiring process`,
  ];
  const seen = new Set<string>();
  const out: PublicDiscussion[] = [];

  for (const q of queries) {
    if (out.length >= 5) break;
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    try {
      const res = await fetchImpl(searchUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);
      $(".result, a.result__a").each((_, el) => {
        if (out.length >= 5) return;
        const title = $(el).text().trim();
        const href = $(el).attr("href") || "";
        const snippet = $(el).closest(".result").find(".result__snippet").text().trim();
        let url = href;
        try {
          const parsed = new URL(href, "https://duckduckgo.com");
          url = parsed.searchParams.get("uddg") || parsed.toString();
        } catch {
          url = href;
        }
        if (!url.startsWith("http") || seen.has(url)) return;
        seen.add(url);
        out.push({
          url,
          title: title || "Public discussion",
          content: snippet.slice(0, 800),
          type: "public_discussion",
        });
      });
    } catch {
      // Public search is optional evidence, never fatal.
    }
  }

  return out;
}
