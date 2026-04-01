import fs from "fs";
import path from "path";
import type { Tool } from "../types.js";

export const EditTool: Tool = {
  name: "Edit",
  description:
    "Edit an existing file by replacing an exact string match with new content. " +
    "The old_string must be unique in the file unless replace_all is true. " +
    "Read the file first before editing.",
  inputSchema: {
    type: "object" as const,
    properties: {
      file_path: {
        type: "string",
        description: "Absolute path to the file to modify",
      },
      old_string: {
        type: "string",
        description: "The exact text to replace",
      },
      new_string: {
        type: "string",
        description: "The replacement text",
      },
      replace_all: {
        type: "boolean",
        description: "Replace all occurrences (default: false)",
        default: false,
      },
    },
    required: ["file_path", "old_string", "new_string"],
  },

  async call(input) {
    const filePath = path.resolve(input.file_path as string);
    const oldStr = input.old_string as string;
    const newStr = input.new_string as string;
    const replaceAll = (input.replace_all as boolean) || false;

    if (!fs.existsSync(filePath)) {
      return `Error: File not found: ${filePath}`;
    }

    if (oldStr === newStr) {
      return "Error: old_string and new_string are identical";
    }

    const content = fs.readFileSync(filePath, "utf-8");

    if (!content.includes(oldStr)) {
      // Try to help: show nearby content
      return `Error: old_string not found in ${filePath}. Make sure the string matches exactly (including whitespace and indentation).`;
    }

    if (!replaceAll) {
      // Check uniqueness
      const count = content.split(oldStr).length - 1;
      if (count > 1) {
        return `Error: old_string appears ${count} times in the file. Use replace_all: true or provide more context to make it unique.`;
      }
    }

    const updated = replaceAll
      ? content.split(oldStr).join(newStr)
      : content.replace(oldStr, newStr);

    fs.writeFileSync(filePath, updated, "utf-8");

    const replacements = replaceAll
      ? content.split(oldStr).length - 1
      : 1;
    return `Edited ${filePath}: ${replacements} replacement(s) made`;
  },
};
