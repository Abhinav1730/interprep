import { createHash } from "node:crypto";

export function normalizeJd(jd: string): string {
  return jd.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().toLowerCase();
}

export function canonicalizeCompanyUrl(raw: string): string {
  let value = raw.trim();
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  const url = new URL(value);
  url.hash = "";
  let pathname = url.pathname || "/";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  url.pathname = pathname;
  url.hostname = url.hostname.toLowerCase();
  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }
  return url.toString();
}

export function inputHash(jd: string, companyUrl: string): string {
  const canonical = `${normalizeJd(jd)}\n${canonicalizeCompanyUrl(companyUrl)}`;
  return createHash("sha256").update(canonical).digest("hex");
}
