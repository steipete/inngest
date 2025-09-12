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
  .version('1.0.0')
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
  .option(
    '--dev-port <port>',
    'Port for dev server (default: 8288)',
    value => {
      const port = parseInt(value, 10);
      if (Number.isNaN(port) || port < 1 || port > 65535) {
        throw new Error('Dev port must be a valid port number (1-65535)');
      }
      return port;
    }
  )
  .configureOutput({
    writeErr: (str: string) => process.stderr.write(chalk.red(str)),
  });

// Add commands
program.addCommand(createStatusCommand());
program.addCommand(createListCommand());
program.addCommand(createWatchCommand());
program.addCommand(createCancelCommand());
program.addCommand(createJobsCommand());
program.addCommand(createCancellationStatusCommand());

// Global error handler
program.exitOverride(err => {
  if (err.code === 'commander.help') {
    process.exit(0);
  }
  if (err.code === 'commander.version') {
    process.exit(0);
  }
  if (err.code === 'commander.optionMissingArgument') {
    // Handle missing arguments with helpful messages
    if (err.message.includes("option '-s, --status")) {
      console.error(chalk.red('❌ Error: Status value is required\n'));
      console.error('Available statuses: Running, Completed, Failed, Cancelled\n');
      console.error('Examples:');
      console.error('  inngest list --status Running');
      console.error('  inngest list --status Failed');
      process.exit(1);
    }
  }
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

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  displayError(error);
  process.exit(1);
});
