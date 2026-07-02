# sealx-sdk

JavaScript/TypeScript SDK for integrating the [SealX browser extension](https://github.com/taiyi-research-institute/sealx-signer) into your web application.

SealX enables cryptographic document signing. This SDK handles session management, the signing flow, and the Side Panel gesture bridge — so you just call `signBySealx(task)` and get back a signature.

## Requirements

- **TypeScript**: `>=5.8` (uses `AsyncGenerator` and other modern TS features). The SDK itself is built with TS 5.8.3.
- **Browser**: **Chrome only** (Chromium-based browsers including Edge). The SDK relies on the Chrome Extension APIs (`chrome.sidePanel.open`, `chrome.runtime`, etc.) which are Chrome-specific. Firefox / Safari / non-Chromium Edge are **not** supported.
- **Node.js**: Not supported. This SDK runs in a browser page context (inpage script), not in Node.

## Installation

```bash
npm install sealx-sdk
```

Install the **SealX browser extension** from the Chrome Web Store (link TBD).

## Quick Start (5 minutes)

```typescript
import {
  isSealxActive,
  initSealx,
  bindSealx,
  signBySealx,
  onSign,
  SealxSignTask,
} from 'sealx-sdk';

// 1. Check the extension is installed
if (!(await isSealxActive())) {
  alert('Please install the SealX extension');
}

// 2. Initialize a session for the current user
await initSealx(currentUser.id);

// 3. Bind a public key (one-time; opens extension popup)
const publicKey = await bindSealx(currentUser.id);
await backend.saveUserKey(currentUser.id, publicKey);

// 4. Sign a document
const task: SealxSignTask = {
  taskId: 'doc-123',
  taskType: 'eip712',
  command: 'signTypedData',
  signContent: buildSignContent(documentContent),
  validUntilTime: 'hours',
};

const { signature } = await signBySealx<{ signature: string }>(task);
await backend.saveSignature('doc-123', signature);

// 5. Listen for results (optional but recommended)
const cleanup = onSign(async (request) => {
  console.log(`Signed: ${request.payload.taskId}`);
});
```

That's the minimum viable integration. For the full walkthrough, see the [Integration Guide](./docs/integration-guide.md).

## Core Concepts

### Extension availability

Before any SealX call, verify the extension is installed and active:

```typescript
if (!(await isSealxActive())) {
  // prompt user to install
}
```

The result is cached for 5 seconds to avoid redundant checks.

### Session lifecycle

A **session** is a short-lived, signed token between your app and the extension. It has an `expire` timestamp.

- Create: `initSealx(userId)` — once per user login.
- Reuse: the SDK automatically syncs the session from every response, so it stays fresh.
- Renew: if `isSessionAvailable()` returns `false`, call `connectSealx(userId)`.
- You rarely need to worry about expiration — the SDK handles it.

### User gesture requirement (Side Panel)

When SealX opens as a Chrome Side Panel, `signBySealx()` internally calls `chrome.sidePanel.open()`. Browsers **reject** this call unless it's triggered by a real user click.

To satisfy this, add the `sealx-component` boolean attribute to your sign button:

```html
<button sealx-component onclick="handleSign()">Sign</button>
```

The SDK automatically wires up the click to the Side Panel gesture bridge. No manual setup needed.

> **Don't** write `sealx-component="true"` or `sealx-component="false"` — it's a boolean attribute. Any value (including `"false"`) activates it.

## API Overview

### Lifecycle

| API | Purpose |
|---|---|
| `isSealxActive()` | Check if extension is installed and active |
| `initSealx(userId)` | Initialize session for a user |
| `connectSealx(userId?)` | Reconnect if session expired |
| `isSessionAvailable()` | Check if a valid, non-expired session exists |
| `closeSealx()` | Close connection (rarely needed) |
| `checkSealx()` | Low-level health check |
| `checkSealxActive(callback)` | Subscribe to activation status changes |
| ~~`sealxActive`~~ | ⚠️ deprecated, use `isSealxActive()` |

### Signing

| API | Purpose |
|---|---|
| `bindSealx(userId?)` | Bind a public key to the account (opens popup) |
| `signBySealx(task)` | Sign a single task → `Promise<T>` |
| `signBySealx(tasks[])` | Sign multiple tasks → `AsyncGenerator<T>` |
| `sendSignResponse(taskId, error?)` | Acknowledge a signing result to the extension |
| `onSign(callback, taskId?)` | Subscribe to signing results |

### DOM Integration

| API | Purpose |
|---|---|
| `setupSealxActions()` | Scan DOM for `sealx-component` elements (auto-called) |
| `registerLocatableKeys(keys)` | Register which `data-key` attributes are locatable |
| `onLocateElement(callback?)` | Subscribe to element-locate requests from the extension |

### Events

| API | Purpose |
|---|---|
| `onPanelClose(callback)` | Subscribe to Side Panel close events |

For full signatures, parameters, return types, and error behavior, see the [API Reference](./docs/api-reference.md).

## Advanced Topics

### Side Panel Gesture Relay

The `sealx-component` attribute wires your button's click into the extension's Side Panel gesture bridge.

```html
<button sealx-component onclick="handleSign()">Sign</button>
```

The SDK automatically:
- Scans for `sealx-component` elements on page load
- Uses `MutationObserver` to detect dynamically added elements (React/Vue)
- Annotates each element so the content script can open the Side Panel on click

For the full chain diagram and framework integration notes, see the [Integration Guide § Side Panel Gesture Relay](./docs/integration-guide.md#side-panel-gesture-relay).

### Batch Signing (AsyncGenerator)

Sign multiple documents in a single extension session:

```typescript
const generator = await signBySealx(tasks); // tasks is an array
for await (const signature of generator) {
  console.log('Signed:', signature);
  updateProgressUI();
}
```

See the [Integration Guide § Batch Signing](./docs/integration-guide.md#batch-signing-asyncgenerator) for error handling and progress tracking.

### Element Location & Panel Close Events

The extension can ask your app to highlight specific elements in the page:

```typescript
import { registerLocatableKeys, onLocateElement, onPanelClose } from 'sealx-sdk';

registerLocatableKeys(['orderId', 'amount', 'recipient']);

onLocateElement(); // uses default [data-key="..."] lookup

onPanelClose(() => {
  setPanelOpen(false);
  refreshDataFromBackend();
});
```

See the [Integration Guide § Element Location & Panel Close Events](./docs/integration-guide.md#element-location--panel-close-events).

## Error Reference

All SealX-specific errors extend `SealxException`. Catch them with `instanceof`:

| Error | When | Recovery |
|---|---|---|
| `SealxUnavailableException` | Extension missing/inactive | Prompt user to install |
| `SealxUninitializedException` | Forgot to call `initSealx()` | Call `initSealx(userId)` |
| `SessionException` | Session init failed | Call `connectSealx(userId)` |
| `PkException` | Public key mismatch | Call `bindSealx(userId)` |
| `SignException` | Signing failed | Retry or show error |

```typescript
import {
  SealxUnavailableException,
  SealxUninitializedException,
  SessionException,
  PkException,
  SignException,
} from 'sealx-sdk';

try {
  await signBySealx(task);
} catch (error) {
  if (error instanceof SealxUnavailableException) showInstallPrompt();
  else if (error instanceof SealxUninitializedException) await initSealx(userId);
  else if (error instanceof SessionException) await connectSealx(userId);
  else if (error instanceof PkException) await bindSealx(userId);
  else if (error instanceof SignException) showSignError();
  else throw error;
}
```

See the [Integration Guide § Error Handling](./docs/integration-guide.md#error-handling) for the complete recovery pattern.

## Documentation

- **[Quick Start (this page)](#quick-start-5-minutes)** — 6-step minimal integration
- **[Integration Guide](./docs/integration-guide.md)** — full walkthrough: gesture relay, batch signing, element location, error handling, common pitfalls
- **[API Reference](./docs/api-reference.md)** — every API, with parameters, returns, throws, and examples

## Types

Key types exported from `sealx-core`:

- `SealxSignTask` — the shape of a signing task
- `SealxSession` — session metadata (id, expire, address, pk, …)
- `SealxAccount` — user account metadata (userId, pk, newPk, …)

Full type definitions: see the [API Reference § Types](./docs/api-reference.md#types).

## Browser Extension Integration

The SealX browser extension must be installed for this SDK to work.

## License

MIT
