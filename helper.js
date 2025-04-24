import axios from "axios";

class TokenManager {
  constructor() {
    this.token = null;
    this.expiry = 0;
    this.api = "https://api.githubcopilot.com";
  }

  async fetch() {
    // If we have a token and it's not expired, return it
    if (this.token && Date.now() < this.expiry) {
      console.debug(`reusing token`);
      return this.token;
    }
    const options = {
      method: "GET",
      url: "https://api.github.com/copilot_internal/v2/token",
      headers: await getHeaders(process.env.GITHUB_TOKEN),
    };

    console.debug(`refreshing token`, options);
    try {
      const resp = await axios(options);
      const data = resp.data;
      console.debug(`token set: ${data.token}`);
      // console.info(data);
      this.token = data.token;
      this.expiry = data.expires_at * 1000;
      if (data?.endpoints?.api) {
        this.api = data?.endpoints?.api;
      }
    } catch (ex) {
      // console.error(ex);
      console.error("ERROR: ", ex.toString());
      console.error(ex.response.data);
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

export async function getHeaders(token = null) {
  // 'editor-version': 'Neovim/0.6.1',
  // 'editor-plugin-version': 'copilot.vim/1.16.0',
  // 'user-agent': 'GithubCopilot/1.155.0',
  const EDITOR_VERSION = "vscode/1.85.1";
  const EDITOR_PLUGIN_VERSION = "copilot-chat/0.17.2024062801";
  const USER_AGENT = "GitHubCopilotChat/0.17.2024062801";
  const copilotToken = token ? token : await tokenManager.getToken();
  return {
    "accept": "application/json",
    "accept-encoding": "gzip,deflate,br",
    "content-type": "application/json",
    "authorization": `Bearer ${copilotToken}`,
    "editor-version": EDITOR_VERSION,
    "editor-plugin-version": EDITOR_PLUGIN_VERSION,
    "user-agent": USER_AGENT,
  };
}
