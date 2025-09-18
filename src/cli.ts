#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import { createCancelCommand } from './commands/cancel.js';
import { createCancellationStatusCommand } from './commands/cancellation-status.js';
import { createJobsCommand } from './commands/jobs.js';
import { createListCommand } from './commands/list.js';
import { createStatusCommand } from './commands/status.js';
import { createWatchCommand } from './commands/watch.js';
import { displayError } from './utils/display.js';

const program = new Command();

program
  .name('inngest')
  .description('CLI for managing Inngest jobs - watch, cancel, filter by status')
  .version('0.9.1')
  .option(
    '--env <environment>',
    'Environment to connect to',
    value => {
      const validEnvs = ['prod', 'dev'];
      if (!validEnvs.includes(value)) {
        throw new Error(`Invalid environment "${value}". Available: ${validEnvs.join(', ')}`);
      }
      return value as 'prod' | 'dev';
    },
    'prod'
  )
  .option('--dev-port <port>', 'Port for dev server (default: 8288)', value => {
    const port = parseInt(value, 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      throw new Error('Dev port must be a valid port number (1-65535)');
    }
    return port;
  })
  .configureOutput({
    writeOut: (str) => process.stdout.write(str),
    writeErr: (str) => process.stderr.write(str),
    outputError: (str, write) => {
      // Commander calls this for help "errors" - suppress them
      if (str.includes('(outputHelp)')) {
        return;
      }
      write(chalk.red(str));
    }
  });

// Add commands
program.addCommand(createStatusCommand());
program.addCommand(createListCommand());
program.addCommand(createWatchCommand());
program.addCommand(createCancelCommand());
program.addCommand(createJobsCommand());
program.addCommand(createCancellationStatusCommand());

// Handle help and version cleanly without showing errors
program.exitOverride(err => {
  // Check for help - Commander uses 'commander.helpDisplayed' code
  if (err.code === 'commander.helpDisplayed') {
    process.exit(0);
  }
  if (err.code === 'commander.version') {
    process.exit(0);
  }
  // For other errors, display them properly and exit
  displayError(err);
  process.exit(1);
});

// Show help if no command provided
if (process.argv.length <= 2) {
  program.help();
}

// Parse arguments
program.parse();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions (but not help)
process.on('uncaughtException', error => {
  // Don't show error for help output
  if (error.message && error.message.includes('(outputHelp)')) {
    process.exit(0);
  }
  displayError(error);
  process.exit(1);
});
