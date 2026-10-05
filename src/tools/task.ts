import {
  ToolLoopAgent,
  stepCountIs,
  tool,
  type LanguageModel,
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

const DESCRIPTION = `
  Delegate research to a read-only subagent.
  WHEN TO USE: investigating a codebase, finding patterns, gathering context
    across many files.
  WHEN NOT TO USE: making changes (the subagent cannot write or run commands).
  DO NOT USE FOR: tasks that need decisions or askUser interactions.
`;

const instructions = (workingDirectory: string) => `
  You are an explorer agent. Investigate and report back concisely. Working directory: ${workingDirectory}
`;

export function createTaskTool(
  sandbox: Sandbox,
  parentTools: ParentTools,
  model: LanguageModel,
) {
  return tool({
    description: DESCRIPTION,
    inputSchema: z.object({
      taskDescription: z
        .string()
        .describe('What the subagent should investigate'),
    }),
    execute: async ({ taskDescription }) => {
      const explorer = new ToolLoopAgent({
        model,
        instructions: instructions(sandbox.workingDirectory),
        tools: { read: parentTools.read, grep: parentTools.grep },
        onStepEnd: logStep,
        stopWhen: stepCountIs(5),
      });

      try {
        const { text, steps } = await explorer.generate({
          prompt: taskDescription,
        });

        return formatResponse(text, steps);
      } catch (e: unknown) {
        return handleError(e);
      }
    },
  });
}

function formatResponse(text: string, steps: StepResult<any>[]) {
  return text
    ? `[Explorer: ${steps.length} steps]\n${text}`
    : '(no response from subagent)';
}

function handleError(e: unknown): string {
  return Error.isError(e)
    ? `Subagent error: ${e.message}`
    : `Subagent error: ${e}`;
}

function logStep(step: StepResult<any>) {
  console.log(
    `\n[Subagent] Model: ${step.model.modelId} | step: ${step.stepNumber} | input tokens: ${step.usage.inputTokens} | output tokens: ${step.usage.outputTokens}\n`,
  );
}
