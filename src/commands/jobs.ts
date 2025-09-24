import { Command } from 'commander';
import { InngestClient } from '../api/client.js';
import { type Environment, getConfig } from '../utils/config.js';
import {
  displayError,
  displayJobsTable,
  outputJSON,
  prepareJobsForJSON,
} from '../utils/display.js';
import { ensureRun } from '../utils/run-helpers.js';

export function createJobsCommand(): Command {
  const command = new Command('jobs')
    .description('Get job details for a run')
    .argument('<runId>', 'Run ID to get jobs for')
    .option('--format <format>', 'Output format: table or json (default: table)', 'table')
    .action(async (runIdInput, options, command) => {
      try {
        const globalOpts = command.parent?.opts() || {};
        const config = getConfig({
          env: globalOpts.env as Environment,
          devPort: globalOpts.devPort,
          environmentSlug: globalOpts.envSlug,
        });
        const client = new InngestClient(config);

        const { runId } = await ensureRun(client, runIdInput);
        const jobs = await client.getJobs(runId);
        if (options.format === 'json') {
          outputJSON({
            run_id: runId,
            jobs: prepareJobsForJSON(jobs),
            total: jobs.length,
          });
        } else {
          displayJobsTable(jobs);
        }
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  return command;
}
