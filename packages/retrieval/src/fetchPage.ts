import { USER_AGENT } from "./robots.js";
import { assertFetchableUrl, type UrlPolicy } from "./urlPolicy.js";

export const MAX_RESPONSE_BYTES = 1_500_000;
export const FETCH_TIMEOUT_MS = 10_000;
const ALLOWED_TYPES = ["text/html", "application/xhtml+xml", "text/plain"];

export class FetchBlockedError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export async function fetchText(
  rawUrl: string,
  policy: UrlPolicy,
  fetchImpl: typeof fetch = fetch,
): Promise<{ url: string; contentType: string; body: string; status: number }> {
  const url = assertFetchableUrl(rawUrl, policy);
  const res = await fetchImpl(url.toString(), {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

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
}
