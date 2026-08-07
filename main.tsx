import * as Sentry from "@sentry/bun";
import chalk from "chalk";
import { events } from "fetch-event-stream";
import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { renderToString } from "hono/jsx/dom/server";
import { hostname } from "os";
import { lookup } from "mime-types";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  debugPrint,
  findSystemMessageContent,
  findUserMessageContent,
  getHeaders,
  hasImageInRequestBody,
  logger,
} from "./helper";
import { ollamaApiRoutes } from "./ollama";
import type {
  ChatCompletionPayload,
  CompletionResponse,
  CopilotUsageResponse,
  EmbeddingResponse,
  ModelsListResponse,
  ResponsesPayload,
} from "./types.ts";
import ModelsPage from "./ModelsPage";
import UsagePage from "./UsagePage";

const port: number = Number(process.env.GHC_PORT) || 7890;
const host: string = process.env.GHC_HOST || "127.0.0.1";
const app: Hono = new Hono();
const STATIC_DIR = join(import.meta.dirname, "static");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    serverName: hostname(),
    environment: process.env.NODE_ENV,
    release: `github-copilot-proxy@1.0.0`,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.requestDataIntegration(),
      Sentry.nodeContextIntegration(),
    ],
    tracesSampleRate: 1.0,
    tracePropagationTargets: [
      "localhost",
      /^https:\/\/api\.githubcopilot\.com/,
    ],
  });
}

if (!process.env.COPILOT_OAUTH_TOKEN) {
  logger.error("COPILOT_OAUTH_TOKEN is not set");
  process.exit(1);
}

app.use("/*", cors(), async (c: Context, next) => {
  const auth = c.req.header("Authorization")?.split(" ")?.[1];
  logger.debug(`${c.req.path}: token to verify: ${auth}`);
  return next();
});

app.get("/health", async (c: Context) => {
  return c.text("ok");
});

app.get("/static/*", async (c: Context) => {
  const filePath = c.req.path.replace("/static/", "");
  const fullPath = join(STATIC_DIR, filePath);

  // Prevent directory traversal
  if (!fullPath.startsWith(STATIC_DIR)) {
    return c.text("Forbidden", 403);
  }

  try {
    const content = await readFile(fullPath);
    const contentType = lookup(fullPath) || "application/octet-stream";
    return new Response(content, {
      headers: { "Content-Type": contentType },
    });
  } catch {
    return c.text("Not found", 404);
  }
});

const usageHandler = async (c: Context) => {
  const response = await fetch("https://api.github.com/copilot_internal/user", {
    method: "GET",
    headers: await getHeaders({ token: process.env.COPILOT_OAUTH_TOKEN }),
  });
  const usage = (await response.json()) as CopilotUsageResponse;
  return c.html(renderToString(<UsagePage usage={usage} />));
};

app.get("/usage", usageHandler);
app.get("/", usageHandler);

const modelsHandler = async (c: Context) => {
  const response = await fetch("https://api.githubcopilot.com/models", {
    method: "GET",
    headers: await getHeaders(),
  });
  logger.info(`fetched models`);
  return c.json((await response.json()) as ModelsListResponse);
};
app.get("/v1/models", modelsHandler);
app.get("/models", modelsHandler);
app.get("/models.html", async (c: Context) => {
  return c.html(renderToString(<ModelsPage />));
});

