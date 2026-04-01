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
import { newSessionId, saveSession, loadSession, listSessions, printSessionList } from "./session.js";
import { smartCompact, shouldAutoCompact, estimateTokens } from "./compact.js";
import { saveMemory, deleteMemory, printMemories } from "./memory.js";
import type { Message, ToolUseBlock, ToolResultBlockParam, Config } from "./types.js";

const VERSION = "1.2.0";

// ── CLI argument parsing ──

interface CliArgs {
  print: boolean;         // -p, --print: non-interactive mode
  continue_: boolean;     // -c, --continue: resume most recent session
  resume?: string;        // -r, --resume <id>: resume specific session
  model?: string;         // -m, --model <model>: model override
  maxTurns?: number;      // --max-turns <n>: max agentic turns (with --print)
  prompt?: string;        // positional: inline prompt
  dangerouslySkipPermissions: boolean; // --dangerously-skip-permissions
  help: boolean;          // -h, --help
  version: boolean;       // -v, --version
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { print: false, continue_: false, dangerouslySkipPermissions: false, help: false, version: false };
  const positional: string[] = [];
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i]!;
    switch (arg) {
      case "-p": case "--print":
        args.print = true; break;
      case "-c": case "--continue":
        args.continue_ = true; break;
      case "-r": case "--resume":
        args.resume = argv[++i]; break;
      case "-m": case "--model":
        args.model = argv[++i]; break;
      case "--max-turns":
        args.maxTurns = parseInt(argv[++i] || "0", 10); break;
      case "--dangerously-skip-permissions":
        args.dangerouslySkipPermissions = true; break;
      case "-h": case "--help":
        args.help = true; break;
      case "-v": case "--version":
        args.version = true; break;
      default:
        if (arg.startsWith("-")) {
          console.error(chalk.red(`Unknown flag: ${arg}`));
          process.exit(1);
        }
        positional.push(arg);
    }
    i++;
  }

  if (positional.length > 0) args.prompt = positional.join(" ");
  return args;
}

function printHelp() {
  console.log(`
${chalk.bold.cyan("nano-claude")} ${chalk.dim(`v${VERSION}`)} — lightweight Claude Code reimplementation

${chalk.bold("Usage:")}
  nano-claude [options] [prompt]

${chalk.bold("Options:")}
  -p, --print          Non-interactive mode (output text only, then exit)
  -c, --continue       Continue most recent conversation
  -r, --resume <id>    Resume a specific session by ID
  -m, --model <model>  Override the model name
  --max-turns <n>      Maximum agentic turns (default: unlimited, useful with -p)
  --dangerously-skip-permissions  Skip all permission prompts (use with caution)
  -h, --help           Show this help
  -v, --version        Show version

${chalk.bold("Examples:")}
  nano-claude                          # interactive REPL
  nano-claude "explain this project"   # interactive with initial prompt
  nano-claude -p "list all TODOs"      # non-interactive, print result and exit
  nano-claude -c                       # continue last conversation
  nano-claude -r 20250401-120000-ab12  # resume specific session
  nano-claude -m claude-sonnet-4-20250514 "hello"

${chalk.bold("Environment:")}
  ANTHROPIC_API_KEY      API key (or set in .env)
  ANTHROPIC_BASE_URL     API base URL for proxies
  ANTHROPIC_MODEL        Default model name
`);
}

const cliArgs = parseArgs(process.argv.slice(2));

// ── Config ──

const config: Config = {
  model: cliArgs.model || process.env.ANTHROPIC_MODEL || "ppio/pa/claude-opus-4-6",
  maxTokens: 16384,
  systemPrompt: "", // built at startup
};

// ── State ──

const messages: Message[] = [];
let totalInput = 0;
let totalOutput = 0;
let sessionId = newSessionId();
let maxTurns = cliArgs.maxTurns ?? Infinity;

// ── REPL ──

