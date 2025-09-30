// Type definitions aggregated from helper.ts and ollama.ts

// helper.ts
export interface GetHeadersOptions {
  token?: string | null;
  visionRequest?: boolean;
}

export interface Message {
  role: string;
  content: string | MessageContent[];
}

export interface MessageContent {
  type: string;
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface ChatCompletionPayload {
  model: string;
  temperature?: number;
  top_p?: number;
  service_tier?: string; // 'auto'
  stream?: boolean;
  messages?: Message[];
}

export type FilterType = {
  filtered: boolean;
  severity: "safe" | "low" | "medium" | "high" | "critical";
};

export interface CompletionResponse {
  id: string;
  object: string;
  created: number;
  model?: string;
  choices?: Array<{
    finish_reason?: string;
    index?: number;
    content_filter_offsets?: {
      check_offset: number;
      start_offset: number;
      end_offset: number;
    };
    content_filter_results?: {
      hate?: FilterType;
      self_harm?: FilterType;
      sexual?: FilterType;
      violence?: FilterType;
    };
    delta?: {
      content: string;
    };
    message?: Message;
  }>;
  usage?: {
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  system_fingerprint: string;
  service_tier?: string; // 'auto'
}

export type ModelType = {
  id: string;
  name: string;
  version: string;
};

export type TokenResponse = {
  token: string;
  expires_at: number;
  endpoints?: { api?: string };
};

export type ModelsListResponse = {
  data: ModelType[];
};

export interface SentryBreadcrumbData {
  [key: string]: unknown;
}

// ollama.ts
export type OllamaMessage = {
  content: string;
  role: "user" | "assistant" | "system";
};

export interface OllamaChatRequest {
  messages: OllamaMessage[];
  stream: boolean;
  model: string;
}

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

export type CopilotQuotaSnapshot = {
  entitlement: number;
  overage_count: number;
  overage_permitted: boolean;
  percent_remaining: number;
  quota_id: string;
  quota_remaining: number;
  remaining: number;
  unlimited: boolean;
  timestamp_utc: string;
};

export type Organization = { name: string; login: string };

export type CopilotUsageResponse = {
  access_type_sku: string;
  analytics_tracking_id: string;
  assigned_date: string;
  can_signup_for_limited: boolean;
  chat_enabled: boolean;
  copilot_plan: string;
  organization_login_list: string[]; // array of organization logins
  organization_list: Organization[]; // array of organization names/IDs
  quota_reset_date: string;
  quota_snapshots: {
    chat: CopilotQuotaSnapshot;
    completions: CopilotQuotaSnapshot;
    premium_interactions: CopilotQuotaSnapshot;
  };
};

export interface Embedding {
  object: string;
  embedding: Array<number>;
  index: number;
}

export interface EmbeddingResponse {
  object: string;
  data: Array<Embedding>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}
