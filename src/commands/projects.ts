import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../api';
import { ConfigManager } from '../config';
import * as utils from '../utils';

const api = new ApiClient();
const config = ConfigManager.getInstance();

const projectsCommand = new Command('projects')
  .description('Manage projects');

projectsCommand
  .command('list')
  .alias('ls')
  .description('List all user projects')
  .action(async () => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      utils.info('Fetching projects...');
      const projects = await api.get<any[]>('/api/projects');

      if (projects.length === 0) {
        utils.info('No projects found.');
        return;
      }

      console.log(chalk.bold('\nProjects:'));
      console.log(chalk.gray('─────────────────────────────────────────────────────────'));
      projects.forEach((project) => {
        console.log(chalk.cyan('ID:'), project.id);
        console.log(chalk.cyan('Name:'), project.name);
        console.log(chalk.cyan('Region:'), project.region || 'N/A');
        console.log(chalk.cyan('Created:'), utils.formatDate(project.createdAt));
        console.log();
      });
    } catch (error: any) {
      utils.error(error.message || 'Failed to list projects');
      process.exit(1);
    }
  });

projectsCommand
  .command('create')
  .description('Create a new project')
  .argument('<name>', 'Project name')
  .option('--region <region>', 'Project region')
  .action(async (name, options) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      utils.info('Creating project...');
      const project = await api.post<any>('/api/projects', {
        name,
        region: options.region || 'us-east-1',
      });

      utils.success(`Project created: ${project.name} (${project.id})`);
      utils.prettyJson(project);
    } catch (error: any) {
      utils.error(error.message || 'Failed to create project');
      process.exit(1);
    }
  });

projectsCommand
  .command('show')
  .description('Show project details')
  .argument('<project-id>', 'Project ID')
  .action(async (projectId) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      utils.info('Fetching project...');
      const project = await api.get<any>(`/api/projects/${projectId}`);

      console.log(chalk.bold('\nProject Details:'));
      console.log(chalk.gray('───────────────────────────'));
      utils.prettyJson(project);
    } catch (error: any) {
      utils.error(error.message || 'Failed to fetch project');
      process.exit(1);
    }
  });

projectsCommand
  .command('delete')
  .description('Delete a project')
  .argument('<project-id>', 'Project ID')
  .option('--force', 'Skip confirmation')
  .action(async (projectId, options) => {
    try {
      if (!config.getToken()) {
        utils.error('Not authenticated. Please run "vaf login"');
        process.exit(1);
      }

      if (!options.force) {
        utils.warn(`This will delete project ${projectId} and all its environments.`);
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

      utils.info('Deleting project...');
      await api.delete(`/api/projects/${projectId}`);

      utils.success(`Project ${projectId} deleted successfully`);
    } catch (error: any) {
      utils.error(error.message || 'Failed to delete project');
      process.exit(1);
    }
  });

export default projectsCommand;

