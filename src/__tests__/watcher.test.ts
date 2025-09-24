import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InngestClient } from '../api/client.js';
import type { InngestRun } from '../api/types.js';
import { displayError, displayInfo, displayRunDetails } from '../utils/display.js';
import { RunWatcher } from '../utils/polling.js';

vi.mock('../utils/display.js', () => ({
  displayInfo: vi.fn(),
  displayRunDetails: vi.fn(),
  displayError: vi.fn(),
}));

const baseRun: InngestRun = {
  run_id: '01JY7ZQ3N1R6V9T2X5C8B4K7L9',
  status: 'Running',
  run_started_at: '2025-09-24T19:00:00.000Z',
};

describe('RunWatcher', () => {
  let consoleClearSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-09-24T19:00:00.000Z'));
    consoleClearSpy = vi.spyOn(console, 'clear').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleClearSpy.mockRestore();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('polls a run until it completes and stops', async () => {
    const getRun = vi
      .fn()
      .mockResolvedValueOnce(baseRun)
      .mockResolvedValueOnce({
        ...baseRun,
        status: 'Completed' as const,
        ended_at: '2025-09-24T19:05:00.000Z',
      });

    const watcher = new RunWatcher({ getRun } as unknown as InngestClient);

    await watcher.watchRun(baseRun.run_id, { pollInterval: 1000 });

    await vi.advanceTimersByTimeAsync(1000);

    expect(getRun).toHaveBeenCalledTimes(2);
    expect(displayRunDetails).toHaveBeenCalledTimes(2);
    expect(displayInfo).toHaveBeenLastCalledWith('Run completed');
    expect(vi.getTimerCount()).toBe(0);
    expect(consoleClearSpy).toHaveBeenCalled();
  });

  it('stops watching when timeout is reached', async () => {
    const getRun = vi.fn().mockResolvedValue(baseRun);
    const watcher = new RunWatcher({ getRun } as unknown as InngestClient);

    await watcher.watchRun(baseRun.run_id, { pollInterval: 500, maxDuration: 1500 });

    await vi.advanceTimersByTimeAsync(2000);

    expect(displayInfo).toHaveBeenLastCalledWith('Watch timeout reached');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('propagates errors from getRun and stops watching', async () => {
    const getRun = vi.fn().mockRejectedValue(new Error('boom'));
    const watcher = new RunWatcher({ getRun } as unknown as InngestClient);

    await watcher.watchRun(baseRun.run_id, { pollInterval: 1000 });

    expect(displayError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('watches event runs until all complete', async () => {
    const firstRun = baseRun;
    const completedRun = {
      ...baseRun,
      status: 'Completed' as const,
      ended_at: '2025-09-24T19:05:00.000Z',
    };

    const getEventRuns = vi
      .fn()
      .mockResolvedValueOnce([firstRun])
      .mockResolvedValueOnce([completedRun]);

    const watcher = new RunWatcher({ getEventRuns } as unknown as InngestClient);

    await watcher.watchEventRuns('01JY7ZQ3N1R6V9T2X5C8B4K7M0', { pollInterval: 1000 });

    await vi.advanceTimersByTimeAsync(1000);

    expect(getEventRuns).toHaveBeenCalledTimes(2);
    expect(displayRunDetails).toHaveBeenCalled();
    expect(displayInfo).toHaveBeenLastCalledWith('All runs completed');
    expect(vi.getTimerCount()).toBe(0);
  });
});
