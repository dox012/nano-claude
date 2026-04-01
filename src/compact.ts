import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import type { Message, Config } from "./types.js";

// ── Token estimation ──
// Rough heuristic: 1 token ≈ 4 characters for English text.
// OpenAI and Anthropic tokenizers average 3.5-4.5 chars/token for code and
// English prose. We use 4 as a conservative middle ground — slightly over-
// counting is safer than under-counting for auto-compact decisions.

export function estimateTokens(messages: Message[]): number {
  let chars = 0;
  for (const m of messages) {
    if (typeof m.content === "string") {
      chars += m.content.length;
    } else if (Array.isArray(m.content)) {
      for (const block of m.content) {
        if ("text" in block) chars += (block as any).text?.length || 0;
        if ("content" in block) chars += String((block as any).content || "").length;
      }
    }
  }
  return Math.ceil(chars / 4);
}

// ── Smart compaction: use the model to summarize conversation ──

export async function smartCompact(
  client: Anthropic,
  config: Config,
  messages: Message[]
): Promise<{ compacted: Message[]; saved: number }> {
  const before = messages.length;

  if (before <= 4) {
    return { compacted: messages, saved: 0 };
  }

  // Keep the last 2 messages intact — these contain the most recent user request
  // and assistant response, which are critical for conversational continuity.
  // Everything before is summarized by the model into a single compact message.
  const toSummarize = messages.slice(0, -2);
  const keep = messages.slice(-2);

  // Build a summary request
  const summaryMessages: Message[] = [
    {
      role: "user",
      content: `Summarize this conversation concisely. Focus on:
- Key decisions made
- Files read or modified
- Important facts learned
- Current task state

Conversation to summarize:
${serializeMessages(toSummarize)}

Respond with ONLY the summary, no preamble.`,
    },
  ];

  console.log(chalk.dim("  Compacting conversation..."));

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 2048,
    messages: summaryMessages,
    system: "You are a conversation summarizer. Be concise but preserve all important technical details.",
  });

  const summary =
    response.content[0]?.type === "text"
      ? response.content[0].text
      : "Previous conversation was compacted.";

  const compacted: Message[] = [
    {
      role: "user",
      content: `[Conversation compacted — summary of ${toSummarize.length} previous messages]\n\n${summary}`,
    },
    {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "I have the context from the compacted conversation. Ready to continue.",
        },
      ],
    },
    ...keep,
  ];

  return { compacted, saved: before - compacted.length };
}

// ── Auto-compact: trigger when estimated tokens exceed threshold ──

export function shouldAutoCompact(messages: Message[], maxContextTokens = 150_000): boolean {
  const estimated = estimateTokens(messages);
  // Trigger at 75% capacity — leaves a 25% buffer so the model can still
  // generate a full response + tool calls before hitting the context limit.
  // Too low wastes context; too high risks truncation mid-conversation.
  return estimated > maxContextTokens * 0.75;
}

// ── Serialize messages for summarization ──

function serializeMessages(messages: Message[]): string {
  const parts: string[] = [];
  for (const m of messages) {
    const role = m.role.toUpperCase();
    if (typeof m.content === "string") {
      parts.push(`[${role}]: ${m.content}`);
    } else if (Array.isArray(m.content)) {
      for (const block of m.content) {
        if ("text" in block && (block as any).text) {
          parts.push(`[${role}]: ${(block as any).text}`);
        } else if ("type" in block && block.type === "tool_use") {
          const tu = block as any;
          parts.push(`[${role} tool_use]: ${tu.name}(${JSON.stringify(tu.input).slice(0, 200)})`);
        } else if ("type" in block && block.type === "tool_result") {
          const tr = block as any;
          const content = String(tr.content || "").slice(0, 200);
          parts.push(`[${role} tool_result]: ${content}`);
        }
      }
    }
  }
  return parts.join("\n");
}
