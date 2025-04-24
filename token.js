const axios = require("axios");
const {
  EDITOR_VERSION,
  EDITOR_PLUGIN_VERSION,
  USER_AGENT,
} = require("./config");
require("dotenv").config();

class TokenManager {
  constructor() {
    this.token = null;
    this.expiry = 0;
  }

  async getToken() {
    // If we have a token and it's not expired, return it
    if (this.token && Date.now() < this.expiry) {
      console.debug(`reusing token: ${this.token}`);
      return this.token;
    }
    const options = {
      method: "GET",
      url: "https://api.github.com/copilot_internal/v2/token",
      headers: {
        authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "content-type": "application/json",
        "editor-version": EDITOR_VERSION,
        "editor-plugin-version": EDITOR_PLUGIN_VERSION,
        "user-agent": USER_AGENT,
      },
    };

    console.debug(`refreshing token`);
    const resp = await axios.request(options);

    const data = resp.data;
    console.debug(`token set: ${data.token}`);
    this.token = data.token;
    this.expiry = data.expires_at * 1000;
    return this.token;
  }
}

module.exports = new TokenManager();
