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
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/v1/models", async (req, res) => {
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

      dataStream.on("data", (chunk) => {
        console.info("OpenAI stream chunk:", chunk.toString());
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
  console.log(`Copilot proxy listening on http://localhost:${port}`);
});
