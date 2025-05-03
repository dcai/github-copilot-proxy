import {
  hasImageInRequestBody,
  getHeaders,
  logger,
  shortenText,
  findUserMessageContent,
} from "./helper.js";

const port = process.env.GHC_PORT || 7890;
const host = process.env.GHC_HOST || "0.0.0.0";

import * as Sentry from "@sentry/bun";

function addBreadcrumb(obj) {
  if (!process.env.SENTRY_DSN) {
    return;
  }
  Sentry.addBreadcrumb(obj);
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.requestDataIntegration(),
      Sentry.nodeContextIntegration(),
      // new Sentry.bunServerIntegration()
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

Bun.serve({
  port,
  hostname: host,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/v1/models") {
      const response = await fetch("https://api.githubcopilot.com/models", {
        method: "GET",
        headers: await getHeaders(),
      });
      logger.debug(`fetched models`);
      return Response.json(await response.json());
    }

    if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
      try {
        const payload = await req.json();
        const visionRequest = hasImageInRequestBody(payload);
        const stream = payload?.stream || false;
        const headers = await getHeaders({ visionRequest });
        logger.info(
          {
            visionRequest,
            model: payload?.model,
            question: shortenText(findUserMessageContent(payload)),
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
          logger.debug(
            {
              stream,
              model: json?.model,
              usage: json?.usage?.total_tokens,
            },
            "DONE",
          );
          return Response.json(json);
        }

        const stream_response = new ReadableStream({
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
                if (line.includes("[DONE]")) continue;
                try {
                  if (!line) continue;

                  if (line.startsWith("data:")) {
                    const str = line.replace(/^data:\s*/, "");
                    const json = JSON.parse(str);
                    const stopped =
                      json?.choices?.[0]?.finish_reason === "stop";
                    if (stopped) {
                      logger.debug(
                        {
                          stream,
                          model: json?.model,
                          usage: json?.usage?.total_tokens,
                        },
                        "DONE",
                      );
                      // logger.info(`model: ${json.model}`);
                      // logger.info(`usage: ${json?.usage?.total_tokens}`);
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

        return new Response(stream_response, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      } catch (err) {
        logger.error(err);
        return Response.json(
          { error: `something bad happened: ${String(err)}` },
          { status: 500 },
        );
      }
    }

    return new Response("Not found", { status: 404 });
  },
});

logger.info(`Copilot Chat Proxy listening on http://${host}:${port}`);
