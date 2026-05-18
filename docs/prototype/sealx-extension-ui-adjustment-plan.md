# SealX 插件 UI 调整实施计划

日期：2026-05-11

## 目标

在不改变签名器核心数据结构、签名流程和业务语义的前提下，提升 Chrome 插件页面的专业度、可读性和可落地性。

本轮调整以 `docs/prototype/sealx-extension-pages/` 中的 `Proposed + Compact` 原型为参考。

## 边界

本计划允许：

- 调整视觉样式、组件 class、字号、间距、颜色、边框、阴影。
- 为字段增加语义 class，例如 `field-amount`、`field-address`。
- 对 Home 和 Key Management 做轻结构调整。
- 补充按钮、PIN、字段卡、状态提示的交互态。

本计划不允许：

- 改变签名数据结构。
- 改变签名/拒签消息协议。
- 引入 pending task 到 Home。签名器视为无状态工具，只响应当前页面请求。
- 重写签名页信息顺序或改动业务字段含义。

## 设计原则

1. **Compact 作为 popup 默认密度**
   600x800 空间有限，优先减少滚动压力。

2. **保留核心布局**
   签名页保留当前黑色命令头、字段卡、底部操作区。

3. **状态清楚但克制**
   `normal`、`expiring`、`error` 使用语义色，但避免大面积红黄。

4. **字段语义化**
   样式不依赖字段顺序，改用语义 class。

5. **可访问性补齐**
   补 `focus-visible`、disabled、reduced motion、足够对比度。

## 页面调整

### Home

采用极简工具页结构：

- Logo
- Ready 状态
- 当前 signer address
- `Connected to <host> · locks after <time>`
- 三个操作：
  - Key Management
  - Reset PIN
  - Screen Timer

移除：

- marketing 介绍文案
- pending task
- 右上角更多按钮
- 多层状态卡片

### Key Management

采用极简 key 操作页结构：

- `Key Mgmt`
- `Local key ready`
- Pubkey
- Export / Import
- Back

调整点：

- Export / Import 不再挤在 Pubkey label 行右侧。
- 不增加冗长备份说明卡。
- 保持页面清晰、短路径、低认知负担。

### SignTaskRender / TaskDetail

保持当前数据结构和字段顺序，调整视觉：

- 黑色命令头改为更克制的深色渐变。
- 倒计时改为 pill。
- 字段卡边框减轻，阴影统一。
- Amount 使用浅 amber 强调。
- Address / ID 使用等宽字体。
- Reject 使用红色语义但保持次级按钮。
- Sign to Approve 保持主按钮。
- 进度条增加 `width 300ms ease-out` 过渡。

建议字段 class：

- `field-command`
- `field-network`
- `field-time`
- `field-asset`
- `field-address`
- `field-target`
- `field-amount`
- `field-vault`
- `field-choice`
- `field-file`
- `field-password`

### PIN 页面

调整点：

- logo 缩小并上移。
- PIN 输入区上移。
- 移除或弱化 slogan，禁止在 polished 模式使用 Comic Sans。
- 补 normal / focus / error / locked 状态。

### Export / Import

先做视觉精修，不做大结构重排：

- `field-choice` 表示 Local / Google Drive。
- `field-file` 表示文件或目录选择。
- `field-password` 表示备份密码/临时码。
- 输入框和 Select 按钮高度统一。
- 后续可将 Local / Google Drive 升级为 segmented control。

### Settings

保持当前 radio 列表结构：

- 使用 compact 字号和间距。
- 保持当前 1 / 2 / 5 / 10 / 15 / 30 min 数据。
- Confirm / Cancel 使用统一按钮系统。

## 组件与 token

建议先沉淀以下 token：

- `--sx-bg: #f4f6f8`
- `--sx-text: #17202a`
- `--sx-muted: #5a6677`
- `--sx-brand: #0aa06e`
- `--sx-danger: #b42318`
- `--sx-border: #dce3ea`
- `--sx-radius-sm: 10px`
- `--sx-radius-md: 12px`
- `--sx-radius-lg: 16px`
- `--sx-radius-xl: 20px`

建议组件优先级：

1. Button
2. Password / PIN input
3. Field card
4. Sign card
5. Layout header
6. Form field

## 状态体系

需要支持：

- `normal`
- `expiring`
- `error`
- `loading`
- `disabled`
- `locked`

示例：

- 签名快过期：倒计时 pill 和首个任务卡使用 amber。
- 签名错误：标题栏和主按钮使用 danger。
- PIN 错误：输入格边框与提示使用 danger。
- loading：按钮禁用，overlay 遵循 reduced motion。

## 实施顺序

1. 建立视觉 token 和基础按钮样式。
2. 调整 Password / PIN 输入组件。
3. 调整 SignTaskRender 字段卡和签名卡样式。
4. 调整 TaskDetail header、progress、remaining 提示。
5. 调整 Home 为极简工具页。
6. 调整 Key Management 为极简 key 操作页。
7. 调整 Export / Import / Settings 表单密度。
8. 替换字段 Emoji 图标为 SVG 或统一 icon set。

## 验证方式

至少验证：

- `npm run build` 或 extension 对应构建命令。
- Popup 600x800 下核心页面无横向滚动。
- Side panel 下布局不拉伸失控。
- SignTaskRender 长地址、长 coin、长 taskId 可读。
- PIN 错误态、锁定态、初始化中状态可见。
- 键盘 Tab 可见 focus ring。
- `prefers-reduced-motion` 下 spinner/press 动画被削弱。

## 原型入口

本次讨论原型：

`docs/prototype/sealx-extension-pages/index.html`

推荐查看组合：

- `Proposed`
- `Compact`
- `Normal / Expiring / Error`

