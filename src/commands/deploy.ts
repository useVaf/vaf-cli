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
  'use-layers'?: boolean;
}

interface LayerResponse {
  layerArn: string;
  layerVersion: number;
}

async function createLayerPackage(cwd: string): Promise<string> {
  const layerDir = path.join(cwd, '.vaf-layer');
  const layerZip = path.join(cwd, '.vaf-layer-temp.zip');
  
  // Create layer directory structure: layer/nodejs/node_modules
  const layerNodeJsDir = path.join(layerDir, 'nodejs');
  
  // Clean up old layer dir if exists
  if (fs.existsSync(layerDir)) {
    fs.rmSync(layerDir, { recursive: true, force: true });
  }
  
  fs.mkdirSync(layerNodeJsDir, { recursive: true });
  
  // Copy node_modules to layer/nodejs/node_modules
  const sourceNodeModules = path.join(cwd, 'node_modules');
  const targetNodeModules = path.join(layerNodeJsDir, 'node_modules');
  
  if (fs.existsSync(sourceNodeModules)) {
    utils.info('Packaging dependencies for Lambda layer...');
    fs.cpSync(sourceNodeModules, targetNodeModules, { recursive: true });
  } else {
    throw new Error('node_modules not found. Run npm install first.');
  }
  
  // Create zip of layer directory
  await zipDirectory(layerDir, layerZip, []);
  
  // Clean up layer directory
  fs.rmSync(layerDir, { recursive: true, force: true });
  
  return layerZip;
}

async function createThinPackage(cwd: string, tempZip: string): Promise<string> {
  // Read ignore patterns
  const ignorePatterns = await readVafIgnore(cwd);
  
  // Exclude node_modules for thin package
  const thinPackagePatterns = [...ignorePatterns];
  thinPackagePatterns.push('node_modules/**');
  
  await zipDirectory(cwd, tempZip, thinPackagePatterns);
  
  return tempZip;
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
      handler?: string;
      build?: string[];
      deploy?: string[];
    };
  };
}

