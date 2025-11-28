# SealX SDK

JavaScript/TypeScript SDK for interacting with the SealX browser extension, providing secure document signing capabilities.

## Installation

```bash
npm install sealx-sdk
# or
yarn add sealx-sdk
```

## Requirements

-   SealX browser extension installed
-   Modern browser with ES modules support

## Workflow Overview

The SealX SDK follows a strict initialization-first workflow. You must initialize the SDK successfully before performing any operations. The typical workflow is:

1. **Check plugin status** - Verify SealX extension is available
2. **Initialize session** - Set up user session with the extension
3. **Perform operations** - Execute signing and other operations
4. **Monitor status** - Periodically check plugin status for changes

## Initialization

The SDK automatically initializes when imported, but you must explicitly initialize the user session before performing operations:

```typescript
import * as sealx from 'sealx-sdk';

// Check if SealX extension is available
if (sealx.isSealxActive()) {
    // Initialize user session
    await sealx.initSealx('user-123');
    console.log('SDK initialized successfully');
} else {
    console.warn('SealX extension is not available');
}
```

### Initialization Flow

1. **SDK Registration** - Automatically registers global instances when imported
2. **Plugin Detection** - Use `checkSealx()` to detect plugin status
3. **Session Setup** - Call `initSealx(userId)` to establish user session
4. **Connection** - Use `connectSealx()` to establish communication channel

## Plugin Status Management

### Checking Plugin Status

You can periodically check the SealX plugin status using `checkSealx()`:

```typescript
import { checkSealx } from 'sealx-sdk';

// Check plugin status
const pluginStatus = await checkSealx();

if (pluginStatus) {
    console.log('Plugin initialized:', pluginStatus);
} else if (pluginStatus === '') {
    console.log('Plugin installed but not initialized');
} else {
    console.log('Plugin not installed or disabled');
}
```

### `checkSealx()` Return Values

| Return Value         | Meaning                | Description                                              |
| -------------------- | ---------------------- | -------------------------------------------------------- |
| `string` (non-empty) | Plugin initialized     | Extension is installed, active, and properly initialized |
| `""` (empty string)  | Plugin not initialized | Extension is installed but session is not initialized    |
| `null`               | Plugin unavailable     | Extension is not installed or has been disabled/closed   |

### Global State Management

The SDK uses global state management to track plugin status:

```typescript
import { isSealxActive, isSessionAvailable } from 'sealx-sdk';

// Check if plugin is installed and active
if (isSealxActive()) {
    console.log('SealX extension is ready');
}

// Check if valid session exists
if (isSessionAvailable()) {
    console.log('Session is valid and not expired');
}
```

### Periodic Status Monitoring

For applications that need to monitor plugin status changes:

```typescript
import { checkSealx, isSealxActive } from 'sealx-sdk';

// Monitor plugin status every 5 seconds
setInterval(async () => {
    const pluginStatus = await checkSealx();

    if (pluginStatus === null) {
        console.warn('SealX extension has been disabled or uninstalled');
        // Handle plugin unavailability
    } else if (!isSealxActive()) {
        console.warn('SealX extension is no longer active');
        // Handle plugin deactivation
    }
}, 5000);
```

## API Reference

### `isSealxActive()`

Check if SealX extension is installed and active.

```typescript
import { isSealxActive } from 'sealx-sdk';

if (isSealxActive()) {
    console.log('SealX extension is ready');
}
```

### `initSealx(userId: string)`

Initialize a SealX session for the specified user.

```typescript
try {
    await initSealx('user123');
} catch (error) {
    console.error('Session initialization failed:', error);
}
```

### `connectSealx(uId?: string)`

Establish connection with SealX extension.

```typescript
await connectSealx(); // Uses existing account
await connectSealx('new-user'); // Initializes new account
```

### `bindSealx()`

Bind a public key to the current account.

```typescript
const publicKey = await bindSealx();
console.log('Bound public key:', publicKey);
```

### `signBySealx(task)`

Sign documents with SealX service.

#### Single document:

```typescript
const signature = await signBySealx({
    documentId: 'doc123',
    content: 'Document content to sign',
});
```

#### Batch documents:

