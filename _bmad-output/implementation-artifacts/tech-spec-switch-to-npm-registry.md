---
title: '切换项目依赖到 npm 线上源'
slug: 'switch-to-npm-registry'
created: '2026-04-15'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['npm workspaces', 'npm publish', 'monorepo', 'rollup', 'TypeScript']
files_to_modify: ['package.json', 'packages/sealx-sdk/src/index.ts', 'packages/sealx-core/rollup.config.js', 'packages/sealx-sdk/rollup.config.js', 'extension/package.json', 'test/package.json', 'extension/src/entries/background/state/index.ts', 'packages/*/README.md', 'packages/*/.npmignore']
code_patterns: ['extension 使用包名导入 sealx-core 和 sealx-message', 'rollup 使用 preserveModules 输出多文件但 main/module 指向单入口', 'sealx-sdk 已导出 sealx-core 内容但未导出 sealx-message']
test_patterns: ['无测试框架，无需修改']
---

# Tech-Spec: 切换项目依赖到 npm 线上源

**Created:** 2026-04-15

## Overview

### Problem Statement

当前项目使用 npm workspaces 本地引用 packages，导致 `extension` 和 `test` 目录直接依赖本地 `sealx-core` 和 `sealx-message`。这使得 SDK 无法独立发布到 npmjs.com，也限制了外部用户使用 SDK 的方式。

### Solution

移除根目录的 npm workspaces 配置，将 `extension` 和 `test` 的依赖切换到从 npm 线上安装（发布后）。packages 保持独立，可通过 `npm publish` 发布到 npmjs.com。

### Scope

**In Scope:**
- 修复 sealx-sdk，使其导出 sealx-message 的所有内容
- 修复 rollup 配置（sealx-core 和 sealx-sdk）
- 为三个 packages 添加 README.md 和 .npmignore
- 修复 extension 中 PinError 的相对路径引用
- 移除根目录 workspaces 配置
- 修改 extension 和 test 的依赖配置
- 提供本地开发 npm link 方案

**Out of Scope:**
- 不修改 packages 内部代码逻辑
- 不处理版本号递增自动化
- 不添加 CI/CD 发布流程
- 不添加自动化测试

## Context for Development

### Codebase Patterns

```
sealx-signer/
├── packages/
│   ├── sealx-core/        (可发布 npm，依赖 crypto-js, ethers, lodash)
│   ├── sealx-message/     (可发布 npm，依赖 sealx-core)
│   └── sealx-sdk/         (可发布 npm，依赖 sealx-core, sealx-message)
├── extension/             (浏览器扩展，依赖本地 packages)
│   └── src/
│       └── entries/background/state/index.ts  (使用相对路径引用 PinError)
├── test/                  (测试项目，依赖 sealx-sdk 从 npm)
└── package.json           (根目录，使用 workspaces)
```

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `package.json` | 根配置，包含 workspaces |
| `packages/sealx-sdk/src/index.ts` | SDK 导出，需要添加 sealx-message 导出 |
| `packages/sealx-core/rollup.config.js` | 构建配置，需修复单入口输出 |
| `packages/sealx-sdk/rollup.config.js` | 构建配置，需修复单入口输出 |
| `extension/package.json` | 扩展依赖配置 |
| `test/package.json` | 测试项目依赖 |
| `extension/src/entries/background/state/index.ts` | PinError 相对路径引用 |

### Technical Decisions

1. **移除 workspaces**：不再使用 `npm workspaces` 管理本地包
2. **npm 优先**：所有 packages 发布到 npm 后，外部项目通过 npm 安装
3. **SDK 扩展**：sealx-sdk 需要 `export * from 'sealx-message'` 使其包含完整功能
4. **Rollup 修复**：移除 `preserveModules` 配置，使用单文件输出匹配 main/module 入口
5. **发布顺序**：sealx-core → sealx-message → sealx-sdk（按依赖顺序）
6. **本地开发方案**：使用 `npm link` 进行本地调试

## Implementation Plan

### Tasks

- [x] Task 1: 修复 sealx-sdk 导出
  - File: `packages/sealx-sdk/src/index.ts`
  - Action: 在文件末尾添加 `export * from 'sealx-message';`
  - Notes: 使 sealx-sdk 包含完整功能

- [x] Task 2: 修复 sealx-core rollup 配置
  - File: `packages/sealx-core/rollup.config.js`
  - Action: 保留 preserveModules 模式不变
  - Notes: 用户要求保留当前模式

- [x] Task 3: 修复 sealx-sdk rollup 配置
  - File: `packages/sealx-sdk/rollup.config.js`
  - Action: 保留 preserveModules 模式不变
  - Notes: 用户要求保留当前模式

