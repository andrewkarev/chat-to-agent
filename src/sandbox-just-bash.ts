import { Sandbox as JustBashSandbox } from 'just-bash';
import type { Sandbox } from './sandbox';

const MOUNT = '/home/user/project';

export async function createJustBashSandbox(dir: string): Promise<Sandbox> {
  const jb = await JustBashSandbox.create({
    overlayRoot: dir,
    defenseInDepth: false,
  });

  return {
    type: 'just-bash',
    workingDirectory: MOUNT,
    bin: { rg: 'rg' },
    readFile: async (filePath) => {
      const virtualPath = `${MOUNT}/${filePath}`;
      return jb.readFile(virtualPath);
    },
    exec: async (command) => {
      const isCommandsList = Array.isArray(command);
      const [cmd = '', ...args] = isCommandsList ? command : [command];
      const finished = isCommandsList
        ? await jb.runCommand({ cmd, args, cwd: MOUNT })
        : await jb.runCommand(cmd, { cwd: MOUNT });

      return {
        stdout: await finished.output(),
        exitCode: finished.exitCode,
      };
    },
    stop: async () => {
      await jb.stop();
    },
  };
}
