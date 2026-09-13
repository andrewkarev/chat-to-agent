import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { ToolLoopAgent, stepCountIs, tool } from 'ai';
import { z } from 'zod';

const client = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const model = client('poolside/laguna-s-2.1:free', {
  extraBody: {
    models: [
      'poolside/laguna-s-2.1:free',
      'nex-agi/nex-n2.5-pro:free',
      'inclusionai/ling-3.0-flash-vl:free',
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
WHEN NOT TO USE: searching across files (use grep instead).`,
  inputSchema: z.object({
    path: z.string().describe('File path relative to working directory'),
    offset: z.number().optional().describe('Start line (1-indexed)'),
    limit: z.number().optional().describe('Max lines to return'),
  }),
  execute: async ({ path: filePath, offset, limit }) => {
    console.log({ filePath, offset, limit });
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

const agent = new ToolLoopAgent({
  model,
  instructions: `You are a coding agent.\nWorking directory: ${cwd}`,
  tools: { read },
  stopWhen: stepCountIs(10),
});

const prompt = process.argv.slice(3).join(' ') || 'Hello!';
const response = await agent.generate({ prompt });

Bun.write('response.json', JSON.stringify({ response }, null, 2));

console.log(response.text);
console.log(`\n(${response.steps.length} steps)`);
