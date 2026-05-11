const logoPath = "../../../extension/public/logo/sealx-logo.svg";

const notes = {
  initialize: ["按现有 Initialize 页面抽取：顶部大 logo、PIN 输入区、底部口号。", "保留当前 6 格 PIN 输入和提示文案位置。", "这里是布局讨论稿，不接入 initializeSealx。"],
  initialized: ["按 Initialized 页面抽取：初始化完成标题、说明、主按钮。", "保留底部 What you see is what you sign。", "可讨论是否需要回到页面/进入首页两种入口。"],
  login: ["按 Login 页面抽取：大 logo、PIN 输入、剩余次数提示。", "当前页面留白较大，原型忠实保留用于讨论。", "不接入 login 和锁定倒计时。"],
  home: ["按 Home 页面抽取：右上设置入口、logo、地址卡、三条功能说明。", "保留当前偏介绍型主页，不做重构。", "设置菜单内容按 reset/key/session 三项展示。"],
  tasks: ["按 TaskHome + SignTaskRender 抽取：Total、Urgent 分组、黑色命令卡。", "保留大字号签名内容块和底部 Reject/Sign 按钮。", "支持展示 signing overlay 状态。"],
  taskDetail: ["按 TaskDetail 页面抽取：白色头部、返回、进度、任务内容。", "保留 1/3 子任务进度和 remaining 提示。", "内容复用当前签名卡结构。"],
  keyManage: ["按 KeyManage 页面抽取：Key Mgmt 黑色标题栏、公钥卡、Export/Import。", "保留 Back 按钮区域。", "只做静态展示。"],
  keyExport: ["按 KeyExport 页面抽取：Export Signature Key 卡片结构。", "包含导出方式、临时密码、确认密码、目录选择。", "保留当前按钮和表单密度。"],
  keyImport: ["按 KeyImport 页面抽取：Import Signature Key 卡片结构。", "包含 local/google drive 选择、文件选择、temporary code。", "保留 PIN 弹窗入口的前置表单。"],
  settings: ["按 SetSessionExpire 页面抽取：黑色标题卡和 radio 列表。", "保留 1/2/5/10/15/30 min 选项。", "底部 Cancel/Confirm 与当前布局一致。"],
  resetPin: ["按 ResetPin 页面抽取：logo、PIN 输入、提示、底部口号。", "保留先输入旧 PIN，再输入新 PIN 的页面框架。", "静态状态展示为输入旧 PIN。"]
};

const screens = {
  initialize: ["Initialize", initializeHtml()],
  initialized: ["Initialized", initializedHtml()],
  login: ["Unlock", loginHtml()],
  home: ["Home", homeHtml()],
  tasks: ["Task Queue", taskHomeHtml(false)],
  taskDetail: ["Task Detail", taskDetailHtml()],
  signing: ["Signing State", taskHomeHtml(true)],
  keyManage: ["Key Management", layoutWrap(keyManageHtml(), "Key Management")],
  keyExport: ["Export Key", layoutWrap(keyExportHtml(), "Key Export")],
  keyImport: ["Import Key", layoutWrap(keyImportHtml(), "Key Import")],
  settings: ["Settings", layoutWrap(settingsHtml(), "Set Screen Off Time")],
  resetPin: ["Reset PIN", resetPinHtml()]
};

let activeMode = "current";
let activeScreen = "initialize";
let activeDensity = "comfortable";
let activeState = "normal";

function logo() {
  return `<img class="sx-logo-img" src="${logoPath}" alt="SealX Logo" />`;
}

function pinInput(filled = 3, error = false) {
  return `<div class="sx-password-container">
    ${Array.from({ length: 6 }).map((_, i) => `<span class="sx-password ${i < filled ? "filled" : ""} ${error && i < filled ? "error" : ""}">${i < filled ? "•" : ""}</span>`).join("")}
  </div>`;
}

