---
stepsCompleted: []
inputDocuments: []
---

# sealx-signer - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for sealx-signer, decomposing the requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**FR1**: 插件任务详情页渲染签名数据时，为每个数据项添加 `data-key` 属性标识
- 单层字段：`{ orderId: "ORDER-123" }` → `<span data-key="orderId">ORDER-123</span>`
- 嵌套字段：使用点号分隔，如 `message.orderId`

**FR2**: 任务数据项可点击，点击时触发定位事件

**FR3**: 插件向业务系统页面发送定位消息（包含 key 和 value）

**FR4**: 业务系统页面接收定位消息，查找对应 `data-key` 元素

**FR5**: 定位成功后高亮显示目标元素

**FR6**: 业务系统 SDK 提供 `registerLocatableKeys()` 方法注册可定位的 key

### NonFunctional Requirements

**NFR1**: 定位响应时间 < 500ms

**NFR2**: 高亮样式：蓝色边框 (2px solid #007AFF)，3秒后自动消失

**NFR3**: 支持嵌套 key 匹配（如 `message.from`）

**NFR4**: 定位失败时静默处理，不影响用户操作

### Additional Requirements

- 业务系统需要集成 SealX SDK 才能使用定位功能
- 业务系统页面需要添加 `data-key` 属性到需要被定位的元素
- 通过 Content Script 建立 Popup 与业务系统页面的消息通信

### FR Coverage Map

| FR | Epic | Story |
|----|------|-------|
| FR1 | Epic 1 | Story 1.1, 1.2 |
| FR2 | Epic 1 | Story 1.3 |
| FR3 | Epic 2 | Story 2.1 |
| FR4 | Epic 2 | Story 2.2 |
| FR5 | Epic 2 | Story 2.3 |
| FR6 | Epic 3 | Story 3.1 |

## Epic List

- Epic 1: 任务渲染数据项标识
- Epic 2: 元素定位功能
- Epic 3: 业务系统 SDK 集成

---

## Epic 1: 任务渲染数据项标识

为插件任务详情页的签名数据添加可定位的标识

### Story 1.1: 定义 data-key 属性渲染规则

As a 开发者,
I want 为任务数据渲染组件添加 data-key 属性,
So that 每个数据项都可以被唯一标识和定位。

**Acceptance Criteria:**

**Given** EIP712 签名任务包含嵌套的 message 数据
**When** 任务详情页渲染数据时
**Then** 为每个叶子节点数据项添加 `data-key` 属性
**And** 单层字段使用字段名作为 key（如 `data-key="orderId"`）
**And** 嵌套字段使用点号分隔父级字段名（如 `data-key="message.orderId"`）

### Story 1.2: 改造 SignTaskRender 组件

As a 开发者,
I want 修改 SignTaskRender 组件,
So that 自动为渲染的数据项添加 data-key 属性。

**Acceptance Criteria:**

**Given** SignTaskRender 组件渲染签名内容
**When** 组件渲染每个数据项时
**Then** 自动计算并添加正确的 `data-key` 属性
**And** 支持所有内置模板（Board、Authorizer、Transfer 等）
**And** 不影响现有的模板渲染逻辑

### Story 1.3: 为数据项添加点击事件

As a 用户,
I want 点击任务详情页中的数据项,
So that 触发定位操作。

**Acceptance Criteria:**

**Given** 任务详情页显示带有 data-key 属性的数据项
**When** 用户点击某个数据项时
**Then** 触发定位事件
**And** 事件包含该数据项的 key 和 value
**And** 视觉上有轻微的点击反馈（如 hover 效果）


---

## Epic 2: 元素定位功能

实现插件与业务系统页面的元素定位交互

### Story 2.1: 定义定位消息协议

As a 开发者,
I want 定义插件与业务系统页面之间的定位消息格式,
So that 双方能够正确传递定位信息。

**Acceptance Criteria:**

**Given** 需要实现元素定位功能
**When** 定义消息协议时
**Then** 消息包含 topic 字段（值为 'locate-element'，对应 SealxTopic.LOCATE_ELEMENT）
**And** 消息包含 payload.key 字段（要定位的 data-key 值）
**And** 消息包含可选的 payload.value 字段（当前显示的值）
**And** 在 sealx-message 包中定义 LocateElementMessage 类型
**And** 在 SealxTopic 枚举中添加 LOCATE_ELEMENT

### Story 2.2: 使用 Messager 发送定位消息

As a 开发者,
I want 使用 sealx-messager 发送定位消息,
So that 点击数据项时能触发页面元素定位。

**Acceptance Criteria:**

**Given** 用户在插件中点击数据项
**When** 触发定位事件时
**Then** 使用 Messager 发送定位消息（receiver: MessageChannel.CONTENT）
**And** Content Script 已通过 sealx-message 消息组件自动处理消息接收和转发
**And** 消息使用标准的 SealxRequest 格式
**And** 前端 SDK 通过 messager.on(SealxTopic.LOCATE_ELEMENT) 监听定位消息

### Story 2.3: 实现页面元素高亮显示

As a 开发者,
I want 业务系统页面接收到定位消息后高亮显示对应元素,
So that 用户能快速找到对应数据。

**Acceptance Criteria:**

**Given** 业务系统页面接收到 LOCATE_ELEMENT 消息
**When** 页面找到匹配 data-key 属性的元素时
**Then** 为该元素添加高亮样式
**And** 高亮样式：2px solid #007AFF 边框，rgba(0, 122, 255, 0.1) 背景色
**And** 3秒后自动移除高亮样式
**And** 定位失败时静默处理，不显示错误


---

## Epic 3: 业务系统 SDK 集成

为业务系统提供集成定位功能的能力

### Story 3.1: 扩展 SealX SDK 定位 API

As a 业务系统开发者,
I want 在业务系统中注册可定位的 key,
So that 插件能够定位到页面中的对应元素。

**Acceptance Criteria:**

**Given** 业务系统集成了 SealX SDK
**When** 页面加载时
**Then** SDK 提供 `registerLocatableKeys(keys: string[])` 方法
**And** 业务系统可以调用此方法注册需要被定位的 key
**And** SDK 监听来自扩展的定位消息
**And** 收到消息时调用页面回调函数并高亮对应元素

### Story 3.2: 创建业务系统集成示例

As a 开发者,
I want 创建业务系统集成示例页面,
So that 演示如何在实际业务系统中使用定位功能。

**Acceptance Criteria:**

**Given** 需要演示集成方式
**When** 创建示例页面时
**Then** 页面包含典型的 EIP712 签名数据（如订单信息、转账信息）
**And** 页面元素添加正确的 `data-key` 属性
**And** 页面调用 SDK 注册可定位的 key
**And** 用户可以测试点击插件数据项定位到页面元素
