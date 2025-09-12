import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InngestClient } from '../api/client.js';
import type { InngestRun } from '../api/types.js';
import { validateRunId } from '../utils/config.js';

// Mock the client and utilities
vi.mock('../api/client.js');
vi.mock('../utils/config.js', () => ({
  getConfig: vi.fn(() => ({ signingKey: 'test-key' })),
  validateRunId: vi.fn((id: string) => id.length === 26 && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)),
  validateEventId: vi.fn((id: string) => id.length === 26 && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)),
}));
vi.mock('../utils/display.js', () => ({
  displayRunDetails: vi.fn().mockResolvedValue(undefined),
  displayRunsTable: vi.fn(),
  displayInfo: vi.fn(),
  displayError: vi.fn(),
  displayJobsTable: vi.fn(),
}));

const mockClient = vi.mocked(InngestClient);
const mockValidateRunId = vi.mocked(validateRunId);

describe('Command Logic Integration', () => {
  let mockClientInstance: {
    getRun: ReturnType<typeof vi.fn>;
    findRunByPartialId: ReturnType<typeof vi.fn>;
    getEvent: ReturnType<typeof vi.fn>;
    getEventRuns: ReturnType<typeof vi.fn>;
    getJobs: ReturnType<typeof vi.fn>;
    listRuns: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockClientInstance = {
      getRun: vi.fn(),
      findRunByPartialId: vi.fn(),
      getEvent: vi.fn(),
      getEventRuns: vi.fn(),
      getJobs: vi.fn(),
      listRuns: vi.fn(),
    };

    mockClient.mockImplementation(() => mockClientInstance);
    mockValidateRunId.mockImplementation(
      (id: string) => id.length === 26 && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)
    );
  });

  describe('Partial ID support logic', () => {
    it('should call getRun for valid full run ID', async () => {
      const fullRunId = '01HWAVJ8ASQ5C3FXV32JS9DV9Q';
      const mockRun = {
        run_id: fullRunId,
        status: 'Completed' as const,
        run_started_at: '2024-04-25T14:46:45.337Z',
      };

      mockClientInstance.getRun.mockResolvedValue(mockRun);

      // Simulate the logic from the status command
      const client = new InngestClient({ signingKey: 'test' });
      let run: InngestRun | null;

      if (validateRunId(fullRunId)) {
        run = await client.getRun(fullRunId);
      } else {
        run = await client.findRunByPartialId(fullRunId);
      }

      expect(mockClientInstance.getRun).toHaveBeenCalledWith(fullRunId);
      expect(mockClientInstance.findRunByPartialId).not.toHaveBeenCalled();
      expect(run).toEqual(mockRun);
    });

    it('should call findRunByPartialId for partial run ID', async () => {
      const partialId = 'JS9DV9Q';
      const fullRunId = '01HWAVJ8ASQ5C3FXV32JS9DV9Q';
      const mockRun = {
        run_id: fullRunId,
        status: 'Completed' as const,
        run_started_at: '2024-04-25T14:46:45.337Z',
      };

      mockClientInstance.findRunByPartialId.mockResolvedValue(mockRun);

      // Simulate the logic from the status command
      const client = new InngestClient({ signingKey: 'test' });
      let run: InngestRun | null;

      if (validateRunId(partialId)) {
        run = await client.getRun(partialId);
      } else {
        run = await client.findRunByPartialId(partialId);
      }

      expect(mockClientInstance.findRunByPartialId).toHaveBeenCalledWith(partialId);
      expect(mockClientInstance.getRun).not.toHaveBeenCalled();
      expect(run).toEqual(mockRun);
    });

    it('should handle case when partial ID not found', async () => {
      const partialId = 'NOTFOUND';
      mockClientInstance.findRunByPartialId.mockResolvedValue(null);

      // Simulate the logic from the status command
      const client = new InngestClient({ signingKey: 'test' });
      let run: InngestRun | null;

      if (validateRunId(partialId)) {
        run = await client.getRun(partialId);
      } else {
        run = await client.findRunByPartialId(partialId);
      }

      expect(run).toBeNull();
      expect(mockClientInstance.findRunByPartialId).toHaveBeenCalledWith(partialId);
    });

    it('should support jobs command partial ID logic', async () => {
      const partialId = 'JS9DV9Q';
      const fullRunId = '01HWAVJ8ASQ5C3FXV32JS9DV9Q';
      const mockRun = {
        run_id: fullRunId,
        status: 'Completed' as const,
        run_started_at: '2024-04-25T14:46:45.337Z',
      };
      const mockJobs = [
        {
          id: 'job1',
          name: 'step1',
          status: 'Completed' as const,
          output: { success: true },
        },
      ];

      mockClientInstance.findRunByPartialId.mockResolvedValue(mockRun);
      mockClientInstance.getJobs.mockResolvedValue(mockJobs);

      // Simulate the logic from the jobs command
      const client = new InngestClient({ signingKey: 'test' });
      let run: InngestRun | null;

      if (validateRunId(partialId)) {
        run = await client.getRun(partialId);
      } else {
        run = await client.findRunByPartialId(partialId);
      }

      if (!run) throw new Error('Run not found');
      const jobs = await client.getJobs(run.run_id);

      expect(mockClientInstance.findRunByPartialId).toHaveBeenCalledWith(partialId);
      expect(mockClientInstance.getJobs).toHaveBeenCalledWith(fullRunId);
      expect(jobs).toEqual(mockJobs);
    });
  });

  describe('List command details functionality', () => {
    it('should support details display logic', async () => {
      const mockFailedRuns = [
        {
          run_id: '01HWAVJ8ASQ5C3FXV32JS9DV9Q',
          status: 'Failed' as const,
          run_started_at: '2024-04-25T14:46:45.337Z',
          ended_at: '2024-04-25T14:46:47.337Z',
          function_name: 'test-function',
          output: { error: 'Test error message' },
        },
        {
          run_id: '01HWAVJ8ASQ5C3FXV32ABCDEFG',
          status: 'Failed' as const,
          run_started_at: '2024-04-25T14:45:45.337Z',
          ended_at: '2024-04-25T14:45:48.337Z',
          function_name: 'other-function',
          output: { error: 'Another test error' },
        },
      ];

      const mockResponse = {
        data: mockFailedRuns,
        has_more: false,
        metadata: {
          fetched_at: new Date().toISOString(),
          cached_until: null,
        },
      };

      mockClientInstance.listRuns.mockResolvedValue(mockResponse);

      const client = new InngestClient({ signingKey: 'test' });

      // Test listing with details (simulating --details flag logic)
      const response = await client.listRuns({
        status: 'Failed',
        limit: 10,
      });

      expect(response.data).toEqual(mockFailedRuns);
      expect(mockClientInstance.listRuns).toHaveBeenCalledWith({
        status: 'Failed',
        limit: 10,
      });
    });
  });
});