function initializeHtml() {
  return `<section class="sx-app sx-login-container">
    <div class="sx-login-inner">
      <div class="sx-logo-block">${logo()}</div>
      <div class="sx-pin-area">${pinInput(3)}</div>
      <div class="sx-tip">Set your 6-character PIN. It must include a mix of numbers (0-9), uppercase letters(A-Z), and lowercase letters (a-z).</div>
      <div class="sx-slogan">What you see is what you sign</div>
    </div>
  </section>`;
}

function initializedHtml() {
  return `<section class="sx-app sx-login-container">
    <div class="sx-login-inner">
      <div class="sx-logo-block">${logo()}</div>
      <div class="sx-complete">
        <div class="sx-complete-title">Initialization Completed</div>
        <div class="sx-complete-copy">Your SealX Signer has been successfully initialized. You can now return to the page to continue.</div>
        <button class="sx-btn sx-btn-primary sx-btn-full">Return to Page</button>
      </div>
      <div class="sx-slogan">What you see is what you sign</div>
    </div>
  </section>`;
}

function loginHtml() {
  return `<section class="sx-app sx-login-container">
    <div class="sx-login-inner">
      <div class="sx-logo-block login-logo">${logo()}</div>
      <div class="sx-pin-area login-pin">${pinInput(2)}</div>
      <div class="sx-tip">You have 5 attempts remaining.</div>
      <div class="sx-slogan">What you see is what you sign</div>
    </div>
  </section>`;
}

function resetPinHtml() {
  return `<section class="sx-app sx-login-container">
    <div class="sx-login-inner">
      <div class="sx-logo-block reset-logo">${logo()}</div>
      <div class="sx-pin-area login-pin">${pinInput(0)}</div>
      <div class="sx-tip">Please Input Your Pin Code.</div>
      <div class="sx-slogan">Sign What You See</div>
    </div>
  </section>`;
}

function layoutWrap(content, pageTitle = "SealX") {
  return `<section class="sx-app sx-layout">
    <header class="sx-layout-header">
      <div class="sx-connected"><span class="sx-link-icon">●</span>${pageTitle}</div>
      <div class="sx-address">0x7b31A0f4...c2b851</div>
      <button class="sx-menu-icon" aria-label="Menu"></button>
    </header>
    <main class="sx-layout-main">${content}</main>
  </section>`;
}

function proposedLayoutWrap(content, pageTitle = "SealX") {
  return `<section class="sx-app sx-layout sx-structured">
    <header class="sx-layout-header">
      <div class="sx-connected"><span class="sx-link-icon">●</span>${pageTitle}</div>
      <div class="sx-address">0x7b31A0f4...c2b851</div>
      <button class="sx-menu-icon" aria-label="Menu"></button>
    </header>
    <main class="sx-layout-main">${content}</main>
  </section>`;
}

function homeHtml() {
  return `<section class="sx-app sx-home">
    <div class="sx-home-top"><button class="sx-filter-icon" aria-label="Settings"></button></div>
    <div class="sx-logo-home">${logo()}</div>
    <div class="sx-home-content">
      <div class="sx-address-box">
        <div>Current Signer Address</div>
        <strong>0x7b31A0f4b9c8D12E43A8f6C1b2A994eD16c2b851</strong>
      </div>
      <p>A "What You See Is What You Sign" EIP712 structure data signing plugin that provides secure and transparent digital signatures for blockchain transactions.</p>
      <p>Ensure the integrity and authenticity of your EIP712 structured data with our advanced cryptographic signing technology.</p>
      <div class="sx-feature"><span>✓</span>Secure Digital Signatures</div>
      <div class="sx-feature"><span>✓</span>Browser Integration</div>
      <div class="sx-feature"><span>✓</span>Enterprise Security</div>
    </div>
  </section>`;
}

