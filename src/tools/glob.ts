import fg from "fast-glob";
import path from "path";
import type { Tool } from "../types.js";

export const GlobTool: Tool = {
  name: "Glob",
  description:
    "Find files by glob pattern. Returns matching file paths. " +
    "Use for finding files by name or extension (e.g. '**/*.ts', 'src/**/*.test.js').",
  inputSchema: {
    type: "object" as const,
    properties: {
      pattern: {
        type: "string",
        description: "Glob pattern to match (e.g. '**/*.ts')",
      },
      path: {
        type: "string",
        description: "Directory to search in (default: cwd)",
      },
    },
    required: ["pattern"],
  },

  async call(input) {
    const pattern = input.pattern as string;
    const searchPath = (input.path as string) || process.cwd();
    const cwd = path.resolve(searchPath);

    const files = await fg(pattern, {
      cwd,
      dot: true,
      ignore: ["**/node_modules/**", "**/.git/**"],
      onlyFiles: true,
      absolute: false,
    });

    if (files.length === 0) {
      return `No files found matching: ${pattern}`;
    }

    const MAX = 200;
    const truncated = files.length > MAX;
    const shown = files.slice(0, MAX);

    let result = shown.join("\n");
    if (truncated) {
      result += `\n\n(${files.length} total, showing first ${MAX})`;
    } else {
      result += `\n\n(${files.length} files)`;
    }
    return result;
  },
};
