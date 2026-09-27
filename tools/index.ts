import { createBashTool } from './bash';
import { createGrepTool } from './grep';
import { createReadTool } from './read';

export const createTools = (cwd: string) => ({
  read: createReadTool(cwd),
  grep: createGrepTool(cwd),
  bash: createBashTool(cwd),
});