async function main() {
  // Handle --help and --version early
  if (cliArgs.help) { printHelp(); process.exit(0); }
  if (cliArgs.version) { console.log(VERSION); process.exit(0); }

  config.systemPrompt = buildSystemPrompt();
  const client = createClient(config);

  // Initialize sub-agent tool with client reference
  initAgentTool(client, config.model, config.systemPrompt);

  // Handle --continue: load most recent session
  if (cliArgs.continue_) {
    const sessions = listSessions(1);
    if (sessions.length > 0) {
      const session = loadSession(sessions[0]!.id);
      if (session) {
        messages.push(...session.messages);
        totalInput = session.totalInput;
        totalOutput = session.totalOutput;
        sessionId = session.id;
        config.model = cliArgs.model || session.model;
        if (!cliArgs.print) {
          console.log(chalk.green(`  Resumed session ${session.id} (${session.messageCount} messages)`));
        }
      }
    } else if (!cliArgs.print) {
      console.log(chalk.dim("  No sessions to continue."));
    }
  }

  // Handle --resume <id>
  if (cliArgs.resume) {
    const session = loadSession(cliArgs.resume);
    if (!session) {
      console.error(chalk.red(`Session not found: ${cliArgs.resume}`));
      process.exit(1);
    }
    messages.push(...session.messages);
    totalInput = session.totalInput;
    totalOutput = session.totalOutput;
    sessionId = session.id;
    config.model = cliArgs.model || session.model;
    if (!cliArgs.print) {
      console.log(chalk.green(`  Resumed session ${session.id} (${session.messageCount} messages)`));
    }
  }

  // ── Print mode (non-interactive) ──
  if (cliArgs.print) {
    if (!cliArgs.prompt && !cliArgs.continue_ && !cliArgs.resume) {
      console.error(chalk.red("Error: --print requires a prompt or --continue/--resume"));
      process.exit(1);
    }
    if (cliArgs.prompt) {
      messages.push({ role: "user", content: cliArgs.prompt });
    }
    try {
      await runConversationLoop(client);
    } catch (err: any) {
      console.error(err.message || err);
      process.exit(1);
    }
    saveSession(sessionId, messages, config.model, totalInput, totalOutput);
    process.exit(0);
  }

  // ── Interactive REPL ──
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

  // If there's an inline prompt, send it immediately
  if (cliArgs.prompt) {
    console.log(chalk.green("You: ") + cliArgs.prompt);
    messages.push({ role: "user", content: cliArgs.prompt });
    try {
      await runConversationLoop(client);
    } catch (err: any) {
      console.error(chalk.red(`\nError: ${err.message || err}`));
    }
    saveSession(sessionId, messages, config.model, totalInput, totalOutput);
    console.log();
  }

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

async function runConversationLoop(client: ReturnType<typeof createClient>, rl?: readline.Interface) {
  const toolMap = new Map(allTools.map((t) => [t.name, t]));
  let turns = 0;

  while (true) {
    if (turns >= maxTurns) {
      if (!cliArgs.print) console.log(chalk.yellow(`\n  [max-turns] Reached limit of ${maxTurns}`));
      break;
    }
    turns++;
    // Auto-compact if context is getting large
    if (shouldAutoCompact(messages)) {
      if (!cliArgs.print) console.log(chalk.yellow("\n  [auto-compact] Context window filling up..."));
      try {
        const { compacted, saved } = await smartCompact(client, config, messages);
        messages.length = 0;
        messages.push(...compacted);
        if (!cliArgs.print) console.log(chalk.yellow(`  [auto-compact] Saved ${saved} messages`));
      } catch (err: any) {
        if (!cliArgs.print) console.log(chalk.red(`  [auto-compact failed] ${err.message}`));
      }
    }

    // Buffer streamed text for markdown rendering
    let textBuffer = "";
    if (!cliArgs.print) process.stdout.write(chalk.blue("\nAssistant: "));

    const response = await streamMessage(
      client,
      config,
      messages,
      allTools,
      (delta) => {
        textBuffer += delta;
        if (cliArgs.print) {
          process.stdout.write(delta);
        } else {
          process.stdout.write(delta);
        }
      },
    );

    // Re-render with markdown formatting if there was text output
    if (textBuffer.trim() && !cliArgs.print) {
      // Move cursor up and clear the raw streamed text, replace with rendered
      const rawLines = textBuffer.split("\n").length;
      process.stdout.write("\r\x1b[K"); // clear current line
      for (let i = 0; i < rawLines; i++) {
        process.stdout.write("\x1b[A\x1b[K"); // move up + clear
      }
      console.log(chalk.blue("Assistant:\n") + renderMarkdown(textBuffer));
    } else if (textBuffer.trim() && cliArgs.print) {
      process.stdout.write("\n");
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
      if (!cliArgs.print) {
        console.log(
          chalk.dim(`\n  [tool] `) +
            chalk.yellow(tu.name) +
            chalk.dim(` ${formatToolInput(tu)}`)
        );
      }

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
        // In print mode, auto-allow all tools (non-interactive)
        const allowed = (cliArgs.print || cliArgs.dangerouslySkipPermissions) ? true : await askPermission(rl!, tu.name, toolInput, risk);
        if (!allowed) {
          if (!cliArgs.print) console.log(chalk.red("  [denied]"));
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

        if (!cliArgs.print) console.log(chalk.dim(`  [result] ${truncated.split("\n").length} lines`));
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: truncated,
        });
      } catch (err: any) {
        const errMsg = err.message || String(err);
        if (!cliArgs.print) console.log(chalk.red(`  [error] ${errMsg}`));
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
