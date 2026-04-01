**English** | [中文](./README_CN.md)

# nano-claude v0.3.0 — Permission System

**~1,140 lines of TypeScript, 14 files.**

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your API key
npm run dev
```

## What's New (vs v2)

- **`src/permissions.ts`** — Tool risk classification + confirmation
- **Three risk levels**: safe, write, destructive
- **Regex-based bash command classification**

## What's Next

**v4** adds session persistence.
