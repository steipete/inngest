import { Command } from 'commander';
import { InngestClient } from '../api/client.js';
import type { InngestRun } from '../api/types.js';
import { type Environment, getConfig } from '../utils/config.js';
import {
  displayError,
  displayInfo,
  displayRunDetails,
  displayRunsTable,
  outputJSON,
  prepareRunDetailsForJSON,
  prepareRunsForJSON,
} from '../utils/display.js';

export function createListCommand(): Command {
  const command = new Command('list')
    .description('List runs with optional filtering')
    .option(
      '-s, --status <status>',
      'Filter by status. Available: Running, Completed, Failed, Cancelled',
      value => {
        if (!value || value.trim() === '') {
          throw new Error(
            'Status value is required. Available statuses: Running, Completed, Failed, Cancelled'
          );
        }

        const validStatuses = ['Running', 'Completed', 'Failed', 'Cancelled'];
        const normalizedStatus = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

        if (!validStatuses.includes(normalizedStatus)) {
          throw new Error(
            `Invalid status "${value}". Available statuses: ${validStatuses.join(', ')}`
          );
        }

        return normalizedStatus;
      }
    )
    .option(
      '-f, --function <functionId>',
      'Filter by function ID or function name (supports partial matches)'
    )
    .option(
      '-n, --function-name <name>',
      'Filter by function name (partial match, e.g., "embeddings/reconcile")'
    )
    .option('--after <timestamp>', 'Show runs started after this timestamp (ISO 8601 format)')
    .option('--before <timestamp>', 'Show runs started before this timestamp (ISO 8601 format)')
    .option(
      '--hours <hours>',
      'Show runs from the last N hours (default: 24 when filtering by status)',
      value => {
        const num = parseInt(value, 10);
        if (Number.isNaN(num) || num <= 0) {
          throw new Error('Hours must be a positive number');
        }
        return num;
      }
    )
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
    .option('--details', 'Show full details for each run instead of table format')
    .option('-v, --verbose', 'Show detailed debug information during execution')
    .option('--format <format>', 'Output format: table or json (default: table)', 'table')
    .action(async (options, command) => {
      try {
        const globalOpts = command.parent?.opts() || {};
        const config = getConfig({
          env: globalOpts.env as Environment,
          devPort: globalOpts.devPort,
        });
        const client = new InngestClient(config, { verbose: options.verbose });

        let allRuns: InngestRun[] = [];
        let cursor = options.cursor;
        let hasMore = true;

        const functionFilter = options.function || options.functionName;
        const envIndicator = globalOpts.env === 'dev' ? ' [DEV]' : '';
        const isJsonFormat = options.format === 'json';

        if (!isJsonFormat) {
          displayInfo(
            `Fetching runs${options.status ? ` with status: ${options.status}` : ''}${functionFilter ? ` for function: ${functionFilter}` : ''}${envIndicator}...`
          );
        }

        while (hasMore) {
          const response = await client.listRuns({
            status: options.status,
            function_id: functionFilter,
            cursor,
            limit: options.all ? 100 : options.limit,
            after: options.after,
            before: options.before,
            hours: options.hours,
          });

          allRuns = allRuns.concat(response.data);

          if (options.all && response.has_more && response.cursor) {
            cursor = response.cursor;
            if (!isJsonFormat) {
              displayInfo(`Fetched ${allRuns.length} runs, continuing...`);
            }
          } else {
            hasMore = false;
          }

          // Safety break for --all option
          if (options.all && allRuns.length >= 1000) {
            if (!isJsonFormat) {
              displayInfo('Reached maximum of 1000 runs for safety');
            }
            break;
          }
        }

        if (isJsonFormat) {
          // JSON format output
          if (options.details) {
            // Show full details for each run in JSON
            const detailedRuns = [];
            for (const run of allRuns) {
              const inputData = client.getInputDataForRun(run.run_id) || null;
              detailedRuns.push(prepareRunDetailsForJSON(run, inputData));
            }
            outputJSON({
              runs: detailedRuns,
              total: allRuns.length,
              has_more: !options.all && hasMore,
              next_cursor: !options.all && hasMore ? cursor : null,
            });
          } else {
            // Simple JSON format
            outputJSON({
              runs: prepareRunsForJSON(allRuns),
              total: allRuns.length,
              has_more: !options.all && hasMore,
              next_cursor: !options.all && hasMore ? cursor : null,
            });
          }
        } else {
          // Table format output (existing behavior)
          if (options.details) {
            // Show full details for each run
            for (let i = 0; i < allRuns.length; i++) {
              const run = allRuns[i];
              if (i > 0) console.log('\n'); // Add spacing between runs
              await displayRunDetails(run, client);
            }
          } else {
            // Show table format
            displayRunsTable(allRuns);
          }

          if (!options.all && hasMore) {
            console.log(
              `\n${displayInfo.toString().replace('ℹ ', '')}Use --cursor ${cursor} to get next page`
            );
          }

          displayInfo(`Total: ${allRuns.length} run(s)`);
        }
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  return command;
}
