# Project Context: GitHub Copilot Proxy

This project is a proxy server for GitHub Copilot, designed to handle requests and responses between a client and the GitHub Copilot API. It is built using Bun and Hono, a fast JavaScript runtime and web framework, and utilizes the `pino` logging library for logging purposes.

This is not intended to be hosted on public internet, it's strictly being used locally to simulate an openai like api interface as a local proxy.

## Key Components

### 1. `copilot-proxy.ts`

- **Server Setup**: Uses Bun's `serve` method to create a server that listens on a specified port and host.
- **Request Handling**:
  - Handles POST requests to `/v1/chat/completions`: Proxies chat completion requests to the GitHub Copilot API, handling both standard and streaming responses. It also detects vision requests (requests with images).
  - Handles GET requests to `/v1/models`: Fetches and returns a list of available models from the GitHub Copilot API.

### 2. `helper.ts`

- **Logger**: Utilizes `pino` for logging with a default log level of "debug". Includes utility functions for adding breadcrumbs to Sentry.
- **TokenManager Class**: Manages the retrieval, caching, and refreshing of tokens from the GitHub Copilot API. It ensures that a valid token is available for authenticating requests.
- **getHeaders Function**: Constructs headers for API requests, including authorization using a token managed by `TokenManager`. It supports different headers based on whether the request is a vision request.
- **Utility Functions**: Includes helper functions such as `msToTime` for converting milliseconds to a human-readable time format, `shortenText` for shortening long text, `findUserMessageContent` for extracting user message content from a payload, and `hasImageInRequestBody` for detecting image requests.

### 3. `setup.js`

- **Device Code Flow**: Implements the device code flow for obtaining an OAuth token. It includes functions for getting the device code, polling for the access token, and saving the token to a `.env` file.

## Environment Variables

- `GHC_PORT`: Port on which the server listens (default: 7890).
- `GHC_HOST`: Hostname for the server (default: "0.0.0.0").
- `COPILOT_OAUTH_TOKEN`: OAuth token for authenticating with the GitHub Copilot API.
- `SENTRY_DSN`: Sentry Data Source Name for error tracking.

## Usage

- Ensure all environment variables are set.
- Start the server using Bun to handle requests to the GitHub Copilot API.
- Use `setup.js` to obtain and configure the `COPILOT_OAUTH_TOKEN` if needed.
