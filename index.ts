import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { ToolLoopAgent, stepCountIs } from 'ai';
import { tools } from './src/tools';
import { buildSystemPrompt } from './src/system';
import { writeTrace } from './src/trace';

const client = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const DEFAULT_MODEL = 'z-ai/glm-5.3-flash';

const MODELS = [
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'poolside/laguna-s-2.1:free',
] as const satisfies string[];

const model = client(DEFAULT_MODEL, {
  extraBody: {
    models: MODELS,
    provider: {
      allow_fallbacks: true,
    },
  },
});

const cwd = process.argv[2] || process.cwd();

const instructions = buildSystemPrompt({
  workingDirectory: cwd,
  sandboxType: 'local',
  toolNames: Object.keys(tools),
});

const agent = new ToolLoopAgent({
  model,
  instructions,
  tools,
  stopWhen: stepCountIs(10),
});

const prompt = process.argv.slice(3).join(' ') || 'Hello!';
const response = await agent.generate({ prompt });

await writeTrace('response.json', instructions, response.steps);

console.log(response.text);
console.log(`\n(${response.steps.length} steps)`);
