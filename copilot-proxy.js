import { getHeaders, logger } from "./helper.js";

const port = process.env.GHC_PORT || 7890;
const host = process.env.GHC_HOST || "0.0.0.0";

if (!process.env.COPILOT_OAUTH_TOKEN) {
  logger.error("COPILOT_OAUTH_TOKEN is not set");
  process.exit(1);
}

function hasImageInRequestBody(payload) {
  try {
    const userMessages = (payload?.messages || []).find(
      (m) => m?.role === "user",
    );

    if (userMessages?.content instanceof String) {
      return false;
    }

    const imageUrlContent = (userMessages?.content || []).find(
      (c) => c.type === "image_url",
    );
    // const imageUrlExample = {
    //   type: 'image_url',
    //   image_url : {
    //     url: 'data:image/png;base6,xxxxxxxxxxxxxxxxxxxx'
    //   }
    // }
    return Boolean(imageUrlContent);
  } catch (ex) {
    logger.error(ex, "hasImageInRequestBody error");
  }
  return false;
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
            question: payload?.messages?.[0].content?.substring(0, 255),
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
          return Response.json(await response.json());
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
                      logger.info(`model: ${json.model}`);
                      logger.info(`usage: ${json?.usage?.total_tokens}`);
                    }
                  }
                } catch (ex) {
                  logger.error(ex.toString(), " => ", str);
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
          { error: "something bad happened" },
          { status: 500 },
        );
      }
    }

    return new Response("Not found", { status: 404 });
  },
});

logger.info(`Copilot Chat Proxy listening on http://${host}:${port}`);