function proposedHomeHtml() {
  return `<section class="sx-app sx-home sx-structured">
    <div class="sx-home-top sx-home-top-clean"></div>
    <div class="sx-min-home">
      <div class="sx-min-brand">${logo()}</div>
      <div class="sx-min-status"><span></span>Ready</div>
      <div class="sx-min-address">0x7b31A0f4b9c8D12E43A8f6C1b2A994eD16c2b851</div>
      <div class="sx-min-meta-line">Connected to <span class="sx-host">api.vaulink.com</span> · locks after <span class="sx-time">30 min</span></div>
      <div class="sx-min-actions">
        <button>Key Management</button>
        <button>Reset PIN</button>
        <button>Screen Timer</button>
      </div>
    </div>
  </section>`;
}

function taskHomeHtml(signing) {
  return `<section class="sx-app sx-task-home">
    <div class="sx-task-toolbar">
      <button class="sx-filter-icon" aria-label="Filter"></button>
      <span>Total 2</span>
    </div>
    <div class="sx-task-container">
      <div class="sx-day-label">Urgent</div>
      ${signCard("Transfer", "08h:24m:12s", transferFields())}
      ${signCard("Set Treasury Unit", "42m:03s", treasuryFields())}
    </div>
    ${signing ? `<div class="sx-signing-overlay"><div class="sx-spinner"></div><div>Signing...</div></div>` : ""}
  </section>`;
}

function taskDetailHtml() {
  return `<section class="sx-app sx-task-detail">
    <header class="sx-detail-header">
      <div class="sx-detail-title-row">
        <button class="sx-back">‹</button>
        <span>Task Details</span>
      </div>
      <div class="sx-progress-count">1 / 3</div>
    </header>
    <div class="sx-progress-track"><div style="width:33%"></div></div>
    <main class="sx-detail-main">${signCard("Set Treasury Unit", "42m:03s", treasuryFields(), true)}</main>
    <footer class="sx-more-tasks">2 more tasks remaining</footer>
  </section>`;
}

function signCard(title, time, fields, compact = false) {
  return `<article class="sx-sign-card ${compact ? "compact" : ""}">
    <div class="sx-cmd-head">
      <strong>${title}</strong>
      <span class="sx-clock">◷ ${time}</span>
    </div>
    <div class="sx-cmd-body">${fields}</div>
    <div class="sx-action-row">
      <button class="sx-btn sx-btn-secondary">Reject</button>
      <button class="sx-btn sx-btn-primary">${compact ? "Next" : "Sign to Approve"}</button>
    </div>
  </article>`;
}

function field(label, value, icon = "□", fieldClass = "") {
  return `<div class="sx-field-card ${fieldClass}">
    <div class="sx-field-label"><span>${icon}</span>${label}</div>
    <div class="sx-field-value">${value}</div>
  </div>`;
}

function twoCol(left, right) {
  return `<div class="sx-two-col">${left}${right}</div>`;
}

function transferFields() {
  return `${twoCol(field("Command", "Transfer", "☑", "field-command"), field("Network", "Ethereum", "🔗", "field-network"))}
    ${field("指令有效时间", "2026-05-11 10:10:00 UTC+8", "◷", "field-time")}
    ${field("币种", "USDT", "◎", "field-asset")}
    ${field("源地址", "304b7de5-19eb-475c-a653-b60b09aa8bd2", "▣", "field-address")}
    ${field("数额", "100,000", "#", "field-amount")}
    ${field("目标地址", "0x91a8C2D422F5dB012D0d1667e9eF2E776b70a93c", "▣", "field-address field-target")}`;
}

function treasuryFields() {
  return `${twoCol(field("Command", "Set Treasury Unit", "☑", "field-command"), field("Valid Time", "2026-05-11 10:10:00", "◷", "field-time"))}
    ${field("Vault Code", "VAU-0429", "▣", "field-vault")}`;
}

