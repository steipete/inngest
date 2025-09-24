import type { InngestRun } from '../api/types.js';
import { validateRunId } from './config.js';

const RUN_ID_HINT =
  'Please provide either:\n' +
  '  • Full run ID (26 characters): 01K4Z25NHYZFHPRKED1TV8410X\n' +
  '  • Partial ID from table (12+ characters): RKED1TV8410X\n\n' +
  '💡 Use "inngest list" to see available runs.';

export interface RunLookupClient {
  getRun(runId: string): Promise<InngestRun>;
  findRunByPartialId(runId: string): Promise<InngestRun | null>;
}

export interface ResolvedRun {
  run: InngestRun;
  runId: string;
  usedPartial: boolean;
}

export function createRunNotFoundError(identifier: string): Error {
  return new Error(`Run not found with ID "${identifier}". ${RUN_ID_HINT}`);
}

export async function ensureRun(client: RunLookupClient, runIdInput: string): Promise<ResolvedRun> {
  if (validateRunId(runIdInput)) {
    const run = await client.getRun(runIdInput);
    return { run, runId: run.run_id, usedPartial: false };
  }

  const run = await client.findRunByPartialId(runIdInput);
  if (!run) {
    throw createRunNotFoundError(runIdInput);
  }

  return { run, runId: run.run_id, usedPartial: true };
}