```typescript
const signStream = (await signBySealx([
    { documentId: 'doc1', content: '...' },
    { documentId: 'doc2', content: '...' },
])) as AsyncGenerator<string>;

for await (const signature of signStream) {
    console.log('Received signature:', signature);
}
```

### `isSessionAvailable()`

Check if valid session exists.

```typescript
if (isSessionAvailable()) {
    // Safe to performing signing operations
}
```

### `checkSealx()`

Check SealX extension initialization status.

```typescript
const status = await checkSealx();
if (status) {
    console.log('Plugin initialized:', status);
} else if (status === '') {
    console.log('Plugin installed but not initialized');
} else {
    console.log('Plugin not installed or disabled');
}
```

### `sendSignResponse(taskId: string, error?: string, userId?: string | number)`

Send sign response message for completed signing operations.

```typescript
try {
    const response = await sendSignResponse('task-123');
    console.log('Sign response sent successfully:', response);
} catch (error) {
    console.error('Failed to send sign response:', error);
}
```

### `onSign(callback: MessageHandle, taskId?: any)`

Set up event listener for sign response messages.

```typescript
// Listen for specific task ID
const cleanup = onSign((request, reply) => {
    console.log('Sign response received:', request.payload);
}, 'task-123');

// Listen for all sign responses
const cleanupAll = onSign((request, reply) => {
    console.log('Sign response received:', request.payload);
});

// Clean up listener when done
cleanup();
```

### `closeSealx()`

Close the SealX extension connection.

```typescript
// Clean up before page unload
window.addEventListener('beforeunload', () => {
    closeSealx();
});
```

## Installation Interfaces

### Browser Extension Installation

The SealX SDK requires the SealX browser extension to be installed. Users can install the extension from:

-   **Chrome Web Store**: [SealX Extension](https://chrome.google.com/webstore/detail/sealx)
-   **Firefox Add-ons**: [SealX Extension](https://addons.mozilla.org/firefox/addon/sealx)
-   **Edge Add-ons**: [SealX Extension](https://microsoftedge.microsoft.com/addons/detail/sealx)

### Installation Detection

The SDK automatically detects if the extension is installed:

```typescript
import { isSealxActive } from 'sealx-sdk';

if (isSealxActive()) {
    console.log('SealX extension is installed and active');
} else {
    console.log('SealX extension is not installed or inactive');
    // Prompt user to install the extension
    alert('Please install the SealX browser extension to continue');
}
```

### Post-Installation Setup

After installation, the extension needs to be initialized:

```typescript
import { checkSealx, initSealx } from 'sealx-sdk';

// Check if extension is ready
const status = await checkSealx();
if (status === null) {
    console.log('Extension not installed or disabled');
} else if (status === '') {
    console.log('Extension installed but not initialized');
    // Initialize the extension
    await initSealx('user-123');
} else {
    console.log('Extension ready:', status);
}
```

## Error Handling

The SDK throws specific exceptions:

-   `SealxUnavailableException`: Extension not installed or inactive
-   `SealxUninitializedException`: Plugin not properly initialized
-   `SessionException`: Session-related errors
-   `PkException`: Public key validation errors
-   `SignException`: Document signing errors

```typescript
try {
    await signBySealx(...);
} catch (error) {
    if (error instanceof SealxUnavailableException) {
        console.error('SealX extension is not available');
        // Prompt user to install the extension
    } else if (error instanceof SealxUninitializedException) {
        console.error('SealX plugin not initialized');
        // Call initSealx() first
    } else if (error instanceof SessionException) {
        console.error('Session error:', error.message);
        // Reconnect or reinitialize session
    } else if (error instanceof PkException) {
        console.error('Public key error:', error.message);
        // Handle public key issues
    } else if (error instanceof SignException) {
        console.error('Signing error:', error.message);
        // Handle signing failures
    }
}
```

## Troubleshooting

**Extension not detected:**

1. Ensure SealX extension is installed
2. Refresh the page after installation
3. Check browser console for errors

**Signing failures:**

1. Verify session is active (`isSessionAvailable()`)
2. Check network connectivity
3. Ensure documents are properly formatted

## License

MIT
