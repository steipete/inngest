# @steipete/inngest

A powerful CLI for managing Inngest jobs with support for watching, canceling, and filtering by status.

## Features

- **Query run status** by run ID or event ID with detailed output
- **List runs** with filtering by status, function, and pagination support
- **Watch runs** in real-time with configurable polling intervals and timeouts
- **Cancel runs** individually or in bulk with conditional expressions and dry-run mode
- **View job details** for step-by-step execution analysis and debugging
- **Rich terminal output** with colors, tables, and progress indicators
- **Comprehensive error handling** with actionable troubleshooting guidance
- **Runtime validation** using Zod schemas for type safety
- **Modern TypeScript implementation** with strict mode and full test coverage

## Installation

```bash
npm install -g @steipete/inngest
```

## Setup

Set your Inngest signing key as an environment variable:

```bash
export INNGEST_SIGNING_KEY="your-signing-key-here"
```

Get your signing key from: https://app.inngest.com/env/production/manage/signing-key

## Usage

### Check Run Status

```bash
# Get status for a specific run
inngest status --run 01HWAVJ8ASQ5C3FXV32JS9DV9Q

# Get status for all runs of an event
inngest status --event 01HWAVEB858VPPX47Z65GR6P6R
```

### List Runs with Filtering

The CLI displays actual function names (e.g., `sweetistics-system.jobs.sweeper`) instead of UUIDs in the runs table for better readability.

```bash
# List all runs (default limit: 20) - shows function names
inngest list

# Filter by status
inngest list --status Running
inngest list --status Failed

# Filter by function name (supports partial matching)
inngest list --function-name "sweeper"
inngest list --function-name "embeddings/reconcile"
inngest list --function-name "system.jobs"

# Filter by function ID or name using --function (legacy option)
inngest list --function "process-payment"
inngest list --function "6cc723a1-30f3-4e16-bcaa-ae40619f9770"

# Combine filters
inngest list --status Running --function-name "send-email" --limit 50
inngest list --status Failed --function-name "embeddings" --limit 10

# Get all results (may take time)
inngest list --all

# Paginate through results
inngest list --cursor "next-page-cursor"
```

### Watch Runs in Real-time

```bash
# Watch a specific run (updates every 5 seconds)
inngest watch --run 01HWAVJ8ASQ5C3FXV32JS9DV9Q

# Watch all runs for an event
inngest watch --event 01HWAVEB858VPPX47Z65GR6P6R

# Custom polling interval (in seconds)
inngest watch --run 01HWAVJ8ASQ5C3FXV32JS9DV9Q --interval 10

# Set timeout (in minutes)
inngest watch --run 01HWAVJ8ASQ5C3FXV32JS9DV9Q --timeout 30
```

### Cancel Runs

```bash
# Cancel a specific run (with confirmation)
inngest cancel --run 01HWAVJ8ASQ5C3FXV32JS9DV9Q

# Cancel without confirmation
inngest cancel --run 01HWAVJ8ASQ5C3FXV32JS9DV9Q --yes

# Bulk cancel by function (requires app-id)
inngest cancel --app-id "my-app" --function "send-email" --yes

# Bulk cancel with time range
inngest cancel --app-id "my-app" --function "process-order" \
  --after "2024-01-01T00:00:00Z" \
  --before "2024-01-02T00:00:00Z" --yes

# Conditional cancellation with CEL expression
inngest cancel --app-id "my-app" --function "notify-user" \
  --if 'event.data.userId == "user_123"' --yes

# Dry run (preview what would be cancelled)
inngest cancel --app-id "my-app" --function "send-email" --dry-run
```

### View Job Details

```bash
# Get detailed job information for a run
inngest jobs 01HWAVJ8ASQ5C3FXV32JS9DV9Q
```

### Check Cancellation Status

```bash
# Check the status of a bulk cancellation
inngest cancellation-status 01HWAVJ8ASQ5C3FXV32JS9DV9Q
```

## Available Statuses

- `Running` - Job is currently executing
- `Completed` - Job finished successfully  
- `Failed` - Job failed with an error
- `Cancelled` - Job was cancelled

## Function Name Filtering

The CLI automatically extracts and displays readable function names from Inngest events instead of showing UUIDs. This makes it much easier to identify and filter runs.

**Function Name Format**: Function names typically follow patterns like:
- `sweetistics-system.jobs.sweeper`
- `my-app.embeddings.reconcile`  
- `user-service.notifications.send`

**Filtering Options**:
- `--function-name`: Filter by function name with partial matching (recommended)
- `--function`: Filter by function ID (UUID) or function name (legacy support)

