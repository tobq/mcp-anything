import type { MCPToolDefinition } from '../lib/openapi-converter.js';

interface WorkerTemplateOptions {
  name: string;
  tools: MCPToolDefinition[];
  oauth: {
    clientId: string;
    clientSecret: string;
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string[];
  };
}

export function generateWorkerTemplate(options: WorkerTemplateOptions): string {
  const { name, tools, oauth } = options;
  
  return `
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

// Environment bindings
// KV: KVNamespace
// OPENAPI_URL: string
// CLIENT_ID: string
// CLIENT_SECRET: string
// AUTH_URL: string
// TOKEN_URL: string

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

async function refreshAccessToken(env, refreshToken) {
  try {
    const response = await fetch('${oauth.tokenUrl}', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(\`\${env.CLIENT_ID}:\${env.CLIENT_SECRET}\`)
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });
    
    if (!response.ok) {
      console.error('Token refresh failed:', response.status);
      return null;
    }
    
    const tokens = await response.json();
    
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || refreshToken, // Some providers don't return new refresh token
      expires_at: Date.now() + (tokens.expires_in * 1000)
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    
    // OAuth endpoints
    if (url.pathname === '/oauth/authorize') {
      return handleOAuthAuthorize(request, env);
    }
    
    if (url.pathname === '/oauth/callback') {
      return handleOAuthCallback(request, env);
    }
    
    // MCP SSE endpoint
    if (url.pathname === '/sse') {
      return handleMCPConnection(request, env);
    }
    
    // Health check
    if (url.pathname === '/') {
      return new Response('MCP Server: ${name}', { headers: CORS_HEADERS });
    }
    
    return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
  }
};

async function handleOAuthAuthorize(request, env) {
  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const mcpUserId = url.searchParams.get('user_id') || crypto.randomUUID();
  
  // Store state for verification
  await env.KV.put(\`oauth_state_\${state}\`, mcpUserId, { expirationTtl: 3600 });
  
  const authUrl = new URL('${oauth.authorizationUrl}');
  authUrl.searchParams.set('client_id', env.CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', \`\${url.origin}/oauth/callback\`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', '${oauth.scopes.join(' ')}');
  
  return Response.redirect(authUrl.toString());
}

async function handleOAuthCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  if (!code || !state) {
    return new Response('Missing code or state', { status: 400 });
  }
  
  // Verify state
  const mcpUserId = await env.KV.get(\`oauth_state_\${state}\`);
  if (!mcpUserId) {
    return new Response('Invalid state', { status: 400 });
  }
  
  // Exchange code for token
  const tokenResponse = await fetch('${oauth.tokenUrl}', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(\`\${env.CLIENT_ID}:\${env.CLIENT_SECRET}\`)
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: \`\${url.origin}/oauth/callback\`
    })
  });
  
  if (!tokenResponse.ok) {
    return new Response('Token exchange failed', { status: 500 });
  }
  
  const tokens = await tokenResponse.json();
  
  // Store tokens for this MCP user
  await env.KV.put(
    \`tokens_\${mcpUserId}\`,
    JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in * 1000)
    }),
    { expirationTtl: 86400 * 30 } // 30 days
  );
  
  return new Response('Authorization successful! You can close this window.', {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleMCPConnection(request, env) {
  const transport = new SSEServerTransport(request);
  const server = new McpServer({
    name: '${name}',
    version: '1.0.0'
  });
  
  // Get user ID from auth token if present
  const authHeader = request.headers.get('Authorization');
  let userId: string | null = null;
  
  if (authHeader?.startsWith('Bearer ')) {
    // In a real implementation, validate the JWT and extract user ID
    // For now, we'll use a simple approach
    userId = authHeader.substring(7); // This would be the actual user ID from JWT
  }
  
  // Register account management tools
  server.tool('link_account', 'Link your account to use this API', {
    type: 'object',
    properties: {},
    required: []
  }, async () => {
    const linkUrl = new URL(request.url).origin + '/oauth/authorize?user_id=' + (userId || crypto.randomUUID());
    return {
      content: [{
        type: 'text',
        text: \`To link your account, please visit: \${linkUrl}\`
      }]
    };
  });
  
  server.tool('check_link_status', 'Check if your account is linked', {
    type: 'object',
    properties: {},
    required: []
  }, async () => {
    if (!userId) {
      return {
        content: [{
          type: 'text',
          text: 'No user ID found. Please use link_account first.'
        }]
      };
    }
    
    const tokensStr = await env.KV.get(\`tokens_\${userId}\`);
    if (tokensStr) {
      const tokens = JSON.parse(tokensStr);
      const expiresIn = tokens.expires_at ? Math.round((tokens.expires_at - Date.now()) / 1000 / 60) : 'unknown';
      return {
        content: [{
          type: 'text',
          text: \`✅ Account is linked! Token expires in \${expiresIn} minutes.\`
        }]
      };
    } else {
      return {
        content: [{
          type: 'text',
          text: '❌ Account not linked. Please use link_account to connect.'
        }]
      };
    }
  });
  
  // Register API tools
  ${tools.map(tool => `
  server.tool('${tool.name}', '${tool.description}', ${JSON.stringify(tool.parameters)}, async (params) => {
    // Get user's API token
    if (!userId) {
      const linkUrl = new URL(request.url).origin + '/oauth/authorize?user_id=' + crypto.randomUUID();
      return {
        content: [{
          type: 'text',
          text: \`❌ No user session found. Please use the "link_account" tool first, or visit: \${linkUrl}\`
        }]
      };
    }
    
    const tokensStr = await env.KV.get(\`tokens_\${userId}\`);
    if (!tokensStr) {
      const linkUrl = new URL(request.url).origin + '/oauth/authorize?user_id=' + userId;
      return {
        content: [{
          type: 'text',
          text: \`❌ Account not linked. Please use the "link_account" tool, or visit: \${linkUrl}\`
        }]
      };
    }
    
    let tokens = JSON.parse(tokensStr);
    
    // Check if token is expired and try to refresh
    if (tokens.expires_at && Date.now() > tokens.expires_at && tokens.refresh_token) {
      console.log('Token expired, attempting refresh...');
      const refreshed = await refreshAccessToken(env, tokens.refresh_token);
      if (refreshed) {
        tokens = refreshed;
        await env.KV.put(
          \`tokens_\${userId}\`,
          JSON.stringify(tokens),
          { expirationTtl: 86400 * 30 }
        );
      }
    }
    
    // Make API request
    let path = '${tool.path}';
    
    // Replace path parameters
    for (const [key, value] of Object.entries(params)) {
      const paramDef = ${JSON.stringify(tool.parameters)}.properties[key];
      if (paramDef && paramDef.in === 'path') {
        path = path.replace(\`{\${key}}\`, encodeURIComponent(String(value)));
      }
    }
    
    const apiUrl = new URL(path, env.OPENAPI_URL);
    
    // Add query parameters
    for (const [key, value] of Object.entries(params)) {
      const paramDef = ${JSON.stringify(tool.parameters)}.properties[key];
      if (paramDef && paramDef.in === 'query') {
        apiUrl.searchParams.set(key, String(value));
      }
    }
    
    // Build request options
    const requestOptions = {
      method: '${tool.method}',
      headers: {
        'Authorization': \`Bearer \${tokens.access_token}\`,
        'Content-Type': 'application/json'
      }
    };
    
    // Add body if needed
    ${tool.requestBody ? `
    if ('${tool.method}' !== 'GET' && '${tool.method}' !== 'DELETE') {
      const bodyParams = {};
      for (const [key, value] of Object.entries(params)) {
        const paramDef = ${JSON.stringify(tool.parameters)}.properties[key];
        if (!paramDef || paramDef.in !== 'query') {
          bodyParams[key] = value;
        }
      }
      requestOptions.body = JSON.stringify(bodyParams);
    }
    ` : ''}
    
    try {
      const response = await fetch(apiUrl.toString(), requestOptions);
      const data = await response.json();
      
      if (!response.ok) {
        // Handle 401 Unauthorized - prompt to re-authenticate
        if (response.status === 401) {
          const linkUrl = new URL(request.url).origin + '/oauth/authorize?user_id=' + userId;
          return {
            content: [{
              type: 'text',
              text: \`🔒 Authentication failed. Your token may have expired. Please re-authenticate using the "link_account" tool or visit: \${linkUrl}\`
            }]
          };
        }
        
        return {
          content: [{
            type: 'text',
            text: \`API Error: \${response.status} - \${JSON.stringify(data)}\`
          }]
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: \`Error: \${error.message}\`
        }]
      };
    }
  });
  `).join('')}
  
  await server.connect(transport);
  return transport.response;
}
`;
}