const embeddingsHandler = async (c: Context) => {
  const payload = (await c.req.json()) as {
    input: string | string[];
    model: string;
  };
  const headers = await getHeaders({ visionRequest: false });
  logger.info(`/v1/embeddings: ${JSON.stringify(payload)}`);

  try {
    const response = await fetch("https://api.githubcopilot.com/embeddings", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const json = JSON.parse(text) as EmbeddingResponse;
    return c.json(json);
  } catch (e) {
    return c.json({ error: `something bad happened: ${String(e)}` }, 500);
  }
};
app.post("/embeddings", embeddingsHandler);
app.post("/v1/embeddings", embeddingsHandler);

app.post("/query", async (c: Context) => {
  const { system, user } = (await c.req.json()) as {
    system: string;
    user: string;
  };
  const headers = await getHeaders({ visionRequest: false });
  const payload: ChatCompletionPayload = {
    model: "gpt-4.1",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    stream: false,
  };
  logger.info(`/query: ${system}`);
  logger.info(`/query: ${user}`);

  try {
    const response = await fetch(
      "https://api.githubcopilot.com/chat/completions",
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      },
    );

    const text = await response.text();
    const json = JSON.parse(text) as CompletionResponse;

    const answer = json?.choices?.[0]?.message?.content || "No answer found";
    logger.info(`/query answer: ${answer}`);
    return c.json({
      answer,
    });
  } catch (e) {
    return c.json({ error: `something bad happened: ${String(e)}` }, 500);
  }
});

const chatCompletionHandler = async (c: Context) => {
  try {
    const payload = (await c.req.json()) as ChatCompletionPayload;
    const visionRequest: boolean = hasImageInRequestBody(payload);
    const stream: boolean = payload?.stream || false;
    const headers = await getHeaders({ visionRequest });
    debugPrint(
      chalk.green(findSystemMessageContent(payload)?.[0] || "N/A"),
      "SYSTEM Prompt",
    );
    debugPrint(
      chalk.red(findUserMessageContent(payload)?.[0] || "N/A"),
      "USER Prompt",
    );

    const response = await fetch(
      "https://api.githubcopilot.com/chat/completions",
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      },
    );

    if (!stream) {
      const text = await response.text();
      try {
        const json = JSON.parse(text) as CompletionResponse;
        const unixts = Math.floor(Date.now() / 1000);
        json.created = unixts;
        json.object = "chat.completion";
        const answerText = json?.choices?.[0]?.message?.content;
        debugPrint(
          chalk.blue(`${answerText || "No message content found"}`),
          "LLM Response",
        );
        return c.json(json);
      } catch (e) {
        logger.error(
          {
            text,
            e,
          },
          "error",
        );
        return c.json(
          {
            error: `something bad happened: ${String(e)}`,
            upstream: {
              status: response.status,
              statusText: response.statusText,
              text: text,
            },
          },
          500,
        );
      }
    }
    // END of non-streaming response

    return streamSSE(c, async (stream) => {
      if (!response.ok) {
        console.error("Upstream error", response.status, response.statusText);
        console.error(await response.text());
        return;
      }
      const openaiEvents = events(response);
      for await (const rawEvent of openaiEvents) {
        if (rawEvent.data === "[DONE]") {
          break;
        }

        if (!rawEvent.data) {
          continue;
        }

        // const chunk = JSON.parse(rawEvent.data);
        await stream.writeSSE({
          data: rawEvent.data,
        });
      }
    });
    // const streamResponse = makeReadableStream(response.body.getReader(), false);
    // return new Response(streamResponse, {
    //   headers: {
    //     "Content-Type": "text/event-stream",
    //     "Cache-Control": "no-cache",
    //     "Connection": "keep-alive",
    //   },
    // });
  } catch (err) {
    logger.error(err);
    return c.json({ error: `something bad happened: ${String(err)}` }, 500);
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractResponseOutputText(response: unknown): string {
  if (!isRecord(response) || !Array.isArray(response.output)) {
    return "";
  }

  return response.output
    .filter(isRecord)
    .flatMap((output) =>
      Array.isArray(output.content) ? output.content.filter(isRecord) : [],
    )
    .filter(
      (content) =>
        content.type === "output_text" && typeof content.text === "string",
    )
    .map((content) => content.text)
    .join("");
}

function extractStreamOutputText(events: unknown[]): string {
  let completedOutput = "";
  let completedText = "";
  let deltas = "";

  for (const event of events) {
    if (!isRecord(event)) {
      continue;
    }

    if (isRecord(event.response)) {
      const output = extractResponseOutputText(event.response);
      if (output) {
        completedOutput = output;
      }
    }

    if (
      event.type === "response.output_text.done" &&
      typeof event.text === "string"
    ) {
      completedText = event.text;
    }

    if (
      event.type === "response.output_text.delta" &&
      typeof event.delta === "string"
    ) {
      deltas += event.delta;
    }
  }

  return completedOutput || completedText || deltas;
}

function debugResponseOutput(body: string, streaming = false): void {
  const eventBodies = streaming
    ? body.split(/\r?\n\r?\n/).map((event) =>
        event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice("data:".length).trimStart())
          .join("\n"),
      )
    : [body];
  const parsedBodies = eventBodies.flatMap((eventBody) => {
    try {
      return [JSON.parse(eventBody) as unknown];
    } catch {
      return [];
    }
  });
  const output = streaming
    ? extractStreamOutputText(parsedBodies)
    : extractResponseOutputText(parsedBodies[0]);

  debugPrint(chalk.blue(output || "No output text found"), "RESPONSE OUTPUT");
}

