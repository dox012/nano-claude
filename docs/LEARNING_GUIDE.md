**English** | [中文](./LEARNING_GUIDE_CN.md)

# nano-claude Learning Guide

A step-by-step walkthrough of how to build an agentic coding assistant from scratch. Each version introduces one concept — read the code at that tag, then come back here for the "why."

```bash
git checkout v0   # start here and follow along
```

---

## v0 — Chatbot Baseline

**The problem:** Before building an agent, understand what a plain chatbot looks like — and what it *can't* do.

**The concept:** A chatbot is just a loop: read user input → send to API → stream response → repeat. The entire thing fits in ~80 lines and a single file:

```
User input → API call (streaming) → print tokens as they arrive → loop
```

There are no tools. The model can answer questions, but it can't read files, run commands, or modify code. It's stuck inside its own context window.

**Files to read:**
- `src/index.ts` — the entire chatbot in one file

**What to notice:**
- The `messages` array accumulates conversation history — this is what makes it multi-turn
- Streaming uses `client.messages.stream()` and processes `content_block_delta` events
- The model is *stateless* — the client maintains all state in the messages array

**Try it:** Ask the chatbot to read a file. It can't — it will apologize or hallucinate. This is exactly the limitation that v1 solves.

---

## v1 — The Agentic Tool-Use Loop

**The problem:** How do you turn a language model into a coding assistant that can actually *do* things?

**The concept:** The entire magic of an agentic coding assistant boils down to a single loop:

```
User input → API call → model returns text or tool_use → execute tool → API call → ...
```

