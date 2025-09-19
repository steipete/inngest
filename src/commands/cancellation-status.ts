import chalk from 'chalk';
import { Command } from 'commander';
import { InngestClient } from '../api/client.js';
import { getConfig } from '../utils/config.js';
import { displayError, outputJSON } from '../utils/display.js';

export function createCancellationStatusCommand(): Command {
  const command = new Command('cancellation-status')
    .description('Check the status of a bulk cancellation')
    .argument('<cancellationId>', 'Cancellation ID to check')
    .option('--format <format>', 'Output format: table or json (default: table)', 'table')
    .action(async (cancellationId, options) => {
      try {
        const config = getConfig();
        const client = new InngestClient(config);

        const status = await client.getCancellationStatus(cancellationId);

        if (options.format === 'json') {
          outputJSON({
            cancellation_id: cancellationId,
            status: status.status,
            cancelled_count: status.cancelled_count,
            created_at: status.created_at,
            updated_at: status.updated_at,
          });
        } else {
          console.log(chalk.bold('\n🔄 Cancellation Status'));
          console.log('─'.repeat(50));
          console.log(`${chalk.bold('ID:')} ${cancellationId}`);
          console.log(`${chalk.bold('Status:')} ${status.status}`);

          if (status.cancelled_count !== undefined) {
            console.log(`${chalk.bold('Cancelled:')} ${status.cancelled_count} run(s)`);
          }

          if (status.created_at) {
            console.log(
              `${chalk.bold('Created:')} ${new Date(status.created_at).toLocaleString()}`
            );
          }

          if (status.updated_at) {
            console.log(
              `${chalk.bold('Updated:')} ${new Date(status.updated_at).toLocaleString()}`
            );
          }
        }
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  return command;
}
