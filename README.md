**English** | [中文](./README_CN.md)

# nano-claude v0 — Chatbot Baseline

A minimal streaming chatbot with Claude. **~80 lines of TypeScript.** No tools, no agent loop — just a REPL that talks to the API.

This is the starting point. See how **v1** transforms this chatbot into an agent by adding tools.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your API key
npm run dev
```

## What's Here

- `src/index.ts` — The entire chatbot in one file
  - .env loading
  - readline REPL
  - Streaming API call
  - Print response

## What's Next

**v1** adds 6 tools + the agentic tool-use loop, turning this chatbot into a coding assistant.
