[English](./README.md) | **中文**

# nano-claude v8 — CLI 参数

**约 2,000 行 TypeScript，19 个文件。**

## 快速开始

```bash
npm install
cp .env.example .env
# 编辑 .env 填入你的 API key
npm run dev
```

## 本版本新增（相比 v7）

- **CLI 参数解析** — `-p`、`-c`、`-r`、`-m`、`--max-turns`、`-h`、`-v`
- **非交互打印模式**（`-p`）
- **`--dangerously-skip-permissions`**
