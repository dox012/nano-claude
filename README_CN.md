[English](./README.md) | **中文**

# nano-claude v0.7.0 — 子代理

**约 1,780 行 TypeScript，18 个文件。**

## 快速开始

```bash
npm install
cp .env.example .env
# 编辑 .env 填入你的 API key
npm run dev
```

## 本版本新增（相比 v6）

- **`src/tools/agent.ts`** — 子代理生成
- 隔离的只读子对话
- 每个子代理最多 20 轮

## 下一步

**v8** 添加 CLI 参数。
