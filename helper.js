import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "debug",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

export async function getHeaders(token = null) {
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
    // If we have a token and it's not expired, return it
    if (this.token && Date.now() < this.expiry) {
      logger.debug(`reusing token`);
      return this.token;
    }

    try {
      logger.debug(`refreshing token`);
      const resp = await fetch(
        "https://api.github.com/copilot_internal/v2/token",
        {
          method: "GET",
          headers: await getHeaders(process.env.COPILOT_OAUTH_TOKEN),
        },
      );

      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }

      const data = await resp.json();
      logger.info(data, "token response");
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
