import { tool } from 'ai';
import { z } from 'zod';

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

function isSafe(command: string): boolean {
  return SAFE_PREFIXES.some((p) => command.trim().startsWith(p));
}

export const createBashTool = (cwd: string) =>
  tool({
    description: DESCRIPTION,
    inputSchema: z.object({
      command: z.string().describe('Shell command to execute'),
    }),
    execute: async ({ command }) => {
      if (!isSafe(command)) {
        return `Blocked: "${command}" requires approval. Only safe commands (${SAFE_PREFIXES.join(', ')}) run automatically.`;
      }

      try {
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

        if (exitCode !== 0) {
          return `Exit ${exitCode}: ${stdout || stderr}`;
        }
        return stdout || '(no output)';
      } catch (e: any) {
        return `Exit 1: ${e.message || ''}`;
      }
    },
  });
