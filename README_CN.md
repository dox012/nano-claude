[English](./README.md) | **中文**

# nano-claude v0 — 聊天机器人基线

一个极简的 Claude 流式聊天机器人。**约 80 行 TypeScript。** 没有工具、没有 Agent 循环 — 只是一个与 API 对话的 REPL。

这是起点。看看 **v1** 如何通过添加工具将这个聊天机器人变成编程助手。

## 快速开始

```bash
npm install
cp .env.example .env
# 编辑 .env 填入你的 API key
npm run dev
```

## 当前内容

- `src/index.ts` — 整个聊天机器人在一个文件中
  - .env 加载
  - readline REPL 交互循环
  - 流式 API 调用
  - 打印响应

## 下一步

**v1** 添加 6 个工具 + Agent 工具调用循环，将聊天机器人变成编程助手。
