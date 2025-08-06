#!/usr/bin/env node
import { Command } from 'commander';
import { addCommand } from './commands/add.js';
import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';

const program = new Command();

program
  .name('sqd-pipes-test')
  .description('CLI for adding Solana data pipes to your indexer')
  .version('0.1.6');

program.addCommand(addCommand);
program.addCommand(initCommand);
program.addCommand(listCommand);

program.parse();
