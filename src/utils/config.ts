import { config } from 'dotenv';
import { z } from 'zod';
import { type ApiConfig, ApiConfigSchema } from '../api/types.js';

config();

const EnvSchema = z.object({
  INNGEST_SIGNING_KEY: z.string().min(1, 'INNGEST_SIGNING_KEY environment variable is required'),
  INNGEST_API_URL: z.string().url().optional(),
});

export function getConfig(): ApiConfig {
  const envResult = EnvSchema.safeParse({
    INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
    INNGEST_API_URL: process.env.INNGEST_API_URL,
  });

  if (!envResult.success) {
    const errors = envResult.error.issues.map(issue => issue.message).join('\n');
    throw new Error(
      `Environment validation failed:\n${errors}\n\n` +
        'Get your signing key from: https://app.inngest.com/env/production/manage/signing-key'
    );
  }

  const configData = {
    signingKey: envResult.data.INNGEST_SIGNING_KEY,
    baseUrl: envResult.data.INNGEST_API_URL || 'https://api.inngest.com',
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
