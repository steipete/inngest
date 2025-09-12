import { Command } from 'commander';
import { InngestClient } from '../api/client.js';
import type { InngestRun } from '../api/types.js';
import { getConfig } from '../utils/config.js';
import { displayError, displayInfo, displayRunsTable } from '../utils/display.js';

export function createListCommand(): Command {
  const command = new Command('list')
    .description('List runs with optional filtering')
    .option(
      '-s, --status <status>',
      'Filter by status (Running, Completed, Failed, Cancelled)',
      value => {
        const validStatuses = ['Running', 'Completed', 'Failed', 'Cancelled'];
        const normalizedStatus = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

        if (!validStatuses.includes(normalizedStatus)) {
          throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        return normalizedStatus;
      }
    )
    .option('-f, --function <functionId>', 'Filter by function ID')
    .option(
      '-l, --limit <number>',
      'Limit number of results (default: 20)',
      value => {
        const num = parseInt(value, 10);
        if (Number.isNaN(num) || num <= 0 || num > 100) {
          throw new Error('Limit must be a number between 1 and 100');
        }
        return num;
      },
      20
    )
    .option('--cursor <cursor>', 'Pagination cursor for next page')
    .option('--all', 'Fetch all results (ignores limit, may take time)')
    .action(async options => {
      try {
        const config = getConfig();
        const client = new InngestClient(config);

        let allRuns: InngestRun[] = [];
        let cursor = options.cursor;
        let hasMore = true;

        displayInfo(
          `Fetching runs${options.status ? ` with status: ${options.status}` : ''}${options.function ? ` for function: ${options.function}` : ''}...`
        );

        while (hasMore) {
          const response = await client.listRuns({
            status: options.status,
            function_id: options.function,
            cursor,
            limit: options.all ? 100 : options.limit,
          });

          allRuns = allRuns.concat(response.data);

          if (options.all && response.has_more && response.cursor) {
            cursor = response.cursor;
            displayInfo(`Fetched ${allRuns.length} runs, continuing...`);
          } else {
            hasMore = false;
          }

          // Safety break for --all option
          if (options.all && allRuns.length >= 1000) {
            displayInfo('Reached maximum of 1000 runs for safety');
            break;
          }
        }

        displayRunsTable(allRuns);

        if (!options.all && hasMore) {
          console.log(
            `\n${displayInfo.toString().replace('ℹ ', '')}Use --cursor ${cursor} to get next page`
          );
        }

        displayInfo(`Total: ${allRuns.length} run(s)`);
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  return command;
}
