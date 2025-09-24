import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InngestClient } from '../api/client.js';
import type { InngestJob, InngestRun } from '../api/types.js';
import { createCancelCommand } from '../commands/cancel.js';
import { createCancellationStatusCommand } from '../commands/cancellation-status.js';
import { createJobsCommand } from '../commands/jobs.js';
import { createListCommand } from '../commands/list.js';
import { createStatusCommand } from '../commands/status.js';
import { createWatchCommand } from '../commands/watch.js';
import { validateEventId, validateRunId } from '../utils/config.js';

const displayModuleMocks = vi.hoisted(() => ({
  displayRunDetails: vi.fn().mockResolvedValue(undefined),
  displayRunsTable: vi.fn(),
  displayInfo: vi.fn(),
  displayError: vi.fn(),
  displayJobsTable: vi.fn(),
  displaySuccess: vi.fn(),
  displayWarning: vi.fn(),
  outputJSON: vi.fn(),
  prepareRunDetailsForJSON: vi.fn(),
  prepareRunsForJSON: vi.fn(),
  prepareJobsForJSON: vi.fn(),
}));

const pollingModuleMocks = vi.hoisted(() => ({
  RunWatcher: vi.fn(),
}));

vi.mock('../api/client.js');
vi.mock('../utils/config.js', () => ({
  getConfig: vi.fn(() => ({ signingKey: 'test-key' })),
  validateRunId: vi.fn((id: string) => id.length === 26 && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)),
  validateEventId: vi.fn((id: string) => id.length === 26 && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)),
}));
vi.mock('../utils/display.js', () => displayModuleMocks);
vi.mock('../utils/polling.js', () => pollingModuleMocks);

const mockDisplayRunDetails = displayModuleMocks.displayRunDetails;
const mockDisplayRunsTable = displayModuleMocks.displayRunsTable;
const mockDisplayInfo = displayModuleMocks.displayInfo;
const mockDisplayError = displayModuleMocks.displayError;
const mockDisplayJobsTable = displayModuleMocks.displayJobsTable;
const mockDisplaySuccess = displayModuleMocks.displaySuccess;
const mockDisplayWarning = displayModuleMocks.displayWarning;
const mockOutputJSON = displayModuleMocks.outputJSON;
const mockPrepareRunDetailsForJSON = displayModuleMocks.prepareRunDetailsForJSON;
const mockPrepareRunsForJSON = displayModuleMocks.prepareRunsForJSON;
const mockPrepareJobsForJSON = displayModuleMocks.prepareJobsForJSON;
const mockRunWatcher = pollingModuleMocks.RunWatcher;

const mockClient = vi.mocked(InngestClient);
const mockValidateRunId = vi.mocked(validateRunId);
const mockValidateEventId = vi.mocked(validateEventId);

