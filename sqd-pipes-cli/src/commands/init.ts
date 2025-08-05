import { Command } from 'commander';
import prompts from 'prompts';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export const initCommand = new Command()
  .name('init')
  .description('Initialize a new indexer project')
  .action(async () => {
    const response = await prompts([
      {
        type: 'text',
        name: 'projectName',
        message: 'Project name:',
        initial: 'my-solana-indexer'
      },
      {
        type: 'multiselect',
        name: 'pipes',
        message: 'Select pipes to include:',
        choices: [
          { title: 'Solana Swaps', value: 'solana-swaps', description: 'DEX swaps from Orca, Raydium, Meteora' },
          { title: 'PumpFun Tokens', value: 'pumpfun-tokens', description: 'PumpFun token creation events' },
          { title: 'PumpFun Swaps', value: 'pumpfun-swaps', description: 'PumpFun bonding curve swaps' },
          { title: 'Metaplex Tokens', value: 'metaplex-tokens', description: 'Metaplex token metadata' }
        ]
      }
    ]);

    if (!response.projectName) {
      console.log(chalk.red('Project creation cancelled'));
      return;
    }

    const projectDir = path.join(process.cwd(), response.projectName);
    
    // Create project structure
    await fs.ensureDir(projectDir);
    await fs.ensureDir(path.join(projectDir, 'src'));
    await fs.ensureDir(path.join(projectDir, 'src/pipes'));

    // Create package.json
    const packageJson = {
      name: response.projectName,
      version: '1.0.0',
      type: 'module',
      scripts: {
        start: 'tsx src/main.ts',
        build: 'tsc'
      },
      dependencies: {
        '@clickhouse/client': '^1.10.1',
        '@sqd-pipes/core': '0.0.1-alpha.2',
        '@subsquid/solana-stream': '1.0.0-portal-api.da1f68',
        'pino': '^9.6.0'
      },
      devDependencies: {
        '@types/node': '^22.13.1',
        'tsx': '^4.0.0',
        'typescript': '^5.7.3'
      }
    };

    await fs.writeJson(path.join(projectDir, 'package.json'), packageJson, { spaces: 2 });

    // Create basic main.ts
    const mainTs = `import { createClient } from '@clickhouse/client';

const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  database: process.env.CLICKHOUSE_DB || 'default',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || ''
});

async function main() {
  console.log('Starting indexer...');
  
  // Add your pipe logic here
  // Example:
  // const swapsPipe = new SolanaSwapsPipe(clickhouse, config);
  // await swapsPipe.start();
}

main().catch(console.error);
`;

    await fs.writeFile(path.join(projectDir, 'src/main.ts'), mainTs);

    console.log(chalk.green(`✓ Created project ${response.projectName}`));
    console.log('');
    console.log(chalk.blue('Next steps:'));
    console.log(chalk.gray(`  cd ${response.projectName}`));
    console.log(chalk.gray('  npm install'));
    
    // Add selected pipes
    if (response.pipes && response.pipes.length > 0) {
      console.log(chalk.gray(`  sqd-pipes-test add ${response.pipes.join(' ')}`));
    }
    
    console.log(chalk.gray('  npm start'));
  });
