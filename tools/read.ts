import { tool } from 'ai';
import { z } from 'zod';

export const createReadTool = (cwd: string) =>
  tool({
    description: `Read a file from the project. Returns numbered lines.
WHEN TO USE: viewing file contents, checking configs, reading source code.
WHEN NOT TO USE: searching across files (use grep instead).
DO NOT USE FOR: running commands, listing directories.`,
    inputSchema: z.object({
      path: z.string().describe('File path relative to working directory'),
      offset: z.number().optional().describe('Start line (1-indexed)'),
      limit: z.number().optional().describe('Max lines to return'),
    }),
    execute: async ({ path: filePath, offset, limit }) => {
      const file = Bun.file(new URL(filePath, Bun.pathToFileURL(`${cwd}/`)));
      const content = await file.text();

      let lines = content.split('\n');

      if (offset) lines = lines.slice(offset - 1);
      if (limit) lines = lines.slice(0, limit);

      const MAX_LINES = 500;
      const truncated = lines.length > MAX_LINES;

      if (truncated) lines = lines.slice(0, MAX_LINES);

      const numbered = lines.map((l, i) => `${(offset || 1) + i}: ${l}`);

      return truncated
        ? numbered.join('\n') + `\n... (truncated at ${MAX_LINES} lines)`
        : numbered.join('\n');
    },
  });
