import type { OpenAPIV3 } from 'openapi-types';

export interface DeployOptions {
  openapi: string;
  clientId: string;
  clientSecret: string;
  name?: string;
  oauthIssuer?: string;
  authUrl?: string;
  tokenUrl?: string;
}

export interface DeployResult {
  url: string;
  name: string;
}

export interface GeneratorOptions {
  openApiSpec: OpenAPIV3.Document | any;
  clientId: string;
  clientSecret: string;
  authUrl?: string;
  tokenUrl?: string;
  name: string;
}

export interface CloudflareDeployOptions {
  code: string;
  name: string;
  environment: Record<string, string>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  handler: (params: any) => Promise<any>;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}