import { Command } from "commander";
import { z } from "zod";
import { InngestClient } from "../api/client.js";
import { getConfig, validateRunId } from "../utils/config.js";
import {
  displayError,
  displayInfo,
  displaySuccess,
  displayWarning,
  outputJSON,
} from "../utils/display.js";

// Match CancellationRequestSchema so a dry run cannot print a body the client rejects.
const iso8601DateTime = z.string().datetime();

function parseIso8601Timestamp(value: string, flag: "--before" | "--after"): Date {
  const parsed = iso8601DateTime.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid ${flag} timestamp format. Use ISO 8601 format.`);
  }

  const date = new Date(parsed.data);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${flag} timestamp format. Use ISO 8601 format.`);
  }

  return date;
}

function bulkCancellationRequest(options: {
  appId: string;
  functionId: string;
  before?: string;
  after?: string;
  if?: string;
}): {
  app_id: string;
  function_id: string;
  started_after?: string;
  started_before: string;
  if?: string;
} {
  if (!options.before) {
    throw new Error("--before is required for bulk cancellation");
  }

  const before = parseIso8601Timestamp(options.before, "--before");
  if (before.getTime() >= Date.now()) {
    throw new Error("--before must be in the past");
  }

  const request: {
    app_id: string;
    function_id: string;
    started_after?: string;
    started_before: string;
    if?: string;
  } = {
    app_id: options.appId,
    function_id: options.functionId,
    started_before: options.before,
  };

  if (options.after) {
    const after = parseIso8601Timestamp(options.after, "--after");
    if (after.getTime() >= before.getTime()) {
      throw new Error("--after must be earlier than --before");
    }
    request.started_after = options.after;
  }

  if (options.if) {
    request.if = options.if;
  }

  return request;
}

export function createCancelCommand(): Command {
  const command = new Command("cancel")
    .description("Cancel runs")
    .option("-r, --run <runId>", "Cancel a specific run")
    .option("-f, --function <functionId>", "Cancel runs for a function (requires app-id)")
    .option("-a, --app-id <appId>", "App ID for bulk cancellation")
    .option("--after <timestamp>", "Cancel runs started after this timestamp (ISO 8601)")
    .option(
      "--before <timestamp>",
      "Cancel runs started before this timestamp (ISO 8601). Required for bulk cancellation and must be in the past",
    )
    .option("--if <expression>", "CEL expression for conditional cancellation")
    .option("--dry-run", "Show what would be cancelled without actually cancelling")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--format <format>", "Output format: table or json (default: table)", "table")
    .action(async (options) => {
      try {
        // Single run cancellation. Bulk flags are still rejected, and this path
        // does not require --before.
        if (options.run) {
          const config = getConfig();
          const client = new InngestClient(config);

          if (options.function || options.appId || options.after || options.before || options.if) {
            throw new Error("Cannot use bulk cancellation options with --run");
          }

          if (!validateRunId(options.run)) {
            throw new Error("Invalid run ID format");
          }

          if (options.dryRun) {
            if (options.format === "json") {
              outputJSON({ action: "would_cancel", run_id: options.run });
            } else {
              displayInfo(`Would cancel run: ${options.run}`);
            }
            return;
          }

          if (!options.yes) {
            displayWarning(`Are you sure you want to cancel run ${options.run}?`);
            displayInfo("Use --yes to skip this confirmation");
            return;
          }

          await client.cancelRun(options.run);
          if (options.format === "json") {
            outputJSON({ action: "cancelled", run_id: options.run });
          } else {
            displaySuccess(`Cancelled run: ${options.run}`);
          }
          return;
        }

        // Bulk cancellation. CreateCancellation rejects a missing or future
        // started_before, so validate before dry-run output or any HTTP call.
        if (!options.function) {
          throw new Error("Either --run or --function must be specified");
        }

        if (!options.appId) {
          throw new Error("--app-id is required for bulk cancellation");
        }

        const cancellationRequest = bulkCancellationRequest({
          appId: options.appId,
          functionId: options.function,
          before: options.before,
          after: options.after,
          if: options.if,
        });

        if (options.dryRun) {
          if (options.format === "json") {
            outputJSON({ action: "would_bulk_cancel", request: cancellationRequest });
          } else {
            displayInfo("Would perform bulk cancellation with:");
            console.log(JSON.stringify(cancellationRequest, null, 2));
          }
          return;
        }

        if (!options.yes) {
          displayWarning("You are about to perform a bulk cancellation:");
          console.log(JSON.stringify(cancellationRequest, null, 2));
          displayWarning("This action cannot be undone!");
          displayInfo("Use --yes to skip this confirmation or --dry-run to preview");
          return;
        }

        const config = getConfig();
        const client = new InngestClient(config);
        const response = await client.bulkCancel(cancellationRequest);
        if (options.format === "json") {
          outputJSON({
            action: "bulk_cancelled",
            cancellation_id: response.cancellation_id,
            status: response.status,
          });
        } else {
          displaySuccess(`Bulk cancellation initiated: ${response.cancellation_id}`);
          displayInfo(`Status: ${response.status}`);
          displayInfo(
            `Check cancellation status with: inngest cancellation-status ${response.cancellation_id}`,
          );
        }
      } catch (error) {
        displayError(error as Error);
        process.exit(1);
      }
    });

  return command;
}
