import { z } from 'zod';

// Zod schemas for runtime validation
const RunStatusSchema = z.enum(['Running', 'Completed', 'Failed', 'Cancelled']);

export const InngestRunSchema = z.object({
  run_id: z.string().min(1, 'Run ID is required'),
  status: RunStatusSchema,
  run_started_at: z.string().datetime('Invalid start date format'),
  ended_at: z.string().datetime('Invalid end date format').optional(),
  output: z.unknown().optional(),
  event_id: z.string().optional(),
  function_id: z.string().optional(),
  function_version: z.number().int().nonnegative().optional(),
});

export const InngestEventSchema = z.object({
  id: z.string().min(1, 'Event ID is required'),
  name: z.string().min(1, 'Event name is required'),
  data: z.unknown(),
  ts: z.number().optional(),
  user: z.unknown().optional(),
  v: z.string().optional(),
});

export const InngestJobSchema = z.object({
  id: z.string().min(1, 'Job ID is required'),
  run_id: z.string().min(1, 'Run ID is required'),
  step: z.string().min(1, 'Step name is required'),
  status: RunStatusSchema,
  started_at: z.string().datetime('Invalid start date format'),
  ended_at: z.string().datetime('Invalid end date format').optional(),
  output: z.unknown().optional(),
  error: z.unknown().optional(),
});

export const ListRunsResponseSchema = z.object({
  data: z.array(InngestRunSchema),
  has_more: z.boolean().optional(),
  cursor: z.string().optional(),
  metadata: z.object({
    fetched_at: z.string(),
    cached_until: z.string().nullable(),
  }).optional(),
});

export const EventRunsResponseSchema = z.object({
  data: z.array(InngestRunSchema),
});

export const JobsResponseSchema = z.object({
  data: z.array(InngestJobSchema),
});

export const CancellationRequestSchema = z.object({
  app_id: z.string().optional(),
  function_id: z.string().optional(),
  started_after: z.string().datetime('Invalid after date format').optional(),
  started_before: z.string().datetime('Invalid before date format').optional(),
  if: z.string().optional(),
});

export const CancellationResponseSchema = z.object({
  cancellation_id: z.string().min(1, 'Cancellation ID is required'),
  status: z.string().min(1, 'Status is required'),
});

export const CancellationStatusSchema = z.object({
  id: z.string().min(1, 'Cancellation ID is required'),
  status: z.string().min(1, 'Status is required'),
  cancelled_count: z.number().int().nonnegative().optional(),
  created_at: z.string().datetime('Invalid created date format').optional(),
  updated_at: z.string().datetime('Invalid updated date format').optional(),
});

export const ApiErrorSchema = z.object({
  error: z.string().min(1, 'Error message is required'),
  message: z.string().min(1, 'Error message is required'),
  code: z.number().int().optional(),
});

export const ApiConfigSchema = z.object({
  signingKey: z.string().min(1, 'Signing key is required'),
  baseUrl: z.string().url('Invalid base URL format').optional(),
});

// Type inference from schemas
export type InngestRun = z.infer<typeof InngestRunSchema>;
export type InngestEvent = z.infer<typeof InngestEventSchema>;
export type InngestJob = z.infer<typeof InngestJobSchema>;
export type ListRunsResponse = z.infer<typeof ListRunsResponseSchema>;
export type EventRunsResponse = z.infer<typeof EventRunsResponseSchema>;
export type JobsResponse = z.infer<typeof JobsResponseSchema>;
export type CancellationRequest = z.infer<typeof CancellationRequestSchema>;
export type CancellationResponse = z.infer<typeof CancellationResponseSchema>;
export type CancellationStatus = z.infer<typeof CancellationStatusSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiConfig = z.infer<typeof ApiConfigSchema>;
export type RunStatus = z.infer<typeof RunStatusSchema>;
