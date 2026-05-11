import { events } from "fetch-event-stream";
import { Hono } from "hono";
import type { Context } from "hono";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { dateToMicroISO, debugPrint, getHeaders, logger } from "./helper";
import type {
  ChatCompletionPayload,
  CompletionResponse,
  MessageContent,
} from "./types.ts";

// Simulate Llama-style API for GitHub Copilot
// https://github.com/ollama/ollama/blob/main/docs/api.md

export type OllamaMessage = {
  content: string;
  role: "user" | "assistant" | "system" | "tool";
  images?: string[];
};

export interface OllamaChatRequest {
  messages: OllamaMessage[];
  stream?: boolean;
  model: string;
}

// Llama-style response shape
export interface OllamaCompletionResponse {
  model: string;
  created_at: string;
  message: OllamaMessage;
  done: boolean;
  done_reason?: "stop" | "length" | "content_filter" | "tool_use";
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

function getOllamaModelName(req: OllamaChatRequest): string {
  return req.model || "llama";
}

function getOpenAiModelName(_req: OllamaChatRequest): string {
  return "gpt-4.1";
}

// Convert Llama request to Copilot chat payload
export function llamaToCopilotPayload(
  req: OllamaChatRequest,
): ChatCompletionPayload {
  const stream = req.stream !== false;

  return {
    model: getOpenAiModelName(req),
    stream,
    messages: req.messages.map((msg) => {
      if (msg.images?.length) {
        return {
          role: msg.role,
          content: [
            {
              type: "text",
              text: msg.content,
            },
            ...msg.images.map((image) => {
              return {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${image}`,
                },
              };
            }),
          ],
        };
      }

      return {
        content: msg.content,
        role: msg.role,
      };
    }),
  };
}

function extractTextContent(
  content: string | MessageContent[] | undefined,
): string {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  return content
    .filter((part: MessageContent) => {
      return part.type === "text" && typeof part.text === "string";
    })
    .map((part: MessageContent) => {
      return part.text || "";
    })
    .join("\n");
}

function toOllamaChunk(
  model: string,
  content: string,
  done: boolean,
  doneReason?: OllamaCompletionResponse["done_reason"],
  usage?: CompletionResponse["usage"],
): OllamaCompletionResponse {
  return {
    model,
    created_at: dateToMicroISO(new Date()),
    message: {
      role: "assistant",
      content,
    },
    done,
    done_reason: doneReason,
    prompt_eval_count: usage?.prompt_tokens,
    eval_count: usage?.completion_tokens,
  };
}

function toOllamaResponse(
  model: string,
  openAiResponse: CompletionResponse,
): OllamaCompletionResponse {
  const choice = openAiResponse.choices?.[0];
  const text = extractTextContent(choice?.message?.content);

  return toOllamaChunk(
    model,
    text,
    true,
    (choice?.finish_reason as OllamaCompletionResponse["done_reason"]) ||
      "stop",
    openAiResponse.usage,
  );
}

export const ollamaApiRoutes = new Hono();

// Llama-style completions proxy
ollamaApiRoutes.post("/api/chat", async (c: Context) => {
  const start = performance.now();

  try {
    const ollamaChatReq = (await c.req.json()) as OllamaChatRequest;
    const stream = ollamaChatReq.stream !== false;
    const ollamaModel = getOllamaModelName(ollamaChatReq);

    logger.info(
      {
        model: ollamaModel,
        stream,
      },
      "/api/chat",
    );

    const copilotPayload = llamaToCopilotPayload(ollamaChatReq);
    const headers = await getHeaders();
    const upstream = await fetch(
      "https://api.githubcopilot.com/chat/completions",
      { method: "POST", headers, body: JSON.stringify(copilotPayload) },
    );

    if (!upstream.ok) {
      const text = await upstream.text();
      return c.json(
        { error: { message: text, code: upstream.status } },
        upstream.status as unknown as ContentfulStatusCode,
      );
    }

    if (!stream) {
      const text = await upstream.text();
      const copilotResp = JSON.parse(text) as CompletionResponse;
      const ollamaResp = toOllamaResponse(ollamaModel, copilotResp);
      debugPrint(JSON.stringify(ollamaResp, null, 2), "OLLAMA");
      return c.json(ollamaResp);
    }

    if (!upstream.body) {
      return c.json(
        { error: { message: "Upstream response body is missing", code: 500 } },
        500 as unknown as ContentfulStatusCode,
      );
    }

    const encoder = new TextEncoder();
    const streamBody = new ReadableStream({
      async start(controller) {
        let promptEvalCount: number | undefined;
        let evalCount = 0;
        let doneReason: OllamaCompletionResponse["done_reason"] = "stop";

        try {
          const openAiEvents = events(upstream);

          for await (const rawEvent of openAiEvents) {
            if (!rawEvent.data) {
              continue;
            }

            if (rawEvent.data === "[DONE]") {
              const finalChunk = toOllamaChunk(
                ollamaModel,
                "",
                true,
                doneReason,
                {
                  prompt_tokens: promptEvalCount,
                  completion_tokens: evalCount,
                },
              );
              controller.enqueue(
                encoder.encode(`${JSON.stringify(finalChunk)}\n`),
              );
              break;
            }

            const chunk = JSON.parse(rawEvent.data) as CompletionResponse;
            const choice = chunk.choices?.[0];
            const deltaText = choice?.delta?.content || "";

            if (chunk.usage?.prompt_tokens !== undefined) {
              promptEvalCount = chunk.usage.prompt_tokens;
            }

            if (chunk.usage?.completion_tokens !== undefined) {
              evalCount = chunk.usage.completion_tokens;
            } else if (deltaText) {
              evalCount += 1;
            }

            if (choice?.finish_reason) {
              doneReason =
                choice.finish_reason as OllamaCompletionResponse["done_reason"];
            }

            if (!deltaText) {
              continue;
            }

            const ollamaChunk = toOllamaChunk(
              ollamaModel,
              deltaText,
              false,
              undefined,
              {
                prompt_tokens: promptEvalCount,
                completion_tokens: evalCount,
              },
            );
            controller.enqueue(
              encoder.encode(`${JSON.stringify(ollamaChunk)}\n`),
            );
          }
        } catch (error) {
          logger.error(error, "ollama stream proxy error");
          controller.error(error);
          return;
        }

        controller.close();
        logger.info(
          {
            model: ollamaModel,
            durationMs: Math.round(performance.now() - start),
          },
          "/api/chat stream complete",
        );
      },
    });

    return new Response(streamBody, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
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