function loadVafConfig(cwd: string): VafConfig | null {
  const configFiles = ['vaf.yml'];
  
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
  .option('--use-layers', 'Use Lambda layers for large node_modules (recommended for >50MB packages)')
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
          // If YAML has an ID, treat the first argument as environment name
          if (vafConfig.id) {
            finalProjectId = vafConfig.id.toString();
            // If only one argument provided
            if (!envName && projectId) {
              // Check if it's a valid environment name
              if (projectId in vafConfig.environments) {
                finalEnvName = projectId; // Treat the first arg as environment name
              } else {
                // First arg is not a valid environment name
                utils.error(`Environment "${projectId}" not found in vaf.yml`);
                utils.info('Available environments:');
                Object.keys(vafConfig.environments).forEach(env => {
                  console.log(chalk.cyan(`  - ${env}`));
                });
                process.exit(1);
              }
            }
          } else if (!finalProjectId) {
            // No ID in YAML and no project ID provided
            utils.error('Project ID is required');
            utils.info('Either provide it as the first argument or add it to vaf.yml');
            process.exit(1);
          }
        }
        
        // Validate we have both project ID and environment name
        if (!finalProjectId) {
          utils.error('Project ID is required');
          utils.info('Either provide it as the first argument or add it to vaf.yml');
          process.exit(1);
        }
        
        if (!finalEnvName) {
          utils.error('Environment name is required');
          if (vafConfig && Object.keys(vafConfig.environments).length > 0) {
            console.log(chalk.gray('Available environments:'));
            Object.keys(vafConfig.environments).forEach(env => {
              console.log(chalk.cyan(`  - ${env}`));
            });
          }
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

        // Install production dependencies
        utils.info('Installing production dependencies...');
        try {
          await execAsync('npm ci --omit=dev', { cwd });
          utils.success('Dependencies installed');
        } catch (error: any) {
          // If npm ci fails, try npm install --production
          try {
            await execAsync('npm install --production --no-audit --no-fund', { cwd });
            utils.success('Dependencies installed');
          } catch (fallbackError: any) {
            utils.warn('Failed to install production dependencies, using existing node_modules...');
          }
        }

        // Read ignore patterns
        const ignorePatterns = await readVafIgnore(cwd);
        
        // Create temp zip file with timestamp
        const timestamp = Date.now();
        const tempZip = path.join(cwd, `.vaf-deploy-temp-${timestamp}.zip`);
        const useLayers = options['use-layers'];
        
        try {
          let layerArn: string | undefined;
          
          if (useLayers) {
            // Create and upload layer
            utils.info('Creating Lambda layer package...');
            const layerZip = await createLayerPackage(cwd);
            
            const layerStats = fs.statSync(layerZip);
            utils.info(`Layer package size: ${formatBytes(layerStats.size)}`);
            
            // Resolve environment for layer upload
            utils.info('Resolving environment...');
            const environments = await api.get<any[]>(
              `/api/projects/${finalProjectId}/environments`
            );
            
            let environmentId = finalEnvName;
            const environment = environments.find(
              (env: any) => env.name === finalEnvName || env.id === finalEnvName
            );
            
            if (environment) {
              environmentId = environment.id;
            }
            
            // Get upload URL for layer
            utils.info('Getting upload URL for layer...');
            const layerUploadUrlResponse = await api.get<{ uploadUrl: string; key: string }>(
              `/api/projects/${finalProjectId}/environments/${environmentId}/deployment/upload-url`
            );
            
            // Upload layer
            utils.info('Uploading layer...');
            const layerFileBuffer = fs.readFileSync(layerZip);
            await axios.put(layerUploadUrlResponse.uploadUrl, layerFileBuffer, {
              headers: { 'Content-Type': 'application/zip' },
            });
            utils.success('Layer uploaded successfully');
            
            // Publish layer
            utils.info('Publishing Lambda layer...');
            const layerResponse = await api.post<LayerResponse>(
              `/api/projects/${finalProjectId}/environments/${environmentId}/deployment/layer`,
              { layerKey: layerUploadUrlResponse.key }
            );
            layerArn = layerResponse.layerArn;
            utils.success(`Layer published: ${layerResponse.layerArn} (version ${layerResponse.layerVersion})`);
            
            // Clean up layer zip
            fs.unlinkSync(layerZip);
          }
          
          // Create function package (thin if using layers, full otherwise)
          utils.info('Creating deployment package...');
          if (useLayers) {
            await createThinPackage(cwd, tempZip);
          } else {
            const filteredIgnorePatterns = ignorePatterns.filter(
              pattern => !pattern.includes('node_modules')
            );
            await zipDirectory(cwd, tempZip, filteredIgnorePatterns);
          }

          const stats = fs.statSync(tempZip);
          utils.info(`Package size: ${formatBytes(stats.size)}`);

          // Resolve environment name to ID (if not already resolved for layer)
          let environmentId = finalEnvName;
          if (!useLayers) {
            utils.info('Resolving environment...');
            const environments = await api.get<any[]>(
              `/api/projects/${finalProjectId}/environments`
            );
            
            // Find environment by name (first try name, then use as ID)
            const environment = environments.find(
              (env: any) => env.name === finalEnvName || env.id === finalEnvName
            );
            
            if (environment) {
              environmentId = environment.id;
            } else {
              // Try to use finalEnvName as ID if no match by name
              const envById = environments.find((env: any) => env.id === finalEnvName);
              if (!envById) {
                utils.error(`Environment "${finalEnvName}" not found`);
                console.log(chalk.gray('Available environments:'));
                environments.forEach((env: any) => {
                  console.log(chalk.cyan(`  - ${env.name} (${env.id})`));
                });
                process.exit(1);
              }
            }
          } else {
            // Environment already resolved in layer upload, get it from there
            const environments = await api.get<any[]>(
              `/api/projects/${finalProjectId}/environments`
            );
            
            const environment = environments.find(
              (env: any) => env.name === finalEnvName || env.id === finalEnvName
            );
            
            if (environment) {
              environmentId = environment.id;
            }
          }

          utils.info('Getting upload URL...');
          const uploadUrlResponse = await api.get<{ uploadUrl: string; key?: string; bucket?: string }>(
            `/api/projects/${finalProjectId}/environments/${environmentId}/deployment/upload-url`
          );

          // Get the deployment key from the upload URL response
          const deploymentKey = uploadUrlResponse.key || `deployments/${timestamp}-package.zip`;
          
          if (uploadUrlResponse.key) {
            utils.info(`Upload destination: ${uploadUrlResponse.key}`);
          }

          utils.info('Uploading package...');
          // Upload the zip file using the signed URL
          const fileBuffer = fs.readFileSync(tempZip);
          try {
            await axios.put(uploadUrlResponse.uploadUrl, fileBuffer, {
              headers: {
                'Content-Type': 'application/zip',
              },
            });
            utils.success('Package uploaded successfully');
          } catch (uploadError: any) {
            utils.error(`Failed to upload package: ${uploadError.message}`);
            throw uploadError;
          }

          utils.info('Triggering deployment...');
          
          // Prepare deployment parameters
          // Use YAML config values, allow CLI options to override
          const deploymentParams: any = {
            deploymentKey,
            runtime: options.runtime || envConfig?.runtime || 'nodejs18.x',
            handler: options.handler || envConfig?.handler || 'index.handler',
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
          
          // Only add database, cache, storage if they have non-empty string values
          const dbValue = options.database || envConfig?.database;
          if (dbValue && typeof dbValue === 'string' && dbValue.trim().length > 0) {
            deploymentParams.database = dbValue;
          }
          
          const cacheValue = options.cache || envConfig?.cache;
          if (cacheValue && typeof cacheValue === 'string' && cacheValue.trim().length > 0) {
            deploymentParams.cache = cacheValue;
          }
          
          const storageValue = options.storage || envConfig?.storage;
          if (storageValue && typeof storageValue === 'string' && storageValue.trim().length > 0) {
            deploymentParams.storage = storageValue;
          }
          
          // Add layers if using layers
          if (useLayers && layerArn) {
            deploymentParams.layers = [layerArn];
          }

          // Remove undefined values to avoid validation errors
          const cleanedParams: any = {};
          Object.keys(deploymentParams).forEach(key => {
            if (deploymentParams[key] !== undefined && deploymentParams[key] !== null) {
              cleanedParams[key] = deploymentParams[key];
            }
          });

          utils.info('Deployment parameters:');
          console.log(chalk.gray(JSON.stringify(cleanedParams, null, 2)));

          // Trigger deployment
          const deployment = await api.post<any>(
            `/api/projects/${finalProjectId}/environments/${environmentId}/deployment/deploy`,
            cleanedParams
          );

          utils.success(`Deployment initiated: ${deployment.id || 'Success'}`);

          // Poll for deployment status if we have an ID
          if (deployment.id) {
            await pollDeploymentStatus(finalProjectId, environmentId, deployment.id);
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
  envId: string,
  deploymentId: string
): Promise<void> {
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max

  while (attempts < maxAttempts) {
    try {
      const deployment = await api.get<any>(
        `/api/projects/${projectId}/environments/${envId}/deployment/${deploymentId}`
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

