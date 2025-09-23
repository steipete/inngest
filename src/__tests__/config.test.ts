import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getConfig, validateEventId, validateRunId } from '../utils/config.js';

describe('Config Utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getConfig', () => {
    it('should return config with signing key', () => {
      process.env.INNGEST_SIGNING_KEY = 'test-key';

      const config = getConfig();

      expect(config.signingKey).toBe('test-key');
      expect(config.baseUrl).toBe('https://api.inngest.com');
    });

    it('should use custom base URL when provided', () => {
      process.env.INNGEST_SIGNING_KEY = 'test-key';
      process.env.INNGEST_API_URL = 'https://api.example.com';

      const config = getConfig();

      expect(config.signingKey).toBe('test-key');
      expect(config.baseUrl).toBe('https://api.example.com');
    });

    it('should throw error when signing key is missing', () => {
      delete process.env.INNGEST_SIGNING_KEY;

      expect(() => getConfig()).toThrow(/Missing INNGEST_SIGNING_KEY environment variable/);
    });

    it('should throw error when signing key is empty', () => {
      process.env.INNGEST_SIGNING_KEY = '';

      expect(() => getConfig()).toThrow(/Missing INNGEST_SIGNING_KEY environment variable/);
    });

    it('should throw error when base URL is invalid', () => {
      process.env.INNGEST_SIGNING_KEY = 'test-key';
      process.env.INNGEST_API_URL = 'not-a-url';

      expect(() => getConfig()).toThrow(/Environment validation failed/);
    });

    it('should read environment slug from env variable', () => {
      process.env.INNGEST_SIGNING_KEY = 'test-key';
      process.env.INNGEST_ENV = 'branch/my-feature';

      const config = getConfig();

      expect(config.environmentSlug).toBe('branch/my-feature');
    });

    it('should prefer explicit environment slug option', () => {
      process.env.INNGEST_SIGNING_KEY = 'test-key';
      process.env.INNGEST_ENV = 'branch/from-env';

      const config = getConfig({ environmentSlug: 'branch/from-option' });

      expect(config.environmentSlug).toBe('branch/from-option');
    });
  });

  describe('validateRunId', () => {
    it('should validate correct ULID format', () => {
      const validRunId = '01HWAVJ8ASQ5C3FXV32JS9DV9Q';
      expect(validateRunId(validRunId)).toBe(true);
    });

    it('should reject too short IDs', () => {
      expect(validateRunId('01HWAVJ8ASQ5C3FXV32JS9DV')).toBe(false);
    });

    it('should reject too long IDs', () => {
      expect(validateRunId('01HWAVJ8ASQ5C3FXV32JS9DV9QX')).toBe(false);
    });

    it('should reject IDs with invalid characters', () => {
      expect(validateRunId('01HWAVJ8ASQ5C3FXV32JS9DV9I')).toBe(false); // Contains 'I'
      expect(validateRunId('01HWAVJ8ASQ5C3FXV32JS9DV9L')).toBe(false); // Contains 'L'
      expect(validateRunId('01HWAVJ8ASQ5C3FXV32JS9DV9O')).toBe(false); // Contains 'O'
      expect(validateRunId('01HWAVJ8ASQ5C3FXV32JS9DV9U')).toBe(false); // Contains 'U'
    });

    it('should reject lowercase characters', () => {
      expect(validateRunId('01hwavj8asq5c3fxv32js9dv9q')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateRunId('')).toBe(false);
    });
  });

  describe('validateEventId', () => {
    it('should validate correct ULID format', () => {
      const validEventId = '01HWAVEB858VPPX47Z65GR6P6R';
      expect(validateEventId(validEventId)).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(validateEventId('invalid-id')).toBe(false);
      expect(validateEventId('')).toBe(false);
      expect(validateEventId('01HWAVEB858VPPX47Z65GR6P6')).toBe(false); // Too short
    });
  });
});
