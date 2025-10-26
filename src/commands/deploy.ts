import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import chalk from 'chalk';
import chokidar from 'chokidar';
import { ApiClient } from '../api';
import { ConfigManager } from '../config';
import * as utils from '../utils';
import { zipDirectory, readVafIgnore, formatBytes } from '../utils';

const api = new ApiClient();
const config = ConfigManager.getInstance();

const deployCommand = new Command('deploy')
  .description('Deploy application to an environment')
  .argument('<project-id>', 'Project ID')
  .argument('<env-id>', 'Environment ID')
  .option('--watch', 'Watch for changes and auto-deploy')
  .action(async (projectId, envId, options) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      const deploy = async () => {
        const cwd = process.cwd();
        
        // Check if package.json exists (for Node.js projects)
        if (!fs.existsSync(path.join(cwd, 'package.json'))) {
          utils.error('No package.json found in current directory');
          process.exit(1);
        }

        // Read ignore patterns
        const ignorePatterns = await readVafIgnore(cwd);
        
        // Create temp zip file
        const tempZip = path.join(cwd, '.vaf-deploy-temp.zip');
        
        try {
          utils.info('Creating deployment package...');
          await zipDirectory(cwd, tempZip, ignorePatterns);

          const stats = fs.statSync(tempZip);
          utils.info(`Package size: ${formatBytes(stats.size)}`);

          utils.info('Uploading and deploying...');
          
          // Create form data
          const formData = new FormData();
          formData.append('file', fs.createReadStream(tempZip));

          // Upload and trigger deployment
          const deployment = await api.post<any>(
            `/api/projects/${projectId}/environments/${envId}/deployments`,
            formData,
            {
              headers: {
                ...formData.getHeaders(),
              },
            }
          );

          utils.success(`Deployment initiated: ${deployment.id}`);

          // Poll for deployment status
          await pollDeploymentStatus(projectId, envId, deployment.id);
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
          ignored: /(^|[\/\\])\../, // ignore .vafignore patterns
          persistent: true,
        });

        let deployTimer: NodeJS.Timeout;
        
        watcher.on('all', async (event, filePath) => {
          // Skip if it's the temp zip file or hidden files
          if (filePath.includes('.vaf-deploy-temp.zip') || filePath.startsWith('.')) {
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
        `/api/projects/${projectId}/environments/${envId}/deployments/${deploymentId}`
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

