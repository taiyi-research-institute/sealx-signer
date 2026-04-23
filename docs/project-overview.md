# SealX 签名器项目

## 项目概述

**SealX 签名器**是一个基于 EIP712 标准的数字签名系统，通过约定格式使签名数据可阅读、可理解，实现**所见即所签**的核心价值。

### 核心特性

- **EIP712 标准签名**：遵循以太坊 EIP712 签名标准
- **人类可读**：签名数据以结构化格式呈现，用户可理解签名的具体内容
- **多平台支持**：同时支持移动端 (iOS/Android) 和浏览器扩展
- **SDK 集成**：提供 JavaScript/TypeScript SDK 方便开发者集成

---

## 项目结构

```
sealx-signer/
├── app/                    # Expo 移动应用 (iOS/Android)
├── extension/              # Chrome 浏览器扩展
├── server/                 # 服务器后端
├── packages/               # 核心库 (Monorepo)
│   ├── sealx-core/        # 核心库 - EIP712 签名实现
│   ├── sealx-message/     # 消息传递库
│   └── sealx-sdk/         # JS/TS SDK
└── test/                  # 测试相关
```

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | TypeScript |
| 核心库 | ethers ^6.14.3, crypto-js ^4.2.0, lodash ^4.17.21 |
| 响应式 | RxJS ^7.8.2 |
| 扩展兼容 | webextension-polyfill ^0.10.0 |
| 移动端 | Expo (React Native) |
| 扩展 | React + Vite |
| 构建 | Rollup |

---

## 核心包说明

### sealx-core (v1.0.10)
核心库，提供 EIP712 签名功能。

**主要模块：**
- `eip712/` - EIP712 签名实现
  - `eip712-signer.ts` - 签名器
  - `eip712-struct.ts` - 结构定义
  - `eip712-helper.ts` - 辅助函数
- `storage/` - 存储层
  - `local-storage.ts` - 本地存储
  - `db-storage.ts` - 数据库存储
- `sealx/` - SealX 接口
  - `sealx-provider.ts` - 提供者
  - `sealx-interface.ts` - 接口定义
  - `sealx-signer.ts` - 签名器
- `state/` - 状态管理
- `tabs/` - 标签页管理
- `utils/` - 工具函数

### sealx-message (v1.0.12)
消息传递库，处理扩展与应用间的通信。

**主要模块：**
- `contracts/` - 消息协议定义
- `messager/` - 消息管理器（支持多种模式：tab, window, content, background, extension）
- `utils/` - 工具函数

### sealx-sdk (v1.0.24)
JavaScript/TypeScript SDK，用于与 SealX 浏览器扩展交互。

**主要模块：**
- `components/sign/` - 签名组件
- `state/` - 状态管理（session, plugin-state）
- `messager/` - 消息传递

---

## 各部分说明

### 1. 移动应用 (app/)
基于 Expo 的跨平台移动应用。

**技术栈：** Expo + React Native + TypeScript

**主要功能：**
- 数字签名操作
- 钱包管理
- 签名请求处理

### 2. Chrome 扩展 (extension/)
浏览器扩展程序，提供钱包和签名功能。

**技术栈：** React + Vite + TypeScript + Tailwind CSS

**主要功能：**
- 钱包管理
- EIP712 签名请求
- 与网页交互

### 3. 服务器 (server/)
后端服务（目前文档较少）

### 4. 核心库 (packages/)
Monorepo 管理的核心库，提供底层功能支持。

---

## 依赖关系

```
sealx-sdk
    ├── sealx-core (^1.0.10)
    └── sealx-message (^1.0.11)
        └── sealx-core (^1.0.10)
```

---

## 开发指南

### 安装依赖

```bash
# 根目录安装
npm install

# 各部分独立安装
cd app && npm install
cd extension && npm install
cd packages/sealx-core && npm install
cd packages/sealx-message && npm install
cd packages/sealx-sdk && npm install
```

### 构建

```bash
# 构建核心库
cd packages/sealx-core && npm run build
cd packages/sealx-message && npm run build
cd packages/sealx-sdk && npm run build
```

### 运行

```bash
# 移动应用
cd app && npx expo start

# Chrome 扩展开发
cd extension && npm run dev
```

---

## 文档索引

- [移动应用 README](./app/README.md)
- [扩展 README](./extension/README.md)
- [sealx-core 库](./packages/sealx-core/)
- [sealx-message 库](./packages/sealx-message/)
- [sealx-sdk 库](./packages/sealx-sdk/)

---

*本文档由 BMAD 文档化工具自动生成*
