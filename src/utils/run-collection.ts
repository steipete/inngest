import type { InngestClient } from '../api/client.js';
import type { InngestRun } from '../api/types.js';

const SAFETY_LIMIT = 1000;

export interface CollectRunsOptions {
  status?: string;
  function_id?: string;
  cursor?: string;
  limit: number;
  after?: string;
  before?: string;
  hours?: number;
  fetchAll?: boolean;
}

export interface CollectRunsCallbacks {
  onProgress?: (message: string) => void;
}

export interface CollectRunsResult {
  runs: InngestRun[];
  hasMore: boolean;
  nextCursor: string | null;
}

export async function collectRuns(
  client: InngestClient,
  options: CollectRunsOptions,
  callbacks: CollectRunsCallbacks = {}
): Promise<CollectRunsResult> {
  const runs: InngestRun[] = [];
  let cursorForRequest = options.cursor;
  let nextCursor: string | null = null;
  let hasMoreAvailable = false;

  while (true) {
    const response = await client.listRuns({
      status: options.status,
      function_id: options.function_id,
      cursor: cursorForRequest,
      limit: options.fetchAll ? 100 : options.limit,
      after: options.after,
      before: options.before,
      hours: options.hours,
    });

    runs.push(...response.data);

    if (response.cursor) {
      nextCursor = response.cursor;
    }

    hasMoreAvailable = Boolean(response.has_more && response.cursor);

    if (!(options.fetchAll && response.has_more && response.cursor)) {
      break;
    }

    cursorForRequest = response.cursor;

    if (options.fetchAll && callbacks.onProgress) {
      callbacks.onProgress(`Fetched ${runs.length} runs, continuing...`);
    }

    if (options.fetchAll && runs.length >= SAFETY_LIMIT) {
      hasMoreAvailable = true;
      if (callbacks.onProgress) {
        callbacks.onProgress('Reached maximum of 1000 runs for safety');
      }
      break;
    }
  }

  return {
    runs,
    hasMore: hasMoreAvailable,
    nextCursor,
  };
}
