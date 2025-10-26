import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ApiClient } from '../api';
import { ConfigManager } from '../config';
import * as utils from '../utils';

const api = new ApiClient();
const config = ConfigManager.getInstance();

export const loginCommand = new Command('login')
  .description('Login to VAF backend')
  .action(async () => {
    try {
      const { email, password } = await inquirer.prompt([
        {
          type: 'input',
          name: 'email',
          message: 'Email:',
          validate: (input) => !!input || 'Email is required',
        },
        {
          type: 'password',
          name: 'password',
          message: 'Password:',
          validate: (input) => !!input || 'Password is required',
        },
      ]);

      utils.info('Logging in...');
      const response = await api.post<{ token: string; user: any }>('/api/login', {
        email,
        password,
      });

      config.setToken(response.token);
      utils.success(`Welcome back, ${email}!`);
    } catch (error: any) {
      utils.error(error.message || 'Failed to login');
      process.exit(1);
    }
  });

export const logoutCommand = new Command('logout')
  .description('Logout and clear stored credentials')
  .action(() => {
    config.clearToken();
    utils.success('Logged out successfully');
  });

export const whoamiCommand = new Command('whoami')
  .description('Display current user info')
  .action(async () => {
    try {
      const token = config.getToken();
      if (!token) {
        utils.error('Not logged in. Please run "vaf login"');
        process.exit(1);
      }

      utils.info('Fetching user info...');
      const user = await api.get<any>('/api/user-info');
      
      console.log(chalk.bold('\nUser Information:'));
      console.log(chalk.gray('───────────────────────────'));
      console.log(chalk.cyan('Email:'), user.user.email);
      console.log(chalk.cyan('Name:'), user.user.firstName + ' ' + user.user.lastName || 'N/A');
      console.log(chalk.cyan('ID:'), user.user.id);
      if (user.createdAt) {
        console.log(chalk.cyan('Joined:'), utils.formatDate(user.user.createdAt));
      }
      console.log();
    } catch (error: any) {
      utils.error(error.message || 'Failed to fetch user info');
      process.exit(1);
    }
  });

