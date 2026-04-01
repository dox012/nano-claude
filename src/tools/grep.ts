import { execSync } from "child_process";
import path from "path";
import type { Tool } from "../types.js";

export const GrepTool: Tool = {
  name: "Grep",
  description:
    "Search file contents using ripgrep (rg). Supports regex patterns, file type filtering, " +
    "and context lines. Falls back to grep if rg is not installed.",
  inputSchema: {
    type: "object" as const,
    properties: {
      pattern: {
        type: "string",
        description: "Regex pattern to search for",
      },
      path: {
        type: "string",
        description: "File or directory to search in (default: cwd)",
      },
      glob: {
        type: "string",
        description: "Glob to filter files (e.g. '*.ts')",
      },
      include: {
        type: "string",
        description: "File extension filter (e.g. 'ts', 'py')",
      },
    },
    required: ["pattern"],
  },

  async call(input) {
    const pattern = input.pattern as string;
    const searchPath = path.resolve((input.path as string) || process.cwd());
    const glob = input.glob as string | undefined;
    const include = input.include as string | undefined;

    // Try rg first, fall back to grep
    const args: string[] = [
      "--hidden",
      "--glob=!.git",
      "--glob=!node_modules",
      "-n", // line numbers
      "--max-columns=500",
      "--max-count=100",
    ];

    if (glob) args.push(`--glob=${glob}`);
    if (include) args.push(`--type=${include}`);

    // Escape pattern for shell
    const escaped = pattern.replace(/'/g, "'\\''");
    const cmd = `rg ${args.join(" ")} '${escaped}' '${searchPath}'`;

    try {
      const output = execSync(cmd, {
        encoding: "utf-8",
        timeout: 30_000,
        maxBuffer: 5 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const lines = output.trim().split("\n");
      if (lines.length > 200) {
        return lines.slice(0, 200).join("\n") + `\n\n(${lines.length} total matches, showing first 200)`;
      }
      return output.trim() || "No matches found.";
    } catch (err: any) {
      if (err.status === 1) return "No matches found.";
      // rg not found, try grep
      if (err.message?.includes("ENOENT") || err.message?.includes("not found")) {
        try {
          const grepCmd = `grep -rn --include='${glob || "*"}' '${escaped}' '${searchPath}' | head -200`;
          const output = execSync(grepCmd, {
            encoding: "utf-8",
            timeout: 30_000,
          });
          return output.trim() || "No matches found.";
        } catch {
          return "No matches found.";
        }
      }
      return `Search error: ${err.message || err}`;
    }
  },
};
