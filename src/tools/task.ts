import {
  ToolLoopAgent,
  stepCountIs,
  tool,
  type LanguageModel,
  type ModelMessage,
  type PrepareStepResult,
  type StepResult,
} from 'ai';
import { z } from 'zod';
import type { Sandbox } from '../sandbox';
import type { createReadTool } from './read';
import type { createGrepTool } from './grep';

type ParentTools = {
  read: ReturnType<typeof createReadTool>;
  grep: ReturnType<typeof createGrepTool>;
};

const MAX_EXPLORERS = 3;
const MAX_EXPLORER_STEPS = 8;
const FINAL_STEP_PROMPT =
  'Step limit reached. Do not call tools. Write your final report now from what you have gathered.';

const DESCRIPTION = `
  Delegate research to up to ${MAX_EXPLORERS} read-only subagents that run in parallel.
  WHEN TO USE: investigating a codebase, finding patterns, gathering context
    across many files.
  WHEN NOT TO USE: making changes (the subagents cannot write or run commands).
  DO NOT USE FOR: tasks that need decisions or askUser interactions.
  HOW TO USE:
    - Split the question into independent tasks with non-overlapping scope
      (different directories, modules, or questions).
    - Make each task self-contained: subagents do not see this conversation.
      Include paths, names, what to look for, and what to report.
    - Do not split dependent steps, where one task needs another's answer.
`;

const instructions = (workingDirectory: string) => `
  You are an explorer agent. Investigate and report back concisely. Working directory: ${workingDirectory}
`;

export function createTaskTool(
  sandbox: Sandbox,
  parentTools: ParentTools,
  model: LanguageModel,
) {
  const runExplorer = async (task: string, index: number) => {
    const explorer = new ToolLoopAgent({
      model,
      instructions: instructions(sandbox.workingDirectory),
      tools: { read: parentTools.read, grep: parentTools.grep },
      onStepEnd: (step) => logStep(index, step),
      prepareStep: ({ stepNumber, messages }) =>
        prepareFinalStep(stepNumber, messages),
      stopWhen: stepCountIs(MAX_EXPLORER_STEPS),
    });

    try {
      const { text, steps } = await explorer.generate({ prompt: task });

      return formatResponse(text, steps);
    } catch (e: unknown) {
      return handleError(e);
    }
  };

  return tool({
    description: DESCRIPTION,
    inputSchema: z.object({
      tasks: z
        .array(z.string().describe('Self-contained question for one subagent'))
        .min(1)
        .max(MAX_EXPLORERS)
        .describe('Independent tasks to investigate in parallel'),
    }),
    execute: async ({ tasks }) => {
      const results = await Promise.all(tasks.map(runExplorer));

      return results
        .map((result, i) => `## Explorer ${i + 1}: ${tasks[i]}\n${result}`)
        .join('\n\n');
    },
  });
}

function formatResponse(text: string, steps: StepResult<any>[]) {
  const limitNote =
    steps.length >= MAX_EXPLORER_STEPS ? ', step limit reached' : '';

  return text
    ? `[Explorer: ${steps.length} steps${limitNote}]\n${text}`
    : '(no response from subagent)';
}

function handleError(e: unknown): string {
  return Error.isError(e)
    ? `Subagent error: ${e.message}`
    : `Subagent error: ${e}`;
}

function logStep(index: number, step: StepResult<any>) {
  console.log(
    `\n[Subagent ${index + 1}] Model: ${step.model.modelId} | step: ${step.stepNumber} | input tokens: ${step.usage.inputTokens} | output tokens: ${step.usage.outputTokens}\n`,
  );
}

function prepareFinalStep(
  stepNumber: number,
  messages: ModelMessage[],
): PrepareStepResult<ParentTools> {
  return stepNumber === MAX_EXPLORER_STEPS - 1
    ? {
        toolChoice: 'none',
        activeTools: [],
        messages: [...messages, { role: 'user', content: FINAL_STEP_PROMPT }],
      }
    : {};
}
