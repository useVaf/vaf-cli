import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ApiClient } from '../api';
import { ConfigManager } from '../config';
import * as utils from '../utils';

const api = new ApiClient();
const config = ConfigManager.getInstance();

const databasesCommand = new Command('databases')
  .alias('db')
  .description('Manage databases');

databasesCommand
  .command('list')
  .alias('ls')
  .description('List all user databases')
  .action(async () => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      utils.info('Fetching databases...');
      const databases = await api.get<any[]>('/api/databases');

      if (databases.length === 0) {
        utils.info('No databases found.');
        return;
      }

      console.log(chalk.bold('\nDatabases:'));
      console.log(chalk.gray('────────────────────────────────────────────────────────────────────────────────'));
      databases.forEach((db) => {
        console.log(chalk.cyan('ID:'), db.id);
        console.log(chalk.cyan('Name:'), db.name);
        console.log(chalk.cyan('Engine:'), db.engine);
        console.log(chalk.cyan('Specs:'), db.serverSpecs);
        console.log(chalk.cyan('Status:'), 
          db.status === 'active' ? chalk.green(db.status) : 
          db.status === 'creating' ? chalk.yellow(db.status) : 
          db.status === 'failed' ? chalk.red(db.status) : db.status
        );
        if (db.status === 'active' && db.host) {
          console.log(chalk.cyan('Host:'), db.host);
          console.log(chalk.cyan('Port:'), db.port);
        }
        console.log(chalk.cyan('Created:'), utils.formatDate(db.createdAt));
        console.log();
      });
    } catch (error: any) {
      utils.error(error.message || 'Failed to list databases');
      process.exit(1);
    }
  });

databasesCommand
  .command('create')
  .description('Create a new database')
  .option('--network-id <id>', 'Network ID (required)')
  .option('--name <name>', 'Database name (required)')
  .option('--engine <engine>', 'Database engine')
  .option('--specs <specs>', 'Server specs (e.g., db.t3.micro)')
  .option('--disk <size>', 'Disk size in GB (20-1000)', parseInt)
  .option('--retention <days>', 'Backup retention in days (1-35)', parseInt)
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
          message: 'Database name:',
          default: options.name,
          validate: (input) => !!input || 'Database name is required',
          when: !options.name,
        },
        {
          type: 'list',
          name: 'engine',
          message: 'Database engine:',
          choices: [
            'MySQL 8.0 Fixed Size Database',
            'MySQL 5.7 Fixed Size Database',
            'MySQL 8.0 Serverless v2',
            'PostgreSQL 17 Fixed Size Database',
            'PostgreSQL 16.4 Serverless v2',
            'PostgreSQL 11.0 Serverless v1',
          ],
          default: options.engine,
          when: !options.engine,
        },
        {
          type: 'list',
          name: 'specs',
          message: 'Server specs:',
          choices: [
            { name: 'db.t3.micro', value: 'db.t3.micro' },
            { name: 'db.t3.small', value: 'db.t3.small' },
            { name: 'db.t3.medium', value: 'db.t3.medium' },
            { name: 'db.t3.large', value: 'db.t3.large' },
            { name: 'db.t3.xlarge', value: 'db.t3.xlarge' },
            { name: 'db.t3.2xlarge', value: 'db.t3.2xlarge' },
            { name: 'db.t4g.micro', value: 'db.t4g.micro' },
            { name: 'db.t4g.small', value: 'db.t4g.small' },
            { name: 'db.m5.large', value: 'db.m5.large' },
            { name: 'db.m5.xlarge', value: 'db.m5.xlarge' },
            { name: 'db.m5.2xlarge', value: 'db.m5.2xlarge' },
            { name: 'db.r5.large', value: 'db.r5.large' },
          ],
          default: options.specs || 'db.t3.micro',
          when: !options.specs,
        },
        {
          type: 'number',
          name: 'minimumDisk',
          message: 'Minimum disk size (GB):',
          default: options.disk || 100,
          validate: (input) => input >= 20 && input <= 1000 || 'Disk size must be between 20 and 1000 GB',
        },
        {
          type: 'number',
          name: 'retention',
          message: 'Backup retention (days):',
          default: options.retention || 7,
          validate: (input) => input >= 1 && input <= 35 || 'Retention must be between 1 and 35 days',
        },
      ]);

      const databaseParams = {
        networkId: answers.networkId || options.networkId,
        name: answers.name || options.name,
        engine: answers.engine || options.engine,
        serverSpecs: answers.specs || options.specs,
        minimumDisk: answers.minimumDisk || options.disk,
        retention: answers.retention || options.retention,
      };

      utils.info('Creating database (this may take a few minutes)...');
      const database = await api.post<any>('/api/databases', databaseParams);

      utils.success(`Database created: ${database.name} (${database.id})`);
      console.log(chalk.gray('Status:'), chalk.yellow(database.status));
      console.log(chalk.gray('This database is being created asynchronously.'));
      console.log(chalk.gray('Run "vaf databases show ' + database.id + '" to check status.'));
    } catch (error: any) {
      utils.error(error.message || 'Failed to create database');
      process.exit(1);
    }
  });

