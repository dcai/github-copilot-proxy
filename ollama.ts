import { ContentfulStatusCode } from "hono/utils/http-status";
import type { ChatCompletionPayload, CompletionResponse } from "./types.ts";
import { Hono } from "hono";
import type { Context } from "hono";
import { dateToMicroISO, getHeaders, logger } from "./helper";

// Simulate Llama-style API for GitHub Copilot
// https://github.com/ollama/ollama/blob/main/docs/api.md

export type OllamaMessage = {
  content: string;
  role: "user" | "assistant" | "system";
};
export interface OllamaChatRequest {
  messages: OllamaMessage[];
  stream: boolean;
  model: string;
}

// Llama-style response shape
export interface OllamaCompletionResponse {
  model: string;
  created?: string;
  message?: OllamaMessage;
  messages?: OllamaMessage[];
  done: boolean;
  done_reason: "stop" | "length" | "content_filter" | "tool_use";
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

// Convert Llama request to Copilot chat payload
export function llamaToCopilotPayload(
  req: OllamaChatRequest,
): ChatCompletionPayload {
  return {
    model: "gpt-4.1", // default model
    messages: req.messages.map((msg) => {
      return {
        content: msg.content,
        role: msg.role,
      };
    }),
  };
}

// Convert Copilot response to Llama-style response
export function copilotToOllamaStreamResponse(
  openAiResponse: CompletionResponse,
): string {
  const choice = openAiResponse.choices?.[0];
  const text = choice?.message?.content || "";

  const secondLine = JSON.stringify({
    model: "llama",
    created_at: dateToMicroISO(new Date()),
    message: {
      content: text,
      role: "assistant",
    },
    done: true,
    done_reason: "stop",
    // total_duration: 4883583458,
    // load_duration: 1334875,
    // prompt_eval_count: 26,
    // prompt_eval_duration: 342546000,
    // eval_count: 282,
    // eval_duration: 4535599000,
  });
  return `${secondLine}`;
}

export const ollamaApiRoutes = new Hono();

// Llama-style completions proxy (no streaming)
ollamaApiRoutes.post("/api/chat", async (c: Context) => {
  try {
    const ollamaChatReq = (await c.req.json()) as OllamaChatRequest;
    const stream = ollamaChatReq.stream || false;
    logger.info(`/api/chat: ${JSON.stringify(ollamaChatReq)}`);
    // Map Llama request to Copilot payload
    const copilotPayload = llamaToCopilotPayload(ollamaChatReq);
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
    if (stream) {
      const ollamaResp = copilotToOllamaStreamResponse(copilotResp);
      console.info("🤔 ///// ollama.ts @ LINE 116", ollamaResp);
      return c.text(ollamaResp, 200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });
    }
    return c.json({});
  } catch (err: any) {
    logger.error(err);
    return c.json(
      { error: { message: String(err), code: 500 } },
      500 as unknown as ContentfulStatusCode,
    );
  }
});

const LLAMA = "llama";
ollamaApiRoutes.get("/api/tags", async (c: Context) => {
  // const modelNames = ["gpt-4.1", "claude-sonnet-4", "o4-mini"];
  const modelNames = [LLAMA];
  const models = modelNames.map((name) => ({
    name,
    model: name,
    modified_at: new Date("2025-01-01").toISOString(),
    size: 0,
    digest:
      "sha256:8daa9615cce30c259a9555b1cc250d461d1bc69980a274b44d7eda0be78076d8",
    details: {
      parent_model: LLAMA,
      format: "gguf",
      family: LLAMA,
      families: [LLAMA],
      parameter_size: "671B",
      quantization_level: "Q4_0",
    },
  }));
  return c.json({
    models,
  });
});
ollamaApiRoutes.post("/api/pull", async (c: Context) => {
  return c.json({ status: "success", message: "Model pull initiated." });
});
ollamaApiRoutes.post("/api/show", async (c: Context) => {
  const payload = (await c.req.json()) as { model: string };
  logger.info(`/api/show: ${payload.model}`);
  const modelName = payload.model;
  return c.json({
    "modelfile": "",
    "system": "You are a helpful, respectful and honest assistant.",
    "details": {
      "parent_model": LLAMA,
      "format": "gguf",
      "family": modelName,
      "families": [modelName],
      "parameter_size": "7B",
      "quantization_level": "Q4_0",
    },
    "model_info": {
      "general.architecture": LLAMA,
      "general.file_type": 2,
      "general.parameter_count": 6738415616,
      "general.quantization_version": 2,
      "llama.attention.head_count": 32,
      "llama.attention.head_count_kv": 32,
      "llama.attention.layer_norm_rms_epsilon": 0.000001,
      "llama.block_count": 32,
      "llama.context_length": 4096,
      "llama.embedding_length": 4096,
      "llama.feed_forward_length": 11008,
      "llama.rope.dimension_count": 128,
      "llama.rope.freq_base": 10000,
      "llama.vocab_size": 32000,
      "tokenizer.ggml.model": LLAMA,
    },
    "capabilities": [
      "completion",
      "vision",
      "chat",
      "embeddings",
      "function-calling",
      "tool-use",
      "tools",
    ],
  });
});
