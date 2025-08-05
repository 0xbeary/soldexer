import { Command } from 'commander';
import { addPipe } from '../utils/add-pipe.js';

export const addCommand = new Command()
  .name('add')
  .description('Add a pipe to your project')
  .argument('<pipe>', 'pipe to add (e.g. solana-swaps, pumpfun-tokens)')
  .action(async (pipe: string) => {
    await addPipe(pipe);
  });
