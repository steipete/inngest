import { Command } from 'commander';
import { InngestClient } from '../api/client.js';
import { getConfig, validateRunId } from '../utils/config.js';
import { displayError, displayJobsTable } from '../utils/display.js';

export function createJobsCommand(): Command {
  const command = new Command('jobs')
    .description('Get job details for a run')
    .argument('<runId>', 'Run ID to get jobs for')
    .action(async runId => {
      try {
        if (!validateRunId(runId)) {
          throw new Error('Invalid run ID format');
        }

        const config = getConfig();
        const client = new InngestClient(config);

        const jobs = await client.getJobs(runId);
        displayJobsTable(jobs);
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  return command;
}
