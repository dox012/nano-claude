import fs from "fs";
import path from "path";
import type { Tool } from "../types.js";

export const ReadTool: Tool = {
  name: "Read",
  description:
    "Read a file from the local filesystem. Returns content with line numbers. " +
    "Supports offset/limit for reading portions of large files.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description: "Absolute path to the file to read",
      },
      offset: {
        type: "number",
        description: "Line number to start reading from (0-based)",
      },
      limit: {
        type: "number",
        description: "Number of lines to read (default: 2000)",
      },
    },
    required: ["file_path"],
  },

  async call(input) {
    const filePath = path.resolve(input.file_path as string);
    const offset = (input.offset as number) || 0;
    const limit = (input.limit as number) || 2000;

    if (!fs.existsSync(filePath)) {
      return `Error: File not found: ${filePath}`;
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      return `Error: ${filePath} is a directory, not a file. Use Bash with 'ls' to list directory contents.`;
    }

    // Refuse huge files without offset/limit
    if (stat.size > 5 * 1024 * 1024 && !input.offset && !input.limit) {
      return `Error: File is ${(stat.size / 1024 / 1024).toFixed(1)}MB. Use offset/limit to read a portion.`;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const total = lines.length;
    const sliced = lines.slice(offset, offset + limit);

    const numbered = sliced
      .map((line, i) => `${offset + i + 1}\t${line}`)
      .join("\n");

    let result = numbered;
    if (offset + limit < total) {
      result += `\n\n(Showing lines ${offset + 1}-${offset + sliced.length} of ${total} total)`;
    }
    return result;
  },
};
