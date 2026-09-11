import * as cheerio from "cheerio";
import { normalizePageUrl } from "./urlPolicy.js";

export type ExtractedPage = {
  url: string;
  title: string;
  text: string;
  links: Array<{ url: string; text: string }>;
};

const MAX_TEXT = 12_000;

export function extractPage(html: string, pageUrl: string): ExtractedPage {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();
  const title = ($("title").first().text() || $("h1").first().text() || "").trim();
  const text = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT);

  const links: Array<{ url: string; text: string }> = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const resolved = normalizePageUrl(href, pageUrl);
    if (!resolved) return;
    links.push({
      url: resolved,
      text: $(el).text().replace(/\s+/g, " ").trim().slice(0, 120),
    });
  });

  return { url: pageUrl, title, text, links };
}
