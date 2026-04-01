[English](./README.md) | **中文**

# nano-claude v0.3.0 — 权限确认系统

**约 1,140 行 TypeScript，14 个文件。**

## 快速开始

```bash
npm install
cp .env.example .env
# 编辑 .env 填入你的 API key
npm run dev
```

## 本版本新增（相比 v2）

- **`src/permissions.ts`** — 工具风险分级 + 确认
- **三级风险**：安全、写入、危险
- **基于正则的 bash 命令分类**

## 下一步

**v4** 添加会话持久化。
