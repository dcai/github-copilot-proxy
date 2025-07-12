# AGENTS.md

## Project Structure
- .gitignore
- .gp.md
- README.md
- biome.json
- bun.lock
- helper.ts
- jsconfig.json
- main.ts
- mise.toml
- ollama.ts
- package.json
- setup.js
- tsconfig.json

## Project Context
This project is a local proxy server for GitHub Copilot, built with Bun and Hono, and uses pino for logging. It is intended for local use only and not for public internet deployment.

### Purpose
- Intercepts and manages requests between a client (e.g., IDE) and the GitHub Copilot API.
- Simulates an OpenAI-like API interface for GitHub Copilot.

### Key Files
- `main.ts`: Main server file. Sets up Hono app, handles `/v1/chat/completions` and `/v1/models` endpoints. Handles both standard and streaming responses, and detects vision requests (requests with images).
- `helper.ts`: Contains utility functions, token management (`TokenManager`), logging, header construction, and request/response helpers.
- `setup.js`: Script for OAuth device flow to obtain Copilot token.
- `package.json`: Project dependencies and scripts.

### Environment Variables
- `GHC_PORT`: Port for the server (default: 7890)
- `GHC_HOST`: Hostname (default: "0.0.0.0")
- `COPILOT_OAUTH_TOKEN`: OAuth token for GitHub Copilot API
- `SENTRY_DSN`: Sentry Data Source Name for error tracking

### Technologies Used
- Bun (JavaScript runtime)
- TypeScript
- Hono (web framework)
- Pino (logging)
- OAuth 2.0 Device Flow
- Sentry (optional error tracking)
- mise (dev environment manager)

### Architecture Overview
- Implements a proxy server pattern.
- Manages authentication tokens, request forwarding, streaming responses, logging, and optional Sentry integration.
- Designed for local simulation and development, not for public deployment.

### Core Workflow
1. **Client**: Sends requests (e.g., for chat completions or model listings) to the proxy server, typically formatted like OpenAI API requests.
2. **Proxy Server (`main.ts` with Hono)**:
   - Listens for incoming HTTP requests on a configured port and host.
   - Parses the incoming request.
   - Uses `TokenManager` (from `helper.ts`) to obtain a valid GitHub Copilot authentication token. This token is cached and refreshed as needed.
   - Constructs the appropriate headers for the GitHub Copilot API using `getHeaders` (from `helper.ts`), including the authentication token.
   - Forwards the request to the actual GitHub Copilot API endpoint.
   - Handles the response from the GitHub Copilot API, including streaming responses and vision requests.
   - Logs request and response information using `pino`.
   - Optionally sends error reports and breadcrumbs to Sentry.
3. **GitHub Copilot API**: The official backend service provided by GitHub that processes the requests and provides AI-powered code suggestions and chat responses.

### Features
- API Proxying
- Chat Completions (standard and streaming)
- Vision Request Detection (image support)
- Model Listing
- Token Management and Refresh
- Custom Headers
- Structured Logging
- OAuth Setup
- Environment Configuration

For more details, refer to the README.md file in the project root.
