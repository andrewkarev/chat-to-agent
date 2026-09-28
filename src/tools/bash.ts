import { tool } from 'ai';
import { z } from 'zod';
import type { Sandbox } from '../sandbox';

interface Command {
  command: string;
}

type ApprovalConfig =
  | { mode: 'interactive' }
  | { mode: 'background' }
  | { mode: 'delegated'; trust: string[] };

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
    - Run a test suite: command "npm test"
  `;

export function createBashTool(
  sandbox: Sandbox,
  needsApproval: (input: Command) => boolean,
) {
  return tool({
    description: DESCRIPTION,
    inputSchema: z.object({
      command: z.string().describe('Shell command to execute'),
    }),
    execute: async ({ command }) => {
      if (needsApproval({ command })) {
        return `Blocked: "${command}" requires approval.`;
      }

      const { stdout } = await sandbox.exec(command);

      return stdout || '(no output)';
    },
  });
}

export function createApproval(config: ApprovalConfig) {
  return ({ command }: Command) => {
    if (config.mode === 'background') {
      return false;
    }

    if (config.mode === 'delegated') {
      return !config.trust.some((p) => command.trim().startsWith(p));
    }

    return !SAFE_PREFIXES.some((p) => command.trim().startsWith(p));
  };
}
