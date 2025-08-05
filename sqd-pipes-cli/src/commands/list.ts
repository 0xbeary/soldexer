import { Command } from 'commander';
import chalk from 'chalk';

export const listCommand = new Command()
  .name('list')
  .description('List available pipes')
  .action(async () => {
    console.log(chalk.blue('Available Solana pipes:'));
    console.log('');
    // console.log(chalk.green('  solana-swaps') + chalk.gray('        - DEX swaps from Orca, Raydium, Meteora'));
    console.log(chalk.green('  pumpfun-tokens') + chalk.gray('      - PumpFun token creation events'));
    // console.log(chalk.green('  pumpfun-swaps') + chalk.gray('       - PumpFun bonding curve swaps'));
    // console.log(chalk.green('  metaplex-tokens') + chalk.gray('     - Metaplex token metadata'));
    console.log('');
    console.log(chalk.gray('Usage: sqd-pipes-test add <pipe-name>'));
  });
