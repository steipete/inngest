import { Command } from 'commander';
import { InngestClient } from '../api/client.js';
import { getConfig, validateEventId, validateRunId } from '../utils/config.js';
import { displayError, displayRunDetails, displayRunsTable } from '../utils/display.js';

export function createStatusCommand(): Command {
  const command = new Command('status')
    .description('Get the status of runs')
    .option('-r, --run <runId>', 'Get status for a specific run ID')
    .option('-e, --event <eventId>', 'Get status for all runs of a specific event')
    .action(async options => {
      try {
        const config = getConfig();
        const client = new InngestClient(config);

        if (!options.run && !options.event) {
          throw new Error('Either --run or --event must be specified');
        }

        if (options.run && options.event) {
          throw new Error('Cannot specify both --run and --event');
        }

        if (options.run) {
          if (!validateRunId(options.run)) {
            throw new Error('Invalid run ID format');
          }

          const run = await client.getRun(options.run);
          displayRunDetails(run);
        }

        if (options.event) {
          if (!validateEventId(options.event)) {
            throw new Error('Invalid event ID format');
          }

          const runs = await client.getEventRuns(options.event);
          displayRunsTable(runs);
        }
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  return command;
}
