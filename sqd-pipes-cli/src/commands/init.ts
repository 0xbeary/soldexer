import { Command } from 'commander';
import prompts from 'prompts';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { copyTemplateDirectory } from '../utils/template-processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const initCommand = new Command()
  .name('init')
  .description('Initialize a new indexer project')
  .action(async () => {
    const response = await prompts([
      {
        type: 'text',
        name: 'projectName',
        message: 'Project name:',
        initial: 'pipes-indexer'
      }
    ]);

    if (!response.projectName) {
      console.log(chalk.red('Project creation cancelled'));
      return;
    }

    const projectDir = path.join(process.cwd(), response.projectName);
    
    // Get the template directory path - templates are in dist/templates when built
    const templateDir = path.join(__dirname, '../templates/base-project');
    
    // Copy template files with variable substitution
    await copyTemplateDirectory(templateDir, projectDir, {
      projectName: response.projectName
    });

    console.log(chalk.green(`✓ Created project ${response.projectName}`));
    console.log('');

    // Auto-install dependencies
    try {
      const { execa } = await import('execa');
      console.log(chalk.gray('Installing dependencies...'));
      await execa('npm', ['install'], {
        cwd: projectDir,
        stdio: 'inherit'
      });
      console.log(chalk.green('✓ Dependencies installed successfully'));
    } catch (error) {
      console.log(chalk.yellow('⚠ Auto-install failed. Please run manually:'));
      console.log(chalk.gray(`  cd ${response.projectName}`));
      console.log(chalk.gray('  npm install'));
    }

    console.log('');
    console.log(chalk.blue('Next steps:'));
    console.log(chalk.gray(`  cd ${response.projectName}`));
    console.log(chalk.gray('  docker-compose up -d # Start ClickHouse'));
    
    // // Add selected pipes
    // if (response.pipes && response.pipes.length > 0) {
    //   console.log(chalk.gray(`  sqd-pipes-test add ${response.pipes.join(' ')}`));
    // }
    
    console.log(chalk.gray('  npm start'));
  });