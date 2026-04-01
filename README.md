**English** | [中文](./README_CN.md)

# nano-claude v0.2.0 — Markdown Rendering

**~1,020 lines of TypeScript, 13 files.**

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your API key
npm run dev
```

## What's New (vs v1)

- **`src/render.ts`** — Markdown-to-terminal renderer
- **Two-pass rendering** — stream raw text first, then re-render with formatting

## What's Next

**v3** adds a permission system.
