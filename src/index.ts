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
import Anthropic from "@anthropic-ai/sdk";

// ── Config ──

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Error: ANTHROPIC_API_KEY not set.");
  console.error("  cp .env.example .env  # then edit with your key");
  process.exit(1);
}

const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const client = new Anthropic({
  apiKey,
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
});

const messages: Anthropic.MessageParam[] = [];

// ── REPL ──

async function main() {
  console.log(`\n  nano-claude v0 (chatbot)  model: ${model}`);
  console.log("  Type your message. Ctrl+C to exit.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "You: ",
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    messages.push({ role: "user", content: input });

    process.stdout.write("\nAssistant: ");

    const stream = await client.messages.stream({
      model,
      max_tokens: 8192,
      messages,
    });

    let text = "";
    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        const delta = event.delta as any;
        if (delta.type === "text_delta") {
          process.stdout.write(delta.text);
          text += delta.text;
        }
      }
    }

    messages.push({ role: "assistant", content: text });
    console.log("\n");
    rl.prompt();
  });

  rl.on("close", () => process.exit(0));
}

main().catch(console.error);
