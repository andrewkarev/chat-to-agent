import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { ToolLoopAgent, stepCountIs } from 'ai';
import { buildSystemPrompt } from './src/system';
import { writeTrace } from './src/trace';
import { createLocalSandbox } from './src/sandbox-local';
import { createJustBashSandbox } from './src/sandbox-just-bash';
import {
  createBashTool,
  createApproval,
  createReadTool,
  createGrepTool,
} from './src/tools';

const cwd = process.argv[2] || process.cwd();
const sandboxType = process.env.SANDBOX || 'local';

const sandbox =
  sandboxType === 'just-bash'
    ? await createJustBashSandbox(cwd)
    : createLocalSandbox(cwd);

console.info(`Sandbox: ${sandbox.type}\n`);

const tools = {
  read: createReadTool(sandbox),
  grep: createGrepTool(sandbox),
  bash: createBashTool(sandbox, createApproval({ mode: 'interactive' })),
};

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

const projectContext = await sandbox
  .readFile('AGENTS.md')
  .catch(() => undefined);

const instructions = buildSystemPrompt({
  workingDirectory: sandbox.workingDirectory,
  sandboxType: sandbox.type,
  toolNames: Object.keys(tools),
  projectContext,
});

const agent = new ToolLoopAgent({
  model,
  instructions,
  tools,
  stopWhen: stepCountIs(25),
});

const prompt = process.argv.slice(3).join(' ') || 'Hello!';
const response = await agent.generate({ prompt });

await writeTrace('response.json', instructions, response.steps);

console.log(response.text);
console.log(`\n(${response.steps.length} steps)`);
