import type { ChatCompletionPayload, CompletionResponse } from "./helper";
import { ContentfulStatusCode } from "hono/utils/http-status";
import type { Message } from "./helper";
import { Hono } from "hono";
import type { Context } from "hono";
import {
  findSystemMessageContent,
  findUserMessageContent,
  getHeaders,
  hasImageInRequestBody,
  logger,
  makeReadableStream,
} from "./helper";

// Llama-style request shape
export interface LlamaCompletionRequest {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  model?: string;
}

// Llama-style response shape
export interface LlamaCompletionResponse {
  id: string;
  object: string;
  created: number;
  model?: string;
  choices: Array<{
    text: string;
    index: number;
    logprobs?: any;
    finish_reason?: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Convert Llama request to Copilot chat payload
export function llamaToCopilotPayload(
  req: LlamaCompletionRequest,
): ChatCompletionPayload {
  const messages = [{ role: "user", content: req.prompt } as Message];
  return {
    model: req.model || "gpt-4.1", // default model
    temperature: req.temperature,
    top_p: req.top_p,
    messages,
  };
}

// Convert Copilot response to Llama-style response
export function copilotToLlamaResponse(
  resp: CompletionResponse,
): LlamaCompletionResponse {
  const choice = resp.choices?.[0];
  const text = choice?.message?.content || "";
  // Simple token count approximation by splitting on whitespace
  const tokenCount = text.split(/\s+/).filter(Boolean).length;
  return {
    id: resp.id,
    object: "text_completion",
    created: resp.created,
    model: resp.model,
    choices: [
      {
        text,
        index: choice?.index ?? 0,
        finish_reason: choice?.finish_reason,
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: tokenCount,
      total_tokens: tokenCount,
    },
  };
}

export const llamaRoutes = new Hono();

// Llama-style completions proxy (no streaming)
llamaRoutes.post("/completions", async (c: Context) => {
  try {
    const llamaReq = (await c.req.json()) as LlamaCompletionRequest;
    // Map Llama request to Copilot payload
    const copilotPayload = llamaToCopilotPayload(llamaReq);
    const headers = await getHeaders();
    // Call Copilot backend
    const upstream = await fetch(
      "https://api.githubcopilot.com/chat/completions",
      { method: "POST", headers, body: JSON.stringify(copilotPayload) },
    );
    const text = await upstream.text();
    if (!upstream.ok) {
      return c.json(
        { error: { message: text, code: upstream.status } },
        upstream.status as unknown as ContentfulStatusCode,
      );
    }
    const copilotResp = JSON.parse(text) as CompletionResponse;
    const llamaResp = copilotToLlamaResponse(copilotResp);
    return c.json(llamaResp);
  } catch (err: any) {
    logger.error(err);
    return c.json(
      { error: { message: String(err), code: 500 } },
      500 as unknown as ContentfulStatusCode,
    );
  }
});

llamaRoutes.get("/api/tags", async (c: Context) => {
  return c.json({
    models: [
      {
        "name": "llama2:latest",
        "model": "llama2:latest",
        "modified_at": "2023-12-07T09:32:18.757212583Z",
        "size": 3825819519,
        "digest":
          "sha256:8daa9615cce30c259a9555b1cc250d461d1bc69980a274b44d7eda0be78076d8",
        "details": {
          "parent_model": "",
          "format": "gguf",
          "family": "llama",
          "families": ["llama"],
          "parameter_size": "7B",
          "quantization_level": "Q4_0",
        },
      },
    ],
  });
});
