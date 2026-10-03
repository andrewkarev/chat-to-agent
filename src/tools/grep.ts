import { tool } from 'ai';
import { z } from 'zod';
import type { Sandbox } from '../sandbox';
import { resolveCap } from './caps';

export type GrepCaps = { maxMatches?: number };

const DEFAULT_GREP_CAPS = {
  fallback: 50,
  max: 500,
};

const description = (maxMatches: number) => `
  Search file contents using regex. Returns matching lines with file paths.

  WHEN TO USE: finding patterns across multiple files, locating function definitions,
    searching for imports, finding TODOs or error messages.

  WHEN NOT TO USE: reading a known file (use read instead).
    Running commands (use bash instead).

  DO NOT USE FOR: reading files (use read), listing directories (use bash),
    modifying files (use edit).

  USAGE: pattern is a regex string. glob filters by file extension.
    Results are capped at ${maxMatches} matches. Files ignored by .gitignore
    (e.g. node_modules) and hidden files are skipped.

  EXAMPLES:
    - Find all TODO comments: pattern "TODO" glob "*.ts"
    - Find function definitions: pattern "function \\w+" glob "*.ts"
    - Find imports of a package: pattern "from 'express'" glob "*.ts"
  `;

const filePath = (line: string) => line.match(/^(.*?):\d+:/)?.[1] ?? line;

export function createGrepTool(sandbox: Sandbox, caps: GrepCaps = {}) {
  const maxMatches = resolveCap(
    'maxMatches',
    caps.maxMatches,
    DEFAULT_GREP_CAPS,
  );

  return tool({
    description: description(maxMatches),
    inputSchema: z.object({
      pattern: z.string().describe('Regex pattern to search for'),
      path: z
        .string()
        .optional()
        .describe('Directory to search (default: working dir)'),
      glob: z.string().optional().describe("File glob filter, e.g. '*.ts'"),
    }),
    execute: async ({ pattern, path: searchPath, glob: globFilter }) => {
      const { stdout, exitCode } = await sandbox.exec([
        sandbox.bin.rg,
        '--line-number',
        '--with-filename',
        ...(globFilter ? ['--glob', globFilter] : []),
        '-e',
        pattern,
        searchPath?.startsWith('-') ? `./${searchPath}` : searchPath || '.',
      ]);

      // rg: 0 = matches, 1 = no matches, 2 = error (bad regex, missing path)
      if (exitCode === 2) {
        return `Error: ${stdout.trim()}`;
      }

      const lines = stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => line.replace(/^\.\//, ''))
        .sort((a, b) => filePath(a).localeCompare(filePath(b)));

      return truncateMatches(lines, maxMatches);
    },
  });
}

function truncateMatches(matches: string[], maxMatches: number) {
  return matches.length > maxMatches
    ? matches.slice(0, maxMatches).join('\n') +
        `\n... (${matches.length} total, showing first ${maxMatches})`
    : matches.join('\n') || 'No matches found.';
}
