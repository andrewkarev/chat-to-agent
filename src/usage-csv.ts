const HEADER = 'call_id,step_number,input_tokens,output_tokens\n';

export type UsageRow = {
  callId: string;
  stepNumber: number;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
};

export async function appendUsage(path: string, row: UsageRow) {
  const file = Bun.file(path);
  const existing = ((await file.exists()) && (await file.text())) || HEADER;

  const line = [
    row.callId,
    row.stepNumber,
    row.inputTokens,
    row.outputTokens,
  ].join(',');

  await file.write(`${existing}${line}\n`);
}
