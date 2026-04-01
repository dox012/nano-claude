import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// ── Git context ──

export function getGitContext(): string {
  try {
    const run = (cmd: string) =>
      execSync(cmd, { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }).trim();

    const branch = tryRun(() => run("git branch --show-current")) || "unknown";
    const userName = tryRun(() => run("git config user.name")) || "unknown";
    const status = tryRun(() => run("git status --short")) || "(clean)";
    const log = tryRun(() => run("git log --oneline -5 2>/dev/null")) || "(no commits)";

    return [
      `Current branch: ${branch}`,
      `Git user: ${userName}`,
      "",
      "Status:",
      status || "(clean)",
      "",
      "Recent commits:",
      log,
    ].join("\n");
  } catch {
    return "(not a git repository)";
  }
}

// ── Multi-level CLAUDE.md loading ──
// Priority order (all loaded, later ones can override):
//   1. ~/.claude/CLAUDE.md          (user-level defaults)
//   2. <project-root>/CLAUDE.md     (project-level)
//   3. <project-root>/.claude/CLAUDE.md (project-level alt)
//   4. <cwd>/CLAUDE.md              (subdir-level, if different from project root)

export function getClaudeMd(): string {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const cwd = process.cwd();
  const projectRoot = findProjectRoot(cwd);

  const candidates: { path: string; label: string }[] = [];

  // 1. User-level
  if (home) {
    candidates.push({
      path: path.join(home, ".claude", "CLAUDE.md"),
      label: "user (~/.claude/CLAUDE.md)",
    });
  }

  // 2. Project-root level
  if (projectRoot) {
    candidates.push({
      path: path.join(projectRoot, "CLAUDE.md"),
      label: `project (${path.relative(cwd, projectRoot) || "."}/)`,
    });
    candidates.push({
      path: path.join(projectRoot, ".claude", "CLAUDE.md"),
      label: `project (${path.relative(cwd, projectRoot) || "."}/.claude/)`,
    });
  }

  // 3. CWD level (if different from project root)
  if (!projectRoot || path.resolve(cwd) !== path.resolve(projectRoot)) {
    candidates.push({
      path: path.join(cwd, "CLAUDE.md"),
      label: "local",
    });
  }

  // Deduplicate by resolved path
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const c of candidates) {
    const resolved = path.resolve(c.path);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (fs.existsSync(resolved)) {
      parts.push(`# [${c.label}]\n${fs.readFileSync(resolved, "utf-8").trim()}`);
    }
  }

  return parts.join("\n\n---\n\n");
}

// ── Find project root (walk up to find .git or package.json) ──

function findProjectRoot(from: string): string | null {
  let dir = path.resolve(from);
  const root = path.parse(dir).root;

  while (dir !== root) {
    if (
      fs.existsSync(path.join(dir, ".git")) ||
      fs.existsSync(path.join(dir, "package.json"))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

// ── Helpers ──

function tryRun<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
