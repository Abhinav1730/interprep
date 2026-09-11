import { describe, expect, it } from "vitest";
import { normalizePageUrl } from "../src/urlPolicy.js";
import { rankLinks, scoreLink } from "../src/ranker.js";

describe("url resolution", () => {
  it("resolves evaluator-style relative careers links", () => {
    expect(normalizePageUrl("careers", "http://localhost:8099/acme/")).toBe(
      "http://localhost:8099/acme/careers",
    );
  });
});

describe("link ranking", () => {
  it("ranks hiring pages above pricing", () => {
    const ranked = rankLinks([
      { url: "https://acme.test/pricing", text: "Pricing" },
      { url: "https://acme.test/careers", text: "Careers" },
      { url: "https://acme.test/blog", text: "Blog" },
    ]);
    expect(ranked[0]?.url).toContain("careers");
    expect(scoreLink("/jobs", "Jobs")).toBeGreaterThan(scoreLink("/pricing", "Pricing"));
  });
});
