interface PromptContext {
  workingDirectory: string;
  sandboxType: string;
  toolNames: string[];
  gitBranch?: string;
  projectContext?: string;
}

function withLineBreaks(lines: string[]): string {
  return lines.join('\n');
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const sections: string[] = [];

  sections.push(
    withLineBreaks([
      `You are a coding agent working in: ${ctx.workingDirectory}`,
      `Sandbox: ${ctx.sandboxType}`,
    ]),
  );

  const agency = [
    '# Agency',
    '- USE your tools. Read files, search code, run commands, then answer.',
    '- Do NOT explain what you WOULD do. Actually do it.',
    `- Available tools: ${ctx.toolNames.join(', ')}`,
  ];

  if (ctx.gitBranch) {
    agency.push(`- Current branch: ${ctx.gitBranch}`);
  }

  sections.push(withLineBreaks(agency));

  sections.push(
    withLineBreaks([
      '# Guardrails',
      '- Prefer simple, minimal changes',
      '- Search before creating, and reuse existing patterns',
      '- No new dependencies without asking',
    ]),
  );

  if (ctx.projectContext) {
    sections.push(
      withLineBreaks([
        '# Project Instructions (from AGENTS.md)',
        ctx.projectContext,
      ]),
    );
  }

  return withLineBreaks(sections);
}
