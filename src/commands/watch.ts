import { Command } from 'commander';
import { InngestClient } from '../api/client.js';
import { getConfig, validateEventId, validateRunId } from '../utils/config.js';
import { displayError } from '../utils/display.js';
import { RunWatcher } from '../utils/polling.js';

export function createWatchCommand(): Command {
  const command = new Command('watch')
    .description('Watch runs in real-time')
    .option('-r, --run <runId>', 'Watch a specific run ID')
    .option('-e, --event <eventId>', 'Watch all runs for a specific event')
    .option(
      '-i, --interval <seconds>',
      'Polling interval in seconds (default: 5)',
      value => {
        const num = parseInt(value, 10);
        if (Number.isNaN(num) || num < 1 || num > 300) {
          throw new Error('Interval must be between 1 and 300 seconds');
        }
        return num;
      },
      5
    )
    .option('-t, --timeout <minutes>', 'Maximum watch duration in minutes', value => {
      const num = parseInt(value, 10);
      if (Number.isNaN(num) || num < 1 || num > 60) {
        throw new Error('Timeout must be between 1 and 60 minutes');
      }
      return num;
    })
    .action(async options => {
      try {
        const config = getConfig();
        const client = new InngestClient(config);
        const watcher = new RunWatcher(client);

        if (!options.run && !options.event) {
          throw new Error('Either --run or --event must be specified');
        }

        if (options.run && options.event) {
          throw new Error('Cannot specify both --run and --event');
        }

        const watchOptions: import('../utils/polling.js').WatchOptions = {
          pollInterval: options.interval * 1000,
          maxDuration: options.timeout ? options.timeout * 60 * 1000 : undefined,
        };

        if (options.run) {
          if (!validateRunId(options.run)) {
            throw new Error('Invalid run ID format');
          }

          await watcher.watchRun(options.run, watchOptions);
        }

        if (options.event) {
          if (!validateEventId(options.event)) {
            throw new Error('Invalid event ID format');
          }

          await watcher.watchEventRuns(options.event, watchOptions);
        }
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  return command;
}
