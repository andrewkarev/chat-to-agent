import type { Sandbox } from './sandbox';
import { createJustBashSandbox } from './sandbox-just-bash';
import { createLocalSandbox } from './sandbox-local';

export async function createSandbox(
  sandboxType: string,
  cwd: string,
): Promise<Sandbox> {
  switch (sandboxType) {
    case 'just-bash':
      return await createJustBashSandbox(cwd);
    case 'local':
      return createLocalSandbox(cwd);
    default:
      throw new Error(`Unknown sandbox type: ${sandboxType}`);
  }
}
