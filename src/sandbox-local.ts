import { rgPath } from '@vscode/ripgrep';
import type { Sandbox } from './sandbox';

export function createLocalSandbox(dir: string): Sandbox {
  return {
    type: 'local',
    workingDirectory: dir,
    bin: { rg: rgPath },
    readFile: async (filePath) => {
      const file = Bun.file(new URL(filePath, Bun.pathToFileURL(`${dir}/`)));
      return await file.text();
    },
    exec: async (command) => {
      try {
        const proc = Bun.spawn({
          cmd: Array.isArray(command) ? command : ['sh', '-c', command],
          cwd: dir,
          stdout: 'pipe',
          stderr: 'pipe',
          timeout: 30_000,
        });

        const [stdout, stderr] = await Promise.all([
          proc.stdout.text(),
          proc.stderr.text(),
        ]);

        const exitCode = await proc.exited;

        return {
          stdout: stdout || stderr,
          exitCode,
        };
      } catch (e: any) {
        return {
          stdout: e.stdout || e.stderr || e.message || '',
          exitCode: e.status ?? 1,
        };
      }
    },
    stop: async () => {},
  };
}
