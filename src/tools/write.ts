import fs from "fs";
import path from "path";
import type { Tool } from "../types.js";

export const WriteTool: Tool = {
  name: "Write",
  description:
    "Create a new file or completely overwrite an existing file. " +
    "Use Edit tool instead for partial modifications to existing files.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description: "Absolute path to the file to write",
      },
      content: {
        type: "string",
        description: "The content to write to the file",
      },
    },
    required: ["file_path", "content"],
  },

  async call(input) {
    const filePath = path.resolve(input.file_path as string);
    const content = input.content as string;

    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const existed = fs.existsSync(filePath);
    fs.writeFileSync(filePath, content, "utf-8");

    const lines = content.split("\n").length;
    return existed
      ? `File overwritten: ${filePath} (${lines} lines)`
      : `File created: ${filePath} (${lines} lines)`;
  },
};
