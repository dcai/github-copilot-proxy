import { join } from "path";
import pino from "pino";

const logLevel = process.env.LOG_LEVEL || "debug";

export const logger = pino({
  transport: {
    targets: [
      {
        target: "pino-pretty",
        level: logLevel,
        options: {
          colorize: true,
          colorizeObjects: true,
          ignore: "pid,hostname",
          singleLine: true,
        },
      },
      {
        target: "pino-roll",
        level: logLevel,
        options: {
          file: join("logs", "chat"),
          size: "1m",
          extension: ".log",
          mkdir: true,
        },
      },
    ],
  },
});

export function msToTime(ms: number): string {
  const milliseconds = ms % 1000;
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return (
    (days ? days + "d " : "") +
    (hours ? hours + "h " : "") +
    (minutes ? minutes + "m " : "") +
    (seconds ? seconds + "s " : "") +
    (milliseconds ? milliseconds + "ms" : "")
  ).trim();
}

interface GetHeadersOptions {
  token?: string | null;
  visionRequest?: boolean;
}

export async function getHeaders({
  token = null,
  visionRequest = false,
}: GetHeadersOptions = {}): Promise<Record<string, string>> {
  const EDITOR_VERSION = "vscode/1.99.3";
  const version_string = "0.17.2024062801";
  const PLUGIN_VERSION = `copilot-chat/${version_string}`;
  const USER_AGENT = `GitHubCopilotChat/${version_string}`;
  const copilotToken = token ? token : await tokenManager.getToken();
  return {
    "accept": "application/json",
    "accept-encoding": "gzip,deflate,br",
    "content-type": "application/json",
    "copilot-vision-request": String(visionRequest),
    "authorization": `Bearer ${copilotToken}`,
    "editor-version": EDITOR_VERSION,
    "editor-plugin-version": PLUGIN_VERSION,
    "user-agent": USER_AGENT,
  };
}

class TokenManager {
  private token: string | null;
  private expiry: number;
  private api: string;

  constructor() {
    this.token = null;
    this.expiry = 0;
    this.api = "https://api.githubcopilot.com";
  }

  async fetch(): Promise<void> {
    const now = Date.now();
    if (this.token && now < this.expiry) {
      logger.debug(
        `reusing token, will expire in ${msToTime(this.expiry - now)}`,
      );
      return;
    }

    try {
      logger.debug(`refreshing token`);
      const resp = await fetch(
        "https://api.github.com/copilot_internal/v2/token",
        {
          method: "GET",
          headers: await getHeaders({ token: process.env.COPILOT_OAUTH_TOKEN }),
        },
      );

      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }

      const data = (await resp.json()) as TokenResponse;
      logger.debug("token retrieved");
      this.token = data.token;
      this.expiry = data.expires_at * 1000;
      if (data?.endpoints?.api) {
        this.api = data.endpoints.api;
      }
    } catch (ex) {
      logger.error(ex, "exception");
      if (ex instanceof Error) {
        logger.error(ex.message, "response data");
      }
    }
  }

  async getToken(): Promise<string | null> {
    await this.fetch();
    return this.token;
  }

  async getApi(): Promise<string> {
    await this.fetch();
    return this.api;
  }
}

const tokenManager = new TokenManager();

export function shortenText(
  text: string | undefined | null,
  maxLength = 256,
): string {
  if (!text) {
    return "";
  }
  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength) + "...";
}

interface Message {
  role: string;
  content: string | MessageContent[];
}

interface MessageContent {
  type: string;
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface ChatCompletionPayload {
  stream?: boolean;
  messages?: Message[];
}
export interface CompletionResponse {
  model?: string;
  choices?: Array<{
    finish_reason?: string;
    message: {
      content: string;
      role: string;
    };
  }>;
  usage?: {
    total_tokens?: number;
  };
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

export function extractOneMessage(msg: Message) {
  if (Array.isArray(msg?.content)) {
    const m = msg.content.find((c) => c.type === "text");
    return m?.text || "";
  }

  return (msg?.content as string) || "";
}

export function findSystemMessageContent(
  payload: ChatCompletionPayload,
): string[] {
  const messages = (payload?.messages || []).filter(
    (m) => m?.role === "system",
  );
  return messages.map((m) => extractOneMessage(m));
}

export function findUserMessageContent(
  payload: ChatCompletionPayload,
): string[] {
  const messages = (payload?.messages || []).filter((m) => m?.role === "user");

  return messages.map((m) => extractOneMessage(m));
}

export function hasImageInRequestBody(payload: ChatCompletionPayload): boolean {
  try {
    const userMessage = (payload?.messages || []).find(
      (m) => m?.role === "user",
    );

    if (typeof userMessage?.content === "string") {
      return false;
    }

    if (Array.isArray(userMessage?.content)) {
      const imageUrlContent = userMessage?.content.find(
        (c) => c.type === "image_url",
      );
      return Boolean(imageUrlContent);
    }
  } catch (ex) {
    logger.error(ex, "hasImageInRequestBody error");
  }
  return false;
}

export interface SentryBreadcrumbData {
  [key: string]: unknown;
}

export function addBreadcrumb(Sentry: any, obj: SentryBreadcrumbData): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }
  Sentry.addBreadcrumb(obj);
}

export function makeReadableStream(
  reader: ReadableStreamDefaultReader,
  parseChunk = false,
) {
  if (!parseChunk) {
    return new ReadableStream({
      async start(controller: ReadableStreamDefaultController) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          controller.enqueue(value);
        }
        controller.close();
      },
    });
  }

  return new ReadableStream({
    async start(controller: ReadableStreamDefaultController) {
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        controller.enqueue(value);

        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (let line of lines) {
          line = line.trim();
          if (line.includes("[DONE]")) {
            continue;
          }
          try {
            if (!line) continue;

            if (line.startsWith("data:")) {
              const str = line.replace(/^data:\s*/, "");
              const json: CompletionResponse = JSON.parse(str);
              const stopped = json?.choices?.[0]?.finish_reason === "stop";
              if (stopped) {
                logger.info(
                  {
                    model: json?.model,
                    usage: json?.usage?.total_tokens,
                  },
                  "DONE",
                );
              }
            } else {
              try {
                const error: CompletionResponse = JSON.parse(line);
                logger.error(
                  {
                    line,
                    error,
                  },
                  "error object received when streaming answer",
                );
              } catch (ex) {
                logger.error(
                  {
                    line,
                    ex,
                  },
                  "parse line error",
                );
              }
            }
          } catch (ex) {
            logger.error(ex, line);
          }
        }
      }
      controller.close();
    },
  });
}
