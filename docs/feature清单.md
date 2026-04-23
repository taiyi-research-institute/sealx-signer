# SealX 签名器 - 功能清单

## 📋 概述

本项目是一个基于 **EIP712 标准**的数字签名系统，实现**"所见即所签"**的核心价值。

---

## 一、核心功能

### 1. EIP712 签名
- [x] **EIP712 标准签名** - 遵循以太坊 EIP712 签名标准
- [x] **结构化数据签名** - 支持复杂结构化数据的签名
- [x] **人类可读格式** - 签名数据以结构化格式呈现，用户可理解签名内容
- [x] **批量签名** - 支持一次性签名多个任务

### 2. 密钥管理
- [x] **密钥生成** - 使用 ethers.js 生成随机钱包
- [x] **密钥导入** - 支持导入已有私钥
- [x] **密钥导出** - 支持导出私钥（HEX 格式）
- [x] **公钥绑定** - 将公钥绑定到用户账户

### 3. 账户管理
- [x] **账户初始化** - 初始化 SealX 账户
- [x] **账户信息管理** - 存储用户 ID、邮箱、用户名
- [x] **PIN 码验证** - PIN 码验证机制
- [x] **PIN 码重置** - 支持重置 PIN 码
- [x] **密码保护** - 密码验证机制

---

## 二、会话管理

### 1. 连接与会话
- [x] **连接钱包** - 连接到 SealX 扩展/服务
- [x] **会话管理** - 创建和管理签名会话
- [x] **会话过期** - 支持会话过期时间设置
- [x] **自动清除** - 会话过期自动清除
- [x] **断开连接** - 主动断开连接

### 2. 状态检查
- [x] **扩展状态检查** - 检查 SealX 扩展是否安装
- [x] **激活状态检查** - 检查扩展是否激活
- [x] **初始化检查** - 检查是否已初始化
- [x] **会话有效性检查** - 检查会话是否过期

---

## 三、通信机制

### 1. 消息传递
- [x] **多通道通信** - 支持多种消息通道
  - Background Script
  - Popup Window
  - Content Script
  - In-page Script
  - Iframe
- [x] **流式响应** - 支持流式消息响应（批量签名）

### 2. 消息主题 (Topics)
| 主题 | 功能 |
|------|------|
| `CONNECT` | 请求连接钱包/账户 |
| `DISCONNECT` | 请求断开连接 |
| `SIGN` | 单条签名请求 |
| `BATCH_SIGN` | 批量签名请求 |
| `DEL_SIGN` | 删除/撤销签名 |
| `SIGN_RESPONSE` | 签名响应 |
| `BIND_PK` | 绑定公钥 |
| `IMPORT_KEY` | 导入密钥 |
| `PK_HEX` | 导出私钥 HEX |
| `CHECK_PIN` | 验证 PIN 码 |
| `CHECK_SESSION_EXPIRED` | 检查会话过期 |
| `CHECK_INITIALIZED` | 检查初始化状态 |
| `LOGIN` | 登录 |
| `INITIALIZE` | 初始化服务 |
| `RESET_PIN` | 重置 PIN 码 |
| `CLOSE` | 关闭连接 |

---

## 四、存储功能

### 1. 本地存储
- [x] **LocalStorage** - 浏览器本地存储
- [x] **IndexedDB** - 浏览器数据库存储
- [x] **存储抽象层** - 统一的存储接口

### 2. 云备份
- [x] **本地备份** - 本地加密存储
- [x] **Google Drive 备份** - 云端备份 ✅ 已测试通过
- [x] **加密存储** - 使用 PIN 加密私钥

---

## 五、SDK 功能 (sealx-sdk)

### 主要 API

```typescript
// 初始化
initSealx(userId)              // 初始化 SealX 会话
connectSealx()                 // 连接到 SealX 扩展

// 密钥
bindSealx()                    // 绑定公钥

// 签名
signBySealx(task)              // 单条签名
signBySealx([tasks])           // 批量签名（返回 AsyncGenerator）
onSign(callback, taskId)       // 监听签名响应

// 状态
isSealxActive()                // 检查扩展是否激活
isSessionAvailable()           // 检查会话是否有效
checkSealx()                   // 健康检查
checkSealxActive(callback)     // 监听激活状态变化

// 响应
sendSignResponse(taskId)       // 发送签名响应

// 关闭
closeSealx()                   // 关闭连接
```

