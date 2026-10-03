import type { SandboxLifecycle } from './sandbox';

export function createLifecycle(): SandboxLifecycle {
  return {
    afterStart: async (sb) => {
      console.info(`[lifecycle]: ${sb.type} sandbox started`);
    },
    beforeStop: async (sb) => {
      const { stdout, exitCode } = await sb.exec('git status --porcelain');

      if (exitCode === 0 && stdout.trim()) {
        console.warn(`[lifecycle]: Uncommitted changes left:\n${stdout}`);
      }

      console.info(`[lifecycle]: ${sb.type} sandbox stopping`);
    },
  };
}
