**English** | [中文](./README_CN.md)

<p align="center">
  <img src="./nano-claude.png" alt="nano-claude logo" width="200">
</p>

# nano-claude

A lightweight, incremental reimplementation of [Claude Code](https://docs.anthropic.com/en/docs/claude-code) in **~2,000 lines of TypeScript**.

| | Claude Code | nano-claude |
|---|---|---|
| Lines of code | 512,685 | **~2,000** |
| Files | 1,902 | **19** |
| Tools | ~50 | **7** |
| Runtime | Bun | Node.js |
| UI | React + Ink | readline |

> **New here?** Read the [Learning Guide](./docs/LEARNING_GUIDE.md) for a step-by-step walkthrough of every version.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your API key
npm run dev
```

## Version Roadmap

Each version is a **tagged, independently runnable** milestone:

```bash
git checkout v0            # start from the chatbot baseline
```

| Version | Tag | What's Added | Lines | Key Concept |
|---------|-----|-------------|-------|-------------|
| **v0** | `v0` | Chatbot baseline: streaming REPL | ~80 | API streaming, no tools |
| **v1** | `v1` | MVP: REPL + 6 tools + streaming | ~900 | The agentic tool-use loop |
| **v2** | `v2` | Markdown rendering | ~1,020 | Terminal styling |
| **v3** | `v3` | Permission confirmation + bash safety | ~1,140 | Tool risk classification |
| **v4** | `v4` | Session persistence + resume | ~1,320 | State management |
| **v5** | `v5` | Smart conversation compaction | ~1,450 | Context window management |
| **v6** | `v6` | Multi-level CLAUDE.md + memory | ~1,630 | Project awareness + persistent memory |
| **v7** | `v7` | Sub-agent tool | ~1,780 | Multi-agent orchestration |
| **v8** | `v8` | CLI arguments + non-interactive mode | ~2,000 | Scripting and automation |

## CLI Usage

```bash
nano-claude                          # interactive REPL
nano-claude "explain this project"   # interactive with initial prompt
nano-claude -p "list all TODOs"      # non-interactive, print and exit
nano-claude -c                       # continue last conversation
nano-claude -r <session-id>          # resume specific session
nano-claude -p --max-turns 5 "refactor this function"
nano-claude --dangerously-skip-permissions "write hello.txt"
```

| Flag | Description |
|------|-------------|
| `-p, --print` | Non-interactive mode: output text only, then exit |
| `-c, --continue` | Continue the most recent conversation |
| `-r, --resume <id>` | Resume a specific session by ID |
| `-m, --model <model>` | Override the model name |
| `--max-turns <n>` | Maximum agentic turns (default: unlimited) |
| `--dangerously-skip-permissions` | Skip all permission prompts |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

## Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/cost` | Display token usage |
| `/clear` | Clear conversation history |
| `/compact` | Smart conversation compression |
| `/model` | Show or switch model |
| `/sessions` | List saved sessions |
| `/resume` | Resume a previous session |
| `/remember` | Save a persistent memory |
| `/forget` | Delete a memory |
| `/memory` | List saved memories |

## Architecture

```
src/
├── index.ts             # Entry + REPL + CLI args + slash commands
├── api.ts               # Anthropic SDK streaming wrapper
├── prompt.ts            # System prompt construction
├── context.ts           # Git context + multi-level CLAUDE.md
├── types.ts             # Core type definitions
├── render.ts            # Markdown terminal renderer
├── permissions.ts       # Tool risk classification + confirmation
├── session.ts           # Session save/load/list
├── compact.ts           # Smart conversation compaction
├── memory.ts            # Persistent key-value memory
└── tools/
    ├── index.ts          # Tool registry
    ├── bash.ts           # Shell command execution
    ├── read.ts           # File reading with line numbers
    ├── write.ts          # File creation / overwrite
    ├── edit.ts           # String-replacement editing
    ├── glob.ts           # File pattern search
    ├── grep.ts           # Content search (ripgrep)
    └── agent.ts          # Sub-agent spawning
```

## Tools

| Tool | Description | Risk |
|------|-------------|------|
| **Bash** | Execute shell commands | Classified per command |
| **Read** | Read files with line numbers | Safe |
| **Write** | Create/overwrite files | Write |
| **Edit** | String-replacement editing | Write |
| **Glob** | Find files by pattern | Safe |
| **Grep** | Search file contents (ripgrep) | Safe |
| **Agent** | Spawn read-only sub-agent | Safe |

## Development

```bash
npm run dev       # Run with tsx
npm run build     # Compile TypeScript
npm start         # Run compiled JS
```

## License

MIT
