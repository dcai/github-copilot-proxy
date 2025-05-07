import * as Sentry from "@sentry/bun";
import { Hono } from "hono";
import { hostname } from "os";
import { getHeaders, hasImageInRequestBody, logger } from "./helper.js";
import packageJson from "./package.json";

const port = process.env.GHC_PORT || 7890;
const host = process.env.GHC_HOST || "0.0.0.0";
const app = new Hono();

function addBreadcrumb(obj) {
  if (!process.env.SENTRY_DSN) {
    return;
  }
  Sentry.addBreadcrumb(obj);
}

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

app.get("/v1/models", async (c) => {
  const response = await fetch("https://api.githubcopilot.com/models", {
    method: "GET",
    headers: await getHeaders(),
  });
  logger.info(`fetched models`);
  return c.json(await response.json());
});

app.post("/v1/chat/completions", async (c) => {
  try {
    const payload = await c.req.json();
    const visionRequest = hasImageInRequestBody(payload);
    const stream = payload?.stream || false;
    const headers = await getHeaders({ visionRequest });
    logger.info(
      {
        payload,
      },
      "requesting answer",
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
      const json = await response.json();
      logger.info(
        {
          stream,
          json,
        },
        "DONE",
      );
      return c.json(json);
    }

    const streamResponse = new ReadableStream({
      async start(controller) {
        const reader = response.body.getReader();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          controller.enqueue(value);

          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (let line of lines) {
            line = line.trim();
            if (line.includes("[DONE]")) {
              continue;
            }
            try {
              if (!line) continue;

              if (line.startsWith("data:")) {
                const str = line.replace(/^data:\s*/, "");
                const json = JSON.parse(str);
                const stopped = json?.choices?.[0]?.finish_reason === "stop";
                if (stopped) {
                  logger.info(
                    {
                      stream,
                      model: json?.model,
                      usage: json?.usage?.total_tokens,
                    },
                    "DONE",
                  );
                }
              }
            } catch (ex) {
              logger.error(ex, str);
            }
          }
        }
        controller.close();
      },
    });

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

app.notFound((c) => c.text("Not found", 404));

logger.info(
  `Copilot Chat Proxy listening on http://${host}:${port}, hostname: ${hostname()}`,
);

export default {
  port,
  fetch: app.fetch,
};
