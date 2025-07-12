import * as Sentry from "@sentry/bun";
import chalk from "chalk";
import { events } from "fetch-event-stream";
import type { Context } from "hono";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { streamSSE } from "hono/streaming";
import { cors } from "hono/cors";
import { hostname } from "os";
import {
  findSystemMessageContent,
  findUserMessageContent,
  getHeaders,
  hasImageInRequestBody,
  logger,
} from "./helper";
import { ollamaApiRoutes } from "./ollama";
import packageJson from "./package.json";
import type {
  ChatCompletionPayload,
  CompletionResponse,
  CopilotUsageResponse,
  ModelsListResponse,
} from "./types.ts";

const port: number = Number(process.env.GHC_PORT) || 7890;
const host: string = process.env.GHC_HOST || "0.0.0.0";
const app: Hono = new Hono();

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    serverName: hostname(),
    environment: process.env.NODE_ENV,
    release: `${packageJson.name}@${packageJson.version}`,
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

app.use(
  "/v1/*",
  cors(),
  // honoLogger(),
  bearerAuth({
    verifyToken: async (token) => {
      logger.info(`token to identify: ${token}`);
      return true;
    },
  }),
);

app.get("/health", async (c: Context) => {
  return c.text("ok");
});

const usageHandler = async (c: Context) => {
  const response = await fetch("https://api.github.com/copilot_internal/user", {
    method: "GET",
    headers: await getHeaders({ token: process.env.COPILOT_OAUTH_TOKEN }),
  });
  // console.info(await response.text());
  // return c.text("hello");
  return c.json((await response.json()) as CopilotUsageResponse);
};

app.get("/usage", usageHandler);

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
    console.info("[SYSTEM] Prompt:");
    console.info(chalk.green(findSystemMessageContent(payload)?.[0] || "N/A"));
    console.info("[USER] Prompt:");
    console.info(chalk.red(findUserMessageContent(payload)?.[0]));
    logger.info(payload.model, "[MODEL]");

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
        logger.info(
          {
            stream,
            // json,
            answer: json?.choices?.[0]?.message?.content,
          },
          "[DONE]",
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
app.post("/v1/chat/completions", chatCompletionHandler);
app.post("/chat/completions", chatCompletionHandler);

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
