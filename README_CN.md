[English](./README.md) | **中文**

<p align="center">
  <img src="./nano-claude.png" alt="nano-claude logo" width="200">
</p>

# nano-claude

用 **~2,000 行 TypeScript** 轻量级复刻 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)。

| | Claude Code | nano-claude |
|---|---|---|
| 代码行数 | 512,685 | **~2,000** |
| 文件数 | 1,902 | **19** |
| 工具数 | ~50 | **7** |
| 运行时 | Bun | Node.js |
| UI | React + Ink | readline |

> **新手？** 阅读[学习指南](./docs/LEARNING_GUIDE_CN.md)，逐版本了解每个概念。

## 快速开始

```bash
npm install
cp .env.example .env
# 编辑 .env 填入你的 API key
npm run dev
```

## 版本路线图

每个版本都是一个**独立可运行的 git 标签**：

```bash
git checkout v0            # 从 chatbot 基线开始
```

| 版本 | 标签 | 新增内容 | 代码行数 | 核心概念 |
|------|------|---------|---------|---------|
| **v0** | `v0` | Chatbot 基线：流式 REPL | ~80 | API 流式调用，无工具 |
| **v1** | `v1` | MVP：REPL + 6 个工具 | ~900 | Agent 工具调用循环 |
| **v2** | `v2` | Markdown 渲染 | ~1,020 | 终端样式 |
| **v3** | `v3` | 权限确认 + Bash 安全分级 | ~1,140 | 工具风险分类 |
| **v4** | `v4` | 会话持久化 + 恢复 | ~1,320 | 状态管理 |
| **v5** | `v5` | 智能对话压缩 | ~1,450 | 上下文窗口管理 |
| **v6** | `v6` | 多层级 CLAUDE.md + 记忆 | ~1,630 | 项目感知 + 持久记忆 |
| **v7** | `v7` | 子 Agent 工具 | ~1,780 | 多 Agent 协作 |
| **v8** | `v8` | CLI 参数 + 非交互模式 | ~2,000 | 脚本和自动化 |

## 命令行用法

```bash
nano-claude                          # 交互式 REPL
nano-claude "解释一下这个项目"          # 带初始 prompt 的交互
nano-claude -p "列出所有 TODO"         # 非交互模式，输出后退出
nano-claude -c                       # 继续上次对话
nano-claude -r <session-id>          # 恢复指定会话
nano-claude -p --max-turns 5 "重构这个函数"
nano-claude --dangerously-skip-permissions "写一个 hello.txt"
```

| 参数 | 说明 |
|------|------|
| `-p, --print` | 非交互模式：只输出文本，完成后退出 |
| `-c, --continue` | 继续最近一次对话 |
| `-r, --resume <id>` | 按 ID 恢复指定会话 |
| `-m, --model <model>` | 覆盖模型名称 |
| `--max-turns <n>` | 最大 Agent 轮次（默认：无限） |
| `--dangerously-skip-permissions` | 跳过所有权限确认 |
| `-h, --help` | 显示帮助 |
| `-v, --version` | 显示版本号 |

## 斜杠命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示可用命令 |
| `/cost` | 显示 token 使用量 |
| `/clear` | 清空对话历史 |
| `/compact` | 智能对话压缩 |
| `/model` | 查看或切换模型 |
| `/sessions` | 列出已保存的会话 |
| `/resume` | 恢复之前的会话 |
| `/remember` | 保存一条持久记忆 |
| `/forget` | 删除一条记忆 |
| `/memory` | 列出已保存的记忆 |

## 架构

```
src/
├── index.ts             # 入口 + REPL + CLI 参数 + 斜杠命令
├── api.ts               # Anthropic SDK 流式封装
├── prompt.ts            # 系统提示词构建
├── context.ts           # Git 上下文 + 多层级 CLAUDE.md
├── types.ts             # 核心类型定义
├── render.ts            # Markdown 终端渲染器
├── permissions.ts       # 工具风险分级 + 确认
├── session.ts           # 会话保存/加载/列表
├── compact.ts           # 智能对话压缩
├── memory.ts            # 持久化键值记忆
└── tools/
    ├── index.ts          # 工具注册表
    ├── bash.ts           # Shell 命令执行
    ├── read.ts           # 带行号文件读取
    ├── write.ts          # 文件创建/覆盖
    ├── edit.ts           # 字符串替换编辑
    ├── glob.ts           # 文件模式搜索
    ├── grep.ts           # 内容搜索 (ripgrep)
    └── agent.ts          # 子代理生成
```

## 工具

| 工具 | 说明 | 风险等级 |
|------|------|---------|
| **Bash** | 执行 Shell 命令 | 按命令分级 |
| **Read** | 带行号读取文件 | 安全 |
| **Write** | 创建/覆盖文件 | 写入 |
| **Edit** | 字符串替换编辑 | 写入 |
| **Glob** | 按模式搜索文件 | 安全 |
| **Grep** | 搜索文件内容 | 安全 |
| **Agent** | 生成只读子代理 | 安全 |

## 开发

```bash
npm run dev       # 用 tsx 运行
npm run build     # 编译 TypeScript
npm start         # 运行编译后的 JS
```

## 许可证

MIT
