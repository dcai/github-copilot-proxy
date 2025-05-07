# Project Context: GitHub Copilot Proxy

This project is a proxy server for GitHub Copilot, designed to handle requests and responses between a client and the GitHub Copilot API. It is built using Bun, a fast JavaScript runtime, and utilizes the `pino` logging library for logging purposes.

This is not intended to be hosted on public internet, it's strictly being used locally to simulate an openai like api interface as a local proxy.

## Key Components

### 1. `helper.js`

- **Logger**: Utilizes `pino` for logging with a default log level of "debug".
- **getHeaders Function**: Constructs headers for API requests, including authorization using a token managed by `TokenManager`.
- **TokenManager Class**: Manages the retrieval and caching of tokens from the GitHub Copilot API.

### 2. `copilot-proxy.js`

- **Environment Configuration**: Loads environment variables using `dotenv`.
- **Server Setup**: Uses Bun's `serve` method to create a server that listens on a specified port and host.
- **Request Handling**:
  - Handles GET requests to `/v1/models` by fetching model data from the GitHub Copilot API.
  - Handles POST requests to `/v1/chat/completions` by forwarding the request to the API and optionally streaming the response.

## Environment Variables

- `GHC_PORT`: Port on which the server listens (default: 7890).
- `GHC_HOST`: Hostname for the server (default: "0.0.0.0").
- `COPILOT_OAUTH_TOKEN`: OAuth token for authenticating with the GitHub Copilot API.

## Usage

- Ensure all environment variables are set.
- Start the server using Bun to handle requests to the GitHub Copilot API.
