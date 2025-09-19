import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Helper to run the CLI and capture output
function runCLI(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const cliPath = require.resolve('../../dist/cli.js');
    const proc = spawn('node', [cliPath, ...args], {
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => {
      stdout += data.toString();
    });

    proc.stderr.on('data', data => {
      stderr += data.toString();
    });

    proc.on('error', reject);
    proc.on('close', code => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

describe('CLI Behavior', () => {
  describe('Help command', () => {
    it('should display help with --help flag and exit with code 0', async () => {
      const result = await runCLI(['--help']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Usage: inngest [options] [command]');
      expect(result.stdout).toContain('CLI for managing Inngest jobs');
      expect(result.stdout).toContain('Options:');
      expect(result.stdout).toContain('Commands:');
      expect(result.stdout).toContain('--env <environment>');
      expect(result.stdout).toContain('--dev-port <port>');

      // Ensure no error message appears
      expect(result.stdout).not.toContain('Error:');
      expect(result.stderr).not.toContain('Error:');
    });

    it('should display help when no arguments provided and exit with code 0', async () => {
      const result = await runCLI([]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Usage: inngest [options] [command]');
      expect(result.stdout).toContain('CLI for managing Inngest jobs');
    });

    it('should display help for specific command', async () => {
      const result = await runCLI(['list', '--help']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Usage: inngest list');
      expect(result.stdout).toContain('List runs with optional filtering');
    });
  });

  describe('Version command', () => {
    it('should display version with --version flag and exit with code 0', async () => {
      const result = await runCLI(['--version']);

      expect(result.code).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/); // Matches version format like 0.9.2

      // Ensure no error message appears
      expect(result.stdout).not.toContain('Error:');
      expect(result.stderr).not.toContain('Error:');
    });

    it('should display version with -V flag and exit with code 0', async () => {
      const result = await runCLI(['-V']);

      expect(result.code).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('Environment option', () => {
    it('should reject invalid environment values', async () => {
      const result = await runCLI(['--env', 'invalid', 'list']);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Invalid environment "invalid"');
      expect(result.stderr).toContain('Available: prod, dev');
    });

    it('should accept valid environment values', async () => {
      // We'll test with help to avoid needing actual API calls
      const resultProd = await runCLI(['--env', 'prod', '--help']);
      expect(resultProd.code).toBe(0);

      const resultDev = await runCLI(['--env', 'dev', '--help']);
      expect(resultDev.code).toBe(0);
    });
  });

  describe('Dev port option', () => {
    it('should reject invalid port values', async () => {
      const result = await runCLI(['--dev-port', '99999', 'list']);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Dev port must be a valid port number');
    });

    it('should reject non-numeric port values', async () => {
      const result = await runCLI(['--dev-port', 'abc', 'list']);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Dev port must be a valid port number');
    });

    it('should accept valid port values', async () => {
      const result = await runCLI(['--dev-port', '3000', '--help']);
      expect(result.code).toBe(0);
    });
  });

  describe('Unknown commands', () => {
    it('should show error for unknown command', async () => {
      const result = await runCLI(['unknown-command']);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("error: unknown command 'unknown-command'");
    });
  });
});