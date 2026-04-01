export { BashTool } from "./bash.js";
export { ReadTool } from "./read.js";
export { WriteTool } from "./write.js";
export { EditTool } from "./edit.js";
export { GlobTool } from "./glob.js";
export { GrepTool } from "./grep.js";

import { BashTool } from "./bash.js";
import { ReadTool } from "./read.js";
import { WriteTool } from "./write.js";
import { EditTool } from "./edit.js";
import { GlobTool } from "./glob.js";
import { GrepTool } from "./grep.js";
import type { Tool } from "../types.js";

export const allTools: Tool[] = [
  BashTool,
  ReadTool,
  WriteTool,
  EditTool,
  GlobTool,
  GrepTool,
];
