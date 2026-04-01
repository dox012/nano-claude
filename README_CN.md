[English](./README.md) | **中文**

# nano-claude v0.1.0 — MVP 智能编程助手

**约 900 行 TypeScript，12 个文件。**

## 快速开始

```bash
npm install
cp .env.example .env
# 编辑 .env 填入你的 API key
npm run dev
```

## 本版本新增（相比 v0）

- **Agent 工具调用循环** — 模型调用工具，结果反馈，循环直到完成
- **6 个工具**：Bash、Read、Write、Edit、Glob、Grep
- **系统提示词**包含 git 上下文
- **模块化架构** — 拆分为 12 个文件

## 下一步

**v2** 添加终端 Markdown 渲染。
