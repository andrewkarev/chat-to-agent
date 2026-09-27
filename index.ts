import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { ToolLoopAgent, stepCountIs, tool } from 'ai';
import { z } from 'zod';

const client = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const model = client('poolside/laguna-s-2.1:free', {
  extraBody: {
    models: [
      'qwen/qwen3.8-27b:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'google/gemma-4-31b-it:free',
    ],
    provider: {
      allow_fallbacks: true,
    },
  },
});

const cwd = process.argv[2] || process.cwd();

const read = tool({
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

const grep = tool({
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

function isSafe(command: string): boolean {
  return SAFE_PREFIXES.some((p) => command.trim().startsWith(p));
}

const bash = tool({
  description: `Execute a shell command in the working directory.
WHEN TO USE: running build commands, installing packages, running tests,
  git operations, directory listings.
WHEN NOT TO USE: reading file contents (use read instead).
  Searching for patterns (use grep instead).
DO NOT USE FOR: reading files (use read), searching code (use grep).`,
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

const agent = new ToolLoopAgent({
  model,
  instructions: `You are a coding agent.\nWorking directory: ${cwd}`,
  tools: { read, grep, bash },
  stopWhen: stepCountIs(10),
});

const prompt = process.argv.slice(3).join(' ') || 'Hello!';
const response = await agent.generate({ prompt });

const trace = response.steps.map((step) => ({
  stepNumber: step.stepNumber,
  model: step.response.modelId,
  finishReason: step.finishReason,
  content: step.content.map((part) => {
    switch (part.type) {
      case 'reasoning':
        return { type: 'reasoning', text: part.text };
      case 'text':
        return { type: 'text', text: part.text };
      case 'tool-call':
        return {
          type: 'tool-call',
          toolName: part.toolName,
          input: part.input,
        };
      case 'tool-result':
        return { type: 'tool-result', output: part.output };
      default:
        return part;
    }
  }),
}));

await Bun.write('response.json', JSON.stringify(trace, null, 2));

console.log(response.text);
console.log(`\n(${response.steps.length} steps)`);
