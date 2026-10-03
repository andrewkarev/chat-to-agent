import { tool } from 'ai';
import { z } from 'zod';
import type { Sandbox } from '../sandbox';
import { resolveCap } from './caps';

export type ReadCaps = { maxLines?: number };

const DEFAULT_READ_CAPS = {
  fallback: 500,
  max: 2000,
};

const description = (maxLines: number) => `
  Read a file from the project. Returns numbered lines.
  
  WHEN TO USE: viewing file contents, checking configurations, reading source code,
    examining specific lines with offset/limit.
  
  WHEN NOT TO USE: searching for patterns across files (use grep instead).
    Running commands (use bash instead).
  
  DO NOT USE FOR: searching code (use grep), executing commands (use bash),
    modifying files (use edit or write).
  
  USAGE: path is relative to working directory. offset and limit are optional.
    Output is capped at ${maxLines} lines.
  `;

export function createReadTool(sandbox: Sandbox, caps: ReadCaps = {}) {
  const maxLines = resolveCap('maxLines', caps.maxLines, DEFAULT_READ_CAPS);

  return tool({
    description: description(maxLines),
    inputSchema: z.object({
      path: z.string().describe('File path relative to working directory'),
      offset: z.number().optional().describe('Start line (1-indexed)'),
      limit: z.number().optional().describe('Max lines to return'),
    }),
    execute: async ({ path: filePath, offset, limit }) => {
      const content = await sandbox.readFile(filePath);

      let lines = content.split('\n');

      if (offset) {
        lines = lines.slice(offset - 1);
      }

      if (limit) {
        lines = lines.slice(0, limit);
      }

      const truncated = lines.length > maxLines;

      if (truncated) {
        lines = lines.slice(0, maxLines);
      }

      const numbered = lines.map((l, i) => `${(offset || 1) + i}: ${l}`);

      return truncated
        ? numbered.join('\n') + `\n... (truncated at ${maxLines} lines)`
        : numbered.join('\n');
    },
  });
}
