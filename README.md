**English** | [中文](./README_CN.md)

# nano-claude v0.4.0 — Session Persistence

**~1,320 lines of TypeScript, 15 files.**

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your API key
npm run dev
```

## What's New (vs v3)

- **`src/session.ts`** — Session save/load/list
- Auto-save after every turn
- **`/sessions`** and **`/resume`** commands

## What's Next

**v5** adds smart conversation compaction.
