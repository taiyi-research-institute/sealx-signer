# sealx-sdk

JavaScript/TypeScript SDK for interacting with the SealX browser extension.

## Installation

```bash
npm install sealx-sdk
```

## Usage

```typescript
import { initSealx, bindSealx, signBySealx, isSealxActive } from 'sealx-sdk';

// Check if extension is active
const isActive = await isSealxActive();
if (!isActive) {
  console.warn('SealX extension is not available');
  return;
}

// Initialize session
await initSealx('user-123');

// Bind public key
const publicKey = await bindSealx();

// Sign a document
const signature = await signBySealx({
  taskId: 'doc-123',
  data: 'document content',
});
```

### Side Panel Gesture Relay

**`sealx-component`** is an HTML boolean attribute that enables buttons to trigger signing operations from within Chrome's Side Panel mode.

**Why?** In Chrome Side Panel mode, `signBySealx()` internally calls `sidePanel.open()` to open the side panel — this step requires a real user click (browser gesture verification). If you invoke `signBySealx()` purely via JavaScript, the browser will refuse to open the side panel. Adding the `sealx-component` attribute to your button lets the SDK automatically bridge the click event, ensuring the sign request carries a valid user gesture.

**How?** Just add the `sealx-component` attribute to your existing sign button:

```html
<button sealx-component onclick="handleSign()">Sign</button>
```

> The `sealx-component` attribute only enables gesture relay — it does not dictate how you bind the click handler. You can use `onclick`, `addEventListener`, or framework-specific event binding (React `onClick`, Vue `@click`, etc.).

The SDK handles the rest automatically:
- Scans all elements with the `sealx-component` attribute on page load and attaches gesture bridge markers
- Uses MutationObserver to continuously watch for dynamically added elements (e.g. from React/Vue render)
- No manual initialization required

```typescript
import { signBySealx } from 'sealx-sdk';

// Signing must be triggered by a user click on a sealx-component button
async function handleSign() {
  const signature = await signBySealx({
    taskId: 'doc-456',
    data: 'document content',
  });
  console.log('Signing complete:', signature);
}
```

> **Note:** The attribute name must be exactly `sealx-component`. It is a boolean attribute — do NOT assign a value. Writing `<button sealx-component="true">` is misleading, and `<button sealx-component="false">` will still activate it because any non-empty value makes the attribute present. Always use `<button sealx-component>`.

## Browser Extension Integration

The SealX browser extension must be installed for this SDK to work.

### Message Channels

- `MessageChannel.BACKGROUND` - Background script communication
- `MessageChannel.POPUP` - Popup window communication
- `MessageChannel.CONTENT` - Content script communication

## API Reference

### Initialization Functions

- `isSealxActive()` - Check if extension is installed and active
- `initSealx(userId)` - Initialize session with user ID
- `connectSealx(userId?)` - Connect/reconnect to extension
- `checkSealx()` - Health check extension status

### Signing Functions

- `bindSealx(userId?)` - Bind public key to account
- `signBySealx(task, userId?)` - Sign single task
- `signBySealx(tasks[], userId?)` - Batch sign (returns AsyncGenerator)
- `sendSignResponse(taskId, error?)` - Send sign response
- `onSign(callback, taskId?)` - Listen for sign responses

### Utility Functions

- `isSessionAvailable()` - Check if valid session exists
- `closeSealx()` - Close extension connection
- `checkSealxActive(callback)` - Monitor activation status
- `registerLocatableKeys(keys)` - Register locatable keys
- `onLocateElement(callback?)` - Listen for element location requests
- `setupSealxActions()` - Scan and bridge sealx-component elements for gesture relay

### Types

- `SealxSignTask` - Task data structure
- `SealxProvider` - Window provider for extension communication

## License

MIT
