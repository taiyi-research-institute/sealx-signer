# SealX 签名器项目文档

## 项目概览

- **项目名称**: SealX 签名器 (sealx-signer)
- **项目类型**: Monorepo 多部分项目
- **核心功能**: EIP712 数字签名系统 - 所见即所签
- **技术栈**: TypeScript, React, Expo, Vite

## 项目结构

| 部分 | 路径 | 描述 |
|------|------|------|
| 移动应用 | `app/` | Expo 跨平台应用 (iOS/Android) |
| 浏览器扩展 | `extension/` | Chrome 扩展程序 |
| 服务器 | `server/` | 后端服务 |
| 核心库 | `packages/sealx-core/` | EIP712 签名核心库 |
| 消息库 | `packages/sealx-message/` | 消息传递库 |
| SDK | `packages/sealx-sdk/` | JavaScript/TypeScript SDK |

## 技术栈速查

- **语言**: TypeScript
- **核心依赖**: ethers, crypto-js, lodash, rxjs, webextension-polyfill
- **移动端**: Expo / React Native
- **扩展**: React + Vite
- **构建**: Rollup

## 生成的文档

- [项目概览](./project-overview.md) - 项目详细介绍
- [功能清单](./feature清单.md) - 已完成功能清单
- _(待生成)_ 架构文档
- _(待生成)_ API 合约
- _(待生成)_ 数据模型

## 现有文档

- `app/README.md` - Expo 移动应用说明
- `extension/README.md` - Chrome 扩展说明

## 快速开始

```bash
# 安装依赖
npm install

# 构建核心库
cd packages/sealx-core && npm run build

# 运行移动应用
cd app && npx expo start

# 开发扩展
cd extension && npm run dev
```

---

*本文档由 BMAD 文档化工具生成 - 2026-03-05*
