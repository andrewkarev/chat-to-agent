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

  if (ctx.toolNames.includes('task')) {
    sections.push(
      withLineBreaks([
        '# Delegation',
        '- For broad questions that span several parts of the codebase, use `task` and investigate the parts in parallel in one call.',
        '- For a narrow lookup (one file, one symbol), use `read` or `grep` directly.',
        '- Treat subagent reports as leads: verify key claims with `read` before relying on them.',
        '- Synthesize the reports into one answer and resolve conflicts between them.',
      ]),
    );
  }

  sections.push(
    withLineBreaks([
      '# Guardrails',
      '- Prefer simple, minimal changes',
      '- Search before creating, and reuse existing patterns',
      '- No new dependencies without asking',
    ]),
  );

  sections.push(
    withLineBreaks([
      '# Verification',
      'After making changes, verify your work:',
      '1. Run `npx tsc --noEmit` when TypeScript is present',
      '2. Run lint, test, or build commands only if they exist in this project and are allowed by the current approval mode',
      '3. Report exactly what you ran, what was blocked, and what was unavailable',
      '4. Do NOT inflate partial verification into a blanket success claim',
      'Do NOT claim "tests pass" without running them.',
      'Scope your claims honestly. "Verification was limited because writes were blocked" is honest.',
      '"All tests pass" when you didn\'t run them is not.',
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
