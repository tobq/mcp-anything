import SwaggerParser from '@apidevtools/swagger-parser';
import { generateMCPServer } from '../lib/generator.js';
import { deployToCloudflare } from '../lib/cloudflare.js';
import { discoverOAuthEndpoints } from '../lib/oauth-discovery.js';
import { convertOpenAPIToTools } from '../lib/openapi-converter.js';
import type { DeployOptions, DeployResult } from '../types/index.js';
import chalk from 'chalk';

export async function deploy(options: DeployOptions): Promise<DeployResult> {
  // 1. Parse OpenAPI spec
  const spec = await SwaggerParser.parse(options.openapi);
  
  // 2. Discover OAuth endpoints if issuer provided
  let authUrl = options.authUrl;
  let tokenUrl = options.tokenUrl;
  
  if (options.oauthIssuer && (!authUrl || !tokenUrl)) {
    console.log(chalk.gray('Discovering OAuth endpoints...'));
    const discovered = await discoverOAuthEndpoints(options.oauthIssuer);
    if (discovered) {
      authUrl = authUrl || discovered.authorizationUrl;
      tokenUrl = tokenUrl || discovered.tokenUrl;
      console.log(chalk.green('✓ Found OAuth endpoints via discovery'));
    } else {
      console.log(chalk.yellow('⚠ Could not discover OAuth endpoints, using manual URLs or OpenAPI spec'));
    }
  }
  
  // 3. Generate MCP server code
  const serverCode = await generateMCPServer({
    openApiSpec: spec,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    authUrl,
    tokenUrl,
    name: options.name || spec.info?.title || 'mcp-server'
  });
  
  // Log tools found
  const tools = convertOpenAPIToTools(spec);
  console.log(chalk.green(`✓ Converted ${tools.length} API operations to MCP tools`));
  if (tools.length > 0) {
    console.log(chalk.gray('  Sample tools:'), tools.slice(0, 3).map(t => t.name).join(', ') + (tools.length > 3 ? '...' : ''));
  }
  
  // 4. Deploy to Cloudflare
  const deploymentResult = await deployToCloudflare({
    code: serverCode,
    name: options.name || spec.info?.title || 'mcp-server',
    environment: {
      OPENAPI_URL: options.openapi,
      CLIENT_ID: options.clientId,
      CLIENT_SECRET: options.clientSecret,
      AUTH_URL: options.authUrl || '',
      TOKEN_URL: options.tokenUrl || ''
    }
  });
  
  return deploymentResult;
}