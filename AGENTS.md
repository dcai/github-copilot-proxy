# AGENTS.md

## Project Structure
- .gitignore
- .gp.md
- README.md
- biome.json
- bun.lock
- copilot-proxy.ts
- helper.ts
- jsconfig.json
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
- `copilot-proxy.ts`: Main server file. Sets up Hono app, handles `/v1/chat/completions` and `/v1/models` endpoints.
- `helper.ts`: Contains utility functions, token management (TokenManager), logging, header construction, and request/response helpers.
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

For more details, refer to the README.md file in the project root.
