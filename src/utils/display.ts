import chalk from 'chalk';
import Table from 'cli-table3';
import type { InngestJob, InngestRun } from '../api/types.js';

export function formatStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'running':
      return `${chalk.yellow('●')} ${chalk.yellow(status)}`;
    case 'completed':
      return `${chalk.green('●')} ${chalk.green(status)}`;
    case 'failed':
      return `${chalk.red('●')} ${chalk.red(status)}`;
    case 'cancelled':
      return `${chalk.gray('●')} ${chalk.gray(status)}`;
    default:
      return `${chalk.white('●')} ${status}`;
  }
}

export function formatDuration(startTime: string, endTime?: string): string {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  const durationMs = end.getTime() - start.getTime();

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  } else if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  } else if (durationMs < 3600000) {
    return `${(durationMs / 60000).toFixed(1)}m`;
  } else {
    return `${(durationMs / 3600000).toFixed(1)}h`;
  }
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export function displayRunsTable(runs: InngestRun[]): void {
  if (runs.length === 0) {
    console.log(chalk.yellow('No runs found'));
    return;
  }

  const table = new Table({
    head: [
      chalk.bold('Run ID'),
      chalk.bold('Status'),
      chalk.bold('Function'),
      chalk.bold('Started'),
      chalk.bold('Duration'),
    ],
    style: {
      head: [],
      border: [],
    },
  });

  runs.forEach(run => {
    table.push([
      run.run_id.slice(-12), // Show last 12 characters
      formatStatus(run.status),
      run.function_name || run.function_id || 'N/A',
      formatTimestamp(run.run_started_at),
      formatDuration(run.run_started_at, run.ended_at),
    ]);
  });

  console.log(table.toString());
}

export function displayRunDetails(run: InngestRun): void {
  console.log(chalk.bold('\n📋 Run Details'));
  console.log('─'.repeat(50));
  console.log(`${chalk.bold('ID:')} ${run.run_id}`);
  console.log(`${chalk.bold('Status:')} ${formatStatus(run.status)}`);
  console.log(`${chalk.bold('Function:')} ${run.function_id || 'N/A'}`);
  console.log(`${chalk.bold('Event ID:')} ${run.event_id || 'N/A'}`);
  console.log(`${chalk.bold('Started:')} ${formatTimestamp(run.run_started_at)}`);

  if (run.ended_at) {
    console.log(`${chalk.bold('Ended:')} ${formatTimestamp(run.ended_at)}`);
    console.log(`${chalk.bold('Duration:')} ${formatDuration(run.run_started_at, run.ended_at)}`);
  } else {
    console.log(`${chalk.bold('Duration:')} ${formatDuration(run.run_started_at)} (running)`);
  }

  if (run.output) {
    console.log(`\n${chalk.bold('Output:')}`);
    console.log(JSON.stringify(run.output, null, 2));
  }
}

export function displayJobsTable(jobs: InngestJob[]): void {
  if (jobs.length === 0) {
    console.log(chalk.yellow('No jobs found'));
    return;
  }

  const table = new Table({
    head: [
      chalk.bold('Job ID'),
      chalk.bold('Step'),
      chalk.bold('Status'),
      chalk.bold('Started'),
      chalk.bold('Duration'),
    ],
    style: {
      head: [],
      border: [],
    },
  });

  jobs.forEach(job => {
    table.push([
      job.id.slice(-12),
      job.step,
      formatStatus(job.status),
      formatTimestamp(job.started_at),
      formatDuration(job.started_at, job.ended_at),
    ]);
  });

  console.log(table.toString());
}

export function displayError(error: Error): void {
  console.error(chalk.red('❌ Error:'), error.message);
}

export function displaySuccess(message: string): void {
  console.log(chalk.green('✅'), message);
}

export function displayInfo(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}

export function displayWarning(message: string): void {
  console.log(chalk.yellow('⚠'), message);
}
