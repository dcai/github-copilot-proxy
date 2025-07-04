import type { ChatCompletionPayload, CompletionResponse } from "./helper";
import type { Message } from "./helper";

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
  req: LlamaCompletionRequest
): ChatCompletionPayload {
  const messages = [
    { role: "user", content: req.prompt } as Message
  ];
  return {
    model: req.model || "gpt-4.1", // default model
    temperature: req.temperature,
    top_p: req.top_p,
    messages,
  };
}

// Convert Copilot response to Llama-style response
export function copilotToLlamaResponse(
  resp: CompletionResponse
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
