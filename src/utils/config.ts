import { config } from 'dotenv';
import { z } from 'zod';
import { type ApiConfig, ApiConfigSchema } from '../api/types.js';

// Only load .env file if INNGEST_SIGNING_KEY is not already set
if (process.env.NODE_ENV !== 'test' && !process.env.INNGEST_SIGNING_KEY) {
  process.env.DOTENVX_QUIET = 'true';
  config();
}

const EnvSchema = z.object({
  INNGEST_SIGNING_KEY: z.string().min(1, 'INNGEST_SIGNING_KEY environment variable is required'),
  INNGEST_API_URL: z.string().url().optional(),
  INNGEST_DEV_SERVER_URL: z.string().url().optional(),
  INNGEST_DEV_SERVER_PORT: z.string().optional(),
});

export type Environment = 'prod' | 'dev';

export interface ConfigOptions {
  env?: Environment;
  devPort?: number;
}

export function getConfig(options: ConfigOptions = {}): ApiConfig {
  // Check if signing key is set at all
  if (!process.env.INNGEST_SIGNING_KEY) {
    throw new Error(
      '🔑 Missing INNGEST_SIGNING_KEY environment variable!\n\n' +
        '📝 To set it:\n' +
        '   export INNGEST_SIGNING_KEY="your-signing-key-here"\n\n' +
        '🔗 Get your signing key from:\n' +
        '   https://app.inngest.com/env/production/manage/signing-key\n\n' +
        '💡 Example usage:\n' +
        '   export INNGEST_SIGNING_KEY="signkey-prod-..."\n' +
        '   inngest list --limit 5'
    );
  }

  const envResult = EnvSchema.safeParse({
    INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
    INNGEST_API_URL: process.env.INNGEST_API_URL,
    INNGEST_DEV_SERVER_URL: process.env.INNGEST_DEV_SERVER_URL,
    INNGEST_DEV_SERVER_PORT: process.env.INNGEST_DEV_SERVER_PORT,
  });

  if (!envResult.success) {
    const errors = envResult.error.issues.map(issue => issue.message).join('\n');
    throw new Error(
      `🚨 Environment validation failed:\n${errors}\n\n` +
        '🔗 Get your signing key from:\n' +
        '   https://app.inngest.com/env/production/manage/signing-key'
    );
  }

  // Determine the base URL based on environment
  let baseUrl: string;
  
  if (options.env === 'dev') {
    // Dev environment - use local dev server
    const devPort = options.devPort || (envResult.data.INNGEST_DEV_SERVER_PORT ? parseInt(envResult.data.INNGEST_DEV_SERVER_PORT) : 8288);
    baseUrl = envResult.data.INNGEST_DEV_SERVER_URL || `http://localhost:${devPort}`;
  } else {
    // Production environment (default)
    baseUrl = envResult.data.INNGEST_API_URL || 'https://api.inngest.com';
  }

  const configData = {
    signingKey: envResult.data.INNGEST_SIGNING_KEY,
    baseUrl,
  };

  // Validate the final config
  return ApiConfigSchema.parse(configData);
}

export function validateRunId(runId: string): boolean {
  // Inngest run IDs are typically ULID format (26 characters)
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(runId);
}

export function validateEventId(eventId: string): boolean {
  // Inngest event IDs are typically ULID format (26 characters)
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(eventId);
}
