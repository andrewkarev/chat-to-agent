import type { StepResult, ToolSet } from 'ai';

function buildTracePart(part: StepResult<ToolSet>['content'][number]) {
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
}

function buildTrace(steps: StepResult<ToolSet>[]) {
  return steps.map((step) => ({
    stepNumber: step.stepNumber,
    model: step.response.modelId,
    finishReason: step.finishReason,
    rawFinishReason: step.rawFinishReason,
    content: step.content.map(buildTracePart),
  }));
}

export async function writeTrace(
  path: string,
  systemPrompt: string,
  steps: StepResult<ToolSet>[],
) {
  await Bun.write(
    path,
    JSON.stringify({ systemPrompt, steps: buildTrace(steps) }, null, 2),
  );
}
