import { beforeEach, describe, expect, it, vi } from 'vitest';

const validateRunIdMock = vi.hoisted(() => vi.fn());

vi.mock('../utils/config.js', () => ({
  validateRunId: validateRunIdMock,
}));

import type { InngestRun } from '../api/types.js';
import type { RunLookupClient } from '../utils/run-helpers.js';
import { createRunNotFoundError, ensureRun } from '../utils/run-helpers.js';

describe('run helpers', () => {
  const buildClient = () =>
    ({
      getRun: vi.fn<Promise<InngestRun>, [string]>(),
      findRunByPartialId: vi.fn<Promise<InngestRun | null>, [string]>(),
    }) as unknown as RunLookupClient & {
      getRun: ReturnType<typeof vi.fn>;
      findRunByPartialId: ReturnType<typeof vi.fn>;
    };

  beforeEach(() => {
    validateRunIdMock.mockReset();
  });

  it('returns run when full ID is provided', async () => {
    const client = buildClient();
    const run: InngestRun = {
      run_id: '01HWAVEB858VPPX47Z65GR6P6R',
      status: 'Completed',
      run_started_at: '2024-04-25T14:46:45.337Z',
    };

    validateRunIdMock.mockReturnValueOnce(true);
    client.getRun.mockResolvedValue(run);

    const result = await ensureRun(client, run.run_id);

    expect(client.getRun).toHaveBeenCalledWith(run.run_id);
    expect(result).toEqual({ run, runId: run.run_id, usedPartial: false });
  });

  it('uses partial lookup when ID fails validation', async () => {
    const client = buildClient();
    const run: InngestRun = {
      run_id: '01HWAVEB858VPPX47Z65GR6P6R',
      status: 'Running',
      run_started_at: '2024-04-25T14:46:45.337Z',
    };

    validateRunIdMock.mockReturnValueOnce(false);
    client.findRunByPartialId.mockResolvedValue(run);

    const result = await ensureRun(client, 'PARTIALID1234');

    expect(client.findRunByPartialId).toHaveBeenCalledWith('PARTIALID1234');
    expect(result).toEqual({ run, runId: run.run_id, usedPartial: true });
  });

  it('throws descriptive error when run cannot be resolved', async () => {
    const client = buildClient();

    validateRunIdMock.mockReturnValueOnce(false);
    client.findRunByPartialId.mockResolvedValue(null);

    await expect(ensureRun(client, 'unknown')).rejects.toThrow(
      'Run not found with ID "unknown". Please provide either:'
    );
  });

  it('creates reusable not found error', () => {
    const error = createRunNotFoundError('bad');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('Run not found with ID "bad"');
  });
});
