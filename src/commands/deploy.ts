import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import chokidar from 'chokidar';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as yaml from 'js-yaml';
import { ApiClient } from '../api';
import { ConfigManager } from '../config';
import * as utils from '../utils';
import { zipDirectory, readVafIgnore, formatBytes } from '../utils';

const api = new ApiClient();
const config = ConfigManager.getInstance();
const execAsync = promisify(exec);

interface DeployOptions {
  memory?: number;
  timeout?: number;
  database?: string;
  cache?: string;
  storage?: string;
  runtime?: string;
  handler?: string;
  watch?: boolean;
}

interface VafConfig {
  id: number;
  name: string;
  environments: {
    [key: string]: {
      runtime?: string;
      memory?: number;
      timeout?: number;
      database?: string;
      cache?: string;
      storage?: string;
      build?: string[];
      deploy?: string[];
    };
  };
}

function loadVafConfig(cwd: string): VafConfig | null {
  const configFiles = ['vaf.yml', 'vapor.yml'];
  
  for (const configFile of configFiles) {
    const filePath = path.join(cwd, configFile);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return yaml.load(content) as VafConfig;
      } catch (error) {
        utils.error(`Failed to parse ${configFile}: ${error}`);
        return null;
      }
    }
  }
  
  return null;
}

const deployCommand = new Command('deploy')
  .description('Deploy application to an environment')
  .argument('[project-id]', 'Project ID (can be in vaf.yml)')
  .argument('[env-name]', 'Environment name (can be in vaf.yml)')
  .option('--memory <mb>', 'Memory in MB', parseInt)
  .option('--timeout <seconds>', 'Timeout in seconds', parseInt)
  .option('--database <name>', 'Database name')
  .option('--cache <name>', 'Cache name')
  .option('--storage <name>', 'Storage name')
  .option('--runtime <runtime>', 'Runtime (e.g., nodejs18.x)')
  .option('--handler <handler>', 'Handler function (e.g., index.handler)')
  .option('--watch', 'Watch for changes and auto-deploy')
  .option('--no-build', 'Skip running build commands from YAML')
  .action(async (projectId, envName, options: DeployOptions) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      const deploy = async () => {
        const cwd = process.cwd();
        
        // Load YAML configuration
        const vafConfig = loadVafConfig(cwd);
        
        // Determine project ID and environment name
        let finalProjectId = projectId;
        let finalEnvName = envName;
        
        if (vafConfig) {
          if (!finalProjectId) {
            finalProjectId = vafConfig.id.toString();
          }
          if (!finalEnvName && Object.keys(vafConfig.environments).length > 0) {
            utils.error('Environment name is required. Available environments:');
            Object.keys(vafConfig.environments).forEach(env => {
              console.log(chalk.cyan(`  - ${env}`));
            });
            process.exit(1);
          }
        }
        
        if (!finalProjectId || !finalEnvName) {
          utils.error('Project ID and environment name are required');
          utils.info('Either provide them as arguments or configure vaf.yml');
          process.exit(1);
        }
        
        // Get environment configuration from YAML if available
        const envConfig = vafConfig?.environments[finalEnvName];
        
        if (!envConfig && vafConfig) {
          utils.error(`Environment "${finalEnvName}" not found in vaf.yml`);
          utils.info('Available environments:');
          Object.keys(vafConfig.environments).forEach(env => {
            console.log(chalk.cyan(`  - ${env}`));
          });
          process.exit(1);
        }
        
        // Run build commands from YAML
        const skipBuild = options['no-build'] || false;
        if (envConfig?.build && !skipBuild) {
          utils.info('Running build commands...');
          for (const buildCmd of envConfig.build) {
            try {
              utils.info(`Running: ${buildCmd}`);
              await execAsync(buildCmd, { cwd });
            } catch (error: any) {
              utils.warn(`Build command failed: ${buildCmd}`);
            }
          }
          utils.success('Build commands completed');
        } else {
          // Fallback to npm run build
          utils.info('Building application...');
          try {
            const { stdout, stderr } = await execAsync('npm run build', { cwd });
            if (stderr) console.error(stderr);
            utils.success('Build completed');
          } catch (error: any) {
            utils.warn('Build command failed, continuing with current directory...');
          }
        }

        // Read ignore patterns
        const ignorePatterns = await readVafIgnore(cwd);
        
        // Create temp zip file with timestamp
        const timestamp = Date.now();
        const tempZip = path.join(cwd, `.vaf-deploy-temp-${timestamp}.zip`);
        const deploymentKey = `deployments/${timestamp}-package.zip`;
        
        try {
          utils.info('Creating deployment package...');
          await zipDirectory(cwd, tempZip, ignorePatterns);

          const stats = fs.statSync(tempZip);
          utils.info(`Package size: ${formatBytes(stats.size)}`);

          utils.info('Getting upload URL...');
          const uploadUrlResponse = await api.get<{ uploadUrl: string }>(
            `/api/projects/${finalProjectId}/environments/${finalEnvName}/deployment/upload-url`
          );

          utils.info('Uploading package...');
          // Upload the zip file using the signed URL
          const fileBuffer = fs.readFileSync(tempZip);
          await axios.put(uploadUrlResponse.uploadUrl, fileBuffer, {
            headers: {
              'Content-Type': 'application/zip',
            },
          });

          utils.info('Triggering deployment...');
          
          // Prepare deployment parameters
          // Use YAML config values, allow CLI options to override
          const deploymentParams: any = {
            deploymentKey,
            runtime: options.runtime || envConfig?.runtime || 'nodejs18.x',
            handler: options.handler || 'index.handler',
          };

          // Add optional parameters (CLI options override YAML config)
          if (options.memory !== undefined) {
            deploymentParams.memory = options.memory;
          } else if (envConfig?.memory !== undefined) {
            deploymentParams.memory = envConfig.memory;
          }
          
          if (options.timeout !== undefined) {
            deploymentParams.timeout = options.timeout;
          } else if (envConfig?.timeout !== undefined) {
            deploymentParams.timeout = envConfig.timeout;
          }
          
          if (options.database) {
            deploymentParams.database = options.database;
          } else if (envConfig?.database) {
            deploymentParams.database = envConfig.database;
          }
          
          if (options.cache) {
            deploymentParams.cache = options.cache;
          } else if (envConfig?.cache) {
            deploymentParams.cache = envConfig.cache;
          }
          
          if (options.storage) {
            deploymentParams.storage = options.storage;
          } else if (envConfig?.storage) {
            deploymentParams.storage = envConfig.storage;
          }

          // Trigger deployment
          const deployment = await api.post<any>(
            `/api/projects/${finalProjectId}/environments/${finalEnvName}/deployment/deploy`,
            deploymentParams
          );

          utils.success(`Deployment initiated: ${deployment.id || 'Success'}`);

          // Poll for deployment status if we have an ID
          if (deployment.id) {
            await pollDeploymentStatus(finalProjectId, finalEnvName, deployment.id);
          }
        } finally {
          // Clean up temp file
          if (fs.existsSync(tempZip)) {
            fs.unlinkSync(tempZip);
          }
        }
      };

      if (options.watch) {
        utils.info('Watching for changes...');
        
        const watcher = chokidar.watch('.', {
          ignored: /(^|[\/\\])\../, // ignore hidden files
          persistent: true,
        });

        let deployTimer: NodeJS.Timeout;
        
        watcher.on('all', async (event, filePath) => {
          // Skip if it's the temp zip file or hidden files
          if (filePath.includes('.vaf-deploy-temp-') || filePath.startsWith('.')) {
            return;
          }

          // Debounce - wait 2 seconds after last change
          clearTimeout(deployTimer);
          deployTimer = setTimeout(async () => {
            utils.info(`\nChange detected in ${filePath}, deploying...`);
            try {
              await deploy();
            } catch (error: any) {
              utils.error(error.message || 'Deployment failed');
            }
          }, 2000);
        });
      } else {
        await deploy();
      }
    } catch (error: any) {
      utils.error(error.message || 'Failed to deploy');
      process.exit(1);
    }
  });

async function pollDeploymentStatus(
  projectId: string,
  envName: string,
  deploymentId: string
): Promise<void> {
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max

  while (attempts < maxAttempts) {
    try {
      const deployment = await api.get<any>(
        `/api/projects/${projectId}/environments/${envName}/deployment/${deploymentId}`
      );

      console.log(chalk.blue(`Status: ${deployment.status}`));

      if (deployment.status === 'success') {
        utils.success('Deployment completed successfully!');
        if (deployment.url) {
          console.log(chalk.green(`URL: ${deployment.url}`));
        }
        return;
      }

      if (deployment.status === 'failed') {
        utils.error('Deployment failed');
        if (deployment.logs) {
          console.log(chalk.red('Logs:'));
          console.log(deployment.logs);
        }
        return;
      }

      // Show logs if available
      if (deployment.logs) {
        const lines = deployment.logs.split('\n');
        lines.slice(-5).forEach((line: string) => console.log(line));
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    } catch (error: any) {
      utils.error(error.message || 'Failed to check deployment status');
      return;
    }
  }

  utils.warn('Deployment is taking longer than expected...');
}

export default deployCommand;

