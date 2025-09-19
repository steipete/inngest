import { Command } from 'commander';
import { InngestClient } from '../api/client.js';
import type { InngestRun } from '../api/types.js';
import { type Environment, getConfig, validateEventId, validateRunId } from '../utils/config.js';
import {
  displayError,
  displayRunDetails,
  displayRunsTable,
  outputJSON,
  prepareRunDetailsForJSON,
  prepareRunsForJSON,
} from '../utils/display.js';

export function createStatusCommand(): Command {
  const command = new Command('status')
    .description('Get the status of runs')
    .option('-r, --run <runId>', 'Get status for a specific run ID (full or partial ID supported)')
    .option('-e, --event <eventId>', 'Get status for all runs of a specific event')
    .option('--format <format>', 'Output format: table or json (default: table)', 'table')
    .action(async (options, command) => {
      try {
        const globalOpts = command.parent?.opts() || {};
        const config = getConfig({
          env: globalOpts.env as Environment,
          devPort: globalOpts.devPort,
        });
        const client = new InngestClient(config);

        if (!options.run && !options.event) {
          throw new Error('Either --run or --event must be specified');
        }

        if (options.run && options.event) {
          throw new Error('Cannot specify both --run and --event');
        }

        if (options.run) {
          // Try to find run by full or partial ID
          let run: InngestRun | null = null;

          if (validateRunId(options.run)) {
            // Full valid run ID
            run = await client.getRun(options.run);
          } else {
            // Try partial ID search
            run = await client.findRunByPartialId(options.run);
            if (!run) {
              throw new Error(
                `Run not found with ID "${options.run}". ` +
                  `Please provide either:\n` +
                  `  • Full run ID (26 characters): 01K4Z25NHYZFHPRKED1TV8410X\n` +
                  `  • Partial ID from table (12+ characters): RKED1TV8410X\n\n` +
                  `💡 Use "inngest list" to see available runs.`
              );
            }
          }

          if (options.format === 'json') {
            const inputData = client.getInputDataForRun(run.run_id);
            outputJSON(prepareRunDetailsForJSON(run, inputData));
          } else {
            await displayRunDetails(run, client);
          }
        }

        if (options.event) {
          if (!validateEventId(options.event)) {
            throw new Error('Invalid event ID format');
          }

          const runs = await client.getEventRuns(options.event);
          if (options.format === 'json') {
            outputJSON({
              event_id: options.event,
              runs: prepareRunsForJSON(runs),
              total: runs.length,
            });
          } else {
            displayRunsTable(runs);
          }
        }
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  return command;
}
