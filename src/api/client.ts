import axios, { type AxiosError, type AxiosInstance } from 'axios';
import { ZodError, type z } from 'zod';
import {
  type ApiConfig,
  ApiConfigSchema,
  ApiErrorSchema,
  type CancellationRequest,
  CancellationRequestSchema,
  type CancellationResponse,
  CancellationResponseSchema,
  type CancellationStatus,
  CancellationStatusSchema,
  type EventRunsResponse,
  EventRunsResponseSchema,
  type InngestJob,
  type InngestRun,
  InngestRunSchema,
  type JobsResponse,
  JobsResponseSchema,
  type ListRunsResponse,
  ListRunsResponseSchema,
} from './types.js';

export class InngestClient {
  private client: AxiosInstance;

  constructor(config: ApiConfig) {
    // Validate config using Zod
    const validatedConfig = ApiConfigSchema.parse(config);

    this.client = axios.create({
      baseURL: validatedConfig.baseUrl || 'https://api.inngest.com',
      headers: {
        Authorization: `Bearer ${validatedConfig.signingKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        if (error.response?.data) {
          try {
            const apiError = ApiErrorSchema.parse(error.response.data);
            throw new Error(`API Error: ${apiError.message || apiError.error}`);
          } catch {
            // If error response doesn't match schema, use raw error
            const rawError = error.response.data as Record<string, unknown>;
            const message =
              typeof rawError?.message === 'string'
                ? rawError.message
                : typeof rawError?.error === 'string'
                  ? rawError.error
                  : `HTTP ${error.response.status}: ${error.response.statusText}`;
            throw new Error(`API Error: ${message}`);
          }
        }
        if (error.response) {
          throw new Error(
            `HTTP Error: ${error.response.status} ${error.response.statusText} - ${error.config?.url}`
          );
        }
        throw new Error(`Network Error: ${error.message}`);
      }
    );
  }

  private validateResponse<T>(data: unknown, schema: z.ZodType<T>): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues
          .map(issue => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ');
        throw new Error(`API Response validation failed: ${issues}`);
      }
      throw error;
    }
  }

  async getRun(runId: string): Promise<InngestRun> {
    const response = await this.client.get(`/v1/runs/${runId}`);
    return this.validateResponse<InngestRun>(response.data, InngestRunSchema);
  }

  async getEventRuns(eventId: string): Promise<InngestRun[]> {
    const response = await this.client.get(`/v1/events/${eventId}/runs`);
    const validatedResponse = this.validateResponse<EventRunsResponse>(
      response.data,
      EventRunsResponseSchema
    );
    return validatedResponse.data;
  }

  async listRuns(
    options: { status?: string; function_id?: string; cursor?: string; limit?: number } = {}
  ): Promise<ListRunsResponse> {
    const params = new URLSearchParams();

    if (options.status) params.append('status', options.status);
    if (options.function_id) params.append('function_id', options.function_id);
    if (options.cursor) params.append('cursor', options.cursor);
    if (options.limit) params.append('limit', options.limit.toString());

    const response = await this.client.get(`/v1/runs?${params}`);
    return this.validateResponse<ListRunsResponse>(response.data, ListRunsResponseSchema);
  }

  async getJobs(runId: string): Promise<InngestJob[]> {
    const response = await this.client.get(`/v1/runs/${runId}/jobs`);
    const validatedResponse = this.validateResponse<JobsResponse>(
      response.data,
      JobsResponseSchema
    );
    return validatedResponse.data;
  }

  async cancelRun(runId: string): Promise<void> {
    await this.client.delete(`/v1/runs/${runId}`);
  }

  async bulkCancel(request: CancellationRequest): Promise<CancellationResponse> {
    // Validate request before sending
    const validatedRequest = CancellationRequestSchema.parse(request);
    const response = await this.client.post('/v1/cancellations', validatedRequest);
    return this.validateResponse<CancellationResponse>(response.data, CancellationResponseSchema);
  }

  async getCancellationStatus(cancellationId: string): Promise<CancellationStatus> {
    const response = await this.client.get(`/v1/cancellations/${cancellationId}`);
    return this.validateResponse<CancellationStatus>(response.data, CancellationStatusSchema);
  }
}