---

## 六、扩展功能 (Chrome Extension)

### 1. 钱包功能
- [x] **创建钱包** - 生成新钱包
- [x] **导入钱包** - 导入已有私钥
- [x] **导出钱包** - 导出私钥
- [x] **密钥管理** - 密钥查看和管理

### 2. 用户界面
- [x] **登录界面** - 用户登录
- [x] **初始化向导** - 首次使用初始化
- [x] **任务详情** - 签名任务详情展示
- [x] **模板系统** - 任务模板（Authorizer, Board 等）
- [x] **全局消息** - 全局消息提示

### 3. 页面注入
- [x] **Content Script** - 网页内容注入
- [x] **In-page Script** - 页面内脚本
- [x] **Popup** - 弹出窗口
- [x] **Background** - 后台脚本
- [x] **Sandbox** - 沙盒环境

---

## 七、移动端功能 (Expo App)

- [x] **跨平台支持** - iOS/Android 双平台
- [x] **签名请求处理** - 处理来自扩展的签名请求
- [x] **钱包管理** - 移动端钱包管理

---

## 八、安全特性

- [x] **私钥加密** - 使用 crypto-js 加密存储
- [x] **PIN 验证** - PIN 码保护
- [x] **密码验证** - 密码保护
- [x] **会话超时** - 自动过期机制
- [x] **状态持久化** - 状态安全存储

---

## 九、技术栈

| 类别 | 技术 |
|------|------|
| 签名 | ethers ^6.14.3 |
| 加密 | crypto-js ^4.2.0 |
| 响应式 | RxJS ^7.8.2 |
| 扩展兼容 | webextension-polyfill |
| 移动端 | Expo / React Native |
| 扩展 | React + Vite |
| 构建 | Rollup |
| 语言 | TypeScript |

---

## 十、目录结构

```
sealx-signer/
├── app/                          # Expo 移动应用
├── extension/                    # Chrome 扩展
│   └── src/
│       ├── core/
│       │   ├── backup/          # 云备份
│       │   ├── google/          # Google Drive 集成
│       │   ├── messager/        # 消息传递
│       │   ├── state/           # 状态管理
│       │   └── topic/           # 主题定义
│       ├── entries/
│       │   ├── background/      # 后台脚本
│       │   ├── content/         # 内容脚本
│       │   ├── inpage/          # 页面脚本
│       │   ├── popup/           # 弹出窗口
│       │   ├── sandbox/         # 沙盒
│       │   └── web/             # 网页入口
│       └── components/          # UI 组件
├── packages/
│   ├── sealx-core/             # 核心库
│   │   └── src/
│   │       ├── eip712/          # EIP712 实现
│   │       ├── sealx/           # SealX 接口
│   │       ├── storage/         # 存储层
│   │       ├── state/           # 状态管理
│   │       ├── tabs/            # 标签页管理
│   │       └── utils/           # 工具函数
│   ├── sealx-message/          # 消息库
│   │   └── src/
│   │       ├── contracts/       # 消息协议
│   │       ├── enums/           # 枚举定义
│   │       ├── messager/        # 消息管理器
│   │       └── utils/           # 工具函数
│   └── sealx-sdk/              # SDK
└── server/                      # 后端服务
```

---

## 总结

| 功能模块 | 完成度 |
|---------|--------|
| EIP712 签名 | ✅ 完成 |
| 密钥管理 | ✅ 完成 |
| 账户管理 | ✅ 完成 |
| 会话管理 | ✅ 完成 |
| 消息通信 | ✅ 完成 |
| 本地存储 | ✅ 完成 |
| 云备份 (本地 + Google Drive) | ✅ 完成 |
| Chrome 扩展 | ✅ 完成 |
| 移动端 App | ✅ 基础完成 |
| SDK | ✅ 完成 |

---

*本文档由 BMAD 自动生成 - 2026-03-05*