function debugResponseStream(
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let responseBody = "";

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        responseBody += decoder.decode(chunk, { stream: true });
        controller.enqueue(chunk);
      },
      flush() {
        responseBody += decoder.decode();
        debugResponseOutput(responseBody, true);
      },
    }),
  );
}

const responsesHandler = async (c: Context) => {
  try {
    // Responses requests are deliberately passed through unchanged. The
    // Responses API has a different event and output schema than chat
    // completions, so converting it to the old API would lose information
    // (tool calls, reasoning items, annotations, and output_text).
    const payload = (await c.req.json()) as ResponsesPayload;
    const headers = await getHeaders();
    logger.info(
      { model: payload.model, stream: payload.stream },
      "[RESPONSES]",
    );
    debugPrint(chalk.green(payload.instructions || "N/A"), "INSTRUCTIONS");
    debugPrint(
      chalk.red(
        typeof payload.input === "string"
          ? payload.input
          : JSON.stringify(payload.input, null, 2),
      ),
      "INPUT",
    );

    const response = await fetch("https://api.githubcopilot.com/responses", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    // Keep the upstream SSE stream intact. In particular, do not use the
    // chat-completions event parser here: response.created, response.output
    // and response.completed are Responses API events.
    if (payload.stream) {
      if (!response.ok) {
        const text = await response.text();
        debugPrint(chalk.blue(text), "RESPONSE ERROR");
        return c.json(
          {
            error: "GitHub Copilot Responses API request failed",
            upstream: { status: response.status, text },
          },
          response.status as 400,
        );
      }

      return new Response(
        response.body ? debugResponseStream(response.body) : null,
        {
          status: response.status,
          headers: {
            "content-type":
              response.headers.get("content-type") || "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          },
        },
      );
    }

    const text = await response.text();
    if (!response.ok) {
      debugPrint(chalk.blue(text), "RESPONSE ERROR");
      return c.json(
        {
          error: "GitHub Copilot Responses API request failed",
          upstream: { status: response.status, text },
        },
        response.status as 400,
      );
    }

    debugResponseOutput(text);
    return new Response(text, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    logger.error(err, "Responses API proxy error");
    return c.json({ error: `something bad happened: ${String(err)}` }, 500);
  }
};
app.post("/v1/chat/completions", chatCompletionHandler);
app.post("/chat/completions", chatCompletionHandler);
app.post("/v1/responses", responsesHandler);
app.post("/responses", responsesHandler);

app.route("/ollama", ollamaApiRoutes);

app.notFound(async (c: Context) => {
  const method = c.req.method;
  const path = c.req.path;
  const text = await c.req.text();
  const message =
    `Not found: ${method} ${path}` + (text ? ` | Body: ${text}` : "");
  logger.warn(message);
  return c.text(message, 404);
});

logger.info(
  `Copilot Chat Proxy listening on http://${host}:${port}, hostname: ${hostname()}`,
);

export default {
  port,
  fetch: app.fetch,
};
