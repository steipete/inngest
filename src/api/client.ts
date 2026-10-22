import axios, { type AxiosError, type AxiosInstance } from "axios";
import { ZodError, type z } from "zod";
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
  InngestJobSchema,
  type InngestRun,
  InngestRunSchema,
  type ListRunsResponse,
  ListRunsResponseSchema,
} from "./types.js";

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
      "Content-Type": "application/json",
    };

    if (validatedConfig.environmentSlug) {
      headers["X-Inngest-Env"] = validatedConfig.environmentSlug;
    }

    this.client = axios.create({
      baseURL: validatedConfig.baseUrl || "https://api.inngest.com",
      headers,
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
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
                `🔗 API Documentation: https://api-docs.inngest.com/`,
            );
          } else if (error.response.status === 401) {
            throw new Error(
              `🔐 Authentication failed (401)\n\n` +
                `❌ Your INNGEST_SIGNING_KEY appears to be invalid or expired.\n\n` +
                `💡 To fix this:\n` +
                `   1. Get a new signing key from: https://app.inngest.com/env/production/manage/signing-key\n` +
                `   2. Update your environment variable:\n` +
                `      export INNGEST_SIGNING_KEY="signkey-prod-..."`,
            );
          } else if (error.response.status === 403) {
            throw new Error(
              `🚷 Access forbidden (403)\n\n` +
                `❌ Your signing key doesn't have permission to access this resource.\n\n` +
                `💡 Check that your key has the required scopes for this operation.`,
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
                typeof rawError?.message === "string"
                  ? rawError.message
                  : typeof rawError?.error === "string"
                    ? rawError.error
                    : `HTTP ${error.response.status}: ${error.response.statusText}`;
              throw new Error(`API Error: ${message}`);
            }
          }

          throw new Error(
            `🌐 HTTP Error: ${error.response.status} ${error.response.statusText}\n` +
              `📍 URL: ${error.config?.url}`,
          );
        }
        throw new Error(
          `🌐 Network Error: ${error.message}\n\n` +
            `💡 This could be due to:\n` +
            `   • No internet connection\n` +
            `   • DNS resolution issues\n` +
            `   • Firewall blocking the request\n` +
            `   • api.inngest.com is unreachable`,
        );
      },
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
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join(", ");
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

    // Search runs started by recent events. data.run_id is the sender payload.
    try {
      const events = await this.listEvents({ limit: 200 });

      for (const event of events.data) {
        const eventId = this.eventInternalId(event);
        if (!eventId) continue;
        try {
          const runs = await this.getEventRuns(eventId);
          const match = runs.find((run) => run.run_id.endsWith(partialId));
          if (match) return match;
        } catch {
          // A missing event run list should not hide a later match.
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  async listEvents(
    options: { limit?: number; cursor?: string; name?: string } = {},
  ): Promise<{ data: unknown[]; metadata: unknown }> {
    const params = new URLSearchParams();
    if (options.limit) params.append("limit", options.limit.toString());
    if (options.cursor) params.append("cursor", options.cursor);
    if (options.name) params.append("name", options.name);

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
      EventRunsResponseSchema,
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
    } = {},
  ): Promise<ListRunsResponse> {
    const sanitizedOptions = this.sanitizeListRunsOptions(options);
    const eventsParams = this.buildEventsParams(sanitizedOptions);
    const { events: initialEvents, response: initialResponse } =
      await this.fetchInitialEvents(eventsParams);
    const { events, hasMore } = await this.expandEvents(
      initialEvents,
      eventsParams,
      initialResponse,
      sanitizedOptions,
    );
    const runs = await this.enrichRunsFromEvents(events, sanitizedOptions);
    const cursor = hasMore ? this.nextEventCursor(events) : undefined;

    return this.buildRunsResponse(runs, cursor, hasMore);
  }

  async getJobs(runId: string): Promise<InngestJob[]> {
    const response = await this.client.get(`/v1/runs/${runId}/jobs`);
    return this.jobRows(response.data).map((row) => this.normalizeJob(row, runId));
  }

  async cancelRun(runId: string): Promise<void> {
    await this.client.delete(`/v1/runs/${runId}`);
  }

  async bulkCancel(request: CancellationRequest): Promise<CancellationResponse> {
    // Validate request before sending
    const validatedRequest = CancellationRequestSchema.parse(request);
    const response = await this.client.post("/v1/cancellations", validatedRequest);
    const payload = response.data as unknown;

    const normalized: unknown = (() => {
      if (payload && typeof payload === "object") {
        const direct = payload as Record<string, unknown>;

        // Newer API responses already expose cancellation_id + status at the top level.
        if (typeof direct.cancellation_id === "string" && typeof direct.status === "string") {
          return direct;
        }

        // Legacy responses wrap values under a `data` object (e.g. { data: { id, status } }).
        if (direct.data && typeof direct.data === "object") {
          const data = direct.data as Record<string, unknown>;
          const cancellationId = typeof data.id === "string" ? data.id : undefined;
          const status = typeof data.status === "string" ? data.status : "pending";

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
        cancellation_id: "unknown",
        status: "pending",
      } satisfies CancellationResponse;
    })();

    return this.validateResponse<CancellationResponse>(normalized, CancellationResponseSchema);
  }

  async getCancellationStatus(cancellationId: string): Promise<CancellationStatus> {
    const response = await this.client.get("/v1/cancellations");
    const match = this.cancellationRows(response.data).find(
      (row) => this.cancellationIdOf(row) === cancellationId,
    );
    if (!match || typeof match !== "object") {
      throw new Error(`Cancellation ${cancellationId} was not found`);
    }
    const record = match as Record<string, unknown>;
    return this.validateResponse<CancellationStatus>(
      {
        id: cancellationId,
        status: record.status,
        cancelled_count: record.cancelled_count,
        created_at: record.created_at,
        updated_at: record.updated_at,
      },
      CancellationStatusSchema,
    );
  }

  getInputDataForRun(runId: string): unknown {
    return this.inputDataCache.get(runId) || null;
  }

  private async fetchAdditionalPages(
    baseParams: URLSearchParams,
    initialResponse: EventsApiResponse,
  ): Promise<{ events: unknown[]; hasMore: boolean }> {
    const additionalEvents: unknown[] = [];
    const pageLimit = Number(baseParams.get("limit") || "0");
    let currentCursor = this.nextEventCursor(initialResponse.data.data || []);
    let pagesLoaded = 0;
    const maxAdditionalPages = 20;
    let hasMore = false;

    while (currentCursor && pagesLoaded < maxAdditionalPages) {
      const pageParams = new URLSearchParams(baseParams);
      pageParams.set("cursor", currentCursor);

      this.debug(`Fetching additional page ${pagesLoaded + 2}...`);

      try {
        const eventsResponse = await this.client.get(`/v1/events?${pageParams}`);
        const pageEvents = eventsResponse.data.data as unknown[] | undefined;

        if (!pageEvents || pageEvents.length === 0) {
          this.debug(`No more events in page ${pagesLoaded + 2}`);
          hasMore = false;
          break;
        }

        additionalEvents.push(...pageEvents);
        pagesLoaded++;
        this.debug(
          `Page ${pagesLoaded + 1} loaded: ${pageEvents.length} events (${additionalEvents.length} total additional)`,
        );

        const nextCursor = this.nextEventCursor(pageEvents);
        const fullPage = pageLimit > 0 && pageEvents.length >= pageLimit;
        if (!fullPage || !nextCursor || nextCursor === currentCursor) {
          hasMore = false;
          break;
        }
        hasMore = pagesLoaded >= maxAdditionalPages;
        currentCursor = nextCursor;
        if (hasMore) break;
      } catch {
        this.debug(`Error fetching page ${pagesLoaded + 2}, stopping pagination`);
        hasMore = false;
        break;
      }
    }

    return { events: additionalEvents, hasMore };
  }

  private async fetchTimeBasedChunks(
    baseParams: URLSearchParams,
    options: { hours?: number; status?: string; maxResults?: number },
  ): Promise<unknown[]> {
    const allEvents: unknown[] = [];

    // Determine time range to search
    const totalHours = options.hours || 168; // Default to 1 week
    const chunkHours = 12; // Use smaller chunks for better parallelism
    const chunks = Math.ceil(totalHours / chunkHours);
    const maxResults = options.maxResults || 1000;

    this.debug(
      `Searching ${totalHours} hours in ${chunks} chunks of ${chunkHours} hours each (parallel)`,
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
      chunkParams.set("received_after", startTime.toISOString());
      chunkParams.set("received_before", endTime.toISOString());

      this.debug(`Chunk ${i + 1}: ${startTime.toISOString()} to ${endTime.toISOString()}`);

      chunkPromises.push(
        this.client
          .get(`/v1/events?${chunkParams}`)
          .then((response) => ({
            chunkIndex: i + 1,
            events: response.data.data || [],
          }))
          .catch(() => ({
            chunkIndex: i + 1,
            events: [] as unknown[],
            error: true,
          })),
      );
    }

    // Execute all chunks in parallel
    const results = await Promise.all(chunkPromises);

    // Sort results by chunk index to maintain chronological order
    results.sort((a, b) => a.chunkIndex - b.chunkIndex);

    for (const result of results) {
      if ("error" in result) {
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

  private buildEventsParams(options: ListRunsQueryOptions): URLSearchParams {
    const eventsParams = new URLSearchParams();
    const eventLimit = options.status ? 100 : options.limit || 50;
    eventsParams.append("limit", eventLimit.toString());
    if (options.cursor) eventsParams.append("cursor", options.cursor);

    if (options.after) {
      eventsParams.append("received_after", options.after);
    } else if (options.before) {
      eventsParams.append("received_before", options.before);
    } else if (options.hours) {
      const hoursAgo = new Date();
      hoursAgo.setHours(hoursAgo.getHours() - options.hours);
      eventsParams.append("received_after", hoursAgo.toISOString());
    } else if (options.status) {
      const monthsAgo = new Date();
      monthsAgo.setMonth(monthsAgo.getMonth() - 6);
      eventsParams.append("received_after", monthsAgo.toISOString());
      this.debug(`Status search going back to: ${monthsAgo.toISOString()}`);
    }

    return eventsParams;
  }

  private async fetchInitialEvents(eventsParams: URLSearchParams): Promise<{
    events: unknown[];
    response: EventsApiResponse;
  }> {
    const response: EventsApiResponse = await this.client.get(`/v1/events?${eventsParams}`);
    const events = response.data.data || [];
    this.debug(`Initial page loaded: ${events.length} events`);
    this.debug(`Response metadata: ${JSON.stringify(response.data.metadata, null, 2)}`);
    return { events, response };
  }

  private async expandEvents(
    initialEvents: unknown[],
    eventsParams: URLSearchParams,
    initialResponse: EventsApiResponse,
    options: ListRunsQueryOptions,
  ): Promise<{ events: unknown[]; hasMore: boolean }> {
    const eventLimit = Number(eventsParams.get("limit") || "0");
    const initialCursor = this.nextEventCursor(initialEvents);
    const initialFull =
      eventLimit > 0 && initialEvents.length >= eventLimit && Boolean(initialCursor);

    if (!options.status) {
      return { events: initialEvents, hasMore: initialFull };
    }

    const combinedEvents = [...initialEvents];

    const chunkOptions: { status: string; hours?: number; maxResults: number } = {
      status: options.status,
      maxResults: Math.max((options.limit || 20) * 5, 200),
    };
    if (typeof options.hours === "number") {
      chunkOptions.hours = options.hours;
    }

    const timeBasedEvents = await this.fetchTimeBasedChunks(eventsParams, chunkOptions);
    combinedEvents.push(...timeBasedEvents);
    this.debug(`Total events after time-based search: ${combinedEvents.length}`);

    if (combinedEvents.length === 0) {
      return { events: combinedEvents, hasMore: initialFull };
    }

    const additional = await this.fetchAdditionalPages(eventsParams, initialResponse);
    combinedEvents.push(...additional.events);
    this.debug(`Total events after all pagination: ${combinedEvents.length}`);

    return { events: combinedEvents, hasMore: additional.hasMore };
  }

  private async enrichRunsFromEvents(
    events: unknown[],
    options: {
      status?: string;
      function_id?: string;
    },
  ): Promise<InngestRun[]> {
    const runs: InngestRun[] = [];
    const seenRunIds = new Set<string>();

    for (const event of events) {
      const eventId = this.eventInternalId(event);
      if (!eventId) continue;

      let eventRuns: InngestRun[] = [];
      try {
        eventRuns = await this.getEventRuns(eventId);
      } catch {
        continue;
      }

      const payload = this.senderPayload(event);
      for (const run of eventRuns) {
        if (seenRunIds.has(run.run_id)) continue;
        seenRunIds.add(run.run_id);
        if (payload) {
          this.inputDataCache.set(run.run_id, payload);
        }
        if (!this.runMatchesFilters(run, options)) continue;
        runs.push(run);
      }
    }

    return runs;
  }

  private eventInternalId(event: unknown): string | null {
    if (!event || typeof event !== "object") return null;
    const id = (event as Record<string, unknown>).internal_id;
    return typeof id === "string" && id.length > 0 ? id : null;
  }

  private nextEventCursor(events: unknown[]): string | undefined {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const id = this.eventInternalId(events[index]);
      if (id) return id;
    }
    return undefined;
  }

  private senderPayload(event: unknown): unknown {
    if (!event || typeof event !== "object") return null;
    const data = (event as Record<string, unknown>).data;
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    return data;
  }

  private jobRows(payload: unknown): unknown[] {
    return this.rowsOf(payload);
  }

  private cancellationRows(payload: unknown): unknown[] {
    return this.rowsOf(payload);
  }

  private rowsOf(payload: unknown): unknown[] {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.cancellations)) return record.cancellations;
    return [];
  }

  private cancellationIdOf(row: unknown): string | null {
    if (!row || typeof row !== "object") return null;
    const record = row as Record<string, unknown>;
    if (typeof record.id === "string" && record.id.length > 0) return record.id;
    if (typeof record.cancellation_id === "string" && record.cancellation_id.length > 0) {
      return record.cancellation_id;
    }
    return null;
  }

  private normalizeJob(raw: unknown, runId: string): InngestJob {
    if (!raw || typeof raw !== "object") {
      throw new Error("API Response validation failed: job: expected object");
    }
    const record = raw as Record<string, unknown>;
    if (!this.isQueueItem(record)) {
      return this.validateResponse<InngestJob>(raw, InngestJobSchema);
    }

    const id = this.stringField(record, "JobID") || this.stringField(record, "id");
    const startedAt = this.stringField(record, "at") || this.stringField(record, "started_at");
    const step = this.stringField(record, "kind") || this.stringField(record, "step") || "queue";
    const status = this.stringField(record, "status") || "Queued";
    const mapped: InngestJob = {
      id: id || "",
      run_id: this.stringField(record, "run_id") || runId,
      step,
      status: status as InngestJob["status"],
      started_at: startedAt || "",
    };
    return this.validateResponse<InngestJob>(mapped, InngestJobSchema);
  }

  private isQueueItem(record: Record<string, unknown>): boolean {
    return (
      "JobID" in record ||
      "at" in record ||
      "kind" in record ||
      "position" in record ||
      "attempt" in record
    );
  }

  private stringField(record: Record<string, unknown>, key: string): string | null {
    const value = record[key];
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private runMatchesFilters(
    run: InngestRun,
    options: Pick<ListRunsQueryOptions, "status" | "function_id">,
  ): boolean {
    if (options.status && run.status !== options.status) {
      return false;
    }

    if (!options.function_id) {
      return true;
    }

    const matchesFunctionId = run.function_id === options.function_id;
    const matchesFunctionName = run.function_name?.includes(options.function_id) ?? false;
    return matchesFunctionId || matchesFunctionName;
  }

  private buildRunsResponse(
    runs: InngestRun[],
    cursor: string | undefined,
    hasMore: boolean,
  ): ListRunsResponse {
    const result: ListRunsResponse = {
      data: runs,
      has_more: hasMore,
      metadata: {
        fetched_at: new Date().toISOString(),
        cached_until: null,
      },
    };
    if (hasMore && cursor) {
      result.cursor = cursor;
    }

    return this.validateResponse<ListRunsResponse>(result, ListRunsResponseSchema);
  }

  private sanitizeListRunsOptions(options: {
    status?: string;
    function_id?: string;
    cursor?: string;
    limit?: number;
    after?: string;
    before?: string;
    hours?: number;
  }): ListRunsQueryOptions {
    const sanitized: ListRunsQueryOptions = {};
    if (options.status) sanitized.status = options.status;
    if (options.function_id) sanitized.function_id = options.function_id;
    if (options.cursor) sanitized.cursor = options.cursor;
    if (typeof options.limit === "number") sanitized.limit = options.limit;
    if (options.after) sanitized.after = options.after;
    if (options.before) sanitized.before = options.before;
    if (typeof options.hours === "number") sanitized.hours = options.hours;
    return sanitized;
  }
}

interface ListRunsQueryOptions {
  status?: string;
  function_id?: string;
  cursor?: string;
  limit?: number;
  after?: string;
  before?: string;
  hours?: number;
}

interface EventsApiResponse {
  data: {
    data?: unknown[];
    metadata?: {
      next_cursor?: string;
    };
  };
}
