import { tool } from 'ai';
import { z } from 'zod';

export const createGrepTool = (cwd: string) =>
  tool({
    description: `Search file contents using regex. Returns matching lines with file paths.
WHEN TO USE: finding patterns across multiple files, locating function definitions,
  searching for imports, finding TODOs or error messages.
WHEN NOT TO USE: reading a known file (use read instead).
DO NOT USE FOR: running commands, listing directories.
EXAMPLES:
  - Find all TODO comments: pattern "TODO" glob "*.ts"
  - Find function definitions: pattern "function \\\\w+" glob "*.ts"`,
    inputSchema: z.object({
      pattern: z.string().describe('Regex pattern to search for'),
      path: z
        .string()
        .optional()
        .describe('Directory to search (default: working dir)'),
      glob: z.string().optional().describe("File glob filter, e.g. '*.ts'"),
    }),
    execute: async ({ pattern, path: searchPath, glob: globFilter }) => {
      const dir = Bun.fileURLToPath(
        new URL(searchPath || '.', Bun.pathToFileURL(`${cwd}/`)),
      );

      const proc = Bun.spawn({
        cmd: [
          'grep',
          '-rn',
          '--exclude-dir=node_modules',
          '--exclude-dir=.git',
          `--include=${globFilter || '*'}`,
          '-E',
          pattern,
          dir,
        ],
        stdout: 'pipe',
        stderr: 'ignore',
        timeout: 10_000,
      });

      const stdout = await proc.stdout.text();
      await proc.exited;

      const lines = stdout.trim().split('\n').filter(Boolean);
      const MAX_MATCHES = 50;
      const truncated = lines.length > MAX_MATCHES;
      const result = truncated ? lines.slice(0, MAX_MATCHES) : lines;

      return truncated
        ? result.join('\n') +
            `\n... (${lines.length} total, showing first ${MAX_MATCHES})`
        : result.join('\n') || 'No matches found.';
    },
  });
