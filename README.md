# SealX Signer

A comprehensive browser extension and SDK for secure document signing with SealX technology.

## Project Structure

This is a monorepo containing multiple packages:

-   **`packages/sealx-sdk/`** - JavaScript/TypeScript SDK for interacting with the SealX browser extension
-   **`packages/sealx-core/`** - Core functionality and utilities for SealX operations
-   **`packages/sealx-message/`** - Message handling and communication between extension components
-   **`extension/`** - Browser extension implementation
-   **`app/`** - Example application using the SealX SDK
-   **`test/`** - Test application for SDK functionality

## Quick Start

### For SDK Users

If you want to use the SealX SDK in your web application:

```bash
npm install sealx-sdk
```

See the [SDK Documentation](./packages/sealx-sdk/readme.md) for detailed usage instructions.

### For Extension Developers

If you want to develop or build the browser extension:

```bash
# Install dependencies
pnpm install

# Build the extension
pnpm build:extension

# Development mode with hot reload
pnpm dev:extension
```

## Core Features

### Secure Document Signing

-   Digital signature generation and verification
-   Support for multiple document formats
-   Batch signing capabilities

### Browser Extension Integration

-   Seamless integration with web applications
-   Cross-browser compatibility (Chrome, Firefox, Edge)
-   Secure communication channels

### SDK Capabilities

-   TypeScript/JavaScript SDK for easy integration
-   Session management and user authentication
-   Public key binding and management
-   Real-time status monitoring with caching (5-second TTL)
-   Comprehensive error handling with specific exception types

## API Reference

### Core Functions

#### `isSealxActive(): Promise<boolean>`

Checks if SealX browser extension is installed and active. Uses caching to reduce redundant checks (5-second TTL).

```typescript
if (await isSealxActive()) {
    // Proceed with SealX operations
    await initSealx('user-123');
} else {
    console.warn('SealX extension is not available');
}
```

#### `initSealx(userId: string | number): Promise<void>`

Initializes the SealX session for a user. Must be called before any other SealX operations.

```typescript
try {
    await initSealx('user-123');
    console.log('SealX session initialized successfully');
} catch (error) {
    if (error instanceof SealxUnavailableException) {
        console.error('Please install the SealX browser extension');
    } else if (error instanceof SessionException) {
        console.error('Failed to establish session:', error.message);
    } else {
        console.error('Unexpected error:', error);
    }
}
```

#### `connectSealx(uId?: string | number): Promise<void>`

Connects to SealX extension and establishes a session. Useful for re-establishing connections or when sessions expire.

```typescript
try {
    await connectSealx('user-123');
    console.log('Connected to SealX extension successfully');
} catch (error) {
    if (error instanceof SealxUnavailableException) {
        console.error('SealX extension is not available');
    } else if (error instanceof SealxUninitializedException) {
        console.error('Please initialize SealX first');
    } else if (error instanceof SessionException) {
        console.error('Connection failed:', error.message);
    }
}
```

#### `bindSealx(userId?: string | number): Promise<string>`

Binds a public key to the current SealX account. Opens extension popup for user interaction.

```typescript
try {
    const publicKey = await bindSealx('user-123');
    console.log('Public key bound successfully:', publicKey);
} catch (error) {
    if (error instanceof SealxUnavailableException) {
        console.error('SealX extension is not available');
    } else if (error instanceof SealxUninitializedException) {
        console.error('Please initialize SealX first');
    } else {
        console.error('Failed to bind public key:', error.message);
    }
}
```

#### `signBySealx<T>(task: SealxSignTask | SealxSignTask[], userId?: string | number): Promise<T | AsyncGenerator<T> | undefined>`

Signs one or more tasks using SealX service. Supports both single and batch processing.

```typescript
// Single task signing
try {
    const signature = await signBySealx({
        taskId: 'doc-123',
        data: 'document content to sign',
        type: 'text',
    });
    console.log('Document signed successfully:', signature);
} catch (error) {
    if (error instanceof SealxUnavailableException) {
        console.error('SealX extension is not available');
    } else if (error instanceof PkException) {
        console.error('Public key mismatch:', error.message);
    } else if (error instanceof SignException) {
        console.error('Signing failed:', error.message);
    } else {
        console.error('Unexpected error:', error);
    }
}

// Batch task signing
try {
    const signatures = signBySealx([
        { taskId: 'doc-1', data: 'document 1' },
        { taskId: 'doc-2', data: 'document 2' },
        { taskId: 'doc-3', data: 'document 3' },
    ]);

    if (signatures && typeof signatures[Symbol.asyncIterator] === 'function') {
        for await (const signature of signatures) {
            console.log('Received signature:', signature);
        }
    }
} catch (error) {
    console.error('Batch signing failed:', error);
}
```

