**English** | [中文](./README_CN.md)

# nano-claude v0.1.0 — MVP Agentic Assistant

**~900 lines of TypeScript, 12 files.**

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your API key
npm run dev
```

## What's New (vs v0)

- **Agentic tool-use loop** — model calls tools, results feed back, repeat until done
- **6 tools**: Bash, Read, Write, Edit, Glob, Grep
- **System prompt** with git context
- **Modular architecture** — split into 12 files

## What's Next

**v2** adds terminal markdown rendering.
