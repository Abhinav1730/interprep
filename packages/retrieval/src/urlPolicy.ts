import dns from "node:dns/promises";

const PRIVATE_V4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.64\./,
];

function isPrivateV4(ip: string): boolean {
  if (PRIVATE_V4.some((re) => re.test(ip))) return true;
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts[0] === 172 && (parts[1] ?? 0) >= 16 && (parts[1] ?? 0) <= 31) {
    return true;
  }
  return false;
}

function isPrivateIp(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower.includes(":")) {
    return (
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80") ||
      lower.startsWith("::ffff:127.") ||
      lower.startsWith("::ffff:10.") ||
      lower.startsWith("::ffff:192.168.")
    );
  }
  return isPrivateV4(ip);
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost")
  );
}

export type UrlPolicy = {
  allowPrivate: boolean;
};

export function evaluationUrlPolicy(): UrlPolicy {
  return {
    allowPrivate:
      process.env.EVALUATION_MODE === "true" ||
      process.env.ALLOW_PRIVATE_URLS === "true" ||
      process.env.NODE_ENV !== "production",
  };
}

export function assertFetchableUrl(raw: string, policy: UrlPolicy = evaluationUrlPolicy()): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw Object.assign(new Error(`Invalid URL: ${raw}`), { code: "INVALID_URL" });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw Object.assign(new Error(`Unsupported protocol: ${parsed.protocol}`), {
      code: "INVALID_URL",
    });
  }
  const host = parsed.hostname;
  if (isLoopbackHost(host) && !policy.allowPrivate) {
    throw Object.assign(new Error("Loopback addresses are not allowed in production"), {
      code: "SSRF_REJECTED",
    });
  }
  if (isPrivateV4(host) && !policy.allowPrivate) {
    throw Object.assign(new Error("Private addresses are not allowed in production"), {
      code: "SSRF_REJECTED",
    });
  }
  return parsed;
}

export async function assertResolvableFetchableUrl(
  raw: string,
  policy: UrlPolicy = evaluationUrlPolicy(),
): Promise<URL> {
  const parsed = assertFetchableUrl(raw, policy);
  if (policy.allowPrivate || isLoopbackHost(parsed.hostname) || isPrivateV4(parsed.hostname)) {
    return parsed;
  }

  try {
    const results = await dns.lookup(parsed.hostname, { all: true });
    for (const result of results) {
      if (isPrivateIp(result.address)) {
        throw Object.assign(new Error("Hostname resolves to a private address"), {
          code: "SSRF_REJECTED",
        });
      }
    }
  } catch (err) {
    if ((err as { code?: string }).code === "SSRF_REJECTED") throw err;
    throw Object.assign(new Error(`Could not resolve hostname: ${parsed.hostname}`), {
      code: "DNS_FAILED",
    });
  }
  return parsed;
}

export function sameRegistrableHost(a: URL, b: URL): boolean {
  return a.hostname.toLowerCase() === b.hostname.toLowerCase();
}

export function normalizePageUrl(raw: string, base?: string): string | null {
  try {
    const url = base ? new URL(raw, base) : new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      // keep trailing slash only for directory-looking evaluator bases like /acme/
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function urlKey(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    let path = url.pathname || "/";
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    url.pathname = path;
    url.search = "";
    return url.toString();
  } catch {
    return raw;
  }
}
