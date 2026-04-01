[English](./README.md) | **中文**

# nano-claude v0.2.0 — 终端 Markdown 渲染

**约 1,020 行 TypeScript，13 个文件。**

## 快速开始

```bash
npm install
cp .env.example .env
# 编辑 .env 填入你的 API key
npm run dev
```

## 本版本新增（相比 v1）

- **`src/render.ts`** — Markdown 转终端渲染器
- **两阶段渲染** — 先流式输出原始文本，再重新渲染为格式化输出

## 下一步

**v3** 添加权限系统。
