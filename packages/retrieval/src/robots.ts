import robotsParserImport from "robots-parser";

function parseRobots(url: string, contents: string) {
  const mod = robotsParserImport as unknown as
    | ((u: string, t: string) => { isAllowed: (url: string, ua?: string) => boolean | undefined })
    | { default: (u: string, t: string) => { isAllowed: (url: string, ua?: string) => boolean | undefined } };
  const fn = typeof mod === "function" ? mod : mod.default;
  return fn(url, contents);
}

const USER_AGENT = "InterprepBot/1.0 (+https://interprep.local; research for interview prep)";

export { USER_AGENT };

export async function loadRobots(origin: string, fetchImpl: typeof fetch): Promise<{
  isAllowed: (url: string) => boolean;
  raw: string | null;
}> {
  const robotsUrl = new URL("/robots.txt", origin).toString();
  try {
    const res = await fetchImpl(robotsUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/plain" },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return { isAllowed: () => true, raw: null };
    }
    const raw = await res.text();
    const robots = parseRobots(robotsUrl, raw);
    return {
      raw,
      isAllowed: (url: string) => robots.isAllowed(url, USER_AGENT) !== false,
    };
  } catch {
    return { isAllowed: () => true, raw: null };
  }
}
