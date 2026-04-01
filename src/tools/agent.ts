import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import type { Tool } from "../types.js";

// ── Sub-agent tool: spawns a new conversation with a focused task ──
//
// Why sub-agents? They enable parallel research without blocking the main
// conversation. The main loop can delegate "go read these 10 files and summarize"
// to a sub-agent while continuing to interact with the user.
//
// Key design decisions:
// - Read-only tools only (Read/Glob/Grep) — prevents unsupervised file mutations
// - No streaming — sub-agents run non-interactively in the background
// - No permission checks — since all tools are safe, no user prompts needed
// - 20-turn hard cap — prevents runaway loops from consuming unbounded API credits
// - Separate message history — sub-agent context is isolated from the main conversation
// - Inherits parent's system prompt — so it understands the project context

// These are set by index.ts at startup
let _client: Anthropic | null = null;
let _model: string = "";
let _systemPrompt: string = "";

export function initAgentTool(client: Anthropic, model: string, systemPrompt: string) {
  _client = client;
  _model = model;
  _systemPrompt = systemPrompt;
}

// Agent gets read-only tools only (no Write/Edit/Bash to prevent unsupervised mutations)
const AGENT_TOOL_NAMES = ["Read", "Glob", "Grep"];

export const AgentTool: Tool = {
  name: "Agent",
  description:
    "Launch a sub-agent to perform a focused research task. The agent can read files " +
    "and search the codebase but cannot modify files or run commands. Use this for " +
    "parallel exploration, code analysis, or gathering information from multiple files.",
  inputSchema: {
    type: "object" as const,
    properties: {
      prompt: {
        type: "string",
        description: "The task for the sub-agent to perform",
      },
      description: {
        type: "string",
        description: "A short (3-5 word) description of the task",
      },
    },
    required: ["prompt", "description"],
  },

  async call(input) {
    if (!_client) return "Error: Agent not initialized";

    const prompt = input.prompt as string;
    const description = input.description as string;

    console.log(chalk.dim(`\n  [agent:${description}] Starting...`));

    // Import tools dynamically to avoid circular deps
    const { allTools } = await import("./index.js");
    const agentTools = allTools.filter((t) => AGENT_TOOL_NAMES.includes(t.name));

    const sdkTools: Anthropic.Tool[] = agentTools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: prompt },
    ];

    const agentSystemPrompt =
      "You are a research sub-agent. Your job is to investigate and report findings. " +
      "You can only read files and search — you cannot modify anything. " +
      "Be thorough but concise. Report your findings clearly.\n\n" +
      _systemPrompt;

    // Tool loop (max 20 iterations to prevent runaway)
    const MAX_TURNS = 20;
    let finalText = "";

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await _client.messages.create({
        model: _model,
        max_tokens: 8192,
        system: agentSystemPrompt,
        messages,
        tools: sdkTools,
      });

      messages.push({ role: "assistant", content: response.content });

      // Collect text output
      for (const block of response.content) {
        if (block.type === "text") {
          finalText += block.text;
        }
      }

      // Find tool uses
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      if (toolUses.length === 0) break;

      // Execute tools
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      const toolMap = new Map(agentTools.map((t) => [t.name, t]));

      for (const tu of toolUses) {
        const tool = toolMap.get(tu.name);
        console.log(chalk.dim(`  [agent:${description}] ${tu.name}`));

        if (!tool) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: `Error: Tool "${tu.name}" not available to sub-agents`,
            is_error: true,
          });
          continue;
        }

        try {
          const result = await tool.call(tu.input as Record<string, unknown>);
          const truncated =
            result.length > 30_000
              ? result.slice(0, 15_000) + "\n...[truncated]...\n" + result.slice(-15_000)
              : result;
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: truncated,
          });
        } catch (err: any) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: `Error: ${err.message}`,
            is_error: true,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
    }

    console.log(chalk.dim(`  [agent:${description}] Done`));

    return finalText || "(Agent produced no text output)";
  },
};
