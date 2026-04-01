**English** | [中文](./README_CN.md)

# nano-claude v0.5.0 — Context Compaction

**~1,450 lines of TypeScript, 16 files.**

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your API key
npm run dev
```

## What's New (vs v4)

- **`src/compact.ts`** — Smart conversation compaction
- Token estimation + auto-compact at 75% capacity
- Model-powered summarization

## What's Next

**v6** adds CLAUDE.md + persistent memory.
