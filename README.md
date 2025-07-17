# MCP-Anything

Convert any OpenAPI spec to a Model Context Protocol (MCP) server. This tool automatically handles OAuth authentication and deploys to Cloudflare Workers.

## Features

- 🔄 Converts OpenAPI operations to MCP tools
- 🔐 Automatic OAuth handling (user linking)
- ☁️ Deploys to Cloudflare Workers
- 🔑 Per-user token management
- 🚀 Simple CLI interface

## Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI authenticated (`npx wrangler login`)

## Installation

```bash
npm install -g mcp-anything
```

## Usage

### 1. Deploy an MCP server

```bash
mcp-anything deploy \
  --openapi https://api.github.com/openapi.json \
  --client-id YOUR_GITHUB_CLIENT_ID \
  --client-secret YOUR_GITHUB_CLIENT_SECRET \
  --name github-mcp
```

### 2. Create KV namespace

After deployment, you'll need to create a KV namespace:

```bash
wrangler kv:namespace create "KV" --preview
```

Update your worker with the KV namespace ID from the output.

### 3. Add to Claude

Add the deployed URL to your Claude MCP configuration.

## How it works

1. **Parse OpenAPI**: Extracts all operations from the OpenAPI spec
2. **Generate MCP Tools**: Converts each operation to an MCP tool
3. **Deploy Worker**: Creates a Cloudflare Worker with OAuth support
4. **Link Accounts**: Users link their API accounts on first use
5. **Proxy Requests**: Worker proxies requests with user's OAuth token

## OAuth Flow

When a user first uses a tool:
1. MCP server detects no linked account
2. Returns a link for OAuth authorization
3. User completes OAuth flow
4. Tokens are stored in KV for future use

## Roadmap

- [ ] Automatic KV namespace creation
- [ ] Multi-tenant deployment option
- [ ] Web dashboard for configuration
- [ ] Support for more auth types
- [ ] Better error handling

## License

MIT