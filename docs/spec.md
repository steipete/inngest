# Inngest CLI Technical Specification

## Overview

The Inngest CLI (`@steipete/inngest`) is a comprehensive command-line interface for managing Inngest jobs, providing capabilities to monitor, filter, cancel, and watch job executions in real-time.

## Architecture

### Core Components

```
inngest/
├── src/
│   ├── api/               # API layer
│   │   ├── client.ts      # HTTP client with validation
│   │   └── types.ts       # Zod schemas and types
│   ├── commands/          # CLI commands
│   │   ├── status.ts      # Get run/event status
│   │   ├── list.ts        # List runs with filtering
│   │   ├── watch.ts       # Real-time monitoring
│   │   ├── cancel.ts      # Cancel operations
│   │   ├── jobs.ts        # Job details
│   │   └── cancellation-status.ts
│   ├── utils/             # Utilities
│   │   ├── config.ts      # Configuration management
│   │   ├── display.ts     # Terminal output formatting
│   │   └── polling.ts     # Real-time polling logic
│   └── cli.ts            # Main entry point
└── dist/                 # Compiled output
```

### Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript with strict mode
- **Validation**: Zod 4.x for runtime type checking
- **CLI Framework**: Commander.js for argument parsing
- **HTTP Client**: Axios with interceptors
- **Testing**: Vitest with comprehensive coverage
- **Linting**: Biome with strict rules
- **Output**: Chalk for colors, CLI-Table3 for formatting

## API Integration

### Authentication

The CLI uses Bearer token authentication with Inngest signing keys:

```typescript
headers: {
  'Authorization': `Bearer ${signingKey}`,
  'Content-Type': 'application/json'
}
```

### Base Configuration

- **Default API URL**: `https://api.inngest.com`
- **Timeout**: 30 seconds
- **API Version**: v1

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/runs/{runId}` | GET | Get specific run details |
| `/v1/events/{eventId}/runs` | GET | Get runs for an event |
| `/v1/runs` | GET | List runs with filtering |
| `/v1/runs/{runId}/jobs` | GET | Get job details for a run |
| `/v1/runs/{runId}` | DELETE | Cancel a specific run |
| `/v1/cancellations` | POST | Bulk cancel operations |
| `/v1/cancellations/{id}` | GET | Get cancellation status |

## Data Models

### Core Types

```typescript
// Run Status Enum
type RunStatus = 'Running' | 'Completed' | 'Failed' | 'Cancelled';

// Inngest Run
interface InngestRun {
  run_id: string;
  status: RunStatus;
  run_started_at: string;     // ISO 8601 timestamp
  ended_at?: string;          // ISO 8601 timestamp
  output?: unknown;           // JSON output
  event_id?: string;
  function_id?: string;
  function_version?: number;
}

