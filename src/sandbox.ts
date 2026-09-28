export interface Sandbox {
  type: string;
  workingDirectory: string;
  bin: { rg: string };
  readFile(path: string): Promise<string>;
  exec(
    command: string | string[],
  ): Promise<{ stdout: string; exitCode: number }>;
  stop(): Promise<void>;
  expiresAt?: number;
  snapshot?(): Promise<{ snapshotId: string }>;
}
