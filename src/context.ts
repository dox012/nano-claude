import { execSync } from "child_process";

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

// ── Helpers ──

function tryRun<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