// Job within a Run
interface InngestJob {
  id: string;
  run_id: string;
  step: string;
  status: RunStatus;
  started_at: string;         // ISO 8601 timestamp
  ended_at?: string;          // ISO 8601 timestamp
  output?: unknown;
  error?: unknown;
}
```

### API Response Schemas

All API responses are validated using Zod schemas at runtime:

```typescript
const InngestRunSchema = z.object({
  run_id: z.string().min(1),
  status: z.enum(['Running', 'Completed', 'Failed', 'Cancelled']),
  run_started_at: z.string().datetime(),
  ended_at: z.string().datetime().optional(),
  output: z.unknown().optional(),
  event_id: z.string().optional(),
  function_id: z.string().optional(),
  function_version: z.number().int().nonnegative().optional(),
});
```

## Command Reference

### Status Command

**Purpose**: Get the status of specific runs or events

```bash
inngest status --run <runId>      # Get single run status
inngest status --event <eventId>  # Get all runs for an event
```

**Implementation**:
- Validates run/event ID format (ULID)
- Fetches data via API client
- Displays formatted output with colors

### List Command

**Purpose**: List and filter runs

```bash
inngest list [options]
```

**Options**:
- `--status <status>`: Filter by status (Running, Completed, Failed, Cancelled)
- `--function <functionId>`: Filter by function ID
- `--limit <number>`: Limit results (1-100, default 20)
- `--cursor <cursor>`: Pagination cursor
- `--all`: Fetch all results (with safety limit)

**Features**:
- Server-side filtering and pagination
- Automatic pagination for `--all` flag
- Safety limits to prevent excessive API calls

### Watch Command

**Purpose**: Real-time monitoring of runs

```bash
inngest watch --run <runId>       # Watch specific run
inngest watch --event <eventId>   # Watch event runs
```

**Options**:
- `--interval <seconds>`: Polling interval (1-300s, default 5s)
- `--timeout <minutes>`: Maximum watch duration (1-60min)

**Implementation**:
- Configurable polling intervals
- Automatic termination when runs complete
- Graceful shutdown on Ctrl+C
- Live terminal updates

### Cancel Command

**Purpose**: Cancel individual runs or bulk operations

```bash
# Single run cancellation
inngest cancel --run <runId> [--yes]

