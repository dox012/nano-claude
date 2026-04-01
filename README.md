**English** | [中文](./README_CN.md)

# nano-claude v0.7.0 — Sub-Agent

**~1,780 lines of TypeScript, 18 files.**

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your API key
npm run dev
```

## What's New (vs v6)

- **`src/tools/agent.ts`** — Sub-agent spawning
- Isolated read-only child conversations
- Max 20 turns per sub-agent

## What's Next

**v8** adds CLI arguments.
