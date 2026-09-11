import OpenAI from "openai";
import {
  backoffMs,
  extractJson,
  isRetryableStatus,
  sleep,
  type LlmProvider,
  type StructuredRequest,
} from "./types.js";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export class OpenRouterProvider implements LlmProvider {
  name = "openrouter" as const;
  private client: OpenAI;
  private model: string;
  private supportsSchema: boolean;

  constructor(
    apiKey: string,
    model = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free",
    supportsSchema = true,
  ) {
    this.client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE,
      defaultHeaders: {
        "HTTP-Referer": process.env.PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Interprep Interview Kit",
      },
    });
    this.model = model;
    this.supportsSchema = supportsSchema;
  }

  async generateJson(request: StructuredRequest): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model: this.model,
          temperature: request.temperature ?? 0.2,
          max_tokens: 4096,
          messages: request.messages,
          ...(this.supportsSchema
            ? {
                response_format: {
                  type: "json_schema",
                  json_schema: {
                    name: request.schemaName,
                    strict: false,
                    schema: request.jsonSchema,
                  },
                },
              }
            : { response_format: { type: "json_object" } }),
        });
        const content = completion.choices[0]?.message?.content ?? "";
        return extractJson(content);
      } catch (err) {
        lastError = err;
        const status = (err as { status?: number }).status ?? 0;
        if (status === 400 && this.supportsSchema) {
          this.supportsSchema = false;
          continue;
        }
        if (!isRetryableStatus(status) && status !== 0) break;
        await sleep(backoffMs(attempt));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("OpenRouter request failed");
  }
}