# Bulk cancellation
inngest cancel --app-id <appId> --function <functionId> [options]
```

**Bulk Options**:
- `--after <timestamp>`: Cancel runs after ISO 8601 timestamp
- `--before <timestamp>`: Cancel runs before ISO 8601 timestamp  
- `--if <expression>`: CEL expression for conditional cancellation
- `--dry-run`: Preview what would be cancelled
- `--yes`: Skip confirmation prompts

**Safety Features**:
- Confirmation prompts for destructive operations
- Dry-run mode for bulk operations
- Input validation for timestamps and expressions

### Jobs Command

**Purpose**: Get detailed job execution information

```bash
inngest jobs <runId>
```

**Output**: Step-by-step execution details with timing and status

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `INNGEST_SIGNING_KEY` | Yes | Inngest signing key for authentication |
| `INNGEST_API_URL` | No | Custom API URL (default: https://api.inngest.com) |

### Validation

Configuration is validated using Zod schemas:

```typescript
const EnvSchema = z.object({
  INNGEST_SIGNING_KEY: z.string().min(1),
  INNGEST_API_URL: z.string().url().optional(),
});
```

## Error Handling

### Validation Errors

- **Input Validation**: Command arguments validated before API calls
- **Response Validation**: All API responses validated against schemas
- **Configuration Validation**: Environment variables validated on startup

### API Errors

- **Network Errors**: Connection timeouts, DNS failures
- **HTTP Errors**: 4xx/5xx responses with structured error messages
- **Validation Errors**: Schema validation failures with detailed feedback

### Error Display

```typescript
// Structured error messages
displayError(new Error("API Error: Invalid run ID format"));
// Output: ❌ Error: API Error: Invalid run ID format
```

## Output Formatting

### Status Indicators

```typescript
const statusColors = {
  Running: '● Running',    // Yellow
  Completed: '● Completed', // Green  
  Failed: '● Failed',       // Red
  Cancelled: '● Cancelled', // Gray
};
```

### Tables

Formatted using CLI-Table3 with consistent styling:

```
┌──────────────┬───────────┬──────────────┬─────────────────────┬──────────┐
│ Run ID       │ Status    │ Function     │ Started             │ Duration │
├──────────────┼───────────┼──────────────┼─────────────────────┼──────────┤
│ ...JS9DV9Q   │ ● Running │ send-email   │ 2024-01-01 10:30:00 │ 5.2s     │
└──────────────┴───────────┴──────────────┴─────────────────────┴──────────┘
```

### Time Formatting

- **Absolute**: `2024-01-01 10:30:00` (locale-specific)
- **Duration**: `5.2s`, `2.1m`, `1.5h` (human-readable)

## Testing

### Test Coverage

- **Unit Tests**: 42 tests covering all major components
- **Type Tests**: Zod schema validation tests
- **Integration Tests**: API client with mocked responses
- **Configuration Tests**: Environment validation

### Test Structure

```typescript
describe('InngestClient', () => {
  beforeEach(() => {
    // Setup mocked dependencies
  });

  it('should validate API responses', async () => {
    // Test runtime validation
  });
});
```

### Coverage Requirements

- **Minimum**: 80% line coverage
- **Critical Paths**: 100% coverage for validation and error handling
- **Commands**: Full integration test coverage

## Performance Considerations

### API Rate Limiting

- **Polling**: Configurable intervals (minimum 1 second)
- **Batch Operations**: Limited to 1000 runs for safety
- **Timeouts**: 30-second HTTP timeout, configurable watch timeouts

### Memory Usage

- **Streaming**: Large result sets handled with pagination
- **Caching**: No persistent caching (stateless design)
- **Cleanup**: Proper resource cleanup for watchers

## Security

### Credential Management

- **Environment Variables**: Signing keys never logged or cached
- **API Keys**: Validated format but never exposed in output
- **Error Messages**: Sanitized to prevent key leakage

### Input Validation

- **Command Arguments**: Validated against expected patterns
- **API Inputs**: Schema validation before network calls
- **File Operations**: No file system access for security

## Development

### Build Process

```bash
npm run build     # TypeScript compilation
npm run test      # Full test suite
npm run lint      # Code quality checks
npm run check     # All quality checks
```

### Code Quality

- **TypeScript**: Strict mode with no `any` types
- **Biome**: Comprehensive linting with auto-fixes
- **Zod**: Runtime type safety for all external data
- **Testing**: Vitest with comprehensive coverage

### Release Process

1. Version bump in `package.json`
2. Run `npm run check` (lint + test + build)
3. Tag release
4. Publish to npm registry

## Extensibility

### Adding Commands

1. Create command file in `src/commands/`
2. Implement command using Commander.js pattern
3. Add to main CLI in `src/cli.ts`
4. Add tests in `src/__tests__/`

### API Extensions

1. Update types in `src/api/types.ts`
2. Add Zod schemas for validation
3. Extend client methods in `src/api/client.ts`
4. Update tests

### Custom Formatters

Display utilities are modular and can be extended:

```typescript
export function customFormatter(data: SomeType): void {
  // Custom formatting logic
}
```

## Deployment

### NPM Package

- **Name**: `@steipete/inngest`
- **Binary**: `inngest`
- **Target**: ES2022 with CommonJS output
- **Dependencies**: Production dependencies only

### Installation

```bash
npm install -g @steipete/inngest
```

### System Requirements

- Node.js 18+ (specified in engines)
- Network access to api.inngest.com
- Environment variable access

## Future Enhancements

### Planned Features

- **Configuration Files**: Support for `.inngestrc` configuration
- **Output Formats**: JSON, CSV export options  
- **Webhooks**: Real-time notifications instead of polling
- **Caching**: Optional response caching for repeated queries
- **Batch Operations**: Enhanced bulk operations with progress bars

### API Evolution

- **Version Support**: Backward compatibility with API versions
- **Schema Evolution**: Graceful handling of API changes
- **Feature Detection**: Automatic feature detection based on API responses

---

## Appendix

### ULID Format

Inngest uses ULID (Universally Unique Lexicographically Sortable Identifier) format:
- 26 characters long
- Characters: `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (Crockford's Base32)
- Pattern: `/^[0-9A-HJKMNP-TV-Z]{26}$/`

### CEL Expressions

Common Expression Language examples for conditional operations:
```cel
event.data.userId == "user_123"
event.data.priority > 5
has(event.data.retryCount) && event.data.retryCount > 3
```

### ISO 8601 Timestamps

Expected format: `2024-01-01T10:30:00.000Z`
- UTC timezone required
- Millisecond precision supported
- Validated by Zod datetime schema