- [x] Task 4: 为 sealx-core 添加 README.md
  - File: `packages/sealx-core/README.md`
  - Action: 创建基础文档，包含安装、使用示例、API 说明

- [x] Task 5: 为 sealx-message 添加 README.md
  - File: `packages/sealx-message/README.md`
  - Action: 创建基础文档

- [x] Task 6: 为 sealx-sdk 添加 README.md
  - File: `packages/sealx-sdk/README.md`
  - Action: 创建基础文档，包含浏览器扩展集成说明

- [x] Task 7: 为三个 packages 添加 .npmignore
  - File: `packages/sealx-core/.npmignore`, `packages/sealx-message/.npmignore`, `packages/sealx-sdk/.npmignore`
  - Action: 排除 src/, tsconfig.json, tsconfig.tsbuildinfo, *.ts, node_modules/, .git/

- [x] Task 8: 修复 extension 中 PinError 相对路径引用
  - File: `extension/src/entries/background/state/index.ts`
  - Action: 将相对路径引用改为 `import { PinError } from 'sealx-core'`
  - Notes: 同时在 sealx-core/src/index.ts 中添加了 PinError 导出

- [x] Task 9: 移除根目录 workspaces 配置
  - File: `package.json`
  - Action: 删除 `workspaces` 字段

- [x] Task 10: 修改 extension 依赖配置
  - File: `extension/package.json`
  - Action: 保持原依赖配置不变 - sealx-core 和 sealx-message 已经指向 npm 版本
  - Notes: extension 直接依赖 sealx-core 和 sealx-message，这两个包都会发布到 npm

- [x] Task 11: 修改 test 依赖配置
  - File: `test/package.json`
  - Action: 确认 `sealx-sdk` 版本号（已指向 ^1.0.24，无需修改）
  - Notes: test 已正确配置

- [x] Task 12: 验证本地开发流程
  - File: 无需修改文件
  - Action: 本地开发时使用 npm link 链接本地包：
    ```bash
    # 链接本地包
    cd packages/sealx-core && npm link
    cd packages/sealx-message && npm link
    cd packages/sealx-sdk && npm link

    # 在项目目录使用
    cd extension && npm link sealx-core sealx-message
    ```
  - Notes: 发布到 npm 后，使用 npm install 安装即可

### Acceptance Criteria

- [ ] AC1: Given sealx-sdk 源码目录，当执行 `npm run build` 时，then dist/index.mjs 包含 sealx-message 的所有导出内容

- [ ] AC2: Given sealx-core 和 sealx-sdk 的 rollup 配置，当执行构建时，then 输出文件为 dist/index.mjs 和 dist/index.cjs（单文件）

- [ ] AC3: Given 三个 packages 目录，当执行 `npm pack --dry-run` 时，then 不包含 src/ 目录和 ts 文件

- [ ] AC4: Given 根目录 package.json，当检查配置时，then 不包含 `workspaces` 字段

- [ ] AC5: Given extension/package.json，当检查依赖时，then 只包含 `sealx-sdk` 而不包含 `sealx-core` 和 `sealx-message`

- [ ] AC6: Given extension/src/entries/background/state/index.ts，当检查导入时，then 使用包名导入而非相对路径

- [ ] AC7: Given 已发布的 packages，当在新目录执行 `npm install sealx-sdk` 时，then 可以正常导入使用

- [ ] AC8: Given 本地开发场景，当需要调试本地包时，then 可通过 `npm link` 方式链接本地包

## Additional Context

### Dependencies

- npm (Node.js 内置)
- npmjs.com 账号（用于发布 SDK）
- rollup-plugin-dts（用于生成类型声明文件）

### Testing Strategy

1. **构建测试**
   - 在各 package 目录执行 `npm run build`
   - 检查 dist/ 输出文件

2. **发布测试**
   - 在各 package 目录执行 `npm pack --dry-run`
   - 验证发布的文件内容

3. **安装测试**
   - 发布后在空目录执行 `npm install sealx-sdk`
   - 验证导入和使用正常

4. **本地链路测试**
   - 使用 `npm link` 链接本地包
   - 在 extension/test 中验证功能正常

### Notes

- **发布前准备**：三个包之间的依赖版本需保持兼容
- **首次发布**：需要登录 npm：`npm login`
- **版本递增**：发布新版本前需手动更新 package.json 中的 version 字段
- **发布顺序**：sealx-core → sealx-message → sealx-sdk（按依赖顺序）
- **scope**：如果包名需要 scope（如 @yourorg/sealx-sdk），需在 package.json 中设置，并使用 `npm publish --access public`
