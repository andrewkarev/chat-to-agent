import { tool } from 'ai';
import { z } from 'zod';

const DESCRIPTION = `
  Read a file from the project. Returns numbered lines.
  
  WHEN TO USE: viewing file contents, checking configurations, reading source code,
    examining specific lines with offset/limit.
  
  WHEN NOT TO USE: searching for patterns across files (use grep instead).
    Running commands (use bash instead).
  
  DO NOT USE FOR: searching code (use grep), executing commands (use bash),
    modifying files (use edit or write).
  
  USAGE: path is relative to working directory. offset and limit are optional.
    Output is capped at 500 lines.`;

export const createReadTool = (cwd: string) =>
  tool({
    description: DESCRIPTION,
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
