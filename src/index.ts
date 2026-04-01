#!/usr/bin/env node

import fs from "fs";
import path from "path";

// Load .env file before anything else
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

import readline from "readline";
import chalk from "chalk";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, streamMessage } from "./api.js";
import { allTools } from "./tools/index.js";
import { initAgentTool } from "./tools/agent.js";
import { buildSystemPrompt } from "./prompt.js";
// buildSystemPrompt is also used in handleCommand for memory updates
import { renderMarkdown } from "./render.js";
import { classifyToolRisk, askPermission } from "./permissions.js";
import { newSessionId, saveSession, loadSession, printSessionList } from "./session.js";
import { smartCompact, shouldAutoCompact, estimateTokens } from "./compact.js";
import { saveMemory, deleteMemory, printMemories } from "./memory.js";
import type { Message, ToolUseBlock, ToolResultBlockParam, Config } from "./types.js";

const VERSION = "0.7.0";

// ── Config ──

const config: Config = {
  model: process.env.ANTHROPIC_MODEL || "ppio/pa/claude-opus-4-6",
  maxTokens: 16384,
  systemPrompt: "", // built at startup
};

// ── State ──

const messages: Message[] = [];
let totalInput = 0;
let totalOutput = 0;
let sessionId = newSessionId();

// ── REPL ──

async function main() {
  config.systemPrompt = buildSystemPrompt();

  const client = createClient(config);

  // Initialize sub-agent tool with client reference
  initAgentTool(client, config.model, config.systemPrompt);

  console.log(
    chalk.bold.cyan("\n  nano-claude") +
      chalk.dim(` v${VERSION}`) +
      chalk.dim(`  (model: ${config.model})`)
  );
  console.log(chalk.dim("  Type your message. /help for commands, Ctrl+C to exit.\n"));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green("You: "),
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Slash commands
    if (input.startsWith("/")) {
      await handleCommand(input, client);
      rl.prompt();
      return;
    }

    // Send to Claude
    messages.push({ role: "user", content: input });

    try {
      await runConversationLoop(client, rl);
    } catch (err: any) {
      console.error(chalk.red(`\nError: ${err.message || err}`));
    }

    // Auto-save session
    saveSession(sessionId, messages, config.model, totalInput, totalOutput);

    console.log(); // blank line
    rl.prompt();
  });

  rl.on("close", () => {
    console.log(chalk.dim("\nBye!"));
    process.exit(0);
  });
}

// ── Core loop: call API, execute tools, repeat ──

async function runConversationLoop(client: ReturnType<typeof createClient>, rl: readline.Interface) {
  const toolMap = new Map(allTools.map((t) => [t.name, t]));

  while (true) {
    // Auto-compact if context is getting large
    if (shouldAutoCompact(messages)) {
      console.log(chalk.yellow("\n  [auto-compact] Context window filling up..."));
      try {
        const { compacted, saved } = await smartCompact(client, config, messages);
        messages.length = 0;
        messages.push(...compacted);
        console.log(chalk.yellow(`  [auto-compact] Saved ${saved} messages`));
      } catch (err: any) {
        console.log(chalk.red(`  [auto-compact failed] ${err.message}`));
      }
    }

    // Buffer streamed text for markdown rendering
    let textBuffer = "";
    process.stdout.write(chalk.blue("\nAssistant: "));

    const response = await streamMessage(
      client,
      config,
      messages,
      allTools,
      (delta) => {
        textBuffer += delta;
        process.stdout.write(delta);
      },
    );

    // Re-render with markdown formatting if there was text output
    if (textBuffer.trim()) {
      // Move cursor up and clear the raw streamed text, replace with rendered
      const rawLines = textBuffer.split("\n").length;
      process.stdout.write("\r\x1b[K"); // clear current line
      for (let i = 0; i < rawLines; i++) {
        process.stdout.write("\x1b[A\x1b[K"); // move up + clear
      }
      console.log(chalk.blue("Assistant:\n") + renderMarkdown(textBuffer));
    }

    totalInput += response.usage.input;
    totalOutput += response.usage.output;

    // Add assistant response to history
    messages.push({ role: "assistant", content: response.content });

    // Find tool_use blocks
    const toolUses = response.content.filter(
      (b): b is ToolUseBlock => b.type === "tool_use"
    );

    if (toolUses.length === 0) break; // model is done

    // Execute tools
    const toolResults: ToolResultBlockParam[] = [];

    for (const tu of toolUses) {
      const tool = toolMap.get(tu.name);
      console.log(
        chalk.dim(`\n  [tool] `) +
          chalk.yellow(tu.name) +
          chalk.dim(` ${formatToolInput(tu)}`)
      );

      if (!tool) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Error: Unknown tool "${tu.name}"`,
          is_error: true,
        });
        continue;
      }

      // Permission check
      const toolInput = tu.input as Record<string, unknown>;
      const risk = classifyToolRisk(tu.name, toolInput);
      if (risk !== "safe") {
        const allowed = await askPermission(rl, tu.name, toolInput, risk);
        if (!allowed) {
          console.log(chalk.red("  [denied]"));
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: "Permission denied by user.",
            is_error: true,
          });
          continue;
        }
      }

      try {
        const result = await tool.call(toolInput);
        const truncated = result.length > 80_000
          ? result.slice(0, 40_000) + "\n...[truncated]...\n" + result.slice(-40_000)
          : result;

        console.log(chalk.dim(`  [result] ${truncated.split("\n").length} lines`));
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: truncated,
        });
      } catch (err: any) {
        const errMsg = err.message || String(err);
        console.log(chalk.red(`  [error] ${errMsg}`));
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Error: ${errMsg}`,
          is_error: true,
        });
      }
    }

    // Push tool results and loop
    messages.push({ role: "user", content: toolResults });
  }
}

