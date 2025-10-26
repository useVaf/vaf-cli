import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import inquirer from 'inquirer';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import * as utils from '../utils';

interface EnvironmentConfig {
  runtime?: string;
  memory?: number;
  timeout?: number;
  database?: string;
  cache?: string;
  storage?: string;
  build?: string[];
  deploy?: string[];
}

interface VafConfig {
  id?: number;
  name: string;
  environments: {
    [key: string]: EnvironmentConfig;
  };
}

const initCommand = new Command('init')
  .description('Initialize a new VAF project and create vaf.yml')
  .action(async () => {
    try {
      const cwd = process.cwd();
      const vafYmlPath = path.join(cwd, 'vaf.yml');

      // Check if vaf.yml already exists
      if (fs.existsSync(vafYmlPath)) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: 'vaf.yml already exists. Overwrite it?',
            default: false,
          },
        ]);

        if (!overwrite) {
          utils.info('Initialization cancelled');
          return;
        }
      }

      utils.info('Let\'s set up your VAF project!');

      // Collect project information
      const projectAnswers = await inquirer.prompt([
        {
          type: 'number',
          name: 'id',
          message: 'Project ID (leave empty if unknown):',
          default: null,
          validate: (input) => {
            if (input && input <= 0) return 'Project ID must be a positive number';
            return true;
          },
        },
        {
          type: 'input',
          name: 'name',
          message: 'Project name:',
          validate: (input) => !!input || 'Project name is required',
        },
      ]);

      // Ask how many environments
      const { envCount } = await inquirer.prompt([
        {
          type: 'number',
          name: 'envCount',
          message: 'How many environments do you want to configure?',
          default: 2,
          validate: (input) => input > 0 || 'At least one environment is required',
        },
      ]);

      const environments: { [key: string]: EnvironmentConfig } = {};

      // Collect environment information
      for (let i = 0; i < envCount; i++) {
        utils.info(`\nConfiguring environment ${i + 1}/${envCount}`);

        const envAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Environment name:',
            default: i === 0 ? 'development' : i === 1 ? 'production' : `env${i + 1}`,
            validate: (input) => !!input || 'Environment name is required',
          },
          {
            type: 'list',
            name: 'runtime',
            message: 'Runtime:',
            choices: [
              'nodejs18.x',
              'nodejs16.x',
              'nodejs14.x',
              'docker',
              'python3.9',
              'python3.11',
            ],
            default: 'nodejs18.x',
          },
          {
            type: 'number',
            name: 'memory',
            message: 'Memory (MB):',
            default: 512,
            validate: (input) => input > 0 || 'Memory must be greater than 0',
          },
          {
            type: 'number',
            name: 'timeout',
            message: 'Timeout (seconds):',
            default: 30,
            validate: (input) => input > 0 || 'Timeout must be greater than 0',
          },
          {
            type: 'input',
            name: 'database',
            message: 'Database name (optional):',
            default: null,
          },
          {
            type: 'input',
            name: 'cache',
            message: 'Cache name (optional):',
            default: null,
          },
          {
            type: 'input',
            name: 'storage',
            message: 'Storage name (optional):',
            default: null,
          },
          {
            type: 'confirm',
            name: 'addBuild',
            message: 'Add build commands?',
            default: true,
          },
        ]);

        const envName = envAnswers.name;

        if (envAnswers.addBuild) {
          const buildCommands: string[] = [];
          let addMore = true;

          while (addMore) {
            const { command, more } = await inquirer.prompt([
              {
                type: 'input',
                name: 'command',
                message: 'Build command:',
                default: buildCommands.length === 0 ? 'npm install' : '',
              },
              {
                type: 'confirm',
                name: 'more',
                message: 'Add another build command?',
                default: false,
              },
            ]);

            if (command) {
              buildCommands.push(command);
            }
            addMore = more;
          }

          if (buildCommands.length > 0) {
            envAnswers.build = buildCommands;
          }
        }

        // Add deployment commands option
        const { addDeploy } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'addDeploy',
            message: 'Add deployment commands?',
            default: false,
          },
        ]);

        if (addDeploy) {
          const deployCommands: string[] = [];
          let addMore = true;

          while (addMore) {
            const { command, more } = await inquirer.prompt([
              {
                type: 'input',
                name: 'command',
                message: 'Deployment command:',
              },
              {
                type: 'confirm',
                name: 'more',
                message: 'Add another deployment command?',
                default: false,
              },
            ]);

            if (command) {
              deployCommands.push(command);
            }
            addMore = more;
          }

          if (deployCommands.length > 0) {
            envAnswers.deploy = deployCommands;
          }
        }

        // Build the environment config
        const envConfig: EnvironmentConfig = {
          runtime: envAnswers.runtime,
          memory: envAnswers.memory,
          timeout: envAnswers.timeout,
        };

        if (envAnswers.database) {
          envConfig.database = envAnswers.database;
        }
        if (envAnswers.cache) {
          envConfig.cache = envAnswers.cache;
        }
        if (envAnswers.storage) {
          envConfig.storage = envAnswers.storage;
        }
        if (envAnswers.build && envAnswers.build.length > 0) {
          envConfig.build = envAnswers.build;
        }
        if (envAnswers.deploy && envAnswers.deploy.length > 0) {
          envConfig.deploy = envAnswers.deploy;
        }

        environments[envName] = envConfig;
      }

      // Build the final config
      const config: VafConfig = {
        name: projectAnswers.name,
        environments,
      };

      if (projectAnswers.id) {
        config.id = projectAnswers.id;
      }

      // Write the file
      const yamlContent = yaml.dump(config, {
        indent: 4,
        lineWidth: -1,
      });

      fs.writeFileSync(vafYmlPath, yamlContent);

      utils.success(`\n✓ Created vaf.yml successfully!`);
      console.log(chalk.gray(`\nLocation: ${vafYmlPath}`));
      console.log(chalk.green('\nNext steps:'));
      console.log(chalk.cyan('  1. Review your vaf.yml configuration'));
      console.log(chalk.cyan('  2. Update with your actual project ID if needed'));
      console.log(chalk.cyan('  3. Run "vaf deploy <env-name>" to deploy'));
      console.log();
    } catch (error: any) {
      utils.error(error.message || 'Failed to create vaf.yml');
      process.exit(1);
    }
  });

export default initCommand;

