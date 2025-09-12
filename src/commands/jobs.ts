import { Command } from 'commander';
import { InngestClient } from '../api/client.js';
import { getConfig, validateRunId, type Environment } from '../utils/config.js';
import { displayError, displayJobsTable } from '../utils/display.js';

export function createJobsCommand(): Command {
  const command = new Command('jobs')
    .description('Get job details for a run')
    .argument('<runId>', 'Run ID to get jobs for')
    .action(async (runIdInput, command) => {
      try {
        const globalOpts = command.parent?.opts() || {};
        const config = getConfig({
          env: globalOpts.env as Environment,
          devPort: globalOpts.devPort,
        });
        const client = new InngestClient(config);

        // Try to find run by full or partial ID
        let runId = runIdInput;
        let run = null;

        if (validateRunId(runIdInput)) {
          // Full valid run ID
          runId = runIdInput;
        } else {
          // Try partial ID search
          run = await client.findRunByPartialId(runIdInput);
          if (!run) {
            throw new Error(
              `Run not found with ID "${runIdInput}". ` +
                `Please provide either:\n` +
                `  • Full run ID (26 characters): 01K4Z25NHYZFHPRKED1TV8410X\n` +
                `  • Partial ID from table (12+ characters): RKED1TV8410X\n\n` +
                `💡 Use "inngest list" to see available runs.`
            );
          }
          runId = run.run_id;
        }

        const jobs = await client.getJobs(runId);
        displayJobsTable(jobs);
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  return command;
}
