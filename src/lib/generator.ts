import type { GeneratorOptions } from '../types/index.js';
import { generateWorkerTemplate } from '../templates/worker.js';
import { convertOpenAPIToTools } from './openapi-converter.js';

export async function generateMCPServer(options: GeneratorOptions): Promise<string> {
  const { openApiSpec, clientId, clientSecret, authUrl, tokenUrl, name } = options;
  
  // Convert OpenAPI operations to MCP tools
  const tools = convertOpenAPIToTools(openApiSpec);
  
  // Extract OAuth URLs from OpenAPI spec if not provided
  const oauthConfig = extractOAuthConfig(openApiSpec, authUrl, tokenUrl);
  
  // Generate the Cloudflare Worker code
  const workerCode = generateWorkerTemplate({
    name,
    tools,
    oauth: {
      clientId,
      clientSecret,
      authorizationUrl: oauthConfig.authUrl || '',
      tokenUrl: oauthConfig.tokenUrl || '',
      scopes: oauthConfig.scopes
    }
  });
  
  return workerCode;
}

function extractOAuthConfig(spec: any, providedAuthUrl?: string, providedTokenUrl?: string) {
  // Try to extract OAuth URLs from OpenAPI security schemes
  const securitySchemes = spec.components?.securitySchemes || {};
  let authUrl = providedAuthUrl;
  let tokenUrl = providedTokenUrl;
  let scopes: string[] = [];
  
  for (const [_, scheme] of Object.entries(securitySchemes)) {
    if ((scheme as any).type === 'oauth2' && (scheme as any).flows?.authorizationCode) {
      const flow = (scheme as any).flows.authorizationCode;
      authUrl = authUrl || flow.authorizationUrl;
      tokenUrl = tokenUrl || flow.tokenUrl;
      scopes = Object.keys(flow.scopes || {});
      break;
    }
  }
  
  return { authUrl, tokenUrl, scopes };
}