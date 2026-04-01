import { execSync, exec as execCb } from "child_process";
import type { Tool } from "../types.js";

const MAX_OUTPUT = 50_000; // chars

function truncate(s: string): string {
  if (s.length <= MAX_OUTPUT) return s;
  return (
    s.slice(0, MAX_OUTPUT / 2) +
    "\n\n... [truncated] ...\n\n" +
    s.slice(-MAX_OUTPUT / 2)
  );
}

export const BashTool: Tool = {
  name: "Bash",
  description:
    "Execute a bash command. Use for running shell commands, installing packages, git operations, etc. " +
    "Prefer dedicated tools (Read, Edit, Write, Glob, Grep) over cat/sed/find/grep when possible.",
  inputSchema: {
    type: "object" as const,
    properties: {
      command: {
        type: "string",
        description: "The bash command to execute",
      },
      timeout: {
        type: "number",
        description: "Timeout in milliseconds (default 120000)",
      },
    },
    required: ["command"],
  },

  async call(input) {
    const command = input.command as string;
    const timeout = (input.timeout as number) || 120_000;

    try {
      const stdout = execSync(command, {
        encoding: "utf-8",
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        shell: "bash",
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      });
      return truncate(stdout || "(no output)");
    } catch (err: any) {
      const parts: string[] = [];
      if (err.stdout) parts.push(err.stdout);
      if (err.stderr) parts.push(err.stderr);
      if (err.status !== undefined) parts.push(`Exit code: ${err.status}`);
      if (parts.length === 0) parts.push(err.message || "Command failed");
      return truncate(parts.join("\n"));
    }
  },
};