## Environment Variables

- `INNGEST_SIGNING_KEY` - Your Inngest signing key (required)
- `INNGEST_API_URL` - Custom API URL (optional, defaults to https://api.inngest.com)

## Examples

### Monitor Function-Specific Jobs

```bash
# Monitor specific functions by name
inngest list --function-name "sweeper"
inngest list --function-name "embeddings/reconcile"

# Monitor failed jobs for specific functions
inngest list --status Failed --function-name "system.jobs"
inngest list --status Failed --function-name "embeddings"

# Watch for new failures in a specific function
inngest watch --event <EVENT_ID> --interval 30
```

### Monitor Failed Jobs

```bash
# List all failed runs
inngest list --status Failed

# List failed runs with readable function names
# (shows: sweetistics-system.jobs.sweeper instead of UUID)
inngest list --status Failed --limit 10
```

### Bulk Cleanup

```bash
# Preview what would be cancelled
inngest cancel --app-id "my-app" --function "cleanup-task" --dry-run

# Cancel all runs for a function from yesterday
inngest cancel --app-id "my-app" --function "cleanup-task" \
  --after "2024-01-01T00:00:00Z" \
  --before "2024-01-02T00:00:00Z" --yes
```

### Debug a Specific Run

```bash
# Get run details
inngest status --run 01HWAVJ8ASQ5C3FXV32JS9DV9Q

# Get step-by-step job execution
inngest jobs 01HWAVJ8ASQ5C3FXV32JS9DV9Q

# Watch it live (if still running)
inngest watch --run 01HWAVJ8ASQ5C3FXV32JS9DV9Q
```

### Example Output

The CLI shows readable function names in a formatted table:

```bash
$ inngest list --limit 3
ℹ Fetching runs...
┌──────────────┬─────────────┬─────────────────────────────────┬───────────────────────┬──────────┐
│ Run ID       │ Status      │ Function                        │ Started               │ Duration │
├──────────────┼─────────────┼─────────────────────────────────┼───────────────────────┼──────────┤
│ SG8GPCA7CATH │ ● Completed │ sweetistics-system.jobs.sweeper │ 9/12/2025, 5:25:00 PM │ 8.0s     │
├──────────────┼─────────────┼─────────────────────────────────┼───────────────────────┼──────────┤
│ 7N49HSG37BFW │ ● Completed │ sweetistics-system.jobs.sweeper │ 9/12/2025, 5:20:00 PM │ 12.3s    │
├──────────────┼─────────────┼─────────────────────────────────┼───────────────────────┼──────────┤
│ 4R0ET7SWCA4Z │ ● Cancelled │ sweetistics-system.jobs.sweeper │ 9/12/2025, 5:05:00 PM │ 13.3m    │
└──────────────┴─────────────┴─────────────────────────────────┴───────────────────────┴──────────┘
ℹ Total: 3 run(s)
```

## Testing

The CLI includes comprehensive validation and error handling. You can test the CLI functionality:

```bash
# Run the included test script
node test-cli.js

# Test specific commands
inngest --help
inngest --version
inngest status --run <valid-run-id>
```

### API Testing

When testing with real API endpoints, ensure:

1. **Valid Signing Key**: Your `INNGEST_SIGNING_KEY` has appropriate permissions
2. **Correct API Version**: The current implementation uses `/v1/` endpoints
3. **Network Access**: Ensure connectivity to `https://api.inngest.com`

If you encounter 404 errors, the API endpoint structure might be different than expected. Check the latest API documentation for the correct endpoint paths.

## API Reference

This CLI is designed to work with the official Inngest REST API:

- [Get Run Status](https://api-docs.inngest.com/docs/inngest-api/ojjs82y5lmbwq-get-a-function-run)
- [List Runs](https://api-docs.inngest.com/docs/inngest-api/yoyeen3mu7wj0-list-event-function-runs)  
- [Cancel Run](https://api-docs.inngest.com/docs/inngest-api/t0itnlacczppy-cancel-a-function-run)
- [Get Jobs](https://api-docs.inngest.com/docs/inngest-api/fgnob41ksy695-fetch-function-run-jobs)
- [Bulk Cancel](https://www.inngest.com/docs/guides/cancel-running-functions)

## Technical Documentation

See [docs/spec.md](docs/spec.md) for comprehensive technical specifications, including:
- Architecture overview
- API integration details
- Data models and validation
- Error handling strategies
- Performance considerations

## License

MIT © Peter Steinberger
