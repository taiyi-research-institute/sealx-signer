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

### Types

- `SealxSignTask` - Task data structure
- `SealxProvider` - Window provider for extension communication

## License

MIT
