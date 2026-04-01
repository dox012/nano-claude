[English](./README.md) | **中文**

# nano-claude v0.4.0 — 会话持久化

**约 1,320 行 TypeScript，15 个文件。**

## 快速开始

```bash
npm install
cp .env.example .env
# 编辑 .env 填入你的 API key
npm run dev
```

## 本版本新增（相比 v3）

- **`src/session.ts`** — 会话保存/加载/列表
- 每轮对话后自动保存
- **`/sessions`** 和 **`/resume`** 命令

## 下一步

**v5** 添加智能对话压缩。
