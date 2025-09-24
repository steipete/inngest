import { describe, expect, it } from 'vitest';
import {
  ApiConfigSchema,
  ApiErrorSchema,
  CancellationRequestSchema,
  CancellationStatusSchema,
  InngestRunSchema,
  ListRunsResponseSchema,
} from '../api/types.js';

describe('API Types Validation', () => {
  describe('InngestRunSchema', () => {
    it('should validate a complete run object', () => {
      const validRun = {
        run_id: '01HWAVJ8ASQ5C3FXV32JS9DV9Q',
        status: 'Completed',
        run_started_at: '2024-04-25T14:46:45.337Z',
        ended_at: '2024-04-25T14:46:46.896Z',
        output: { status: 'success', processedItems: 123 },
        event_id: '01HWAVEB858VPPX47Z65GR6P6R',
        function_id: 'process-payment',
        function_version: 1,
      };

      expect(() => InngestRunSchema.parse(validRun)).not.toThrow();
    });

    it('should validate a minimal queued run object', () => {
      const minimalRun = {
        run_id: '01HWAVJ8ASQ5C3FXV32JS9DV9Q',
        status: 'Queued',
        run_started_at: '2024-04-25T14:46:45.337Z',
      };

      expect(() => InngestRunSchema.parse(minimalRun)).not.toThrow();
    });

    it('should reject invalid status', () => {
      const invalidRun = {
        run_id: '01HWAVJ8ASQ5C3FXV32JS9DV9Q',
        status: 'InvalidStatus',
        run_started_at: '2024-04-25T14:46:45.337Z',
      };

      expect(() => InngestRunSchema.parse(invalidRun)).toThrow();
    });

    it('should reject missing required fields', () => {
      const invalidRun = {
        status: 'Running',
        run_started_at: '2024-04-25T14:46:45.337Z',
      };

      expect(() => InngestRunSchema.parse(invalidRun)).toThrow();
    });
  });

  describe('ListRunsResponseSchema', () => {
    it('should validate a response with runs', () => {
      const validResponse = {
        data: [
          {
            run_id: '01HWAVJ8ASQ5C3FXV32JS9DV9Q',
            status: 'Completed',
            run_started_at: '2024-04-25T14:46:45.337Z',
          },
        ],
        has_more: true,
        cursor: 'next_cursor',
      };

      expect(() => ListRunsResponseSchema.parse(validResponse)).not.toThrow();
    });

    it('should validate empty response', () => {
      const emptyResponse = {
        data: [],
      };

      expect(() => ListRunsResponseSchema.parse(emptyResponse)).not.toThrow();
    });
  });

  describe('CancellationRequestSchema', () => {
    it('should validate bulk cancellation request', () => {
      const validRequest = {
        app_id: 'my-app',
        function_id: 'send-email',
        started_after: '2024-01-01T00:00:00Z',
        started_before: '2024-01-02T00:00:00Z',
        if: 'event.data.userId == "user_123"',
      };

      expect(() => CancellationRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should validate minimal request', () => {
      const minimalRequest = {};

      expect(() => CancellationRequestSchema.parse(minimalRequest)).not.toThrow();
    });

    it('should reject invalid date formats', () => {
      const invalidRequest = {
        started_after: 'invalid-date',
      };

      expect(() => CancellationRequestSchema.parse(invalidRequest)).toThrow();
    });
  });

  describe('ApiConfigSchema', () => {
    it('should validate config with signing key', () => {
      const validConfig = {
        signingKey: 'test-signing-key',
      };

      expect(() => ApiConfigSchema.parse(validConfig)).not.toThrow();
    });

    it('should validate config with base URL', () => {
      const validConfig = {
        signingKey: 'test-signing-key',
        baseUrl: 'https://api.example.com',
      };

      expect(() => ApiConfigSchema.parse(validConfig)).not.toThrow();
    });

    it('should reject empty signing key', () => {
      const invalidConfig = {
        signingKey: '',
      };

      expect(() => ApiConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should reject invalid base URL', () => {
      const invalidConfig = {
        signingKey: 'test-key',
        baseUrl: 'not-a-url',
      };

      expect(() => ApiConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('ApiErrorSchema', () => {
    it('should validate error response', () => {
      const validError = {
        error: 'ValidationError',
        message: 'Invalid request parameters',
        code: 400,
      };

      expect(() => ApiErrorSchema.parse(validError)).not.toThrow();
    });

    it('should validate error without code', () => {
      const validError = {
        error: 'NotFound',
        message: 'Resource not found',
      };

      expect(() => ApiErrorSchema.parse(validError)).not.toThrow();
    });
  });

  describe('CancellationStatusSchema', () => {
    it('should validate complete status response', () => {
      const validStatus = {
        id: '01HWAVJ8ASQ5C3FXV32JS9DV9Q',
        status: 'completed',
        cancelled_count: 5,
        created_at: '2024-04-25T14:46:45.337Z',
        updated_at: '2024-04-25T14:46:46.896Z',
      };

      expect(() => CancellationStatusSchema.parse(validStatus)).not.toThrow();
    });

    it('should validate minimal status response', () => {
      const minimalStatus = {
        id: '01HWAVJ8ASQ5C3FXV32JS9DV9Q',
        status: 'pending',
      };

      expect(() => CancellationStatusSchema.parse(minimalStatus)).not.toThrow();
    });
  });
});
