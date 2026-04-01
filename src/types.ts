import Anthropic from "@anthropic-ai/sdk";

// ── Tool definition ──

export interface Tool {
  name: string;
  description: string;
  inputSchema: Anthropic.Tool["input_schema"];
  call(input: Record<string, unknown>): Promise<string>;
}

// ── Conversation types (re-export SDK types for convenience) ──

export type Message = Anthropic.MessageParam;
export type ContentBlock = Anthropic.ContentBlock;
export type ToolUseBlock = Anthropic.ToolUseBlock;
export type ToolResultBlockParam = Anthropic.ToolResultBlockParam;

// ── Config ──

export interface Config {
  model: string;
  maxTokens: number;
  apiKey?: string;
  baseURL?: string;
  systemPrompt: string;
}
