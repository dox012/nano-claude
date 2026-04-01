import fs from "fs";
import path from "path";
import chalk from "chalk";

// ── Persistent memory stored in ~/.nano-claude/memory/ ──

const MEMORY_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".nano-claude",
  "memory"
);

function ensureDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

// ── Save a memory entry ──

export function saveMemory(key: string, content: string): void {
  ensureDir();
  const sanitized = key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const filePath = path.join(MEMORY_DIR, `${sanitized}.md`);
  const entry = `---\nkey: ${key}\ndate: ${new Date().toISOString()}\n---\n\n${content}\n`;
  fs.writeFileSync(filePath, entry, "utf-8");
}

// ── Load all memories ──

export function loadAllMemories(): string {
  ensureDir();
  const files = fs.readdirSync(MEMORY_DIR).filter((f) => f.endsWith(".md"));
  if (files.length === 0) return "";

  const parts: string[] = [];
  for (const f of files) {
    const content = fs.readFileSync(path.join(MEMORY_DIR, f), "utf-8");
    parts.push(content.trim());
  }
  return parts.join("\n\n---\n\n");
}

// ── Delete a memory ──

export function deleteMemory(key: string): boolean {
  const sanitized = key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const filePath = path.join(MEMORY_DIR, `${sanitized}.md`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

// ── List memories ──

export function listMemories(): string[] {
  ensureDir();
  return fs
    .readdirSync(MEMORY_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

// ── Print memory list ──

export function printMemories() {
  const keys = listMemories();
  if (keys.length === 0) {
    console.log(chalk.dim("  No saved memories."));
    return;
  }
  console.log(chalk.cyan("\nMemories:"));
  for (const k of keys) {
    console.log(chalk.dim(`  • ${k}`));
  }
}
