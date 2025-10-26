import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../config';
import * as utils from '../utils';

const config = ConfigManager.getInstance();

const configCommand = new Command('config')
  .description('Manage CLI configuration')
  .action(() => {
    const currentConfig = config.getConfig();
    console.log(chalk.bold('\nCurrent Configuration:'));
    console.log(chalk.gray('───────────────────────────'));
    utils.prettyJson(currentConfig);
  });

configCommand
  .command('set')
  .description('Set a configuration value')
  .argument('<key>', 'Configuration key')
  .argument('<value>', 'Configuration value')
  .action((key, value) => {
    switch (key) {
      case 'api-url':
        config.setApiUrl(value);
        utils.success(`API URL set to: ${value}`);
        break;
      default:
        utils.error(`Unknown configuration key: ${key}`);
        process.exit(1);
    }
  });

configCommand
  .command('get')
  .description('Get a configuration value')
  .argument('<key>', 'Configuration key')
  .action((key) => {
    const currentConfig = config.getConfig();
    let value;

    switch (key) {
      case 'api-url':
        value = currentConfig.apiUrl;
        break;
      default:
        utils.error(`Unknown configuration key: ${key}`);
        process.exit(1);
        return;
    }

    console.log(value);
  });

export default configCommand;

