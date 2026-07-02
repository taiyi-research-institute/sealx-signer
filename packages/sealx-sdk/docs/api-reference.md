# SealX SDK — API Reference

> **Audience**: Frontend developers integrating the SealX SDK into their applications.
> **Scenario**: This reference uses a consistent fictional app, **`sealx-demo-app`** (a React + TypeScript document signing SPA), so examples across docs feel connected.
> **For a hands-on tutorial**: see [`./integration-guide.md`](./integration-guide.md).

---

## Table of Contents

1. [Lifecycle APIs](#lifecycle-apis)
   - [`isSealxActive()`](#issealxactive)
   - [`initSealx(userId)`](#initsealxuserid)
   - [`connectSealx(userId?)`](#connectsealxuserid)
   - [`isSessionAvailable()`](#issessionavailable)
   - [`closeSealx()`](#closesealx)
   - [`checkSealx()`](#checksealx)
   - [`checkSealxActive(callback)`](#checksealxactivecallback)
   - [`sealxActive`](#sealxactive-deprecated) ⚠️ deprecated
2. [Signing APIs](#signing-apis)
   - [`bindSealx(userId?)`](#bindsealxuserid)
   - [`signBySealx(task | tasks[], userId?)`](#signbysealxtask--tasks-userid)
   - [`sendSignResponse(taskId, error?, userId?)`](#sendsignresponsetaskid-error-userid)
   - [`onSign(callback, taskId?)`](#onsigncallback-taskid)
3. [DOM Integration APIs](#dom-integration-apis)
   - [`setupSealxActions()`](#setupsealxactions)
   - [`registerLocatableKeys(keys)`](#registerlocatablekeyskeys)
   - [`onLocateElement(locateCallback?)`](#onlocateelementlocatecallback)
4. [Event APIs](#event-apis)
   - [`onPanelClose(callback)`](#onpanelclosecallback)
5. [Types](#types)
6. [Error Reference](#error-reference)

---

## Lifecycle APIs

These APIs manage the connection between your app and the SealX browser extension. Call them in order: check → init → sign → close.

### `isSealxActive()`

```typescript
isSealxActive(): Promise<boolean>
```

**Purpose**: Check whether the SealX browser extension is installed and active in the user's browser.

**Behavior**:
- Sends a `CHECK_INITIALIZED` message to the extension background script.
- Returns `true` if the extension is installed and responding, `false` otherwise.
- Results are cached for **5 seconds** to avoid redundant messages.
- This is the **first thing you should check** before any other SealX call.

**Parameters**: None.

**Returns**: `Promise<boolean>` — `true` if extension is available.

**Throws**: None (returns `false` on failure, never throws).

**Example**:
```typescript
import { isSealxActive } from 'sealx-sdk';

async function checkAvailability() {
  const available = await isSealxActive();
  if (!available) {
    console.warn('Please install the SealX extension to continue');
    return;
  }
  // safe to proceed
}
```

---

### `initSealx(userId)`

```typescript
initSealx(userId: string | number): Promise<void>
```

**Purpose**: Initialize the SealX session for a specific user. Must be called before any signing operations.

**Behavior**:
1. Calls `isSealxActive()` internally. Throws `SealxUnavailableException` if the extension is not active.
2. Creates or reuses a session on the extension side.
3. Registers the `userId` with the extension.
4. Syncs the returned session to `window.sealxSigner` and `messager.session` automatically.

**Parameters**:
- `userId: string | number` — Required. The unique identifier from your authentication system.

**Returns**: `Promise<void>`

**Throws**:
- `SealxUnavailableException` — if the extension is not installed or not active.
- `SessionException` — if the extension rejects the connection or communication fails.
- `Error` — if `userId` is empty.

**Example**:
```typescript
import { initSealx, SealxUnavailableException, SessionException } from 'sealx-sdk';

async function setup(user: { id: string }) {
  try {
    await initSealx(user.id);
    console.log('SealX session initialized for', user.id);
  } catch (error) {
    if (error instanceof SealxUnavailableException) {
      showInstallPrompt();
    } else if (error instanceof SessionException) {
      showSessionError();
    } else {
      throw error;
    }
  }
}
```

---

### `connectSealx(userId?)`

```typescript
connectSealx(userId?: string | number): Promise<void>
```

**Purpose**: Establish or re-establish a connection to the SealX extension. Use when the session has expired or when you need to reconnect explicitly.

**Behavior**:
1. Verifies the extension is active.
2. Sends a `CONNECT` message to the background script with `{ userId, title: document.title }`.
3. Updates `sealxSigner.session` and `sealxSigner.account` from the response.
4. Syncs `messager.session` with the new session.

**Parameters**:
- `userId?: string | number` — Optional. If provided and different from the current `account.userId`, updates the account.

**Returns**: `Promise<void>`

**Throws**:
- `SealxUnavailableException` — if the extension is not active.
- `SealxUninitializedException` — if `account.userId` is not set (call `initSealx` first or pass `userId`).
- `SessionException` — if the connection fails.

**Example**:
```typescript
import { connectSealx, isSessionAvailable } from 'sealx-sdk';

async function reconnect(userId: string) {
  if (!isSessionAvailable()) {
    await connectSealx(userId);
  }
}
```

---

### `isSessionAvailable()`

```typescript
isSessionAvailable(): boolean
```

**Purpose**: Check whether a valid, non-expired session exists.

**Behavior**:
- Returns `true` if `sealxSigner.session` exists AND `session.expire >= Date.now()`.
- Does not send any network requests (pure in-memory check).

**Parameters**: None.

**Returns**: `boolean`

**Throws**: None.

**Example**:
```typescript
import { isSessionAvailable, connectSealx, signBySealx } from 'sealx-sdk';

async function safeSign(task: SealxSignTask, userId: string) {
  if (!isSessionAvailable()) {
    await connectSealx(userId);
  }
  return await signBySealx(task, userId);
}
```

---

### `closeSealx()`

```typescript
closeSealx(): Promise<void>
```

**Purpose**: Send a close message to the extension background. Use to clean up when your app is done with SealX.

**Behavior**:
- Sends a `CLOSE` message on the `BACKGROUND` channel.
- Does not clear `window.sealxSigner` state — just notifies the extension.
- Typically you do NOT need to call this manually; `sendSignResponse()` auto-sends `CLOSE` 500ms after signing.

**Parameters**: None.

**Returns**: `Promise<void>`

**Throws**: None (silently fails if extension is gone).

**Example**:
```typescript
import { closeSealx } from 'sealx-sdk';

window.addEventListener('beforeunload', () => {
  closeSealx();
});
```

---

### `checkSealx()`

```typescript
checkSealx(): Promise<string | null>
```

**Purpose**: Low-level health check. Returns the extension status payload if initialized, `null` otherwise.

**Behavior**:
- Sends `CHECK_INITIALIZED` to the background.
- Retries up to **3 times** with 100ms delays between attempts.
- Does NOT use the 5s TTL cache (unlike `isSealxActive()`).

**Parameters**: None.

**Returns**: `Promise<string | null>` — the extension status payload (typically a boolean-like string), or `null` if unavailable.

**Throws**: None.

**Example**:
```typescript
import { checkSealx } from 'sealx-sdk';

async function deepHealthCheck() {
  const status = await checkSealx();
  if (status) {
    console.log('Extension ready:', status);
  } else {
    console.log('Extension not available');
  }
}
```

---

### `checkSealxActive(callback)`

```typescript
checkSealxActive(callback: (address: string) => void): void
```

**Purpose**: Set up a callback that fires whenever the extension activation status changes. The callback is invoked both on passive pushes from the extension and on an active 2-second polling loop.

**Behavior**:
- Registers a global listener for `CHECK_INITIALIZED` messages.
- Starts a 2-second `setInterval` that sends `CHECK_INITIALIZED` and calls the callback with the result.
- Previous interval (if any) is cleared when called again.

**Parameters**:
- `callback: (address: string) => void` — receives the extension status payload (address-like string or empty string if inactive).

**Returns**: `void`

**Throws**: None.

**Example**:
```typescript
import { checkSealxActive } from 'sealx-sdk';

checkSealxActive((status) => {
  if (status) {
    console.log('Extension activated:', status);
    updateUI({ extensionActive: true });
  } else {
    console.log('Extension deactivated');
    updateUI({ extensionActive: false });
  }
});
```

---

### `sealxActive` (deprecated)

```typescript
/** @deprecated Use isSealxActive instead */
export const sealxActive = isSealxActive;
```

**Purpose**: Legacy alias for `isSealxActive()`. New code should use `isSealxActive()` directly.

---

## Signing APIs

These APIs handle the actual signing workflow. The flow is typically: `bindSealx` (once) → `signBySealx` (per document) → `onSign` (listen for results) → `sendSignResponse` (ack).

### `bindSealx(userId?)`

```typescript
bindSealx(userId?: string | number): Promise<string>
```

**Purpose**: Bind a public key to the current SealX account. Opens the extension popup to let the user generate or import a key.

**Behavior**:
1. Verifies extension is active.
2. Sends a `BIND_PK` message to the popup channel.
3. The extension opens its popup UI; the user completes the key-binding flow.
4. Returns the bound public key.
5. After binding, the extension auto-closes.

**Parameters**:
- `userId?: string | number` — Optional. If different from current `account.userId`, updates the account first.

**Returns**: `Promise<string>` — the bound public key.

**Throws**:
- `SealxUnavailableException` — if the extension is not active.
- `SealxUninitializedException` — if `account.userId` is not set.
- `Error` — if binding fails or no payload is returned.

**Example**:
```typescript
import { bindSealx, initSealx } from 'sealx-sdk';

async function bindUserKey(userId: string) {
  await initSealx(userId);
  const pk = await bindSealx(userId);
  console.log('Public key bound:', pk);
  // save pk to your backend
}
```

---

### `signBySealx(task | tasks[], userId?)`

```typescript
signBySealx<T = unknown>(
  task: SealxSignTask | SealxSignTask[],
  userId?: string | number
): Promise<T | AsyncGenerator<T> | undefined>
```

**Purpose**: Sign a single document or a batch of documents.

**Behavior**:
- **Single task**: sends `SIGN` to the popup; returns the signed payload of type `T`.
- **Array of tasks**: sends `BATCH_SIGN` as a stream; returns an `AsyncGenerator<T>` that yields each signature as it becomes available.
- Requires `account.userId` to be set (call `initSealx` first).
- If `account.newPk !== account.pk`, throws `PkException` (pending key change must be resolved first).

**Parameters**:
- `task: SealxSignTask | SealxSignTask[]` — the task or tasks to sign.
- `userId?: string | number` — Optional. Updates the account if different.

**Returns** (note the union — see "Handling the return type" below):
- For single task: `Promise<T>` — the signed payload.
- For batch tasks: `AsyncGenerator<T>` — iterate with `for await`.
- `undefined` only in error cases (see Throws).

**Handling the return type in strict TypeScript**:

Because the return type is a union, TypeScript won't let you use the result directly without narrowing. The easiest pattern is to branch on the input shape:

```typescript
import { signBySealx, SealxSignTask } from 'sealx-sdk';

async function signSingle(task: SealxSignTask) {
  // Single task → Promise<T>
  const signature = (await signBySealx<{ signature: string }>(task)) as { signature: string };
  return signature;
}

async function signBatch(tasks: SealxSignTask[]) {
  // Array of tasks → AsyncGenerator<T>
  const generator = (await signBySealx<{ signature: string }>(tasks)) as AsyncGenerator<{ signature: string }>;
  const results = [];
  for await (const sig of generator) {
    results.push(sig);
  }
  return results;
}
```

If you want runtime type safety instead of `as` casts, check with `Symbol.asyncIterator`:

```typescript
const result = await signBySealx(tasksOrSingle);
if (result && typeof (result as any)[Symbol.asyncIterator] === 'function') {
  for await (const sig of result as AsyncGenerator<any>) {
    // handle each signature
  }
} else if (result) {
  // single signature payload
}
```

**Throws**:
- `SealxUnavailableException` — if the extension is not active.
- `SealxUninitializedException` — if `account.userId` is not set.
- `PkException` — if `account.newPk !== account.pk`.
- `SignException` — if the signing operation fails.
- `Error` — for other unexpected errors.

**Example (single task)**:
```typescript
import { signBySealx, SealxSignTask, SignException } from 'sealx-sdk';

async function signDocument(doc: { id: string; content: string }) {
  const task: SealxSignTask = {
    taskId: doc.id,
    taskType: 'eip712',
    command: 'signTypedData',
    signContent: buildSignContent(doc.content),
    validUntilTime: 'hours',
  };

  try {
    const signature = await signBySealx<{ signature: string }>(task);
    console.log('Document signed:', signature);
    return signature;
  } catch (error) {
    if (error instanceof SignException) {
      console.error('User rejected signing or extension error:', error);
    }
    throw error;
  }
}
```

**Example (batch)**:
```typescript
import { signBySealx, SealxSignTask, SignException } from 'sealx-sdk';

async function signBatch(docs: { id: string; content: string }[]) {
  const tasks: SealxSignTask[] = docs.map((d) => ({
    taskId: d.id,
    taskType: 'eip712',
    command: 'signTypedData',
    signContent: buildSignContent(d.content),
    validUntilTime: 'hours',
  }));

  const generator = await signBySealx<{ signature: string }>(tasks);
  if (!generator || typeof generator[Symbol.asyncIterator] !== 'function') {
    throw new Error('Expected AsyncGenerator');
  }

  const results: { taskId: string; signature: string }[] = [];
  try {
    for await (const signature of generator) {
      results.push({ taskId: docs[results.length].id, signature: signature.signature });
      updateProgress(results.length, docs.length);
    }
  } catch (error) {
    if (error instanceof SignException) {
      console.error(`Batch signing failed at task ${results.length}:`, error);
    }
    throw error;
  }
  return results;
}
```

---

### `sendSignResponse(taskId, error?, userId?)`

```typescript
sendSignResponse(taskId: string, error?: string, userId?: string | number): Promise<any>
```

**Purpose**: Acknowledge receipt of a signed result to the extension. Called inside an `onSign` callback after your app has processed the signature.

**Behavior**:
1. Sends `SIGN_RESPONSE` with `{ taskId, error }` to the popup.
2. **Auto-sends `CLOSE` 500ms later** to notify the background to close the popup.
3. Your app does **NOT** need to call `closeSealx()` after this.

> ⚠️ **Non-blocking delay**: The 500ms delay uses `setTimeout` internally, so the CLOSE message is sent *after* this function returns. If you call something that depends on the popup being closed immediately after `sendSignResponse`, you'll hit a race condition. Wrap dependent logic in a `setTimeout(..., 600)` or similar if you need to wait for the popup to actually close.

**Parameters**:
- `taskId: string` — Required. The task ID of the signing operation.
- `error?: string` — Optional. If provided, tells the extension the signing failed (the extension can then show an error state).
- `userId?: string | number` — Optional.

**Returns**: `Promise<any>` — the response payload from the extension.

**Throws**:
- `SealxUnavailableException`
- `SealxUninitializedException`
- `SignException` — if no payload is returned.

**Example**:
```typescript
import { onSign, sendSignResponse } from 'sealx-sdk';

// Listen for signing results and acknowledge them
onSign(async (request) => {
  const { taskId, signatures } = request.payload;

  try {
    await saveSignatureToBackend(taskId, signatures);
    await sendSignResponse(taskId); // no error = success
  } catch (error) {
    await sendSignResponse(taskId, error instanceof Error ? error.message : String(error));
    throw error; // re-throw so onSign catches it
  }
});
```

---

### `onSign(callback, taskId?)`

```typescript
onSign(callback: MessageHandle, taskId?: string | number | string[] | number[]): () => void
```

**Purpose**: Subscribe to signing results from the extension. Optionally filter by task ID(s).

**Behavior**:
- Registers a listener for `SIGN_RESPONSE` messages on the `POPUP` channel.
- If `taskId` is provided:
  - Single string/number: only fires when the payload matches that `taskId`.
  - Array: fires when payload matches any of the listed `taskId`s.
  - Omitted: fires for ALL signing results.
- Automatically calls `sendSignResponse(taskId)` after the callback resolves successfully.
- If the callback throws, calls `sendSignResponse(taskId, error)` and swallows the exception.

**Parameters**:
- `callback: MessageHandle` — `async (request, reply?) => {...}`. Receives the signing result.
- `taskId?: string | number | string[] | number[]` — Optional filter.

**Returns**: `() => void` — a cleanup function to unsubscribe.

**Throws**: None (errors inside callback are routed through `sendSignResponse`).

**Example**:
```typescript
import { onSign } from 'sealx-sdk';

// Listen for a specific task
const cleanup = onSign(async (request) => {
  const { taskId, signatures } = request.payload;
  console.log(`Signed ${taskId}:`, signatures);
  await backend.confirm(taskId, signatures);
}, 'task-123');

// Listen for multiple specific tasks
const cleanup = onSign(async (request) => {
  console.log('Signed:', request.payload);
}, ['task-123', 'task-456']);

// Listen for ALL signing results
const cleanup = onSign(async (request) => {
  console.log('Any task signed:', request.payload);
});

// Cleanup when done
useEffect(() => {
  const cleanup = onSign(...);
  return cleanup;
}, []);
```

---

## DOM Integration APIs

These APIs manage the Side Panel gesture bridge. Chrome's `sidePanel.open()` requires a real user click — these APIs let the SDK wire up the click event automatically.

### `setupSealxActions()`

```typescript
setupSealxActions(): void
```

**Purpose**: Scan the DOM for elements with the `sealx-component` boolean attribute and annotate them with `data-sealx-action="open"`.

**Behavior**:
- Called automatically on `DOMContentLoaded` (or immediately if the DOM is ready).
- Called automatically by a `MutationObserver` whenever new `sealx-component` elements are added.
- You almost never need to call this manually — it's exposed for tests or custom render pipelines.

**Parameters**: None.

**Returns**: `void`

**Throws**: None.

**Example**:
```typescript
import { setupSealxActions } from 'sealx-sdk';

// After a React/Vue re-render, if you bypass the MutationObserver
useEffect(() => {
  setupSealxActions();
}, [dynamicElements]);
```

---

### `registerLocatableKeys(keys)`

```typescript
registerLocatableKeys(keys: string[]): void
```

**Purpose**: Register which `data-key` attributes can be located/highlighted by the extension when requested.

**Behavior**:
- If `keys` is empty or `null`/`undefined`, clears the registry (allows all keys — backward-compatible).
- Otherwise, only the registered keys will be processed by `onLocateElement`.

**Parameters**:
- `keys: string[]` — array of `data-key` values to register.

**Returns**: `void`

**Throws**: None.

**Example**:
```typescript
import { registerLocatableKeys } from 'sealx-sdk';

// Register keys that the extension can locate
registerLocatableKeys(['orderId', 'message.from', 'message.to', 'amount']);

// Later, when the extension asks to locate "orderId",
// the SDK finds <span data-key="orderId">...</span> and highlights it.
```

---

### `onLocateElement(locateCallback?)`

```typescript
onLocateElement(
  locateCallback?: (key: string, value?: string) => HTMLElement | null
): () => void
```

**Purpose**: Listen for `LOCATE_ELEMENT` requests from the extension and highlight the matching element in the page.

**Behavior**:
- Subscribes to `LOCATE_ELEMENT` messages on the `POPUP` channel.
- If `key` is in the registered set (or no keys registered), finds the element using the `locateCallback` (or the default `document.querySelector([data-key="..."])`).
- If found, adds highlight styles (`border: 2px solid #007AFF`, `backgroundColor: rgba(0, 122, 255, 0.1)`) and scrolls the element into view.
- Highlight is automatically removed after 3 seconds.

**Parameters**:
- `locateCallback?: (key, value?) => HTMLElement | null` — Optional. Custom function to find the element. Defaults to `document.querySelector([data-key="${key}"])`.

**Returns**: `() => void` — cleanup function to unsubscribe.

**Throws**: None.

**Example**:
```typescript
import { onLocateElement } from 'sealx-sdk';

// Use default element location (by data-key)
useEffect(() => {
  const cleanup = onLocateElement();
  return cleanup;
}, []);

// Or with custom logic
useEffect(() => {
  const cleanup = onLocateElement((key, value) => {
    // Find element by custom logic
    return document.querySelector(`[data-field="${key}"]`) as HTMLElement;
  });
  return cleanup;
}, []);
```

---

## Event APIs

### `onPanelClose(callback)`

```typescript
onPanelClose(callback: () => void): () => void
```

**Purpose**: Subscribe to Side Panel close events from the extension.

**Behavior**:
- Subscribes to `PANEL_CLOSE` messages on the `BACKGROUND` channel.
- Fires when the user closes the Side Panel (either manually or via the extension).

**Parameters**:
- `callback: () => void` — invoked when the panel closes.

**Returns**: `() => void` — cleanup function to unsubscribe.

**Throws**: None.

**Example**:
```typescript
import { onPanelClose } from 'sealx-sdk';

useEffect(() => {
  const cleanup = onPanelClose(() => {
    setPanelOpen(false);
    // refresh UI state, sync with backend, etc.
  });
  return cleanup;
}, []);
```

---

## Types

### `SealxSignTask`

**Source**: `sealx-core` (`SealxSignTask` interface)

| Field | Type | Required | Description |
|---|---|---|---|
| `taskId` | `string` | ✅ | Unique task identifier |
| `taskType` | `string` | ✅ | Task category (e.g., `"eip712"`, `"raw"`) |
| `command` | `string` | ✅ | Signing command (e.g., `"signPersonal"`, `"signTypedData"`) |
| `signContent` | `SignContent \| { taskId, signContent }[]` | ✅ | The content to sign |
| `validUntilTime` | `string` | ✅ | **Unit of measurement** for signature validity — one of `"seconds"`, `"minutes"`, `"hours"`. The numeric duration itself is specified inside `signContent` (the `SignContentLayout` / domain-specific fields). This field only says "the unit I'm using is X". |
| `preViewUrl` | `string` | ❌ | Optional preview page URL |
| `extenals` | `Record<string, unknown>` | ❌ | Optional additional external data (key-value map). **⚠️ Note the spelling**: the field is named `extenals` (not `externals`) in the source — this is a typo inherited from `sealx-core`. Use the misspelled name, or you'll get a TS error. |

### `SealxProvider`

Class from `sealx-core` with a static `register()` method that creates the global `window.sealxSigner` singleton. You **never need to call this directly** — the SDK does it automatically on module load. Exposed via `export * from 'sealx-core'` in case you need to reference the type in advanced scenarios.

### `MessageHandle`

```typescript
type MessageHandle = (
  request: SealxRequest,
  reply?: (res: any) => void
) => Promise<any> | any;
```

The callback signature used in `onSign` and similar APIs.

---

## Error Reference

| Error Class | When It's Thrown | How to Recover |
|---|---|---|
| `SealxUnavailableException` | Extension is not installed or not active | Prompt the user to install/enable the extension |
| `SealxUninitializedException` | `account.userId` is not set (forgot to call `initSealx` or `connectSealx`) | Call `initSealx(userId)` first |
| `SessionException` | Session initialization or connection failed | Retry, or prompt user to re-authenticate with the extension |
| `PkException` | `account.newPk !== account.pk` (pending key change) | Complete the key binding flow: call `bindSealx` again or submit the new key to your backend |
| `SignException` | Signing operation failed (user rejected, extension error, etc.) | Show error to user, retry, or fall back |

**Example (pattern for all SealX calls)**:
```typescript
import {
  SealxUnavailableException,
  SealxUninitializedException,
  SessionException,
  PkException,
  SignException,
} from 'sealx-sdk';

try {
  await someSealxOperation();
} catch (error) {
  if (error instanceof SealxUnavailableException) {
    showInstallPrompt();
  } else if (error instanceof SealxUninitializedException) {
    await initSealx(currentUser.id);
  } else if (error instanceof SessionException) {
    await connectSealx(currentUser.id);
  } else if (error instanceof PkException) {
    await bindSealx(currentUser.id);
  } else if (error instanceof SignException) {
    showSignError(error.message);
  } else {
    throw error;
  }
}
```

---

## Related Docs

- [Integration Guide](./integration-guide.md) — hands-on tutorial covering Quick Start, gesture relay, batch signing, element location, error handling, and common pitfalls.
- [README](../README.md) — entry point, 5-minute Quick Start, API overview table.
- Internal architecture docs (for maintainers): `docs/sdk-internal/` at repo root.