describe('Command Logic Integration', () => {
  let mockClientInstance: {
    getRun: ReturnType<typeof vi.fn>;
    findRunByPartialId: ReturnType<typeof vi.fn>;
    getEvent: ReturnType<typeof vi.fn>;
    getEventRuns: ReturnType<typeof vi.fn>;
    getJobs: ReturnType<typeof vi.fn>;
    listRuns: ReturnType<typeof vi.fn>;
    getInputDataForRun: ReturnType<typeof vi.fn>;
    cancelRun: ReturnType<typeof vi.fn>;
    bulkCancel: ReturnType<typeof vi.fn>;
    getCancellationStatus: ReturnType<typeof vi.fn>;
  };
  let mockRunWatcherInstance: {
    watchRun: ReturnType<typeof vi.fn>;
    watchEventRuns: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDisplayRunDetails.mockReset().mockResolvedValue(undefined);
    mockDisplayRunsTable.mockReset();
    mockDisplayInfo.mockReset();
    mockDisplayError.mockReset();
    mockDisplayJobsTable.mockReset();
    mockDisplaySuccess.mockReset();
    mockDisplayWarning.mockReset();
    mockOutputJSON.mockReset();
    mockPrepareRunDetailsForJSON.mockReset().mockImplementation((run: unknown) => run);
    mockPrepareRunsForJSON.mockReset().mockImplementation((runs: unknown) => runs);
    mockPrepareJobsForJSON.mockReset().mockImplementation((jobs: unknown) => jobs);
    mockRunWatcher.mockReset();

    mockClientInstance = {
      getRun: vi.fn(),
      findRunByPartialId: vi.fn(),
      getEvent: vi.fn(),
      getEventRuns: vi.fn(),
      getJobs: vi.fn(),
      listRuns: vi.fn(),
      getInputDataForRun: vi.fn().mockReturnValue(undefined),
      cancelRun: vi.fn(),
      bulkCancel: vi.fn(),
      getCancellationStatus: vi.fn(),
    };

    mockClient.mockImplementation(
      () => mockClientInstance as unknown as InstanceType<typeof InngestClient>
    );
    mockValidateRunId.mockImplementation(
      (id: string) => id.length === 26 && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)
    );
    mockValidateEventId.mockImplementation(
      (id: string) => id.length === 26 && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)
    );

    mockRunWatcherInstance = {
      watchRun: vi.fn().mockResolvedValue(undefined),
      watchEventRuns: vi.fn().mockResolvedValue(undefined),
    };
    mockRunWatcher.mockImplementation(() => mockRunWatcherInstance);
  });

  describe('List command pagination hints', () => {
    it('suggests using cursor when more results are available', async () => {
      const listCommand = createListCommand();

      const run: InngestRun = {
        run_id: '01HWAVJ8ASQ5C3FXV32JS9DV9Q',
        status: 'Running',
        run_started_at: '2024-04-25T14:46:45.337Z',
        ended_at: undefined,
      };

      mockClientInstance.listRuns.mockResolvedValue({
        data: [run],
        has_more: true,
        cursor: 'NEXT-CURSOR',
        metadata: {
          fetched_at: new Date().toISOString(),
          cached_until: null,
        },
      });

      await listCommand.parseAsync(['--format', 'table'], { from: 'user' });

      expect(mockClientInstance.listRuns).toHaveBeenCalled();
      expect(mockDisplayInfo).toHaveBeenCalledWith('Use --cursor NEXT-CURSOR to get next page');
      expect(mockDisplayInfo).toHaveBeenCalledWith('Total: 1 run(s)');
    });
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
      const mockJobs: InngestJob[] = [
        {
          id: 'job1',
          run_id: fullRunId,
          step: 'step1',
          status: 'Completed',
          started_at: '2024-04-25T14:46:45.337Z',
          ended_at: '2024-04-25T14:47:45.337Z',
        },
      ];

      mockClientInstance.findRunByPartialId.mockResolvedValue(mockRun);
      mockClientInstance.getJobs.mockResolvedValue(mockJobs);

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

  describe('Status command', () => {
    it('displays run details for a full run ID', async () => {
      const statusCommand = createStatusCommand();
      const runId = '01HWAVEB858VPPX47Z65GR6P6R';
      const run: InngestRun = {
        run_id: runId,
        status: 'Completed',
        run_started_at: '2024-04-25T14:46:45.337Z',
        ended_at: '2024-04-25T14:47:45.337Z',
      };

      mockClientInstance.getRun.mockResolvedValue(run);

      await statusCommand.parseAsync(['--run', runId], { from: 'user' });

      expect(mockClientInstance.getRun).toHaveBeenCalledWith(runId);
      expect(mockDisplayRunDetails).toHaveBeenCalledWith(run, mockClientInstance);
    });

    it('outputs event runs as JSON', async () => {
      const statusCommand = createStatusCommand();
      const eventId = '01HWAVEB858VPPX47Z65GR6P6R';
      const runs: InngestRun[] = [
        {
          run_id: '01HWAVJ8ASQ5C3FXV32JS9DV9Q',
          status: 'Running',
          run_started_at: '2024-04-25T14:46:45.337Z',
        },
      ];

      mockClientInstance.getEventRuns.mockResolvedValue(runs);

      await statusCommand.parseAsync(['--event', eventId, '--format', 'json'], { from: 'user' });

      expect(mockClientInstance.getEventRuns).toHaveBeenCalledWith(eventId);
      expect(mockOutputJSON).toHaveBeenCalledWith({
        event_id: eventId,
        runs,
        total: runs.length,
      });
    });

    it('reports error when partial run ID is not found', async () => {
      const statusCommand = createStatusCommand();
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      mockClientInstance.findRunByPartialId.mockResolvedValue(null);

      await statusCommand.parseAsync(['--run', 'NOTFOUND'], { from: 'user' });

      expect(mockDisplayError).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
    });
  });

  describe('Jobs command', () => {
    it('fetches jobs for a partial run ID and outputs JSON', async () => {
      const jobsCommand = createJobsCommand();
      const partialId = 'RUNPARTIAL1234';
      const fullRunId = '01HWAVJ8ASQ5C3FXV32JS9DV9Q';
      const run: InngestRun = {
        run_id: fullRunId,
        status: 'Completed',
        run_started_at: '2024-04-25T14:46:45.337Z',
        ended_at: '2024-04-25T14:47:45.337Z',
      };
      const jobs: InngestJob[] = [
        {
          id: 'job1',
          run_id: fullRunId,
          step: 'Fetch data',
          status: 'Completed',
          started_at: '2024-04-25T14:46:45.337Z',
          ended_at: '2024-04-25T14:46:50.337Z',
        },
      ];

      mockValidateRunId.mockReturnValueOnce(false);
      mockClientInstance.findRunByPartialId.mockResolvedValue(run);
      mockClientInstance.getJobs.mockResolvedValue(jobs);

      await jobsCommand.parseAsync([partialId, '--format', 'json'], { from: 'user' });

      expect(mockClientInstance.findRunByPartialId).toHaveBeenCalledWith(partialId);
      expect(mockClientInstance.getJobs).toHaveBeenCalledWith(fullRunId);
      expect(mockOutputJSON).toHaveBeenCalledWith({
        run_id: fullRunId,
        jobs,
        total: jobs.length,
      });
    });

    it('reports error when run cannot be resolved', async () => {
      const jobsCommand = createJobsCommand();
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      mockValidateRunId.mockReturnValueOnce(false);
      mockClientInstance.findRunByPartialId.mockResolvedValue(null);

      await jobsCommand.parseAsync(['UNKNOWN'], { from: 'user' });

      expect(mockDisplayError).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
    });
  });

  describe('Cancel command', () => {
    it('cancels a single run and outputs JSON', async () => {
      const cancelCommand = createCancelCommand();
      const runId = '01HWAVEB858VPPX47Z65GR6P6R';
      mockClientInstance.cancelRun.mockResolvedValue(undefined);

      await cancelCommand.parseAsync(['--run', runId, '--yes', '--format', 'json'], {
        from: 'user',
      });

      expect(mockClientInstance.cancelRun).toHaveBeenCalledWith(runId);
      expect(mockOutputJSON).toHaveBeenCalledWith({ action: 'cancelled', run_id: runId });
    });

    it('performs dry-run for a single run without confirmation', async () => {
      const cancelCommand = createCancelCommand();
      const runId = '01HWAVEB858VPPX47Z65GR6P6R';

      await cancelCommand.parseAsync(['--run', runId, '--dry-run'], { from: 'user' });

      expect(mockDisplayInfo).toHaveBeenCalledWith(`Would cancel run: ${runId}`);
      expect(mockClientInstance.cancelRun).not.toHaveBeenCalled();
    });

    it('executes bulk cancellation and outputs JSON', async () => {
      const cancelCommand = createCancelCommand();
      mockClientInstance.bulkCancel.mockResolvedValue({
        cancellation_id: '123',
        status: 'pending',
      });

      await cancelCommand.parseAsync(
        ['--function', 'fn-id', '--app-id', 'app-123', '--yes', '--format', 'json'],
        { from: 'user' }
      );

      expect(mockClientInstance.bulkCancel).toHaveBeenCalledWith({
        app_id: 'app-123',
        function_id: 'fn-id',
        started_after: undefined,
        started_before: undefined,
        if: undefined,
      });
      expect(mockOutputJSON).toHaveBeenCalledWith({
        action: 'bulk_cancelled',
        cancellation_id: '123',
        status: 'pending',
      });
    });
  });

  describe('Watch command', () => {
    it('watches a run with custom interval and timeout', async () => {
      const watchCommand = createWatchCommand();
      const runId = '01HWAVEB858VPPX47Z65GR6P6R';

      await watchCommand.parseAsync(['--run', runId, '--interval', '10', '--timeout', '2'], {
        from: 'user',
      });

      expect(mockRunWatcher).toHaveBeenCalledWith(mockClientInstance);
      expect(mockRunWatcherInstance.watchRun).toHaveBeenCalledWith(runId, {
        pollInterval: 10_000,
        maxDuration: 120_000,
      });
    });

    it('reports validation errors via displayError', async () => {
      const watchCommand = createWatchCommand();
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      mockValidateRunId.mockReturnValueOnce(false);

      await watchCommand.parseAsync(['--run', 'bad-id'], { from: 'user' });

      expect(mockDisplayError).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
    });
  });

  describe('Cancellation status command', () => {
    it('outputs status information as JSON', async () => {
      const cancellationCommand = createCancellationStatusCommand();
      mockClientInstance.getCancellationStatus.mockResolvedValue({
        status: 'pending',
        cancelled_count: 5,
        created_at: '2024-04-25T14:45:45.337Z',
        updated_at: '2024-04-25T14:46:45.337Z',
      });

      await cancellationCommand.parseAsync(['abc123', '--format', 'json'], { from: 'user' });

      expect(mockClientInstance.getCancellationStatus).toHaveBeenCalledWith('abc123');
      expect(mockOutputJSON).toHaveBeenCalledWith({
        cancellation_id: 'abc123',
        status: 'pending',
        cancelled_count: 5,
        created_at: '2024-04-25T14:45:45.337Z',
        updated_at: '2024-04-25T14:46:45.337Z',
      });
    });
  });
});
