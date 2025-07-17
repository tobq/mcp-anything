#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { deploy } from './commands/deploy.js';

const program = new Command();

program
  .name('mcp-anything')
  .description('Convert any OpenAPI spec to a Model Context Protocol (MCP) server')
  .version('0.1.0');

program
  .command('deploy')
  .description('Deploy an MCP server for an OpenAPI spec')
  .requiredOption('--openapi <url>', 'OpenAPI specification URL')
  .requiredOption('--client-id <id>', 'OAuth client ID for the target API')
  .requiredOption('--client-secret <secret>', 'OAuth client secret for the target API')
  .option('--name <name>', 'Name for the MCP server deployment')
  .option('--oauth-issuer <url>', 'OAuth issuer URL for auto-discovery (.well-known)')
  .option('--auth-url <url>', 'OAuth authorization URL (if not using discovery)')
  .option('--token-url <url>', 'OAuth token URL (if not using discovery)')
  .action(async (options) => {
    // Show helpful setup message
    console.log(chalk.blue('\n📋 Pre-deployment Checklist:\n'));
    console.log(chalk.yellow('1. OAuth App Setup:'));
    console.log(`   - Create an OAuth app for the target service`);
    console.log(`   - ${chalk.bold('Temporarily')} set redirect URL to: ${chalk.cyan('http://localhost:8787/oauth/callback')}`);
    console.log(`   - After deployment, update it to: ${chalk.cyan('https://YOUR-WORKER.workers.dev/oauth/callback')}\n`);
    
    console.log(chalk.yellow('2. Cloudflare Setup:'));
    console.log(`   - Make sure you're logged in: ${chalk.cyan('npx wrangler login')}`);
    console.log(`   - Or set: ${chalk.cyan('export CLOUDFLARE_API_TOKEN=your-token')}\n`);
    
    console.log(chalk.gray('Starting deployment...\n'));
    
    const spinner = ora('Deploying MCP server...').start();
    try {
      const result = await deploy(options);
      spinner.succeed(chalk.green('MCP server deployed successfully!'));
      
      console.log('\n' + chalk.green('✅ Deployment Complete!\n'));
      console.log(chalk.bold('MCP Server URL:'), chalk.cyan(result.url));
      console.log(chalk.bold('Worker URL:'), chalk.cyan(result.url.replace('/sse', '')));
      
      console.log(chalk.yellow('\n⚠️  Important Next Steps:'));
      console.log(`1. Update your OAuth app's redirect URL to:`);
      console.log(`   ${chalk.cyan(result.url.replace('/sse', '/oauth/callback'))}`);
      console.log(`2. Create KV namespace: ${chalk.cyan('npx wrangler kv:namespace create "KV"')}`);
      console.log(`3. Update the worker with the KV namespace ID from step 2`);
      console.log(`4. Add this URL to Claude: ${chalk.cyan(result.url)}\n`);
    } catch (error) {
      spinner.fail(chalk.red('Deployment failed'));
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

program.parse();