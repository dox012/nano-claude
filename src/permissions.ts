import type readline from "readline";
import chalk from "chalk";

// ── Bash command risk classification ──
//
// Two-tier risk model inspired by Claude Code's permission system:
// - "write" = modifies state but is reversible (git commit, npm install, rm file)
//   → asks for user confirmation with a yellow warning
// - "destructive" = hard or impossible to reverse (rm -rf, git reset --hard, DROP TABLE)
//   → asks with a red warning, should make the user think twice
// - "safe" = read-only commands (ls, cat, grep) → no confirmation needed
//
// The classification is intentionally conservative: `rm` alone is "write" because
// single-file deletion is recoverable, but `rm -rf` is "destructive" because
// recursive force-deletion can wipe entire directories.

export type RiskLevel = "safe" | "write" | "destructive";

const DESTRUCTIVE_PATTERNS = [
  /\brm\s+(-[rRf]+\s+|.*--no-preserve-root)/,  // rm -rf
  /\brm\s+-[a-zA-Z]*[rR]/,                      // rm -r variants
  /\bgit\s+(reset\s+--hard|clean\s+-[a-zA-Z]*f|push\s+.*--force|checkout\s+--\s+\.)/, // destructive git
  /\bgit\s+branch\s+-[dD]\b/,                    // delete branch
  /\b(drop\s+table|drop\s+database|truncate)\b/i, // SQL destructive
  /\bkill\s+-9\b/,                                // force kill
  /\bmkfs\b/,                                     // format filesystem
  /\bdd\s+/,                                      // raw disk write
  />\s*\/dev\/sd/,                                 // write to disk device
  /\bchmod\s+777\b/,                              // overly permissive
  /\bsudo\s+rm\b/,                                // sudo rm
  /\bcurl\b.*\|\s*(bash|sh)\b/,                   // pipe to shell
];

const WRITE_PATTERNS = [
  /\bgit\s+(add|commit|push|merge|rebase|stash|checkout|switch|branch)\b/,
  /\b(npm|yarn|pnpm)\s+(install|uninstall|update|publish)\b/,
  /\bpip\s+install\b/,
  /\bmkdir\b/,
  /\btouch\b/,
  /\bmv\b/,
  /\bcp\b/,
  /\brm\b/,     // plain rm (not -rf) is write, not destructive
  /\bchmod\b/,
  /\bchown\b/,
  />\s*\S/,     // redirect to file
  /\bsed\s+-i\b/,
  /\btee\b/,
  /\bdocker\s+(run|build|push|rm|stop|kill)\b/,
  /\bkubectl\s+(apply|delete|create|patch)\b/,
];

export function classifyBashRisk(command: string): RiskLevel {
  for (const p of DESTRUCTIVE_PATTERNS) {
    if (p.test(command)) return "destructive";
  }
  for (const p of WRITE_PATTERNS) {
    if (p.test(command)) return "write";
  }
  return "safe";
}

// ── Tool risk classification ──

export function classifyToolRisk(toolName: string, input: Record<string, unknown>): RiskLevel {
  switch (toolName) {
    case "Bash":
      return classifyBashRisk(String(input.command || ""));
    case "Write":
      return "write";
    case "Edit":
      return "write";
    default:
      return "safe"; // Read, Glob, Grep are safe
  }
}

// ── Permission prompt ──

export async function askPermission(
  rl: readline.Interface,
  toolName: string,
  input: Record<string, unknown>,
  risk: RiskLevel
): Promise<boolean> {
  if (risk === "safe") return true;

  const riskLabel =
    risk === "destructive"
      ? chalk.bgRed.white.bold(" DESTRUCTIVE ")
      : chalk.bgYellow.black(" WRITE ");

  let detail = "";
  if (toolName === "Bash") {
    detail = String(input.command || "");
  } else if (toolName === "Write") {
    detail = String(input.file_path || "");
  } else if (toolName === "Edit") {
    detail = String(input.file_path || "");
  }

  const short = detail.length > 100 ? detail.slice(0, 97) + "..." : detail;

  console.log(
    `\n  ${riskLabel} ${chalk.yellow(toolName)}: ${chalk.dim(short)}`
  );

  const answer = await new Promise<string>((resolve) => {
    rl.question(`  Allow? (${chalk.green("y")}es / ${chalk.red("n")}o / ${chalk.cyan("a")}lways): `, resolve);
  });
  const choice = answer.trim().toLowerCase();
  return choice === "y" || choice === "yes" || choice === "a" || choice === "always";
}
