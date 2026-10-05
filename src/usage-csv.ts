import type { GenerateTextStepEndEvent } from 'ai';

const HEADER =
  'call_id,step_number,provider,model_id,input_tokens,cache_read_tokens,cache_write_tokens,output_tokens\n';

export type UsageRow = {
  callId: string;
  stepNumber: number;
  provider: string | undefined;
  modelId: string;
  inputTokens: number | undefined;
  cacheReadTokens: number | undefined;
  cacheWriteTokens: number | undefined;
  outputTokens: number | undefined;
};

export async function appendUsage(path: string, row: UsageRow) {
  const file = Bun.file(path);
  const existing = ((await file.exists()) && (await file.text())) || HEADER;

  const line = [
    row.callId,
    row.stepNumber,
    row.provider,
    row.modelId,
    row.inputTokens,
    row.cacheReadTokens,
    row.cacheWriteTokens,
    row.outputTokens,
  ].join(',');

  await file.write(`${existing}${line}\n`);
}

export function prepareUsageData(step: GenerateTextStepEndEvent): UsageRow {
  const provider = step.providerMetadata?.openrouter?.provider;
  const providerName = typeof provider === 'string' ? provider : undefined;

  return {
    callId: step.callId,
    stepNumber: step.stepNumber,
    provider: providerName,
    modelId: step.response.modelId,
    inputTokens: step.usage.inputTokens,
    cacheReadTokens: step.usage.inputTokenDetails.cacheReadTokens,
    cacheWriteTokens: step.usage.inputTokenDetails.cacheWriteTokens,
    outputTokens: step.usage.outputTokens,
  };
}
