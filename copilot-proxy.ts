import * as Sentry from "@sentry/bun";
import type { Context } from "hono";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
// import { logger as honoLogger } from "hono/logger";
import { cors } from "hono/cors";
import { hostname } from "os";
import {
  findSystemMessageContent,
  findUserMessageContent,
  getHeaders,
  hasImageInRequestBody,
  logger,
  makeReadableStream,
} from "./helper";
import type {
  ChatCompletionPayload,
  CompletionResponse,
  ModelsListResponse,
} from "./helper.ts";
import packageJson from "./package.json";
import { ContentfulStatusCode } from "hono/utils/http-status";

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

app.get("/v1/models", async (c: Context) => {
  const response = await fetch("https://api.githubcopilot.com/models", {
    method: "GET",
    headers: await getHeaders(),
  });
  logger.info(`fetched models`);
  return c.json((await response.json()) as ModelsListResponse);
});

app.post("/v1/chat/completions", async (c: Context) => {
  try {
    const payload = (await c.req.json()) as ChatCompletionPayload;
    const visionRequest: boolean = hasImageInRequestBody(payload);
    const stream: boolean = payload?.stream || false;
    const headers = await getHeaders({ visionRequest });
    logger.info(
      {
        system: findSystemMessageContent(payload),
        user: findUserMessageContent(payload),
      },
      "[ASKING]",
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

    const streamResponse = makeReadableStream(response.body.getReader(), true);
    return new Response(streamResponse, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    logger.error(err);
    return c.json({ error: `something bad happened: ${String(err)}` }, 500);
  }
});

app.notFound((c: Context) => c.text("Not found", 404));

logger.info(
  `Copilot Chat Proxy listening on http://${host}:${port}, hostname: ${hostname()}`,
);

export default {
  port,
  fetch: app.fetch,
};
