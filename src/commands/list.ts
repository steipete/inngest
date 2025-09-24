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
import type { CollectRunsOptions } from '../utils/run-collection.js';
import { collectRuns } from '../utils/run-collection.js';

export function createListCommand(): Command {
  const command = new Command('list')
    .aliases(['runs'])
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

        const validStatuses = ['Running', 'Queued', 'Completed', 'Failed', 'Cancelled'];
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
          environmentSlug: globalOpts.envSlug,
        });
        const client = new InngestClient(config, { verbose: options.verbose });

        const functionFilter = options.function || options.functionName;
        const envIndicator = globalOpts.env === 'dev' ? ' [DEV]' : '';
        const isJsonFormat = options.format === 'json';

        if (!isJsonFormat) {
          displayInfo(
            `Fetching runs${options.status ? ` with status: ${options.status}` : ''}${functionFilter ? ` for function: ${functionFilter}` : ''}${envIndicator}...`
          );
        }

        const runCollectionOptions: CollectRunsOptions = {
          limit: options.limit,
          fetchAll: Boolean(options.all),
        };
        if (options.status) runCollectionOptions.status = options.status;
        if (functionFilter) runCollectionOptions.function_id = functionFilter;
        if (options.cursor) runCollectionOptions.cursor = options.cursor;
        if (options.after) runCollectionOptions.after = options.after;
        if (options.before) runCollectionOptions.before = options.before;
        if (options.hours) runCollectionOptions.hours = options.hours;

        const {
          runs: allRuns,
          hasMore,
          nextCursor,
        } = await collectRuns(client, runCollectionOptions, {
          onProgress: message => {
            if (!isJsonFormat) {
              displayInfo(message);
            }
          },
        });

        const outputOptions = { details: Boolean(options.details), all: Boolean(options.all) };

        if (isJsonFormat) {
          await outputRunsAsJson({
            runs: allRuns,
            client,
            options: outputOptions,
            hasMore,
            nextCursor,
          });
        } else {
          await outputRunsAsTable({
            runs: allRuns,
            client,
            options: outputOptions,
            hasMore,
            nextCursor,
            displayInfo,
          });
        }
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  return command;
}

interface OutputOptions {
  details: boolean;
  all: boolean;
}

interface JsonOutputContext {
  runs: InngestRun[];
  client: InngestClient;
  options: OutputOptions;
  hasMore: boolean;
  nextCursor: string | null;
}

interface TableOutputContext extends JsonOutputContext {
  displayInfo: typeof displayInfo;
}

function outputRunsAsJson({ runs, client, options, hasMore, nextCursor }: JsonOutputContext): void {
  if (options.details) {
    const detailedRuns = runs.map(run => {
      const inputData = client.getInputDataForRun(run.run_id) || null;
      return prepareRunDetailsForJSON(run, inputData);
    });

    outputJSON({
      runs: detailedRuns,
      total: runs.length,
      has_more: hasMore,
      next_cursor: hasMore ? nextCursor : null,
    });
    return;
  }

  outputJSON({
    runs: prepareRunsForJSON(runs),
    total: runs.length,
    has_more: hasMore,
    next_cursor: hasMore ? nextCursor : null,
  });
}

async function outputRunsAsTable({
  runs,
  client,
  options,
  hasMore,
  nextCursor,
  displayInfo,
}: TableOutputContext): Promise<void> {
  if (options.details) {
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      if (i > 0) console.log('\n');
      await displayRunDetails(run, client);
    }
  } else {
    displayRunsTable(runs);
  }

  if (!options.all && hasMore && nextCursor) {
    console.log('');
    displayInfo(`Use --cursor ${nextCursor} to get next page`);
  }

  displayInfo(`Total: ${runs.length} run(s)`);
}
