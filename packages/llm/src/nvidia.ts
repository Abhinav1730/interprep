import OpenAI from "openai";
import {
  backoffMs,
  extractJson,
  isRetryableStatus,
  sleep,
  type LlmProvider,
  type StructuredRequest,
} from "./types.js";

const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";

export class NvidiaProvider implements LlmProvider {
  name = "nvidia" as const;
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = process.env.NVIDIA_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b") {
    this.client = new OpenAI({ apiKey, baseURL: NVIDIA_BASE });
    this.model = model;
  }

  async generateJson(request: StructuredRequest): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model: this.model,
          temperature: request.temperature ?? 0.1,
          max_tokens: 4096,
          messages: request.messages,
          // @ts-expect-error NVIDIA extra body
          extra_body: {
            chat_template_kwargs: { enable_thinking: false },
          },
        });
        const content = completion.choices[0]?.message?.content ?? "";
        return extractJson(content);
      } catch (err) {
        lastError = err;
        const status = (err as { status?: number }).status ?? 0;
        if (!isRetryableStatus(status) && status !== 0) break;
        await sleep(backoffMs(attempt));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("NVIDIA request failed");
  }
}
