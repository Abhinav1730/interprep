import { USER_AGENT } from "./robots.js";
import { assertFetchableUrl, type UrlPolicy } from "./urlPolicy.js";

export const MAX_RESPONSE_BYTES = 1_500_000;
export const FETCH_TIMEOUT_MS = 10_000;
export const FETCH_MAX_RETRIES = 3;
const ALLOWED_TYPES = ["text/html", "application/xhtml+xml", "text/plain"];

export class FetchBlockedError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

function backoffMs(attempt: number): number {
  return Math.min(8000, 400 * 2 ** attempt + Math.floor(Math.random() * 200));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchText(
  rawUrl: string,
  policy: UrlPolicy,
  fetchImpl: typeof fetch = fetch,
): Promise<{ url: string; contentType: string; body: string; status: number }> {
  const url = assertFetchableUrl(rawUrl, policy);
  let lastError: unknown;

  for (let attempt = 0; attempt < FETCH_MAX_RETRIES; attempt++) {
    try {
      const res = await fetchImpl(url.toString(), {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (isRetryableStatus(res.status) && attempt < FETCH_MAX_RETRIES - 1) {
        await sleep(backoffMs(attempt));
        continue;
      }

      const contentType = (res.headers.get("content-type") || "").split(";")[0]?.trim().toLowerCase() || "";
      if (contentType && !ALLOWED_TYPES.some((t) => contentType.startsWith(t))) {
        throw new FetchBlockedError(`Unexpected content type ${contentType}`, "UNSUPPORTED_CONTENT_TYPE");
      }

      const length = Number(res.headers.get("content-length") || "0");
      if (length > MAX_RESPONSE_BYTES) {
        throw new FetchBlockedError("Response too large", "RESPONSE_TOO_LARGE");
      }

      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_RESPONSE_BYTES) {
        throw new FetchBlockedError("Response too large", "RESPONSE_TOO_LARGE");
      }
      const body = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      return { url: res.url || url.toString(), contentType, body, status: res.status };
    } catch (err) {
      lastError = err;
      if (err instanceof FetchBlockedError) throw err;
      if (attempt < FETCH_MAX_RETRIES - 1) {
        await sleep(backoffMs(attempt));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Fetch failed after retries");
}
