require("dotenv").config();
const express = require("express");
const axios = require("axios");
const tokenManager = require("./token");
const {
  EDITOR_VERSION,
  USER_AGENT,
  EDITOR_PLUGIN_VERSION,
} = require("./config");

const app = express();
const port = process.env.GHC_PORT || 7890;
const host = process.env.GHC_HOST || "0.0.0.0";

app.use(express.json());

app.get("/v1/models", async (_req, res) => {
  const copilotToken = await tokenManager.getToken();
  const options = {
    method: "GET",
    url: "https://api.githubcopilot.com/models",
    headers: {
      authorization: `Bearer ${copilotToken}`,
      "content-type": "application/json",
      "editor-version": EDITOR_VERSION,
      "user-agent": USER_AGENT,
      "editor-plugin-version": EDITOR_PLUGIN_VERSION,
    },
  };
  const response = await axios.request(options);
  return res.json(response.data);
});

app.post("/v1/chat/completions", async (req, res) => {
  try {
    const payload = req.body;
    const copilotToken = await tokenManager.getToken();

    const stream = payload?.stream || false;
    const options = {
      method: "POST",
      url: "https://api.githubcopilot.com/chat/completions",
      headers: {
        authorization: `Bearer ${copilotToken}`,
        "content-type": "application/json",
        "editor-version": EDITOR_VERSION,
        "user-agent": USER_AGENT,
        "editor-plugin-version": EDITOR_PLUGIN_VERSION,
      },
      data: payload,
    };
    if (!stream) {
      const response = await axios.request(options);
      return res.json(response.data);
    }

    if (stream) {
      const response = await axios.request({
        ...options,
        responseType: "stream",
      });
      const dataStream = response.data;

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.flushHeaders();

      let buffer = "";
      dataStream.on("data", (chunk) => {
        buffer += chunk;

        const lines = buffer.split("\n");
        buffer = lines.pop(); // Keep the last line in the buffer

        for (let line of lines) {
          line = line.trim();
          if (line.includes("[DONE]")) {
            continue;
          }
          try {
            if (!line) {
              continue;
            }

            // {
            //   "choices": [
            //     {
            //       "finish_reason": "stop",
            //       "index": 0,
            //       "delta": {
            //         "content": null,
            //         "annotations": {
            //           "CodeVulnerability": [
            //             {
            //               "id": 0,
            //               "start_offset": 48,
            //               "end_offset": 48,
            //               "details": { "type": "general" },
            //               "citations": {},
            //             },
            //           ],
            //         },
            //         "copilot_annotations": {
            //           "CodeVulnerability": [
            //             {
            //               "id": 0,
            //               "start_offset": 48,
            //               "end_offset": 48,
            //               "details": { "type": "general" },
            //               "citations": {},
            //             },
            //           ],
            //         },
            //       },
            //     },
            //   ],
            //   "created": 1745479088,
            //   "id": "",
            //   "usage": {
            //     "completion_tokens": 305,
            //     "prompt_tokens": 10,
            //     "total_tokens": 315,
            //   },
            //   "model": "gpt-4.1-2025-04-14",
            //   "system_fingerprint": "fp_11111",
            // }
            if (line.startsWith("data:")) {
              const str = line.replace(/^data:\s*/, "");
              const json = JSON.parse(str);
              const stopped = json?.choices?.[0]?.finish_reason === "stop";
              if (stopped) {
                console.info(`model: ${json.model}`);
                console.info(`usage: ${json?.usage?.total_tokens}`);
              }
            }
          } catch (ex) {
            // console.error(ex);
            console.error(ex.toString(), " => ", str);
          }
        }

        res.write(chunk);
      });

      dataStream.on("end", () => {
        // res.write("\n\n");
        res.end();
      });

      dataStream.on("error", (err) => {
        console.error("OpenAI stream error:", err);
        res.end();
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "something bad happened" });
  }
});

app.listen(port, () => {
  console.log(`Copilot Chat Proxy listening on http://${host}:${port}`);
});