function keyManageHtml() {
  return `<div class="sx-page-pad">
    <div class="sx-black-card">
      <div class="sx-black-title">Key Mgmt</div>
      <div class="sx-black-body">
        <div class="sx-field-card">
          <div class="sx-field-label">
            <span>▣</span>Pubkey
            <div class="sx-inline-actions">
              <button class="sx-small-primary">Export</button>
              <button class="sx-small-primary">Import</button>
            </div>
          </div>
          <div class="sx-field-value">0x7b31A0f4b9c8D12E43A8f6C1b2A994eD16c2b851</div>
        </div>
      </div>
    </div>
    <div class="sx-bottom-actions"><button class="sx-btn sx-btn-secondary">Back</button></div>
  </div>`;
}

function proposedKeyManageHtml() {
  return `<div class="sx-page-pad sx-key-minimal">
    <div class="sx-black-card">
      <div class="sx-black-title">Key Mgmt</div>
      <div class="sx-key-simple">
        <div class="sx-key-ready"><span></span>Local key ready</div>
        <div class="sx-key-pub">0x7b31A0f4b9c8D12E43A8f6C1b2A994eD16c2b851</div>
        <div class="sx-key-actions">
          <button class="sx-btn sx-btn-primary">Export</button>
          <button class="sx-btn sx-btn-secondary">Import</button>
        </div>
      </div>
    </div>
    <div class="sx-bottom-actions"><button class="sx-btn sx-btn-secondary">Back</button></div>
  </div>`;
}

function keyExportHtml() {
  return `<div class="sx-page-pad">
    <div class="sx-black-card">
      <div class="sx-black-title">Export Signature Key</div>
      <div class="sx-black-body">
        ${field("How would you like to export your backup?", `<label class="sx-radio checked"></label> To Local File<br><label class="sx-radio"></label> To Google Drive`, "□", "field-choice")}
        ${field("Temporary password", `<input class="sx-input" value="••••••••" />`, "□", "field-password")}
        ${field("Confirm temporary password", `<input class="sx-input" value="••••••••" />`, "□", "field-password")}
        ${field("Select export directory", `<input class="sx-input sx-path" value="Downloads/sealx.key (selected)" /><button class="sx-small-primary">Select</button>`, "□", "field-file")}
      </div>
    </div>
    <div class="sx-bottom-actions two"><button class="sx-btn sx-btn-secondary">Cancel</button><button class="sx-btn sx-btn-primary">Export</button></div>
  </div>`;
}

function keyImportHtml() {
  return `<div class="sx-page-pad">
    <div class="sx-black-card">
      <div class="sx-black-title">Import Signature Key</div>
      <div class="sx-black-body">
        ${field("How would you like to import your backup?", `<label class="sx-radio checked"></label> From Local File<br><label class="sx-radio"></label> From Google Drive`, "□", "field-choice")}
        ${field("Select your encrypted backup file", `<input class="sx-input sx-path" value="sealx.key" /><button class="sx-small-primary">Select</button>`, "□", "field-file")}
        ${field("Temporary code", `<input class="sx-input" value="••••••••" />`, "□", "field-password")}
      </div>
    </div>
    <div class="sx-bottom-actions two"><button class="sx-btn sx-btn-secondary">Cancel</button><button class="sx-btn sx-btn-primary">Import</button></div>
  </div>`;
}

function settingsHtml() {
  const items = [1, 2, 5, 10, 15, 30].map((t) => `<label class="sx-timer-row"><span class="sx-radio ${t === 30 ? "checked" : ""}"></span><strong>${t} min</strong></label>`).join("");
  return `<div class="sx-page-pad">
    <div class="sx-black-card">
      <div class="sx-black-title">Set Screen off Timer</div>
      <div class="sx-black-body">
        <p class="sx-desc">Choose how long your screen stays on during periods of inactivity before turning off.</p>
        <div class="sx-timer-list">${items}</div>
      </div>
    </div>
    <div class="sx-bottom-actions two"><button class="sx-btn sx-btn-secondary">Cancel</button><button class="sx-btn sx-btn-primary wide">Confirm</button></div>
  </div>`;
}