#### `isSessionAvailable(): boolean`

Checks if a valid SealX session exists and is not expired.

```typescript
if (isSessionAvailable()) {
    // Session is valid, proceed with operations
    await signBySealx(task);
} else {
    // Session expired, need to reconnect
    await connectSealx();
}
```

#### `checkSealx(): Promise<string | null>`

Performs health check on SealX extension with retry logic (3 attempts, 100ms delay).

```typescript
const status = await checkSealx();
if (status) {
    console.log('SealX extension is ready:', status);
} else if (status === '') {
    console.log('SealX extension installed but not initialized');
} else {
    console.log('SealX extension is not available');
}
```

#### `onSign(callback: MessageHandle, taskId?: any): () => void`

Sets up event listener for sign response messages for specific task IDs.

```typescript
// Listen for a single task ID
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

#### `checkSealxActive(callback: (address: string) => void): void`

Sets up a callback to monitor SealX extension activation status in real-time.

```typescript
checkSealxActive((status) => {
    if (status) {
        console.log('SealX extension activated:', status);
    } else {
        console.log('SealX extension deactivated');
    }
});
```

### Utility Functions

#### `sendSignResponse(taskId: string, error?: string, userId?: string | number): Promise<any>`

Sends sign response message for completed signing operations (typically used internally).

#### `closeSealx(): void`

Closes the SealX extension connection for cleanup.

#### `sealxActive(): Promise<boolean>` (deprecated)

Deprecated alias for `isSealxActive()`.

## Error Handling

The SDK provides specific exception types for different error scenarios:

| Exception Type                | Description                         | Typical Cause                                |
| ----------------------------- | ----------------------------------- | -------------------------------------------- |
| `SealxUnavailableException`   | Extension not installed or inactive | User hasn't installed SealX extension        |
| `SealxUninitializedException` | Plugin not properly initialized     | `initSealx()` or `connectSealx()` not called |
| `SessionException`            | Session-related errors              | Session expired or connection failed         |
| `PkException`                 | Public key validation errors        | Public key mismatch during signing           |
| `SignException`               | Document signing errors             | Signing operation failed                     |

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

## Development

### Prerequisites

-   Node.js 16+
-   pnpm package manager
-   Modern browser with extension support

### Setup

```bash
# Clone the repository
git clone https://github.com/taiyi-research-institute/sealx-signer.git
cd sealx-signer

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Available Scripts

```bash
# Development
pnpm dev:extension    # Start extension development server
pnpm dev:app         # Start example app development server

# Building
pnpm build           # Build all packages
pnpm build:extension # Build browser extension
pnpm build:sdk       # Build SDK package

# Testing
pnpm test            # Run tests
pnpm test:watch      # Run tests in watch mode
```

## Architecture

### Component Overview

```
sealx-signer/
├── packages/
│   ├── sealx-sdk/          # Public SDK for web applications
│   ├── sealx-core/         # Core functionality and utilities
│   └── sealx-message/      # Message passing system
├── extension/              # Browser extension
│   ├── src/entries/
│   │   ├── popup/         # Extension popup UI
│   │   ├── background/    # Background service worker
│   │   ├── content/       # Content scripts
│   │   └── sandbox/       # Sandboxed environment
│   └── manifest/          # Extension manifests
└── app/                   # Example application
```

### Communication Flow

1. **Web Application** ↔ **SDK** ↔ **Content Script** ↔ **Background** ↔ **Popup**
2. Secure message passing between all components
3. Session management and state synchronization
4. Real-time status monitoring with caching

## Performance Features

-   **Caching**: Extension status checks are cached for 5 seconds to reduce network overhead
-   **Retry Logic**: Automatic retry mechanism for extension detection (3 attempts, 100ms delay)
-   **Efficient Session Management**: Session validation without unnecessary reconnections
-   **Batch Processing**: Support for batch document signing with async generators

## Security

-   Secure message passing between extension components
-   Session-based authentication
-   Public key cryptography for signing operations
-   Sandboxed execution environments
-   Input validation and error handling

## Browser Support

-   Chrome 88+
-   Firefox 85+
-   Edge 88+

## Contributing

Please read our [Contributing Guidelines](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

-   [SDK Documentation](./packages/sealx-sdk/readme.md) - Complete API reference and usage guide
-   [Issue Tracker](https://github.com/taiyi-research-institute/sealx-signer/issues)
-   [Discussion Forum](https://github.com/taiyi-research-institute/sealx-signer/discussions)
