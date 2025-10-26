import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../api';
import { ConfigManager } from '../config';
import * as utils from '../utils';

const api = new ApiClient();
const config = ConfigManager.getInstance();

const envCommand = new Command('env')
  .description('Manage environments');

envCommand
  .command('list')
  .alias('ls')
  .description('List environments for a project')
  .argument('<project-id>', 'Project ID')
  .action(async (projectId) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      utils.info('Fetching environments...');
      const environments = await api.get<any[]>(
        `/api/projects/${projectId}/environments`
      );

      if (environments.length === 0) {
        utils.info('No environments found.');
        return;
      }

      console.log(chalk.bold(`\nEnvironments for project ${projectId}:`));
      console.log(chalk.gray('─────────────────────────────────────────────────────────'));
      environments.forEach((env) => {
        console.log(chalk.cyan('ID:'), env.id);
        console.log(chalk.cyan('Name:'), env.name);
        console.log(chalk.cyan('Status:'), env.status || 'active');
        console.log(chalk.cyan('Created:'), utils.formatDate(env.createdAt));
        console.log();
      });
    } catch (error: any) {
      utils.error(error.message || 'Failed to list environments');
      process.exit(1);
    }
  });

envCommand
  .command('create')
  .description('Create a new environment')
  .argument('<project-id>', 'Project ID')
  .argument('<name>', 'Environment name')
  .action(async (projectId, name) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      utils.info('Creating environment...');
      const environment = await api.post<any>(
        `/api/projects/${projectId}/environments`,
        { name }
      );

      utils.success(`Environment created: ${environment.name} (${environment.id})`);
      utils.prettyJson(environment);
    } catch (error: any) {
      utils.error(error.message || 'Failed to create environment');
      process.exit(1);
    }
  });

envCommand
  .command('show')
  .description('Show environment details')
  .argument('<project-id>', 'Project ID')
  .argument('<env-id>', 'Environment ID')
  .action(async (projectId, envId) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      utils.info('Fetching environment...');
      const environment = await api.get<any>(
        `/api/projects/${projectId}/environments/${envId}`
      );

      console.log(chalk.bold('\nEnvironment Details:'));
      console.log(chalk.gray('───────────────────────────'));
      utils.prettyJson(environment);
    } catch (error: any) {
      utils.error(error.message || 'Failed to fetch environment');
      process.exit(1);
    }
  });

envCommand
  .command('delete')
  .description('Delete an environment')
  .argument('<project-id>', 'Project ID')
  .argument('<env-id>', 'Environment ID')
  .option('--force', 'Skip confirmation')
  .action(async (projectId, envId, options) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      if (!options.force) {
        utils.warn(`This will delete environment ${envId}.`);
        const { confirm } = await import('inquirer').then((m) =>
          m.default.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Are you sure?',
            },
          ])
        );

        if (!confirm) {
          utils.info('Cancelled');
          return;
        }
      }

      utils.info('Deleting environment...');
      await api.delete(
        `/api/projects/${projectId}/environments/${envId}`
      );

      utils.success(`Environment ${envId} deleted successfully`);
    } catch (error: any) {
      utils.error(error.message || 'Failed to delete environment');
      process.exit(1);
    }
  });

export default envCommand;