The model never directly runs code. It returns structured `tool_use` blocks saying "I want to call tool X with input Y." Your code executes the tool, feeds the result back, and asks the model again. This loop repeats until the model returns only text (meaning it's done).

**Key insight:** Tool results are sent as `user` messages. This is a Claude API convention — the model treats tool results as context provided by the user, not as its own output. This is why the loop alternates between `assistant` (tool_use) and `user` (tool_result) messages.

**Files to read:**
- `src/index.ts` — `runConversationLoop()` is the core loop (~30 lines that drive everything)
- `src/api.ts` — `streamMessage()` handles the streaming protocol
- `src/tools/` — each tool is a simple `{ name, description, inputSchema, call() }` object

**The 6 starter tools:**

| Tool | What it does | Why the model needs it |
|------|-------------|----------------------|
| Bash | Run shell commands | Install deps, run tests, git ops |
| Read | Read files with line numbers | Understand code before editing |
| Write | Create/overwrite files | Generate new files |
| Edit | String-replace in files | Modify existing code precisely |
| Glob | Find files by pattern | Navigate unfamiliar codebases |
| Grep | Search file contents | Find where something is defined/used |

**Try it:** Check out `v1`, remove the Grep tool from `allTools`, and watch how the model adapts — it'll fall back to `Bash` with `grep` commands. This shows the model's flexibility.

---

## v2 — Markdown Rendering

**The problem:** Raw text output is ugly in a terminal. Code blocks, headings, and inline formatting all look the same.

**The concept: Two-pass rendering.** Stream raw text first (for instant feedback), then erase it with ANSI escape codes and re-render with formatting. This gives both low latency and styled output.

**Files to read:**
- `src/render.ts` — 87-line markdown renderer (code blocks, headers, lists, inline formatting)

**Try it:** Ask the model to explain some code. Watch how the output first appears as raw text, then gets re-rendered with bold, code blocks, and colors.

---

## v3 — Permission Confirmation + Bash Safety

**The problem:** An AI that can run `rm -rf /` without asking is a disaster waiting to happen.

**The concept: Two-tier risk classification.**

```
safe        → auto-allow (Read, Glob, Grep)
write       → yellow warning, ask for confirmation (git commit, npm install, Write, Edit)
destructive → red warning, ask for confirmation (rm -rf, git reset --hard, DROP TABLE)
```

Bash commands are classified by regex pattern matching. The distinction between "write" and "destructive" is about reversibility: `rm file.txt` is recoverable (git, trash, backups), but `rm -rf /` is not.

**Files to read:**
- `src/permissions.ts` — `classifyBashRisk()` has the regex patterns, `askPermission()` handles the interactive prompt

**Design decision:** Why not just block all dangerous commands? Because sometimes the user *wants* to `rm -rf node_modules`. The role of the system is to make the user **consciously confirm**, not to prevent actions entirely.

**Try it:** Type a message that makes the model run `git commit`. Watch the yellow confirmation prompt. Then try to make it run `rm -rf` — notice the red warning.

---

## v4 — Session Persistence + Resume

**The problem:** Close the terminal, lose the entire conversation. For long coding sessions, this is unacceptable.

**The concept:** Sessions are auto-saved to `~/.nano-claude/sessions/<id>.json` after every exchange. Each session file contains the full message history, model name, token counts, and metadata. Sessions can be listed, browsed, and resumed.

**Files to read:**
- `src/session.ts` — `saveSession()`, `loadSession()`, `listSessions()`
- `src/index.ts` — auto-save after every API call, `/resume` command

**Key design choice:** Sessions save the *raw message array* — the exact format the API expects. This means resuming is as simple as loading the array and continuing the loop. No re-parsing, no format conversion.

**Try it:** Start a conversation, close the terminal, restart, and type `/sessions` to see your saved sessions. Then `/resume <id>` to pick up exactly where you left off.

---

## v5 — Smart Conversation Compaction

**The problem:** Claude has a context window limit (~200K tokens). Long coding sessions with lots of tool calls will eventually overflow it.

**The concept:** Instead of truncating messages (losing context), use the model itself to summarize the conversation. The compaction algorithm:

1. Keep the last 2 messages intact (most recent context)
2. Send everything else to the model with a "summarize this" prompt
3. Replace the old messages with `[summary] + [assistant ack] + [last 2 messages]`

**Why keep the last 2?** They contain the current user request and the most recent assistant response — the critical context for what's happening *right now*.

**Why 75% threshold?** Compacting at 75% of the context limit leaves a 25% buffer. The model needs room to generate a response + tool calls after compaction. Too high → risk of truncation mid-response. Too low → wastes context space with premature compaction.

**Files to read:**
- `src/compact.ts` — `smartCompact()`, `shouldAutoCompact()`, `estimateTokens()`

**Try it:** Use `/cost` to watch your token usage grow. When it gets large, use `/compact` manually to see the summarization in action.

---

## v6 — Multi-Level CLAUDE.md + Memory

**The problem:** The model doesn't know your project's conventions, tech stack, or preferences. Every conversation starts cold.

**The concept: Project awareness through CLAUDE.md files.** These are markdown files at multiple levels that get injected into the system prompt:

```
~/.claude/CLAUDE.md            → user-level defaults (your name, style preferences)
<project-root>/CLAUDE.md       → project rules (tech stack, conventions)
<project-root>/.claude/CLAUDE.md → same, alternate location
<cwd>/CLAUDE.md                → subdir-specific overrides
```

All levels are loaded and concatenated. This mirrors how `.gitignore` works — global defaults with project-level overrides.

**Persistent memory** (`/remember`, `/forget`) stores key-value pairs as markdown files in `~/.nano-claude/memory/`. Memories are loaded into the system prompt on every API call, giving the model cross-session recall.

**Files to read:**
- `src/context.ts` — `getClaudeMd()` with multi-level loading and deduplication
- `src/memory.ts` — simple CRUD for persistent key-value memory
- `src/prompt.ts` — `buildSystemPrompt()` assembles everything

**Try it:** Create a `CLAUDE.md` in your project root with "Always use TypeScript. Never use `any`." Then ask the model to write some code — it will follow your rules.

---

## v7 — Sub-Agent Tool

**The problem:** Some tasks require reading 10+ files to gather context before answering. Doing this in the main conversation clutters the context with tool calls.

**The concept:** A sub-agent is an isolated conversation that can only read (never write). It gets its own message history, runs up to 20 tool-use turns, and returns a text summary to the main conversation.

**Security boundary:** The sub-agent only gets `Read`, `Glob`, `Grep` — no `Bash`, `Write`, or `Edit`. This prevents unsupervised mutations. The model in the main conversation can request research via sub-agents without the user needing to approve every file read.

**Architecture:**

```
Main conversation ──[tool_use: Agent]──→ Sub-agent conversation
                                          ├── Read files
                                          ├── Grep for patterns
                                          ├── Glob for files
                                          └── Return summary text
                  ←──[tool_result: summary]──┘
```

**Files to read:**
- `src/tools/agent.ts` — the complete sub-agent implementation

**Try it:** Ask the model to "analyze the architecture of this project." Watch it spawn a sub-agent that reads multiple files, then returns a consolidated summary.

---

## v8 — CLI Arguments + Non-Interactive Mode

**The problem:** An interactive REPL is great for exploration, but scripting and automation need a non-interactive mode.

**The concept:** CLI argument parsing (without external dependencies) enables:

```bash
# Scripting: pipe-friendly output
nano-claude -p "list all TODO comments" > todos.txt

# Automation: resume and continue
nano-claude -c -p "what were we working on?"

# Skip permissions for trusted scripts
nano-claude --dangerously-skip-permissions "refactor this file"
```

**Print mode differences:**
- No markdown rendering (plain text output)
- No `[tool]`/`[result]` noise on stderr
- Auto-allows all tool permissions (non-interactive)
- Exits after the model finishes

**Files to read:**
- `src/index.ts` — `parseArgs()`, print mode branches throughout `runConversationLoop()`

---

## Architectural Summary

After all 9 versions (v0–v8), the full architecture looks like this:

```
┌─ User Input ──────────────────────────────────────┐
│  CLI args / REPL / pipe                           │
└──────────────┬────────────────────────────────────┘
               ▼
┌─ System Prompt ───────────────────────────────────┐
│  CORE_PROMPT + env + git + CLAUDE.md + memories   │
└──────────────┬────────────────────────────────────┘
               ▼
┌─ Agentic Loop ────────────────────────────────────┐
│  while (true) {                                   │
│    auto-compact if needed                         │
│    stream API response                            │
│    if text → render markdown, break               │
│    if tool_use → check permissions → execute      │
│    push tool_result as user message               │
│  }                                                │
└──────────────┬────────────────────────────────────┘
               ▼
┌─ Tools ───────────────────────────────────────────┐
│  Built-in: Bash Read Write Edit Glob Grep Agent   │
└──────────────┬────────────────────────────────────┘
               ▼
┌─ Persistence ─────────────────────────────────────┐
│  Sessions (~/.nano-claude/sessions/)              │
│  Memory   (~/.nano-claude/memory/)                │
└───────────────────────────────────────────────────┘
```

## Key Takeaways

1. **The model IS the agent.** The code is just a harness that provides tools and manages context. The intelligence comes from the API.

2. **The tool-use loop is everything.** `while(true) { call API → execute tools → repeat }` is the entire architecture. Everything else is optimization.

3. **Context management is the hard problem.** The model is only as good as what fits in its context window. Compaction, CLAUDE.md, and memory are all strategies for putting the right context in front of the model.

4. **Security is about confirmation, not prevention.** The user should always be able to do what they want — the system's job is to make dangerous actions *conscious* choices.

5. **~2,000 lines is enough.** Claude Code has 500K+ lines, but the essential agentic loop is ~30 lines. Everything else is UI, edge cases, and enterprise features. Understanding this core is all you need to build your own.
