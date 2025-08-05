import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function addPipe(pipeName: string) {
  try {
    // Check if we're in a valid project
    const cwd = process.cwd();
    const packageJsonPath = path.join(cwd, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      console.log(chalk.red('Error: Not in a valid project directory'));
      console.log(chalk.gray('Run: sqd-pipes-test init'));
      return;
    }

    // Template path (relative to CLI package)
    const templateDir = path.join(__dirname, '../../templates', pipeName);
    
    if (!fs.existsSync(templateDir)) {
      console.log(chalk.red(`Error: Pipe "${pipeName}" not found`));
      console.log(chalk.gray('Available pipes: pumpfun-tokens'));
      // console.log(chalk.gray('Available pipes: solana-swaps, pumpfun-tokens, pumpfun-swaps, metaplex-tokens'));
      console.log(chalk.gray('Run: sqd-pipes-test list'));
      return;
    }

    // Destination paths
    const destDir = path.join(cwd, 'src/pipes', pipeName);
    
    // Copy template files
    await fs.copy(templateDir, destDir);
    
    console.log(chalk.green(`✓ Added ${pipeName} pipe`));
    console.log(chalk.gray(`  ${destDir}`));
    
    // Update dependencies if needed
    await updateDependencies(pipeName, cwd);
    
    // Show usage instructions
    showUsageInstructions(pipeName);
    
  } catch (error) {
    console.log(chalk.red('Error adding pipe:'), error);
  }
}

async function updateDependencies(pipeName: string, projectDir: string) {
  const depsPath = path.join(__dirname, '../../templates', pipeName, 'dependencies.json');
  
  if (!fs.existsSync(depsPath)) return;
  
  const deps = await fs.readJson(depsPath);
  const packageJsonPath = path.join(projectDir, 'package.json');
  const packageJson = await fs.readJson(packageJsonPath);
  
  // Merge dependencies
  packageJson.dependencies = { ...packageJson.dependencies, ...deps.dependencies };
  if (deps.devDependencies) {
    packageJson.devDependencies = { ...packageJson.devDependencies, ...deps.devDependencies };
  }
  
  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  
  console.log(chalk.blue('✓ Updated package.json with new dependencies'));
  console.log(chalk.gray('Run: npm install'));
}

function showUsageInstructions(pipeName: string) {
  console.log('');
  console.log(chalk.blue('Usage:'));
  
  switch (pipeName) {
    case 'solana-swaps':
      console.log(chalk.gray('  import { SolanaSwapsPipe } from "./pipes/solana-swaps/index.js";'));
      console.log(chalk.gray('  const pipe = new SolanaSwapsPipe(clickhouse, config);'));
      console.log(chalk.gray('  await pipe.start();'));
      break;
    case 'pumpfun-tokens':
      console.log(chalk.gray('  import { PumpfunTokensPipe } from "./pipes/pumpfun-tokens/index.js";'));
      console.log(chalk.gray('  const pipe = new PumpfunTokensPipe(clickhouse, config);'));
      console.log(chalk.gray('  await pipe.start();'));
      break;
    case 'pumpfun-swaps':
      console.log(chalk.gray('  import { PumpfunSwapsPipe } from "./pipes/pumpfun-swaps/index.js";'));
      console.log(chalk.gray('  const pipe = new PumpfunSwapsPipe(clickhouse, config);'));
      console.log(chalk.gray('  await pipe.start();'));
      break;
    case 'metaplex-tokens':
      console.log(chalk.gray('  import { MetaplexTokensPipe } from "./pipes/metaplex-tokens/index.js";'));
      console.log(chalk.gray('  const pipe = new MetaplexTokensPipe(clickhouse, config);'));
      console.log(chalk.gray('  await pipe.start();'));
      break;
  }
}
