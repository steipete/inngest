import { describe, expect, it, vi } from 'vitest';
import type { InngestJob, InngestRun } from '../api/types.js';
import {
  outputJSON,
  prepareJobsForJSON,
  prepareRunDetailsForJSON,
  prepareRunsForJSON,
} from '../utils/display.js';

// Mock console.log for testing JSON output
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('JSON Output Functions', () => {
  describe('outputJSON', () => {
    it('should output formatted JSON', () => {
      const data = { test: 'value', nested: { field: 123 } };
      outputJSON(data);
      expect(console.log).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    });

    it('should handle null and undefined values', () => {
      outputJSON(null);
      expect(console.log).toHaveBeenCalledWith('null');

      outputJSON(undefined);
      expect(console.log).toHaveBeenCalledWith(undefined);
    });

    it('should handle arrays', () => {
      const data = [1, 2, 3];
      outputJSON(data);
      expect(console.log).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    });
  });

  describe('prepareRunsForJSON', () => {
    it('should format runs for JSON output', () => {
      const runs: InngestRun[] = [
        {
          run_id: 'run-1',
          status: 'Completed',
          function_id: 'func-1',
          function_name: 'test-function',
          function_version: 'v1',
          event_id: 'event-1',
          run_started_at: '2024-01-01T00:00:00Z',
          ended_at: '2024-01-01T00:05:00Z',
          output: { result: 'success' },
        },
        {
          run_id: 'run-2',
          status: 'Failed',
          function_id: 'func-2',
          run_started_at: '2024-01-01T01:00:00Z',
        },
      ];

      const result = prepareRunsForJSON(runs);
      expect(result).toEqual([
        {
          run_id: 'run-1',
          status: 'Completed',
          function_id: 'func-1',
          function_name: 'test-function',
          function_version: 'v1',
          event_id: 'event-1',
          run_started_at: '2024-01-01T00:00:00Z',
          ended_at: '2024-01-01T00:05:00Z',
          output: { result: 'success' },
        },
        {
          run_id: 'run-2',
          status: 'Failed',
          function_id: 'func-2',
          function_name: undefined,
          function_version: undefined,
          event_id: undefined,
          run_started_at: '2024-01-01T01:00:00Z',
          ended_at: undefined,
          output: undefined,
        },
      ]);
    });

    it('should handle empty runs array', () => {
      const result = prepareRunsForJSON([]);
      expect(result).toEqual([]);
    });
  });

  describe('prepareRunDetailsForJSON', () => {
    it('should format run details with input data', () => {
      const run: InngestRun = {
        run_id: 'run-1',
        status: 'Completed',
        function_id: 'func-1',
        function_name: 'test-function',
        function_version: 'v1',
        event_id: 'event-1',
        run_started_at: '2024-01-01T00:00:00Z',
        ended_at: '2024-01-01T00:05:00Z',
        output: { result: 'success' },
      };

      const inputData = { user_id: '123', action: 'process' };

      const result = prepareRunDetailsForJSON(run, inputData);
      expect(result).toEqual({
        run_id: 'run-1',
        status: 'Completed',
        function_id: 'func-1',
        function_name: 'test-function',
        function_version: 'v1',
        event_id: 'event-1',
        run_started_at: '2024-01-01T00:00:00Z',
        ended_at: '2024-01-01T00:05:00Z',
        output: { result: 'success' },
        input_data: inputData,
      });
    });

    it('should handle run without input data', () => {
      const run: InngestRun = {
        run_id: 'run-1',
        status: 'Running',
        function_id: 'func-1',
        run_started_at: '2024-01-01T00:00:00Z',
      };

      const result = prepareRunDetailsForJSON(run);
      expect(result).toEqual({
        run_id: 'run-1',
        status: 'Running',
        function_id: 'func-1',
        function_name: undefined,
        function_version: undefined,
        event_id: undefined,
        run_started_at: '2024-01-01T00:00:00Z',
        ended_at: undefined,
        output: undefined,
        input_data: null,
      });
    });
  });

  describe('prepareJobsForJSON', () => {
    it('should format jobs for JSON output', () => {
      const jobs: InngestJob[] = [
        {
          id: 'job-1',
          step: 'step-1',
          status: 'Completed',
          started_at: '2024-01-01T00:00:00Z',
          ended_at: '2024-01-01T00:01:00Z',
          output: { data: 'processed' },
        },
        {
          id: 'job-2',
          step: 'step-2',
          status: 'Running',
          started_at: '2024-01-01T00:01:00Z',
        },
      ];

      const result = prepareJobsForJSON(jobs);
      expect(result).toEqual([
        {
          id: 'job-1',
          step: 'step-1',
          status: 'Completed',
          started_at: '2024-01-01T00:00:00Z',
          ended_at: '2024-01-01T00:01:00Z',
          output: { data: 'processed' },
        },
        {
          id: 'job-2',
          step: 'step-2',
          status: 'Running',
          started_at: '2024-01-01T00:01:00Z',
          ended_at: undefined,
          output: undefined,
        },
      ]);
    });

    it('should handle empty jobs array', () => {
      const result = prepareJobsForJSON([]);
      expect(result).toEqual([]);
    });

    it('should preserve all job fields', () => {
      const job: InngestJob = {
        id: 'job-complex',
        step: 'complex-step',
        status: 'Failed',
        started_at: '2024-01-01T00:00:00Z',
        ended_at: '2024-01-01T00:10:00Z',
        output: {
          error: 'Something went wrong',
          stack: 'Error stack trace here',
          metadata: { retry_count: 3 },
        },
      };

      const result = prepareJobsForJSON([job]);
      expect(result).toEqual([
        {
          id: 'job-complex',
          step: 'complex-step',
          status: 'Failed',
          started_at: '2024-01-01T00:00:00Z',
          ended_at: '2024-01-01T00:10:00Z',
          output: {
            error: 'Something went wrong',
            stack: 'Error stack trace here',
            metadata: { retry_count: 3 },
          },
        },
      ]);
    });
  });

  describe('JSON Output Integration', () => {
    it('should properly format list command JSON response', () => {
      const runs: InngestRun[] = [
        {
          run_id: 'run-1',
          status: 'Completed',
          function_id: 'func-1',
          function_name: 'my-function',
          run_started_at: '2024-01-01T00:00:00Z',
          ended_at: '2024-01-01T00:05:00Z',
        },
      ];

      const formattedRuns = prepareRunsForJSON(runs);
      const response = {
        runs: formattedRuns,
        total: runs.length,
        has_more: false,
        next_cursor: null,
      };

      expect(response).toEqual({
        runs: [
          {
            run_id: 'run-1',
            status: 'Completed',
            function_id: 'func-1',
            function_name: 'my-function',
            function_version: undefined,
            event_id: undefined,
            run_started_at: '2024-01-01T00:00:00Z',
            ended_at: '2024-01-01T00:05:00Z',
            output: undefined,
          },
        ],
        total: 1,
        has_more: false,
        next_cursor: null,
      });
    });

    it('should properly format status command JSON response', () => {
      const run: InngestRun = {
        run_id: 'run-1',
        status: 'Failed',
        function_id: 'func-1',
        function_name: 'error-function',
        run_started_at: '2024-01-01T00:00:00Z',
        ended_at: '2024-01-01T00:00:30Z',
        output: { error: 'Test error' },
      };

      const inputData = { param: 'value' };
      const formatted = prepareRunDetailsForJSON(run, inputData);

      expect(formatted).toEqual({
        run_id: 'run-1',
        status: 'Failed',
        function_id: 'func-1',
        function_name: 'error-function',
        function_version: undefined,
        event_id: undefined,
        run_started_at: '2024-01-01T00:00:00Z',
        ended_at: '2024-01-01T00:00:30Z',
        output: { error: 'Test error' },
        input_data: { param: 'value' },
      });
    });

    it('should properly format jobs command JSON response', () => {
      const jobs: InngestJob[] = [
        {
          id: 'job-1',
          step: 'validate',
          status: 'Completed',
          started_at: '2024-01-01T00:00:00Z',
          ended_at: '2024-01-01T00:00:01Z',
        },
        {
          id: 'job-2',
          step: 'process',
          status: 'Completed',
          started_at: '2024-01-01T00:00:01Z',
          ended_at: '2024-01-01T00:00:05Z',
        },
      ];

      const formattedJobs = prepareJobsForJSON(jobs);
      const response = {
        run_id: 'run-1',
        jobs: formattedJobs,
        total: jobs.length,
      };

      expect(response).toEqual({
        run_id: 'run-1',
        jobs: [
          {
            id: 'job-1',
            step: 'validate',
            status: 'Completed',
            started_at: '2024-01-01T00:00:00Z',
            ended_at: '2024-01-01T00:00:01Z',
            output: undefined,
          },
          {
            id: 'job-2',
            step: 'process',
            status: 'Completed',
            started_at: '2024-01-01T00:00:01Z',
            ended_at: '2024-01-01T00:00:05Z',
            output: undefined,
          },
        ],
        total: 2,
      });
    });
  });
});
