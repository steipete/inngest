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
  private inputDataCache: Map<string, any> = new Map(); // runId -> input data

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
        if (event.data?.run_id && event.data.run_id.endsWith(partialId)) {
          try {
            return await this.getRun(event.data.run_id);
          } catch {
            continue;
          }
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  async listEvents(options: { limit?: number; cursor?: string; name?: string } = {}): Promise<{ data: any[]; metadata: any }> {
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
    const eventLimit = options.status ? 100 : (options.limit || 50); // Use API maximum of 100 for status searches
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
      console.log(`Debug: Status search going back to: ${monthsAgo.toISOString()}`);
    }
    
    // Note: We don't pre-filter events by status because event names don't always 
    // match final run status (e.g., failed runs can be later cancelled)
    // Instead, we filter by status after fetching the actual run details

    // Implement streaming search - process first page immediately, then continue fetching
    const initialEventsResponse = await this.client.get(`/v1/events?${eventsParams}`);
    let events = initialEventsResponse.data.data || [];
    console.log(`Debug: Initial page loaded: ${events.length} events`);
    console.log(`Debug: Response metadata:`, JSON.stringify(initialEventsResponse.data.metadata, null, 2));
    
    // If filtering by status, try time-based chunking to get more historical data
    if (options.status) {
      const timeBasedEvents = await this.fetchTimeBasedChunks(eventsParams, options);
      events = events.concat(timeBasedEvents);
      console.log(`Debug: Total events after time-based search: ${events.length}`);
      
      // Also try cursor-based pagination if available
      if (events.length > 0) {
        const additionalEvents = await this.fetchAdditionalPages(eventsParams, initialEventsResponse);
        events = events.concat(additionalEvents);
        console.log(`Debug: Total events after all pagination: ${events.length}`);
      }
    }

    // Get runs from events that have run_id and capture function names
    const runs: InngestRun[] = [];
    const seenRunIds = new Set<string>();
    const functionNames = new Map<string, string>(); // runId -> functionName

    // First pass: collect function names and event data from events
    const eventDataMap = new Map<string, any>(); // runId -> original event data
    for (const event of events) {
      if (event.data?.run_id && event.data?.function_id) {
        functionNames.set(event.data.run_id, event.data.function_id);
        // Store the full event for later use - this contains the input data
        eventDataMap.set(event.data.run_id, event);
      }
    }

    for (const event of events) {
      if (event.data?.run_id) {
        const runId = event.data.run_id;
        if (!seenRunIds.has(runId)) {
          seenRunIds.add(runId);
          try {
            const run = await this.getRun(runId);
            
            // Add function name and event data
            const functionName = functionNames.get(runId);
            const eventData = eventDataMap.get(runId);
            // Extract the actual input data from the event structure
            let inputData = null;
            if (eventData?.data && typeof eventData.data === 'object') {
              // The event data contains an 'event' object with the actual input data
              const eventInfo = eventData.data.event || eventData.data.events?.[0];
              if (eventInfo && eventInfo.data) {
                inputData = eventInfo.data;
              }
            }

            // Cache the input data for this run
            if (inputData) {
              this.inputDataCache.set(runId, inputData);
            }

            const enrichedRun = { 
              ...run, 
              function_name: functionName
            };

            // Apply filters (check both function_id and function_name)
            if (options.status && enrichedRun.status !== options.status) continue;
            if (options.function_id) {
              const matchesFunctionId = enrichedRun.function_id === options.function_id;
              const matchesFunctionName = enrichedRun.function_name?.includes(options.function_id);
              if (!matchesFunctionId && !matchesFunctionName) continue;
            }
            
            runs.push(enrichedRun);
          } catch (error) {
            // Skip runs that can't be fetched
            continue;
          }
        }
      }
    }

    const result = {
      data: runs.slice(0, options.limit || 20),
      metadata: {
        fetched_at: new Date().toISOString(),
        cached_until: null
      }
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
    return this.validateResponse<CancellationResponse>(response.data, CancellationResponseSchema);
  }

  async getCancellationStatus(cancellationId: string): Promise<CancellationStatus> {
    const response = await this.client.get(`/v1/cancellations/${cancellationId}`);
    return this.validateResponse<CancellationStatus>(response.data, CancellationStatusSchema);
  }

  getInputDataForRun(runId: string): any | null {
    return this.inputDataCache.get(runId) || null;
  }

  private async fetchAdditionalPages(
    baseParams: URLSearchParams, 
    initialResponse: any
  ): Promise<any[]> {
    const additionalEvents: any[] = [];
    let currentCursor = initialResponse.data.metadata?.next_cursor;
    let pagesLoaded = 0;
    const maxAdditionalPages = 20; // Fetch up to 20 additional pages
    
    while (currentCursor && pagesLoaded < maxAdditionalPages) {
      const pageParams = new URLSearchParams(baseParams);
      pageParams.set('cursor', currentCursor);
      
      console.log(`Debug: Fetching additional page ${pagesLoaded + 2}...`);
      
      try {
        const eventsResponse = await this.client.get(`/v1/events?${pageParams}`);
        const pageEvents = eventsResponse.data.data;
        
        if (!pageEvents || pageEvents.length === 0) {
          console.log(`Debug: No more events in page ${pagesLoaded + 2}`);
          break;
        }
        
        additionalEvents.push(...pageEvents);
        pagesLoaded++;
        console.log(`Debug: Page ${pagesLoaded + 1} loaded: ${pageEvents.length} events (${additionalEvents.length} total additional)`);
        
        // Check for next cursor
        const nextCursor = eventsResponse.data.metadata?.next_cursor;
        if (nextCursor && nextCursor !== currentCursor) {
          currentCursor = nextCursor;
        } else {
          console.log(`Debug: Reached end of pagination after ${pagesLoaded + 1} pages`);
          break;
        }
      } catch (error) {
        console.log(`Debug: Error fetching page ${pagesLoaded + 2}, stopping pagination`);
        break;
      }
    }
    
    return additionalEvents;
  }

  private async fetchTimeBasedChunks(
    baseParams: URLSearchParams,
    options: { hours?: number; status?: string }
  ): Promise<any[]> {
    const allEvents: any[] = [];
    
    // Determine time range to search
    const totalHours = options.hours || 168; // Default to 1 week
    const chunkHours = 24; // Search in 24-hour chunks
    const chunks = Math.ceil(totalHours / chunkHours);
    
    console.log(`Debug: Searching ${totalHours} hours in ${chunks} chunks of ${chunkHours} hours each`);
    
    for (let i = 1; i < chunks; i++) { // Start from 1 since we already got the first chunk
      const endHours = i * chunkHours;
      const startHours = Math.min((i + 1) * chunkHours, totalHours);
      
      const endTime = new Date();
      endTime.setHours(endTime.getHours() - endHours);
      
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - startHours);
      
      const chunkParams = new URLSearchParams(baseParams);
      chunkParams.set('received_after', startTime.toISOString());
      chunkParams.set('received_before', endTime.toISOString());
      
      console.log(`Debug: Chunk ${i + 1}: ${startTime.toISOString()} to ${endTime.toISOString()}`);
      
      try {
        const response = await this.client.get(`/v1/events?${chunkParams}`);
        const chunkEvents = response.data.data || [];
        console.log(`Debug: Chunk ${i + 1} returned ${chunkEvents.length} events`);
        
        if (chunkEvents.length > 0) {
          allEvents.push(...chunkEvents);
        }
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`Debug: Error fetching chunk ${i + 1}, skipping`);
        continue;
      }
    }
    
    return allEvents;
  }
}
