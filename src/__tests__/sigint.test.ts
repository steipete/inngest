import { afterEach, describe, expect, it, vi } from "vitest";
import type { InngestClient } from "../api/client.js";
import type { InngestRun } from "../api/types.js";

const baseRun: InngestRun = {
  run_id: "01JY7ZQ3N1R6V9T2X5C8B4K7L9",
  status: "Running",
  run_started_at: "2025-09-24T19:00:00.000Z",
};

function listenersAddedSince(
  before: ReadonlySet<NodeJS.SignalsListener>,
): NodeJS.SignalsListener[] {
  return process.listeners("SIGINT").filter((listener) => !before.has(listener));
}

function exitCodesFrom(listeners: readonly NodeJS.SignalsListener[]): number[] {
  const codes: number[] = [];
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    codes.push(code ?? 0);
  }) as typeof process.exit);
  try {
    for (const listener of listeners) {
      listener("SIGINT");
    }
  } finally {
    exitSpy.mockRestore();
  }
  return codes;
}

describe("SIGINT scope", () => {
  const leaked: NodeJS.SignalsListener[] = [];

  afterEach(() => {
    for (const listener of leaked.splice(0)) {
      process.removeListener("SIGINT", listener);
    }
    vi.restoreAllMocks();
  });

  it("does not install a SIGINT handler that exits 0 when the CLI or list command is imported", async () => {
    const before = new Set(process.listeners("SIGINT"));
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${String(code)}`);
    }) as typeof process.exit);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const previousArgv = process.argv.slice();
    process.argv = ["node", "inngest", "list", "--help"];

    try {
      await import("../commands/list.js");
      await import("../cli.js");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.startsWith("process.exit:")) {
        throw error;
      }
    } finally {
      process.argv = previousArgv;
      exitSpy.mockRestore();
      stdout.mockRestore();
      stderr.mockRestore();
    }

    const installed = listenersAddedSince(before);
    leaked.push(...installed);

    expect(exitCodesFrom(installed)).not.toContain(0);
    expect(installed).toHaveLength(0);
  });

  it("handles SIGINT while a watch is running and does not report success", async () => {
    const before = new Set(process.listeners("SIGINT"));
    const { RunWatcher } = await import("../utils/polling.js");
    const fromImport = listenersAddedSince(before);
    leaked.push(...fromImport);
    expect(fromImport).toHaveLength(0);

    const getRun = vi.fn().mockResolvedValue(baseRun);
    const watcher = new RunWatcher({ getRun } as unknown as InngestClient);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "clear").mockImplementation(() => {});

    try {
      await watcher.watchRun(baseRun.run_id, { pollInterval: 60_000 });

      const during = listenersAddedSince(before);
      for (const listener of during) {
        if (!leaked.includes(listener)) {
          leaked.push(listener);
        }
      }

      expect(during).toHaveLength(1);
      expect(exitCodesFrom(during)).toEqual([130]);
      expect(logSpy).toHaveBeenCalledWith(expect.anything(), "Stopping watch...");
      expect(listenersAddedSince(before)).toHaveLength(0);
      expect(getRun).toHaveBeenCalledTimes(1);
    } finally {
      watcher.stopWatching();
    }
  });
});
