# Project Context: GitHub Copilot Proxy

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/dcai/github-copilot-proxy)

This project is a proxy server for GitHub Copilot, designed to handle requests and responses between a client and the GitHub Copilot API. It is built using Bun and Hono, a fast JavaScript runtime and web framework, and utilizes the `pino` logging library for logging purposes.

This is not intended to be hosted on public internet, it's strictly being used locally to simulate an openai like api interface as a local proxy.

## Key Components

### 1. `main.ts`

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

## Project Summary and Features

This project is a local proxy server for GitHub Copilot. Its main purpose is to intercept and manage requests between a client application (e.g., an IDE or a custom tool) and the GitHub Copilot API. This allows for functionalities like custom logging, request/response modification, and local simulation of an OpenAI-like API interface for GitHub Copilot. It is designed for local use and not for public internet deployment.

Key Features:

- **API Proxying**: Forwards requests to the GitHub Copilot API.
- **Chat Completions**: Handles POST requests to `/v1/chat/completions`, supporting both standard and streaming responses.
- **Vision Request Detection**: Identifies requests that include images.
- **Model Listing**: Handles GET requests to `/v1/models` to fetch and return available Copilot models.
- **Token Management**: Manages GitHub Copilot authentication tokens, including retrieval, caching, and refreshing, via the `TokenManager` class.
- **Custom Headers**: Constructs appropriate headers for API requests, including authorization.
- **Logging**: Utilizes `pino` for structured logging.
- **OAuth Setup**: Includes a script (`setup.js`) for obtaining OAuth tokens using the device code flow.
- **Environment Configuration**: Loads settings from environment variables (e.g., port, host, OAuth token).

## Project Key Directories and Files

The project primarily resides in a flat directory structure within the root. Key files include:

- **`copilot-proxy.ts`**: The main entry point for the proxy server. It sets up the Hono server, defines API routes (`/v1/chat/completions`, `/v1/models`), and handles incoming requests by forwarding them to the GitHub Copilot API.
- **`helper.ts`**: Contains utility functions and classes used across the project. This includes:
  - `TokenManager`: Manages authentication tokens for the GitHub Copilot API.
  - `getHeaders`: Constructs HTTP headers for API requests.
  - Logging setup (`pino`).
  - Helper functions for text manipulation, time conversion, and request/response parsing (e.g., `findUserMessageContent`, `hasImageInRequestBody`).
  - Sentry breadcrumb integration.
- **`setup.js`**: A script to facilitate the OAuth device flow to obtain a `COPILOT_OAUTH_TOKEN` from GitHub, which is then typically stored in a `.env` file.
- **`package.json`**: Defines project metadata, dependencies (like `hono`, `pino`, `@sentry/bun`), and scripts (e.g., `start` script to run the server with `bun`).
- **`.env` (not present in chat, but implied)**: Used to store environment variables such as `GHC_PORT`, `GHC_HOST`, `COPILOT_OAUTH_TOKEN`, and `SENTRY_DSN`.
- **`README.md`**: This file, providing documentation for the project.
- **`.gitignore`**: Specifies intentionally untracked files that Git should ignore.
- **`bun.lockb`**: The lockfile for Bun, ensuring reproducible dependencies.
- **`tsconfig.json` / `jsconfig.json`**: Configuration files for TypeScript and JavaScript development.
- **`mise.toml`**: Configuration file for `mise` (a dev environment manager).

## Guide to Navigate the Project

- **API Endpoint Definitions and Core Logic**: Look into `copilot-proxy.ts`. This file contains the Hono app setup and the handlers for `/v1/chat/completions` and `/v1/models`.
- **Helper Functions, Token Management, and Utilities**: Explore `helper.ts`. This is where you'll find the `TokenManager` class, header generation logic, logging configuration, and various utility functions.
- **Authentication Setup**: If you need to understand how the OAuth token is obtained, refer to `setup.js`.
- **Dependencies and Scripts**: Check `package.json` for a list of project dependencies and available run scripts.
- **Environment Configuration**: Environment variables are typically managed in a `.env` file (not version controlled) and are documented in the README files.

## Key Technologies and Components

- **Runtime**: Bun (a fast JavaScript runtime)
- **Programming Language**: TypeScript
- **Web Framework**: Hono (a small, simple, and ultrafast web framework for the Edge)
- **Logging**: Pino (a very low overhead Node.js logger) with `pino-pretty` for development.
- **Authentication**: OAuth 2.0 Device Flow (for obtaining GitHub Copilot tokens).
- **Error Tracking**: Sentry (via `@sentry/bun`), if `SENTRY_DSN` is configured.
- **Package Management**: Bun
- **Development Environment Management**: `mise` (optional, based on `mise.toml`)

## Core Architecture

The project implements a proxy server pattern. It acts as an intermediary between a client application (e.g., an IDE plugin or a script using an OpenAI-compatible API) and the GitHub Copilot API.

1.  **Client**: Sends requests (e.g., for chat completions or model listings) to the proxy server, typically formatted like OpenAI API requests.
2.  **Proxy Server (`copilot-proxy.ts` with Hono)**:
    - Listens for incoming HTTP requests on a configured port and host.
    - Parses the incoming request.
    - Uses `TokenManager` (from `helper.ts`) to obtain a valid GitHub Copilot authentication token. This token is cached and refreshed as needed.
    - Constructs the appropriate headers for the GitHub Copilot API using `getHeaders` (from `helper.ts`), including the authentication token.
    - Forwards the request to the actual GitHub Copilot API endpoint (e.g., `https://api.githubcopilot.com`).
    - Handles the response from the GitHub Copilot API.
    - If the request is for a streaming response (e.g., chat completions with `stream: true`), it streams the data back to the client chunk by chunk.
    - If it's a regular response, it sends the complete response back to the client.
    - Logs request and response information using `pino`.
    - Optionally sends error reports and breadcrumbs to Sentry.
3.  **GitHub Copilot API**: The official backend service provided by GitHub that processes the requests and provides AI-powered code suggestions and chat responses.

The `setup.js` script is a utility to perform the initial OAuth device flow to get the `COPILOT_OAUTH_TOKEN`, which the proxy then uses for authenticating its requests to the GitHub Copilot API.

```mermaid
graph TD
    Client[Client Application (e.g., IDE, Script)] -->|HTTP Request (OpenAI format)| ProxyServer{GitHub Copilot Proxy Server (Bun + Hono)};
    ProxyServer -->|Uses| HelperUtils[helper.ts: TokenManager, getHeaders, Logging];
    HelperUtils -->|Fetches/Refreshes Token| GitHubAuthAPI[GitHub OAuth API for Tokens];
    ProxyServer -->|Proxied Request with Auth| CopilotAPI[GitHub Copilot API];
    CopilotAPI -->|API Response/Stream| ProxyServer;
    ProxyServer -->|HTTP Response/Stream| Client;
    SentryDSN{{SENTRY_DSN?}} -- Optional --> SentryService[Sentry.io];
    ProxyServer -.->|Sends Errors/Breadcrumbs if SENTRY_DSN set| SentryService;
    SetupScript[setup.js] -->|Device Flow| GitHubAuthAPI;
    SetupScript -->|Saves Token to .env| DotEnvFile[.env File];
    DotEnvFile -->|Loads Token| HelperUtils;
```
