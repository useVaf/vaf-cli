import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ApiClient } from '../api';
import { ConfigManager } from '../config';
import * as utils from '../utils';

const api = new ApiClient();
const config = ConfigManager.getInstance();

const cachesCommand = new Command('caches')
  .alias('cache')
  .description('Manage caches');

cachesCommand
  .command('list')
  .alias('ls')
  .description('List all user caches')
  .action(async () => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      utils.info('Fetching caches...');
      const caches = await api.get<any[]>('/api/caches');

      if (caches.length === 0) {
        utils.info('No caches found.');
        return;
      }

      console.log(chalk.bold('\nCaches:'));
      console.log(chalk.gray('────────────────────────────────────────────────────────────────────────────────'));
      caches.forEach((cache) => {
        console.log(chalk.cyan('ID:'), cache.id);
        console.log(chalk.cyan('Name:'), cache.name);
        console.log(chalk.cyan('Type:'), cache.type);
        console.log(chalk.cyan('Specs:'), cache.serverSpecs);
        console.log(chalk.cyan('Status:'), 
          cache.status === 'active' ? chalk.green(cache.status) : 
          cache.status === 'creating' ? chalk.yellow(cache.status) : 
          cache.status === 'failed' ? chalk.red(cache.status) : cache.status
        );
        if (cache.status === 'active' && cache.endpoint) {
          console.log(chalk.cyan('Endpoint:'), cache.endpoint);
          console.log(chalk.cyan('Port:'), cache.port);
        }
        console.log(chalk.cyan('Created:'), utils.formatDate(cache.createdAt));
        console.log();
      });
    } catch (error: any) {
      utils.error(error.message || 'Failed to list caches');
      process.exit(1);
    }
  });

cachesCommand
  .command('create')
  .description('Create a new cache')
  .option('--network-id <id>', 'Network ID (required)')
  .option('--name <name>', 'Cache name (required)')
  .option('--type <type>', 'Cache type')
  .option('--specs <specs>', 'Server specs (e.g., cache.t3.micro)')
  .action(async (options) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      // Collect required information
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'networkId',
          message: 'Network ID:',
          default: options.networkId,
          validate: (input) => !!input || 'Network ID is required',
          when: !options.networkId,
        },
        {
          type: 'input',
          name: 'name',
          message: 'Cache name:',
          default: options.name,
          validate: (input) => !!input || 'Cache name is required',
          when: !options.name,
        },
        {
          type: 'list',
          name: 'type',
          message: 'Cache type:',
          choices: [
            'Redis 7.x Cluster',
            'Redis 6.x Cluster',
            'Redis 5.x Cluster',
          ],
          default: options.type || 'Redis 7.x Cluster',
          when: !options.type,
        },
        {
          type: 'list',
          name: 'specs',
          message: 'Server specs:',
          choices: [
            { name: 'cache.t3.micro', value: 'cache.t3.micro' },
            { name: 'cache.t3.small', value: 'cache.t3.small' },
            { name: 'cache.t3.medium', value: 'cache.t3.medium' },
            { name: 'cache.t3.large', value: 'cache.t3.large' },
            { name: 'cache.t3.xlarge', value: 'cache.t3.xlarge' },
            { name: 'cache.t3.2xlarge', value: 'cache.t3.2xlarge' },
            { name: 'cache.r5.large', value: 'cache.r5.large' },
            { name: 'cache.r5.xlarge', value: 'cache.r5.xlarge' },
            { name: 'cache.r5.2xlarge', value: 'cache.r5.2xlarge' },
          ],
          default: options.specs || 'cache.t3.micro',
          when: !options.specs,
        },
      ]);

      const cacheParams = {
        networkId: answers.networkId || options.networkId,
        name: answers.name || options.name,
        type: answers.type || options.type,
        serverSpecs: answers.specs || options.specs,
      };

      utils.info('Creating cache (this may take a few minutes)...');
      const cache = await api.post<any>('/api/caches', cacheParams);

      utils.success(`Cache created: ${cache.name} (${cache.id})`);
      console.log(chalk.gray('Status:'), chalk.yellow(cache.status));
      console.log(chalk.gray('This cache is being created asynchronously.'));
      console.log(chalk.gray('Run "vaf caches show ' + cache.id + '" to check status.'));
    } catch (error: any) {
      utils.error(error.message || 'Failed to create cache');
      process.exit(1);
    }
  });

cachesCommand
  .command('show')
  .description('Show cache details')
  .argument('<cache-id>', 'Cache ID')
  .action(async (cacheId) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      utils.info('Fetching cache...');
      const cache = await api.get<any>(`/api/caches/${cacheId}`);

      console.log(chalk.bold('\nCache Details:'));
      console.log(chalk.gray('───────────────────────────'));
      console.log(chalk.cyan('ID:'), cache.id);
      console.log(chalk.cyan('Name:'), cache.name);
      console.log(chalk.cyan('Type:'), cache.type);
      console.log(chalk.cyan('Specs:'), cache.serverSpecs);
      console.log(chalk.cyan('Status:'), 
        cache.status === 'active' ? chalk.green(cache.status) : 
        cache.status === 'creating' ? chalk.yellow(cache.status) : 
        cache.status === 'failed' ? chalk.red(cache.status) : cache.status
      );

      if (cache.status === 'active') {
        console.log(chalk.green('\nConnection Details:'));
        console.log(chalk.cyan('Endpoint:'), cache.endpoint);
        console.log(chalk.cyan('Port:'), cache.port);
      }

      if (cache.error) {
        console.log(chalk.red('\nError:'), cache.error);
      }

      console.log(chalk.cyan('Created:'), utils.formatDate(cache.createdAt));
      if (cache.updatedAt) {
        console.log(chalk.cyan('Updated:'), utils.formatDate(cache.updatedAt));
      }
      console.log();
    } catch (error: any) {
      utils.error(error.message || 'Failed to fetch cache');
      process.exit(1);
    }
  });

cachesCommand
  .command('delete')
  .description('Delete a cache')
  .argument('<cache-id>', 'Cache ID')
  .option('--force', 'Skip confirmation')
  .action(async (cacheId, options) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      // Get cache info for confirmation
      const cache = await api.get<any>(`/api/caches/${cacheId}`);

      if (!options.force) {
        utils.warn(`This will delete cache "${cache.name}" (${cacheId})`);
        utils.warn('This action cannot be undone.');
        
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to delete this cache?',
            default: false,
          },
        ]);

        if (!confirm) {
          utils.info('Deletion cancelled');
          return;
        }
      }

      utils.info('Deleting cache...');
      await api.delete(`/api/caches/${cacheId}`);

      utils.success('Cache deletion initiated');
      console.log(chalk.gray('The cache is being deleted asynchronously.'));
      console.log(chalk.gray('Run "vaf caches list" to verify deletion.'));
    } catch (error: any) {
      utils.error(error.message || 'Failed to delete cache');
      process.exit(1);
    }
  });

export default cachesCommand;

