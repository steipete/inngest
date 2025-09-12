import { Command } from 'commander';
import { InngestClient } from '../api/client.js';
import { getConfig, validateRunId } from '../utils/config.js';
import { displayError, displayInfo, displaySuccess, displayWarning } from '../utils/display.js';

export function createCancelCommand(): Command {
  const command = new Command('cancel')
    .description('Cancel runs')
    .option('-r, --run <runId>', 'Cancel a specific run')
    .option('-f, --function <functionId>', 'Cancel runs for a function (requires app-id)')
    .option('-a, --app-id <appId>', 'App ID for bulk cancellation')
    .option('--after <timestamp>', 'Cancel runs started after this timestamp (ISO 8601)')
    .option('--before <timestamp>', 'Cancel runs started before this timestamp (ISO 8601)')
    .option('--if <expression>', 'CEL expression for conditional cancellation')
    .option('--dry-run', 'Show what would be cancelled without actually cancelling')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async options => {
      try {
        const config = getConfig();
        const client = new InngestClient(config);

        // Single run cancellation
        if (options.run) {
          if (options.function || options.appId || options.after || options.before || options.if) {
            throw new Error('Cannot use bulk cancellation options with --run');
          }

          if (!validateRunId(options.run)) {
            throw new Error('Invalid run ID format');
          }

          if (options.dryRun) {
            displayInfo(`Would cancel run: ${options.run}`);
            return;
          }

          if (!options.yes) {
            displayWarning(`Are you sure you want to cancel run ${options.run}?`);
            displayInfo('Use --yes to skip this confirmation');
            return;
          }

          await client.cancelRun(options.run);
          displaySuccess(`Cancelled run: ${options.run}`);
          return;
        }

        // Bulk cancellation
        if (!options.function) {
          throw new Error('Either --run or --function must be specified');
        }

        if (!options.appId) {
          throw new Error('--app-id is required for bulk cancellation');
        }

        // Validate timestamps
        if (options.after && Number.isNaN(Date.parse(options.after))) {
          throw new Error('Invalid --after timestamp format. Use ISO 8601 format.');
        }

        if (options.before && Number.isNaN(Date.parse(options.before))) {
          throw new Error('Invalid --before timestamp format. Use ISO 8601 format.');
        }

        const cancellationRequest = {
          app_id: options.appId,
          function_id: options.function,
          started_after: options.after,
          started_before: options.before,
          if: options.if,
        };

        if (options.dryRun) {
          displayInfo('Would perform bulk cancellation with:');
          console.log(JSON.stringify(cancellationRequest, null, 2));
          return;
        }

        if (!options.yes) {
          displayWarning('You are about to perform a bulk cancellation:');
          console.log(JSON.stringify(cancellationRequest, null, 2));
          displayWarning('This action cannot be undone!');
          displayInfo('Use --yes to skip this confirmation or --dry-run to preview');
          return;
        }

        const response = await client.bulkCancel(cancellationRequest);
        displaySuccess(`Bulk cancellation initiated: ${response.cancellation_id}`);
        displayInfo(`Status: ${response.status}`);
        displayInfo(
          `Check cancellation status with: inngest cancellation-status ${response.cancellation_id}`
        );
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  return command;
}
