import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { CloudflareDeployOptions, DeployResult } from '../types/index.js';

const execAsync = promisify(exec);

export async function deployToCloudflare(options: CloudflareDeployOptions): Promise<DeployResult> {
  const { code, name, environment } = options;
  
  // Create temporary directory for deployment
  const tempDir = join(tmpdir(), `mcp-deploy-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });
  
  try {
    // Write worker code
    await writeFile(join(tempDir, 'worker.js'), code);
    
    // Create wrangler.toml
    const wranglerConfig = generateWranglerConfig(name, environment);
    await writeFile(join(tempDir, 'wrangler.toml'), wranglerConfig);
    
    // Deploy using wrangler
    const { stdout, stderr } = await execAsync('npx wrangler deploy', {
      cwd: tempDir,
      env: process.env
    });
    
    // Extract URL from wrangler output
    const urlMatch = stdout.match(/https:\/\/[^\s]+\.workers\.dev/);
    if (!urlMatch) {
      throw new Error('Could not extract deployment URL from wrangler output');
    }
    
    const deploymentUrl = urlMatch[0];
    
    return {
      url: `${deploymentUrl}/sse`,
      name
    };
  } finally {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  }
}

function generateWranglerConfig(name: string, environment: Record<string, string>): string {
  const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  
  const envVars = Object.entries(environment)
    .map(([key, value]) => `${key} = "${value}"`)
    .join('\n');
  
  return `
name = "${safeName}"
main = "worker.js"
compatibility_date = "2024-01-01"

[vars]
${envVars}

[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_NAMESPACE_ID"
preview_id = "YOUR_KV_PREVIEW_ID"

# Note: You'll need to create a KV namespace and update the IDs above
# Run: wrangler kv:namespace create "KV"
`;
}