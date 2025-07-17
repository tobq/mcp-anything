# Quick Start Guide

## Example: Deploy GitHub API as MCP

### 1. Create GitHub OAuth App

1. Go to https://github.com/settings/applications/new
2. Fill in:
   - **Application name**: `MCP Test`
   - **Homepage URL**: `https://github.com/your-username/mcp-test`
   - **Authorization callback URL**: `http://localhost:8787/oauth/callback` (temporary)
3. Click "Register application"
4. Save your Client ID and Client Secret

### 2. Deploy the MCP Server

```bash
# Install globally
npm install -g mcp-anything

# Deploy using OAuth discovery
mcp-anything deploy \
  --openapi https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json \
  --oauth-issuer https://github.com \
  --client-id YOUR_CLIENT_ID \
  --client-secret YOUR_CLIENT_SECRET \
  --name my-github-mcp
```

### 3. Post-Deployment Steps

After deployment, you'll see output like:
```
✅ Deployment Complete!

MCP Server URL: https://my-github-mcp.your-subdomain.workers.dev/sse
Worker URL: https://my-github-mcp.your-subdomain.workers.dev

⚠️  Important Next Steps:
1. Update your OAuth app's redirect URL to:
   https://my-github-mcp.your-subdomain.workers.dev/oauth/callback
2. Create KV namespace: npx wrangler kv:namespace create "KV"
3. Update the worker with the KV namespace ID from step 2
4. Add this URL to Claude: https://my-github-mcp.your-subdomain.workers.dev/sse
```

Follow these steps exactly!

### 4. Update GitHub OAuth App

1. Go back to your GitHub OAuth app settings
2. Change the callback URL to the one shown in the deployment output
3. Save changes

### 5. Create KV Namespace

```bash
npx wrangler kv:namespace create "KV"
```

This will output something like:
```
✨ Success!
Add the following to your configuration file:
kv_namespaces = [
  { binding = "KV", id = "abcd1234..." }
]
```

### 6. Update Worker with KV Namespace

```bash
# Edit the deployed worker to add the KV namespace ID
npx wrangler kv:namespace list
```

### 7. Add to Claude

Add the MCP Server URL to your Claude configuration!

## Troubleshooting

- **"Not logged in to Cloudflare"**: Run `npx wrangler login`
- **"OAuth callback mismatch"**: Make sure you updated the GitHub OAuth app callback URL
- **"KV namespace not found"**: Follow step 5 to create the namespace