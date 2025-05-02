import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "debug",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      colorizeObjects: true,
      ignore: "pid,hostname",
      singleLine: true,
    },
  },
});
export function msToTime(ms) {
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

export async function getHeaders({ token = null, visionRequest = false } = {}) {
  // 'editor-version': 'Neovim/0.6.1',
  // 'editor-plugin-version': 'copilot.vim/1.16.0',
  // 'user-agent': 'GithubCopilot/1.155.0',
  const EDITOR_VERSION = "vscode/1.99.3";
  const PLUGIN_VERSION = "copilot-chat/0.17.2024062801";
  const USER_AGENT = "GitHubCopilotChat/0.17.2024062801";
  const copilotToken = token ? token : await tokenManager.getToken();
  return {
    "accept": "application/json",
    "accept-encoding": "gzip,deflate,br",
    "content-type": "application/json",
    "authorization": `Bearer ${copilotToken}`,
    "editor-version": EDITOR_VERSION,
    "editor-plugin-version": PLUGIN_VERSION,
    "Copilot-Vision-Request": visionRequest,
    "user-agent": USER_AGENT,
  };
}

class TokenManager {
  constructor() {
    this.token = null;
    this.expiry = 0;
    this.api = "https://api.githubcopilot.com";
  }

  async fetch() {
    const now = Date.now();
    // If we have a token and it's not expired, return it
    if (this.token && now < this.expiry) {
      logger.debug(`reusing token, will expire in ${msToTime(this.expiry - now)}`);
      return this.token;
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

      const data = await resp.json();
      logger.debug("token retrieved");
      // logger.debug(data, "token retrieved");
      this.token = data.token;
      this.expiry = data.expires_at * 1000;
      if (data?.endpoints?.api) {
        this.api = data?.endpoints?.api;
      }
    } catch (ex) {
      logger.error(ex, "exception");
      logger.error(ex.response?.data || ex.message, "response data");
    }
  }
  async getToken() {
    await this.fetch();
    return this.token;
  }
  async getApi() {
    await this.fetch();
    return this.api;
  }
}

const tokenManager = new TokenManager();

export function shortenText(text, maxLength = 256) {
  if (!text) {
    return "";
  }
  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength) + "...";
}

export function findUserMessageContent(payload) {
  const msg = (payload?.messages || []).find((m) => m?.role === "user");

  if (Array.isArray(msg?.content)) {
    const m = msg.content.find((c) => c.type === "text");

    return m?.text || "";
  }

  return msg?.content;
}

export function hasImageInRequestBody(payload) {
  try {
    const userMessage = (payload?.messages || []).find(
      (m) => m?.role === "user",
    );

    if (typeof userMessage?.content === "string") {
      return false;
    }

    if (Array.isArray(userMessage?.content)) {
      // // for userMessage with image the message content is array
      // const userMessageWithImageExample = [
      //   {
      //     type: "text",
      //     "text":
      //       "create a react component looks like this, use tailwind, all in one file",
      //   },
      //   {
      //     type: "image_url",
      //     image_url: {
      //       url: "data:image/png;base6,xxxxxxxxxxxxxxxxxxxx",
      //     },
      //   },
      // ];
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
