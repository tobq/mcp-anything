#!/bin/bash

# Example: Deploy GitHub API as MCP server

# First, create a GitHub OAuth App:
# 1. Go to https://github.com/settings/developers
# 2. Click "New OAuth App"
# 3. Set Authorization callback URL to: https://your-worker.workers.dev/oauth/callback
# 4. Copy the Client ID and Client Secret

# Deploy the MCP server
npm run dev -- deploy \
  --openapi https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json \
  --client-id YOUR_GITHUB_CLIENT_ID \
  --client-secret YOUR_GITHUB_CLIENT_SECRET \
  --name github-mcp \
  --auth-url https://github.com/login/oauth/authorize \
  --token-url https://github.com/login/oauth/access_token