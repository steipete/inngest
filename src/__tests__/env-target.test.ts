import { Command } from "commander";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCancelCommand } from "../commands/cancel.js";
import { createCancellationStatusCommand } from "../commands/cancellation-status.js";
import { createWatchCommand } from "../commands/watch.js";

vi.mock("axios");
const mockedAxios = vi.mocked(axios);

function programWithEnv(): Command {
  const program = new Command();
  program
    .option(
      "--env <environment>",
      "Environment to connect to",
      (value) => {
        if (value !== "prod" && value !== "dev") {
          throw new Error(`Invalid environment "${value}"`);
        }
        return value;
      },
      "prod",
    )
    .option("--env-slug <slug>", "Inngest environment slug", (value: string) => value.trim())
    .option("--dev-port <port>", "Port for dev server", (value: string) => {
      const port = parseInt(value, 10);
      if (Number.isNaN(port) || port < 1 || port > 65535) {
        throw new Error("Dev port must be a valid port number (1-65535)");
      }
      return port;
    });
  program.addCommand(createCancelCommand());
  program.addCommand(createWatchCommand());
  program.addCommand(createCancellationStatusCommand());
  return program;
}

describe("global environment flags", () => {
  const originalKey = process.env.INNGEST_SIGNING_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INNGEST_SIGNING_KEY = "signkey-test";
    mockedAxios.create.mockReturnValue({
      get: vi.fn().mockResolvedValue({ data: { data: [] } }),
      post: vi.fn(),
      delete: vi.fn(),
      interceptors: { response: { use: vi.fn() } },
    } as ReturnType<typeof axios.create>);
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.INNGEST_SIGNING_KEY;
    } else {
      process.env.INNGEST_SIGNING_KEY = originalKey;
    }
  });

  it("sends --env dev cancel to the local dev server", async () => {
    const program = programWithEnv();

    await program.parseAsync(
      [
        "--env",
        "dev",
        "cancel",
        "--run",
        "01HWAVJ8ASQ5C3FXV32JS9DV9Q",
        "--dry-run",
        "--format",
        "json",
      ],
      { from: "user" },
    );

    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: "http://localhost:8288" }),
    );
    const urls = mockedAxios.create.mock.calls.map((call) => call[0]?.baseURL);
    expect(urls).not.toContain("https://api.inngest.com");
  });
});
