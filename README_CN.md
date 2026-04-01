[English](./README.md) | **中文**

# nano-claude v0.5.0 — 上下文压缩

**约 1,450 行 TypeScript，16 个文件。**

## 快速开始

```bash
npm install
cp .env.example .env
# 编辑 .env 填入你的 API key
npm run dev
```

## 本版本新增（相比 v4）

- **`src/compact.ts`** — 智能对话压缩
- Token 估算 + 75% 时自动压缩
- 模型驱动的摘要

## 下一步

**v6** 添加 CLAUDE.md + 持久记忆。
