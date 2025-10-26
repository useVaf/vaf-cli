import { Command } from 'commander';
import * as fs from 'fs';
import chalk from 'chalk';
import FormData from 'form-data';
import { ApiClient } from '../api';
import { ConfigManager } from '../config';
import * as utils from '../utils';

const api = new ApiClient();
const config = ConfigManager.getInstance();

const varsCommand = new Command('vars')
  .description('Manage environment variables');

varsCommand
  .command('list')
  .alias('ls')
  .description('List all environment variables')
  .argument('<project-id>', 'Project ID')
  .argument('<env-id>', 'Environment ID')
  .action(async (projectId, envId) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      utils.info('Fetching environment variables...');
      const vars = await api.get<any>(
        `/api/projects/${projectId}/environments/${envId}/env-variables`
      );

      if (!vars || Object.keys(vars).length === 0) {
        utils.info('No environment variables set.');
        return;
      }

      console.log(chalk.bold('\nEnvironment Variables:'));
      console.log(chalk.gray('───────────────────────────'));
      Object.entries(vars).forEach(([key, value]) => {
        console.log(chalk.cyan(`${key}`), '=', value);
      });
    } catch (error: any) {
      utils.error(error.message || 'Failed to list environment variables');
      process.exit(1);
    }
  });

varsCommand
  .command('set')
  .description('Set an environment variable')
  .argument('<project-id>', 'Project ID')
  .argument('<env-id>', 'Environment ID')
  .argument('<key>', 'Variable key')
  .argument('<value>', 'Variable value')
  .action(async (projectId, envId, key, value) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      utils.info('Setting environment variable...');
      await api.post(`/api/projects/${projectId}/environments/${envId}/env-variables`, {
        [key]: value,
      });

      utils.success(`Environment variable ${key} set successfully`);
    } catch (error: any) {
      utils.error(error.message || 'Failed to set environment variable');
      process.exit(1);
    }
  });

varsCommand
  .command('remove')
  .alias('rm')
  .description('Remove an environment variable')
  .argument('<project-id>', 'Project ID')
  .argument('<env-id>', 'Environment ID')
  .argument('<key>', 'Variable key')
  .action(async (projectId, envId, key) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      utils.info('Removing environment variable...');
      await api.delete(
        `/api/projects/${projectId}/environments/${envId}/env-variables/${key}`
      );

      utils.success(`Environment variable ${key} removed successfully`);
    } catch (error: any) {
      utils.error(error.message || 'Failed to remove environment variable');
      process.exit(1);
    }
  });

varsCommand
  .command('set-file')
  .description('Bulk set environment variables from a file')
  .argument('<project-id>', 'Project ID')
  .argument('<env-id>', 'Environment ID')
  .argument('<file>', 'Path to .env file')
  .action(async (projectId, envId, filePath) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      if (!fs.existsSync(filePath)) {
        utils.error(`File not found: ${filePath}`);
        process.exit(1);
      }

      utils.info('Reading environment variables from file...');
      const content = fs.readFileSync(filePath, 'utf-8');
      const variables: Record<string, string> = {};

      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key) {
            const value = valueParts.join('=');
            variables[key.trim()] = value.trim();
          }
        }
      });

      if (Object.keys(variables).length === 0) {
        utils.warn('No environment variables found in file');
        return;
      }

      utils.info(`Setting ${Object.keys(variables).length} environment variables...`);
      await api.post(
        `/api/projects/${projectId}/environments/${envId}/env-variables`,
        variables
      );

      utils.success('Environment variables set successfully');
    } catch (error: any) {
      utils.error(error.message || 'Failed to set environment variables from file');
      process.exit(1);
    }
  });

export default varsCommand;

