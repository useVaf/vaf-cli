#!/usr/bin/env node

import { Command } from 'commander';
import * as chalk from 'chalk';
import { loginCommand, logoutCommand, whoamiCommand } from './commands/auth';
import projectsCommand from './commands/projects';
import envCommand from './commands/env';
import varsCommand from './commands/envvars';
import deployCommand from './commands/deploy';
import configCommand from './commands/config';

const program = new Command();

program
  .name('vaf')
  .description('VAF CLI - Command-line interface for VAF backend API')
  .version('0.1.0');

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