const app = document.querySelector("#extension-app");
const title = document.querySelector("#prototype-title");
const noteTitle = document.querySelector("#note-title");
const noteCopy = document.querySelector("#note-copy");
const notePoints = document.querySelector("#note-points");
const frame = document.querySelector("#device-frame");

function renderScreen(screenKey) {
  activeScreen = screenKey;
  const useProposed = activeMode === "proposed";
  let [screenTitle, html] = screens[screenKey] || screens.initialize;
  if (useProposed && screenKey === "home") {
    screenTitle = "Home · Structured";
    html = proposedHomeHtml();
  }
  if (useProposed && screenKey === "keyManage") {
    screenTitle = "Key Management · Structured";
    html = proposedLayoutWrap(proposedKeyManageHtml(), "Key Management");
  }
  app.innerHTML = html;
  app.classList.toggle("sx-polished", useProposed);
  app.classList.toggle("sx-compact", activeDensity === "compact");
  app.classList.toggle("sx-state-expiring", activeState === "expiring");
  app.classList.toggle("sx-state-error", activeState === "error");
  title.textContent = useProposed ? `${screenTitle} · Polished` : screenTitle;
  noteTitle.textContent = useProposed ? "同布局视觉精修" : "当前功能布局抽取";
  noteCopy.textContent = useProposed
    ? "Polished 版本不改页面骨架、字段顺序和数据结构，只通过色彩、字号、间距、边框、阴影和按钮状态提升专业感。"
    : "Current 版本按现有 Chrome 插件页面结构复刻，用 mock 数据展示当前布局，方便逐页讨论哪里丑、哪里需要改。";
  const points = useProposed
    ? (screenKey === "home"
      ? ["不显示待处理任务，符合 signer 无状态约束。", "首页压缩为 Ready、地址、站点、session 和三个操作。", "去掉说明性长文案和多层卡片。"]
      : screenKey === "keyManage"
        ? ["Key Management 压缩为 key 状态、pubkey、Export/Import。", "去掉备份说明卡和操作分区，避免臃肿。", "保持当前数据：pubkey、export、import、back。"]
        : [
      "不改变现有路由和组件数据结构。",
      "Comfort/Compact 只改变视觉密度，适合评估 600x800 popup 滚动压力。",
      "Normal/Expiring/Error 只模拟状态样式，后续可迁移为组件状态 class。"
    ])
    : (notes[screenKey] || notes.initialize);
  notePoints.innerHTML = points.map((point) => `<li>${point}</li>`).join("");
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.screen === screenKey));
  document.querySelectorAll(".mode-btn").forEach((button) => button.classList.toggle("active", button.dataset.mode === activeMode));
  document.querySelectorAll(".density-btn").forEach((button) => button.classList.toggle("active", button.dataset.density === activeDensity));
  document.querySelectorAll(".state-btn").forEach((button) => button.classList.toggle("active", button.dataset.state === activeState));
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => renderScreen(button.dataset.screen));
});

document.querySelectorAll(".toggle-btn").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".toggle-btn").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    frame.classList.toggle("panel", button.dataset.frame === "panel");
  });
});

document.querySelectorAll(".mode-btn").forEach((button) => {
  button.addEventListener("click", () => {
    activeMode = button.dataset.mode;
    if (activeMode === "proposed" && activeDensity === "comfortable") {
      activeDensity = "compact";
    }
    renderScreen(activeScreen);
  });
});

document.querySelectorAll(".density-btn").forEach((button) => {
  button.addEventListener("click", () => {
    activeDensity = button.dataset.density;
    renderScreen(activeScreen);
  });
});

document.querySelectorAll(".state-btn").forEach((button) => {
  button.addEventListener("click", () => {
    activeState = button.dataset.state;
    renderScreen(activeScreen);
  });
});

renderScreen("initialize");