// ── Slash commands ──

async function handleCommand(input: string, client: Anthropic) {
  const cmd = input.split(/\s+/)[0]!.toLowerCase();

  switch (cmd) {
    case "/help":
      console.log(chalk.cyan("\nCommands:"));
      console.log("  /help      Show this help");
      console.log("  /cost      Show token usage");
      console.log("  /clear     Clear conversation history");
      console.log("  /compact   Summarize conversation to save context");
      console.log("  /model     Show or change model");
      console.log("  /sessions  List saved sessions");
      console.log("  /resume    Resume a saved session");
      console.log("  /remember  Save a memory (/remember key: content)");
      console.log("  /forget    Delete a memory (/forget key)");
      console.log("  /memory    List saved memories");
      break;

    case "/cost":
      console.log(chalk.cyan(`\nTokens: ${totalInput} in / ${totalOutput} out`));
      console.log(chalk.dim(`Messages: ${messages.length}`));
      break;

    case "/clear":
      messages.length = 0;
      totalInput = 0;
      totalOutput = 0;
      console.log(chalk.yellow("Conversation cleared."));
      break;

    case "/compact": {
      const msgCount = messages.length;
      if (msgCount <= 4) {
        console.log(chalk.dim("Nothing to compact."));
        break;
      }
      try {
        const { compacted, saved } = await smartCompact(client, config, messages);
        messages.length = 0;
        messages.push(...compacted);
        const tokens = estimateTokens(messages);
        console.log(chalk.yellow(`Compacted: ${msgCount} → ${messages.length} messages (~${tokens} tokens)`));
      } catch (err: any) {
        console.log(chalk.red(`Compact failed: ${err.message}`));
      }
      break;
    }

    case "/model": {
      const arg = input.slice("/model".length).trim();
      if (arg) {
        config.model = arg;
        console.log(chalk.cyan(`Model set to: ${arg}`));
      } else {
        console.log(chalk.cyan(`Current model: ${config.model}`));
      }
      break;
    }

    case "/remember": {
      const body = input.slice("/remember".length).trim();
      const colonIdx = body.indexOf(":");
      if (!body || colonIdx === -1) {
        console.log(chalk.dim("  Usage: /remember key: content"));
        break;
      }
      const key = body.slice(0, colonIdx).trim();
      const content = body.slice(colonIdx + 1).trim();
      saveMemory(key, content);
      console.log(chalk.green(`  Saved memory: ${key}`));
      // Rebuild system prompt with new memory
      config.systemPrompt = buildSystemPrompt();
      break;
    }

    case "/forget": {
      const key = input.slice("/forget".length).trim();
      if (!key) {
        console.log(chalk.dim("  Usage: /forget key"));
        break;
      }
      if (deleteMemory(key)) {
        console.log(chalk.yellow(`  Deleted memory: ${key}`));
        config.systemPrompt = buildSystemPrompt();
      } else {
        console.log(chalk.red(`  Memory not found: ${key}`));
      }
      break;
    }

    case "/memory":
      printMemories();
      break;

    case "/sessions":
      printSessionList();
      break;

    case "/resume": {
      const resumeId = input.slice("/resume".length).trim();
      if (!resumeId) {
        printSessionList();
        break;
      }
      const session = loadSession(resumeId);
      if (!session) {
        console.log(chalk.red(`Session not found: ${resumeId}`));
        break;
      }
      messages.length = 0;
      messages.push(...session.messages);
      totalInput = session.totalInput;
      totalOutput = session.totalOutput;
      sessionId = session.id;
      config.model = session.model;
      console.log(chalk.green(`Resumed session ${resumeId} (${session.messageCount} messages)`));
      break;
    }

    default:
      console.log(chalk.red(`Unknown command: ${cmd}. Type /help for commands.`));
  }
}

// ── Helpers ──

function formatToolInput(tu: ToolUseBlock): string {
  const input = tu.input as Record<string, unknown>;
  // Show first key-value pair as preview
  const keys = Object.keys(input);
  if (keys.length === 0) return "";
  const first = keys[0]!;
  const val = String(input[first] || "");
  const short = val.length > 80 ? val.slice(0, 77) + "..." : val;
  return `${first}=${short}`;
}

// ── Run ──

main().catch((err) => {
  console.error(chalk.red(`Fatal: ${err.message || err}`));
  process.exit(1);
});
