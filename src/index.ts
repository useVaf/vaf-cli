#!/usr/bin/env node

import { Command } from 'commander';
import * as chalk from 'chalk';
import { loginCommand, logoutCommand, whoamiCommand } from './commands/auth';
import initCommand from './commands/init';
import projectsCommand from './commands/projects';
import envCommand from './commands/env';
import varsCommand from './commands/envvars';
import deployCommand from './commands/deploy';
import configCommand from './commands/config';
import databasesCommand from './commands/databases';
import cachesCommand from './commands/caches';

const program = new Command();

program
  .name('vaf')
  .description('VAF CLI - Command-line interface for VAF backend API')
  .version('0.1.1');

// Project initialization
program.addCommand(initCommand);

// Authentication commands
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(whoamiCommand);

// Project commands
program.addCommand(projectsCommand);

// Environment commands
envCommand.addCommand(varsCommand);
program.addCommand(envCommand);

// Deployment commands
program.addCommand(deployCommand);

// Database and cache management
program.addCommand(databasesCommand);
program.addCommand(cachesCommand);

// Configuration commands
program.addCommand(configCommand);

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  console.error(chalk.red('Unhandled Rejection:'), reason?.message || reason);
  process.exit(1);
});

program.parse();

