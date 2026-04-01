import fs from "fs";
import path from "path";
import chalk from "chalk";
import type { Message } from "./types.js";

// ── Session storage ──

const SESSION_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".nano-claude",
  "sessions"
);

interface SessionMeta {
  id: string;
  cwd: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  firstMessage: string; // preview
}

interface SessionData extends SessionMeta {
  messages: Message[];
  totalInput: number;
  totalOutput: number;
}

function ensureDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

function sessionPath(id: string): string {
  return path.join(SESSION_DIR, `${id}.json`);
}

// ── Generate session ID ──

export function newSessionId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  const rand = Math.random().toString(36).slice(2, 6);
  return `${date}-${time}-${rand}`;
}

// ── Save session ──

export function saveSession(
  id: string,
  messages: Message[],
  model: string,
  totalInput: number,
  totalOutput: number
): void {
  ensureDir();
  const firstMsg = getFirstUserMessage(messages);

  const data: SessionData = {
    id,
    cwd: process.cwd(),
    model,
    createdAt: fs.existsSync(sessionPath(id))
      ? (JSON.parse(fs.readFileSync(sessionPath(id), "utf-8")) as SessionData).createdAt
      : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: messages.length,
    firstMessage: firstMsg.slice(0, 100),
    messages,
    totalInput,
    totalOutput,
  };

  fs.writeFileSync(sessionPath(id), JSON.stringify(data, null, 2), "utf-8");
}

// ── Load session ──

export function loadSession(id: string): SessionData | null {
  const p = sessionPath(id);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as SessionData;
  } catch {
    return null;
  }
}

// ── List recent sessions ──

export function listSessions(limit = 10): SessionMeta[] {
  ensureDir();
  const files = fs.readdirSync(SESSION_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, limit);

  return files.map((f) => {
    try {
      const data = JSON.parse(
        fs.readFileSync(path.join(SESSION_DIR, f), "utf-8")
      ) as SessionData;
      return {
        id: data.id,
        cwd: data.cwd,
        model: data.model,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        messageCount: data.messageCount,
        firstMessage: data.firstMessage,
      };
    } catch {
      return null;
    }
  }).filter((s): s is SessionMeta => s !== null);
}

// ── Print session list ──

export function printSessionList() {
  const sessions = listSessions();
  if (sessions.length === 0) {
    console.log(chalk.dim("  No saved sessions."));
    return;
  }
  console.log(chalk.cyan("\nRecent sessions:"));
  for (const s of sessions) {
    const date = s.updatedAt.slice(0, 16).replace("T", " ");
    const preview = s.firstMessage.slice(0, 50);
    console.log(
      chalk.dim(`  ${s.id}`) +
        chalk.dim(` (${date})`) +
        chalk.dim(` [${s.messageCount} msgs]`) +
        `  ${preview}`
    );
  }
  console.log(chalk.dim("\n  Use /resume <id> to restore a session."));
}

// ── Helpers ──

function getFirstUserMessage(messages: Message[]): string {
  for (const m of messages) {
    if (m.role === "user" && typeof m.content === "string") return m.content;
  }
  return "(no message)";
}
