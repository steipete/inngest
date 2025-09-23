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
  type InngestEvent,
  InngestEventSchema,
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
  private inputDataCache: Map<string, unknown> = new Map(); // runId -> input data
  private verbose: boolean = false;

  constructor(config: ApiConfig, options: { verbose?: boolean } = {}) {
    this.verbose = options.verbose || false;

    // Validate config using Zod
    const validatedConfig = ApiConfigSchema.parse(config);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${validatedConfig.signingKey}`,
      'Content-Type': 'application/json',
    };

    if (validatedConfig.environmentSlug) {
      headers['X-Inngest-Env'] = validatedConfig.environmentSlug;
    }

    this.client = axios.create({
      baseURL: validatedConfig.baseUrl || 'https://api.inngest.com',
      headers,
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        if (error.response) {
          // Handle specific HTTP errors with helpful guidance first
          if (error.response.status === 404) {
            throw new Error(
              `🚫 API endpoint not found (404)\n\n` +
                `📍 Endpoint: ${error.config?.url}\n\n` +
                `🔍 This could mean:\n` +
                `   • The API endpoint structure has changed\n` +
                `   • Your signing key doesn't have access to this resource\n` +
                `   • The API version (v1) might be incorrect\n\n` +
                `💡 Troubleshooting:\n` +
                `   1. Verify your signing key has the right permissions\n` +
                `   2. Check the latest Inngest API documentation\n` +
                `   3. Try a different API version or endpoint structure\n\n` +
                `🔗 API Documentation: https://api-docs.inngest.com/`
            );
          } else if (error.response.status === 401) {
            throw new Error(
              `🔐 Authentication failed (401)\n\n` +
                `❌ Your INNGEST_SIGNING_KEY appears to be invalid or expired.\n\n` +
                `💡 To fix this:\n` +
                `   1. Get a new signing key from: https://app.inngest.com/env/production/manage/signing-key\n` +
                `   2. Update your environment variable:\n` +
                `      export INNGEST_SIGNING_KEY="signkey-prod-..."`
            );
          } else if (error.response.status === 403) {
            throw new Error(
              `🚷 Access forbidden (403)\n\n` +
                `❌ Your signing key doesn't have permission to access this resource.\n\n` +
                `💡 Check that your key has the required scopes for this operation.`
            );
          }

          // Try to parse structured error response for other status codes
          if (error.response.data) {
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

          throw new Error(
            `🌐 HTTP Error: ${error.response.status} ${error.response.statusText}\n` +
              `📍 URL: ${error.config?.url}`
          );
        }
        throw new Error(
          `🌐 Network Error: ${error.message}\n\n` +
            `💡 This could be due to:\n` +
            `   • No internet connection\n` +
            `   • DNS resolution issues\n` +
            `   • Firewall blocking the request\n` +
            `   • api.inngest.com is unreachable`
        );
      }
    );
  }

  private debug(message: string): void {
    if (this.verbose) {
      console.log(`Debug: ${message}`);
    }
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
    return this.validateResponse<InngestRun>(response.data.data, InngestRunSchema);
  }

  async findRunByPartialId(partialId: string): Promise<InngestRun | null> {
    // If it looks like a full ULID (26 characters), use it directly
    if (partialId.length === 26 && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(partialId)) {
      try {
        return await this.getRun(partialId);
      } catch {
        return null;
      }
    }

    // Search recent events for runs with matching partial ID
    try {
      const events = await this.listEvents({ limit: 200 });

      for (const event of events.data) {
        const eventRecord = event as Record<string, unknown>;
        if (eventRecord.data && typeof eventRecord.data === 'object' && eventRecord.data !== null) {
          const eventData = eventRecord.data as Record<string, unknown>;
          if (typeof eventData.run_id === 'string' && eventData.run_id.endsWith(partialId)) {
            try {
              return await this.getRun(eventData.run_id);
            } catch {}
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  async listEvents(
    options: { limit?: number; cursor?: string; name?: string } = {}
  ): Promise<{ data: unknown[]; metadata: unknown }> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.cursor) params.append('cursor', options.cursor);
    if (options.name) params.append('name', options.name);

    const response = await this.client.get(`/v1/events?${params}`);
    return response.data;
  }

  async getEvent(eventId: string): Promise<InngestEvent | null> {
    try {
      const response = await this.client.get(`/v1/events/${eventId}`);
      return this.validateResponse<InngestEvent>(response.data.data, InngestEventSchema);
    } catch {
      return null;
    }
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
    options: {
      status?: string;
      function_id?: string;
      cursor?: string;
      limit?: number;
      after?: string;
      before?: string;
      hours?: number;
    } = {}
  ): Promise<ListRunsResponse> {
    // Get events - use larger limit and broader time range when filtering by status
    const eventsParams = new URLSearchParams();
    const eventLimit = options.status ? 100 : options.limit || 50; // Use API maximum of 100 for status searches
    eventsParams.append('limit', eventLimit.toString());
    if (options.cursor) eventsParams.append('cursor', options.cursor);

    // Handle time range parameters
    if (options.after) {
      eventsParams.append('received_after', options.after);
    } else if (options.before) {
      eventsParams.append('received_before', options.before);
    } else if (options.hours) {
      const hoursAgo = new Date();
      hoursAgo.setHours(hoursAgo.getHours() - options.hours);
      eventsParams.append('received_after', hoursAgo.toISOString());
    } else if (options.status) {
      // When only status is specified, look back much further to find failed/cancelled runs
      const monthsAgo = new Date();
      monthsAgo.setMonth(monthsAgo.getMonth() - 6); // Look back 6 months
      eventsParams.append('received_after', monthsAgo.toISOString());
      this.debug(`Status search going back to: ${monthsAgo.toISOString()}`);
    }

    // Note: We don't pre-filter events by status because event names don't always
    // match final run status (e.g., failed runs can be later cancelled)
    // Instead, we filter by status after fetching the actual run details

    // Implement streaming search - process first page immediately, then continue fetching
    const initialEventsResponse = await this.client.get(`/v1/events?${eventsParams}`);
    let events = initialEventsResponse.data.data || [];
    this.debug(`Initial page loaded: ${events.length} events`);
    this.debug(
      `Response metadata: ${JSON.stringify(initialEventsResponse.data.metadata, null, 2)}`
    );

    // If filtering by status, try time-based chunking to get more historical data
    if (options.status) {
      const timeBasedEvents = await this.fetchTimeBasedChunks(eventsParams, {
        ...options,
        maxResults: Math.max((options.limit || 20) * 5, 200), // Request 5x the limit to account for filtering
      });
      events = events.concat(timeBasedEvents);
      this.debug(`Total events after time-based search: ${events.length}`);

      // Also try cursor-based pagination if available
      if (events.length > 0) {
        const additionalEvents = await this.fetchAdditionalPages(
          eventsParams,
          initialEventsResponse
        );
        events = events.concat(additionalEvents);
        this.debug(`Total events after all pagination: ${events.length}`);
      }
    }

    // Get runs from events that have run_id and capture function names
    const runs: InngestRun[] = [];
    const seenRunIds = new Set<string>();
    const functionNames = new Map<string, string>(); // runId -> functionName

    // First pass: collect function names and event data from events
    const eventDataMap = new Map<string, unknown>(); // runId -> original event data
    for (const event of events) {
      const eventRecord = event as Record<string, unknown>;
      if (eventRecord.data && typeof eventRecord.data === 'object' && eventRecord.data !== null) {
        const data = eventRecord.data as Record<string, unknown>;
        if (typeof data.run_id === 'string' && typeof data.function_id === 'string') {
          functionNames.set(data.run_id, data.function_id);
          // Store the full event for later use - this contains the input data
          eventDataMap.set(data.run_id, event);
        }
      }
    }

    for (const event of events) {
      const eventRecord = event as Record<string, unknown>;
      if (eventRecord.data && typeof eventRecord.data === 'object' && eventRecord.data !== null) {
        const data = eventRecord.data as Record<string, unknown>;
        if (typeof data.run_id === 'string') {
          const runId = data.run_id;
          if (!seenRunIds.has(runId)) {
            seenRunIds.add(runId);
            try {
              const run = await this.getRun(runId);

              // Add function name and event data
              const functionName = functionNames.get(runId);
              const eventData = eventDataMap.get(runId);
              // Extract the actual input data from the event structure
              let inputData = null;
              const eventDataRecord = eventData as Record<string, unknown>;
              if (
                eventDataRecord?.data &&
                typeof eventDataRecord.data === 'object' &&
                eventDataRecord.data !== null
              ) {
                const dataRecord = eventDataRecord.data as Record<string, unknown>;
                // The event data contains an 'event' object with the actual input data
                const eventInfo =
                  dataRecord.event ||
                  (Array.isArray(dataRecord.events) ? dataRecord.events[0] : null);
                if (eventInfo && typeof eventInfo === 'object' && eventInfo !== null) {
                  const eventInfoRecord = eventInfo as Record<string, unknown>;
                  if (eventInfoRecord.data) {
                    inputData = eventInfoRecord.data;
                  }
                }
              }

              // Cache the input data for this run
              if (inputData) {
                this.inputDataCache.set(runId, inputData);
              }

              const enrichedRun = {
                ...run,
                function_name: functionName,
              };

              // Apply filters (check both function_id and function_name)
              if (options.status && enrichedRun.status !== options.status) continue;
              if (options.function_id) {
                const matchesFunctionId = enrichedRun.function_id === options.function_id;
                const matchesFunctionName = enrichedRun.function_name?.includes(
                  options.function_id
                );
                if (!matchesFunctionId && !matchesFunctionName) continue;
              }

              runs.push(enrichedRun);
            } catch (_error) {}
          }
        }
      }
    }

    const result = {
      data: runs.slice(0, options.limit || 20),
      metadata: {
        fetched_at: new Date().toISOString(),
        cached_until: null,
      },
    };

    return this.validateResponse<ListRunsResponse>(result, ListRunsResponseSchema);
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
    const payload = response.data as unknown;

    const normalized: unknown = (() => {
      if (payload && typeof payload === 'object') {
        const direct = payload as Record<string, unknown>;

        // Newer API responses already expose cancellation_id + status at the top level.
        if (typeof direct.cancellation_id === 'string' && typeof direct.status === 'string') {
          return direct;
        }

        // Legacy responses wrap values under a `data` object (e.g. { data: { id, status } }).
        if (direct.data && typeof direct.data === 'object') {
          const data = direct.data as Record<string, unknown>;
          const cancellationId = typeof data.id === 'string' ? data.id : undefined;
          const status = typeof data.status === 'string' ? data.status : 'pending';

          if (cancellationId) {
            return {
              cancellation_id: cancellationId,
              status,
            } satisfies CancellationResponse;
          }
        }
      }

      // Fallback to a sentinel so Zod surfaces a useful validation error instead of crashing.
      return {
        cancellation_id: 'unknown',
        status: 'pending',
      } satisfies CancellationResponse;
    })();

    return this.validateResponse<CancellationResponse>(normalized, CancellationResponseSchema);
  }

  async getCancellationStatus(cancellationId: string): Promise<CancellationStatus> {
    const response = await this.client.get(`/v1/cancellations/${cancellationId}`);
    return this.validateResponse<CancellationStatus>(response.data, CancellationStatusSchema);
  }

  getInputDataForRun(runId: string): unknown {
    return this.inputDataCache.get(runId) || null;
  }

  private async fetchAdditionalPages(
    baseParams: URLSearchParams,
    initialResponse: { data: { metadata?: { next_cursor?: string } } }
  ): Promise<unknown[]> {
    const additionalEvents: unknown[] = [];
    let currentCursor = initialResponse.data.metadata?.next_cursor;
    let pagesLoaded = 0;
    const maxAdditionalPages = 20; // Fetch up to 20 additional pages

    while (currentCursor && pagesLoaded < maxAdditionalPages) {
      const pageParams = new URLSearchParams(baseParams);
      pageParams.set('cursor', currentCursor);

      this.debug(`Fetching additional page ${pagesLoaded + 2}...`);

      try {
        const eventsResponse = await this.client.get(`/v1/events?${pageParams}`);
        const pageEvents = eventsResponse.data.data;

        if (!pageEvents || pageEvents.length === 0) {
          this.debug(`No more events in page ${pagesLoaded + 2}`);
          break;
        }

        additionalEvents.push(...pageEvents);
        pagesLoaded++;
        this.debug(
          `Page ${pagesLoaded + 1} loaded: ${pageEvents.length} events (${additionalEvents.length} total additional)`
        );

        // Check for next cursor
        const nextCursor = eventsResponse.data.metadata?.next_cursor;
        if (nextCursor && nextCursor !== currentCursor) {
          currentCursor = nextCursor;
        } else {
          this.debug(`Reached end of pagination after ${pagesLoaded + 1} pages`);
          break;
        }
      } catch (_error) {
        this.debug(`Error fetching page ${pagesLoaded + 2}, stopping pagination`);
        break;
      }
    }

    return additionalEvents;
  }

  private async fetchTimeBasedChunks(
    baseParams: URLSearchParams,
    options: { hours?: number; status?: string; maxResults?: number }
  ): Promise<unknown[]> {
    const allEvents: unknown[] = [];

    // Determine time range to search
    const totalHours = options.hours || 168; // Default to 1 week
    const chunkHours = 12; // Use smaller chunks for better parallelism
    const chunks = Math.ceil(totalHours / chunkHours);
    const maxResults = options.maxResults || 1000;

    this.debug(
      `Searching ${totalHours} hours in ${chunks} chunks of ${chunkHours} hours each (parallel)`
    );

    // Create all chunk promises in parallel
    const chunkPromises = [];
    for (let i = 1; i < chunks && i <= 6; i++) {
      // Limit to 6 parallel requests to avoid overwhelming the API
      // Start from 1 since we already got the first chunk
      const endHours = i * chunkHours;
      const startHours = Math.min((i + 1) * chunkHours, totalHours);

      const endTime = new Date();
      endTime.setHours(endTime.getHours() - endHours);

      const startTime = new Date();
      startTime.setHours(startTime.getHours() - startHours);

      const chunkParams = new URLSearchParams(baseParams);
      chunkParams.set('received_after', startTime.toISOString());
      chunkParams.set('received_before', endTime.toISOString());

      this.debug(`Chunk ${i + 1}: ${startTime.toISOString()} to ${endTime.toISOString()}`);

      chunkPromises.push(
        this.client
          .get(`/v1/events?${chunkParams}`)
          .then(response => ({
            chunkIndex: i + 1,
            events: response.data.data || [],
          }))
          .catch(_error => ({
            chunkIndex: i + 1,
            events: [] as unknown[],
            error: true,
          }))
      );
    }

    // Execute all chunks in parallel
    const results = await Promise.all(chunkPromises);

    // Sort results by chunk index to maintain chronological order
    results.sort((a, b) => a.chunkIndex - b.chunkIndex);

    for (const result of results) {
      if ('error' in result) {
        this.debug(`Error fetching chunk ${result.chunkIndex}, skipping`);
        continue;
      }

      this.debug(`Chunk ${result.chunkIndex} returned ${result.events.length} events`);

      if (result.events.length > 0) {
        allEvents.push(...result.events);

        // Early termination if we have enough events
        if (allEvents.length >= maxResults) {
          this.debug(`Early termination after ${allEvents.length} events (limit: ${maxResults})`);
          break;
        }
      }
    }

    return allEvents.slice(0, maxResults);
  }
}
