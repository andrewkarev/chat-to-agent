import { tool } from 'ai';
import { z } from 'zod';

interface BashOperations {
  exec(command: string): Promise<{ stdout: string; exitCode: number }>;
}

const SAFE_PREFIXES = [
  'ls',
  'cat',
  'echo',
  'pwd',
  'which',
  'find',
  'head',
  'tail',
  'wc',
  'git log',
  'git status',
  'git diff',
];

const DESCRIPTION = `
  Execute a shell command in the working directory.
  
  WHEN TO USE: running build commands, installing packages, running tests,
    git operations, directory listings.
  
  WHEN NOT TO USE: reading file contents (use read instead).
    Searching for patterns (use grep instead).
  
  DO NOT USE FOR: reading files (use read), searching code (use grep).
  
  USAGE: command is a single shell string. Commands not in the safe-prefix
    allowlist are blocked and return a clear error message.
  
  EXAMPLES:
    - List files: command "ls -la"
    - Check git status: command "git status"
    - Run a test suite: command "npm test"`;

function isSafe(command: string, safePrefixes: string[]): boolean {
  return safePrefixes.some((p) => command.trim().startsWith(p));
}

function createBashTool(operations: BashOperations, safePrefixes: string[]) {
  return tool({
    description: DESCRIPTION,
    inputSchema: z.object({
      command: z.string().describe('Shell command to execute'),
    }),
    execute: async ({ command }) => {
      if (!isSafe(command, safePrefixes)) {
        return `Blocked: "${command}" requires approval.`;
      }

      const { stdout } = await operations.exec(command);

      return stdout || '(no output)';
    },
  });
}

const localOps: BashOperations = {
  exec: async (command) => {
    try {
      const cwd = process.argv[2] || process.cwd();

      const proc = Bun.spawn({
        cmd: ['sh', '-c', command],
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 30_000,
      });

      const [stdout, stderr] = await Promise.all([
        proc.stdout.text(),
        proc.stderr.text(),
      ]);

      const exitCode = await proc.exited;

      return {
        stdout: stdout || stderr,
        exitCode,
      };
    } catch (e: any) {
      return {
        stdout: e.stdout || e.stderr || e.message || '',
        exitCode: e.status ?? 1,
      };
    }
  },
};

export const bash = createBashTool(localOps, SAFE_PREFIXES);
