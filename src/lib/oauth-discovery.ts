import axios from 'axios';

export interface OAuthMetadata {
  authorizationUrl: string;
  tokenUrl: string;
  scopes?: string[];
  issuer?: string;
}

/**
 * Discover OAuth endpoints from well-known URLs
 */
export async function discoverOAuthEndpoints(issuerUrl: string): Promise<OAuthMetadata | null> {
  // Remove trailing slash
  const baseUrl = issuerUrl.replace(/\/$/, '');
  
  // Try OAuth 2.0 Authorization Server Metadata first (RFC 8414)
  try {
    const response = await axios.get(`${baseUrl}/.well-known/oauth-authorization-server`);
    return {
      authorizationUrl: response.data.authorization_endpoint,
      tokenUrl: response.data.token_endpoint,
      scopes: response.data.scopes_supported,
      issuer: response.data.issuer
    };
  } catch (e) {
    // Continue to next attempt
  }
  
  // Try OpenID Connect Discovery
  try {
    const response = await axios.get(`${baseUrl}/.well-known/openid-configuration`);
    return {
      authorizationUrl: response.data.authorization_endpoint,
      tokenUrl: response.data.token_endpoint,
      scopes: response.data.scopes_supported,
      issuer: response.data.issuer
    };
  } catch (e) {
    // Continue to next attempt
  }
  
  // GitHub doesn't follow standards, but we can handle it specially
  if (issuerUrl.includes('github.com')) {
    return {
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      scopes: ['repo', 'user', 'gist', 'notifications'],
      issuer: 'https://github.com'
    };
  }
  
  return null;
}