import Anthropic from "@anthropic-ai/sdk";
import type { Tool, Config, Message, ContentBlock } from "./types.js";

// ── Response from one API call ──

export interface ApiResponse {
  content: ContentBlock[];
  stopReason: string | null;
  usage: { input: number; output: number };
}

// ── Create client ──

export function createClient(config: Config): Anthropic {
  return new Anthropic({
    apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
    baseURL: config.baseURL || process.env.ANTHROPIC_BASE_URL || undefined,
  });
}

// ── Stream a single API call, printing text deltas in real-time ──

export async function streamMessage(
  client: Anthropic,
  config: Config,
  messages: Message[],
  tools: Tool[],
  onText: (delta: string) => void,
  onThinking?: (delta: string) => void
): Promise<ApiResponse> {
  const sdkTools: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));

  const stream = await client.messages.stream({
    model: config.model,
    max_tokens: config.maxTokens,
    system: config.systemPrompt,
    messages,
    tools: sdkTools,
  });

  const blocks: ContentBlock[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const event of stream) {
    switch (event.type) {
      case "message_start":
        inputTokens = event.message.usage?.input_tokens ?? 0;
        break;

      case "message_delta":
        outputTokens = (event as any).usage?.output_tokens ?? outputTokens;
        break;

      case "content_block_start":
        blocks.push(event.content_block as ContentBlock);
        break;

      case "content_block_delta": {
        const block = blocks[blocks.length - 1];
        const delta = event.delta as any;
        if (delta.type === "text_delta" && block?.type === "text") {
          (block as any).text += delta.text;
          onText(delta.text);
        } else if (
          delta.type === "thinking_delta" &&
          block?.type === "thinking"
        ) {
          (block as any).thinking += delta.thinking;
          onThinking?.(delta.thinking);
        } else if (
          delta.type === "input_json_delta" &&
          block?.type === "tool_use"
        ) {
          // Accumulate partial JSON for tool input
          (block as any)._partialJson =
            ((block as any)._partialJson || "") + delta.partial_json;
        }
        break;
      }

      case "content_block_stop": {
        const block = blocks[blocks.length - 1];
        if (block?.type === "tool_use" && (block as any)._partialJson) {
          try {
            (block as any).input = JSON.parse((block as any)._partialJson);
          } catch {
            // keep whatever input SDK already parsed
          }
          delete (block as any)._partialJson;
        }
        break;
      }
    }
  }

  const final = await stream.finalMessage();

  return {
    content: blocks,
    stopReason: final.stop_reason,
    usage: {
      input: final.usage?.input_tokens ?? inputTokens,
      output: final.usage?.output_tokens ?? outputTokens,
    },
  };
}
