const clientId = process.env.MY_COPILOT_CLIENT_ID;

if (!clientId) {
  console.error("MY_COPILOT_CLIENT_ID is not set");
  process.exit(1);
}

const commonHeaders = new Headers();
commonHeaders.append("accept", "application/json");
commonHeaders.append("editor-version", "Neovim/0.6.1");
commonHeaders.append("editor-plugin-version", "copilot.vim/1.16.0");
commonHeaders.append("content-type", "application/json");
commonHeaders.append("user-agent", "GithubCopilot/1.155.0");
commonHeaders.append("accept-encoding", "gzip,deflate,b");

type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
};

type AccessTokenPendingResponse = {
  error: string;
  error_description?: string;
  access_token?: never;
};

type AccessTokenSuccessResponse = {
  access_token: string;
  token_type?: string;
  scope?: string;
  error?: never;
  error_description?: never;
};

type AccessTokenResponse =
  | AccessTokenPendingResponse
  | AccessTokenSuccessResponse;

async function getDeviceCode(): Promise<DeviceCodeResponse> {
  const raw = JSON.stringify({
    "client_id": clientId,
    "scope": "read:user",
  });

  const requestOptions = {
    method: "POST",
    headers: commonHeaders,
    body: raw,
  };

  const response = await fetch(
    "https://github.com/login/device/code",
    requestOptions,
  );
  const data = (await response.json()) as DeviceCodeResponse;
  return data;
}

async function getAccessToken(
  deviceCode: string,
): Promise<AccessTokenResponse> {
  const raw = JSON.stringify({
    "client_id": clientId,
    "device_code": deviceCode,
    "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
  });

  const requestOptions = {
    method: "POST",
    headers: commonHeaders,
    body: raw,
  };

  const response = await fetch(
    "https://github.com/login/oauth/access_token",
    requestOptions,
  );
  const data = (await response.json()) as AccessTokenResponse;
  return data;
}

(async function () {
  const { device_code, user_code, verification_uri, expires_in } =
    await getDeviceCode();
  console.info(`enter user code:\n${user_code}\n${verification_uri}`);
  console.info(`Expires in ${expires_in} seconds`);
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const accessToken = await getAccessToken(device_code);
    if ("error" in accessToken) {
      console.info(`${accessToken.error}: ${accessToken.error_description}`);
    }
    if ("access_token" in accessToken) {
      console.info(`access token:\n${JSON.stringify(accessToken, null, 1)}`);
      break;
    }
  }
})();
