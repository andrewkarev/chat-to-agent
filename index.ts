import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { ToolLoopAgent, stepCountIs } from 'ai';
import { createTools } from './tools';

const client = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const DEFAULT_MODEL = 'inclusionai/ling-3.0-flash-sante:free';

const MODELS = [
  'qwen/qwen3.8-27b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'google/gemma-4-31b-it:free',
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

const agent = new ToolLoopAgent({
  model,
  instructions: `You are a coding agent.\nWorking directory: ${cwd}`,
  tools: createTools(cwd),
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
