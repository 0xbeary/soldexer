import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

// Find the package root directory (where package.json and templates/ are located)
function findPackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  let dir = path.dirname(currentFile);
  
  // In a published package, the structure is:
  // package-root/
  // ├── dist/index.js (our built file)
  // └── templates/
  // So from dist/index.js, we need to go up one level
  
  // Keep going up until we find package.json with our package name
  while (dir !== path.dirname(dir)) {
    const packageJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = fs.readJsonSync(packageJsonPath);
        // Make sure it's our package
        if (pkg.name === 'sqd-pipes-test') {
          return dir;
        }
      } catch {
        // Continue searching
      }
    }
    dir = path.dirname(dir);
  }
  
  // Fallback: assume we're in dist/ and go up one level
  return path.join(path.dirname(currentFile), '..');
}

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

    // Template path (find package root, then go to templates)
    const packageRoot = findPackageRoot();
    const templateDir = path.join(packageRoot, 'templates', pipeName);
    
    console.log(chalk.gray(`Debug: Package root: ${packageRoot}`));
    console.log(chalk.gray(`Debug: Template dir: ${templateDir}`));
    console.log(chalk.gray(`Debug: Template exists: ${fs.existsSync(templateDir)}`));
    
    if (!fs.existsSync(templateDir)) {
      console.log(chalk.red(`Error: Pipe "${pipeName}" not found`));
      console.log(chalk.gray(`Searched in: ${templateDir}`));
      
      // List what's actually in the templates directory
      const templatesRoot = path.join(packageRoot, 'templates');
      if (fs.existsSync(templatesRoot)) {
        const availableTemplates = fs.readdirSync(templatesRoot);
        console.log(chalk.gray(`Available templates in ${templatesRoot}: ${availableTemplates.join(', ')}`));
      } else {
        console.log(chalk.gray(`Templates directory doesn't exist at: ${templatesRoot}`));
      }
      
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
  const packageRoot = findPackageRoot();
  const depsPath = path.join(packageRoot, 'templates', pipeName, 'dependencies.json');
  
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
  
  // Auto-install dependencies
  try {
    const { execa } = await import('execa');
    console.log(chalk.gray('Installing dependencies...'));
    
    // Detect package manager
    const hasYarnLock = fs.existsSync(path.join(projectDir, 'yarn.lock'));
    const hasPnpmLock = fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'));
    
    let installCmd = 'npm install';
    if (hasPnpmLock) installCmd = 'pnpm install';
    else if (hasYarnLock) installCmd = 'yarn install';
    
    await execa(installCmd.split(' ')[0], installCmd.split(' ').slice(1), { 
      cwd: projectDir,
      stdio: 'inherit'
    });
    
    console.log(chalk.green('✓ Dependencies installed successfully'));
  } catch (error) {
    console.log(chalk.yellow('⚠ Auto-install failed. Please run manually:'));
    console.log(chalk.gray('npm install'));
  }
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
