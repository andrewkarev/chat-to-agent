import { tool } from 'ai';
import { z } from 'zod';
import type { Sandbox } from '../sandbox';
import { resolveCap } from './caps';

interface Command {
  command: string;
}

type ApprovalConfig =
  | { mode: 'interactive' }
  | { mode: 'background' }
  | { mode: 'delegated'; trust: string[] };

export type BashCaps = { maxChars?: number };

const DEFAULT_BASH_CAPS = {
  fallback: 5000,
  max: 50000,
};

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
  caps: BashCaps = {},
) {
  const maxChars = resolveCap('maxChars', caps.maxChars, DEFAULT_BASH_CAPS);

  return tool({
    description: DESCRIPTION,
    inputSchema: z.object({
      command: z.string().describe('Shell command to execute'),
    }),
    execute: async ({ command }) => {
      if (needsApproval({ command })) {
        return `Blocked: "${command}" requires approval.`;
      }

      const result = await sandbox.exec(command);

      const stdout = result.stdout || '(no output)';

      return truncateOutput(stdout, maxChars);
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

function truncateOutput(output: string, maxChars: number) {
  return output.length > maxChars
    ? output.slice(-maxChars) +
        `\n... (truncated, showing last ${maxChars} chars)`
    : output;
}
