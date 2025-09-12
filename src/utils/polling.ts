import type { InngestClient } from '../api/client.js';
import { displayError, displayInfo, displayRunDetails } from './display.js';

export interface WatchOptions {
  pollInterval: number; // in milliseconds
  maxDuration?: number | undefined; // in milliseconds, optional timeout
}

export class RunWatcher {
  private client: InngestClient;
  private isWatching = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(client: InngestClient) {
    this.client = client;
  }

  async watchRun(runId: string, options: WatchOptions): Promise<void> {
    if (this.isWatching) {
      throw new Error('Already watching a run');
    }

    this.isWatching = true;
    let lastStatus = '';
    const startTime = Date.now();

    displayInfo(`Watching run ${runId}... (Press Ctrl+C to stop)`);

    const checkRun = async () => {
      try {
        const run = await this.client.getRun(runId);

        if (run.status !== lastStatus) {
          console.clear();
          displayRunDetails(run);
          lastStatus = run.status;
        }

        // Stop watching if run is completed/failed/cancelled
        if (['Completed', 'Failed', 'Cancelled'].includes(run.status)) {
          this.stopWatching();
          displayInfo(`Run ${run.status.toLowerCase()}`);
          return;
        }

        // Check timeout
        if (options.maxDuration && Date.now() - startTime > options.maxDuration) {
          this.stopWatching();
          displayInfo('Watch timeout reached');
          return;
        }
      } catch (error) {
        displayError(error as Error);
        this.stopWatching();
      }
    };

    // Initial check
    await checkRun();

    if (this.isWatching) {
      this.intervalId = setInterval(checkRun, options.pollInterval);
    }
  }

  async watchEventRuns(eventId: string, options: WatchOptions): Promise<void> {
    if (this.isWatching) {
      throw new Error('Already watching runs');
    }

    this.isWatching = true;
    let lastRunCount = 0;
    const startTime = Date.now();

    displayInfo(`Watching runs for event ${eventId}... (Press Ctrl+C to stop)`);

    const checkRuns = async () => {
      try {
        const runs = await this.client.getEventRuns(eventId);

        if (runs.length !== lastRunCount) {
          console.clear();
          displayInfo(`Found ${runs.length} run(s) for event ${eventId}`);
          runs.forEach(run => {
            console.log(`\n📋 Run ${run.run_id.slice(-12)}`);
            displayRunDetails(run);
          });
          lastRunCount = runs.length;
        }

        // Check if all runs are completed
        const activeRuns = runs.filter(run => run.status === 'Running');
        if (activeRuns.length === 0 && runs.length > 0) {
          this.stopWatching();
          displayInfo('All runs completed');
          return;
        }

        // Check timeout
        if (options.maxDuration && Date.now() - startTime > options.maxDuration) {
          this.stopWatching();
          displayInfo('Watch timeout reached');
          return;
        }
      } catch (error) {
        displayError(error as Error);
        this.stopWatching();
      }
    };

    // Initial check
    await checkRuns();

    if (this.isWatching) {
      this.intervalId = setInterval(checkRuns, options.pollInterval);
    }
  }

  stopWatching(): void {
    this.isWatching = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  displayInfo('Stopping watch...');
  process.exit(0);
});