databasesCommand
  .command('show')
  .description('Show database details')
  .argument('<database-id>', 'Database ID')
  .action(async (databaseId) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      utils.info('Fetching database...');
      const database = await api.get<any>(`/api/databases/${databaseId}`);

      console.log(chalk.bold('\nDatabase Details:'));
      console.log(chalk.gray('───────────────────────────'));
      console.log(chalk.cyan('ID:'), database.id);
      console.log(chalk.cyan('Name:'), database.name);
      console.log(chalk.cyan('Engine:'), database.engine);
      console.log(chalk.cyan('Specs:'), database.serverSpecs);
      console.log(chalk.cyan('Disk:'), `${database.minimumDisk} GB`);
      console.log(chalk.cyan('Retention:'), `${database.retention} days`);
      console.log(chalk.cyan('Status:'), 
        database.status === 'active' ? chalk.green(database.status) : 
        database.status === 'creating' ? chalk.yellow(database.status) : 
        database.status === 'failed' ? chalk.red(database.status) : database.status
      );

      if (database.status === 'active') {
        console.log(chalk.green('\nConnection Details:'));
        console.log(chalk.cyan('Host:'), database.host);
        console.log(chalk.cyan('Port:'), database.port);
        console.log(chalk.cyan('Password:'), database.password);
      }

      if (database.error) {
        console.log(chalk.red('\nError:'), database.error);
      }

      console.log(chalk.cyan('Created:'), utils.formatDate(database.createdAt));
      if (database.updatedAt) {
        console.log(chalk.cyan('Updated:'), utils.formatDate(database.updatedAt));
      }
      console.log();
    } catch (error: any) {
      utils.error(error.message || 'Failed to fetch database');
      process.exit(1);
    }
  });

databasesCommand
  .command('delete')
  .description('Delete a database')
  .argument('<database-id>', 'Database ID')
  .option('--force', 'Skip confirmation')
  .action(async (databaseId, options) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      // Get database info for confirmation
      const database = await api.get<any>(`/api/databases/${databaseId}`);

      if (!options.force) {
        utils.warn(`This will delete database "${database.name}" (${databaseId})`);
        utils.warn('This action cannot be undone.');
        
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to delete this database?',
            default: false,
          },
        ]);

        if (!confirm) {
          utils.info('Deletion cancelled');
          return;
        }
      }

      utils.info('Deleting database...');
      await api.delete(`/api/databases/${databaseId}`);

      utils.success('Database deletion initiated');
      console.log(chalk.gray('The database is being deleted asynchronously.'));
      console.log(chalk.gray('Run "vaf databases list" to verify deletion.'));
    } catch (error: any) {
      utils.error(error.message || 'Failed to delete database');
      process.exit(1);
    }
  });

export default databasesCommand;

