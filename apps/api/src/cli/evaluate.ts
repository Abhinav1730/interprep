import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { evaluateCaseSchema, type EvaluateCase, type EvaluateResult } from "@interprep/shared";
import { generateKit } from "@interprep/pipeline";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../../.env") });
dotenv.config();
process.env.EVALUATION_MODE = "true";
process.env.ALLOW_PRIVATE_URLS = "true";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

function parseArgs() {
  const input = arg("--input");
  const output = arg("--output");
  if (!input || !output) {
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exit(1);
  }
  return { input: path.resolve(input), output: path.resolve(output) };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function main() {
  const { input, output } = parseArgs();
  const raw = JSON.parse(await fs.readFile(input, "utf8")) as unknown;
  if (!Array.isArray(raw)) {
    console.error("Input must be a JSON array of cases");
    process.exit(1);
  }

  const cases: EvaluateCase[] = raw.map((item, i) => {
    const parsed = evaluateCaseSchema.safeParse(item);
    if (!parsed.success) {
      return {
        id: (item as { id?: string })?.id || `invalid-${i}`,
        jd: "",
        company_url: "",
        days: 1,
      };
    }
    return parsed.data;
  });

  const started = Date.now();
  const results = await mapLimit(cases, 2, async (item, ): Promise<EvaluateResult> => {
    if (!item.jd || !item.company_url) {
      return {
        id: item.id,
        status: "failed",
        kit: null,
        error: { code: "INVALID_INPUT", message: "Case is missing jd, company_url, or days" },
      };
    }
    try {
      const result = await generateKit(
        { jd: item.jd, company_url: item.company_url, days: item.days },
        { includePublicSearch: true },
      );
      return { ...result, id: item.id };
    } catch (err) {
      return {
        id: item.id,
        status: "failed",
        kit: null,
        error: {
          code: "PIPELINE_FAILED",
          message: err instanceof Error ? err.message : "Unknown error",
        },
      };
    }
  });

  await fs.writeFile(output, JSON.stringify(results, null, 2), "utf8");
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const ok = results.filter((r) => r.status === "ok").length;
  console.log(`Wrote ${results.length} results (${ok} ok) to ${output} in ${elapsed}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
