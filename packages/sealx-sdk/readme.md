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

## Initialization

The SDK automatically initializes when imported:

```typescript
import * as sealx from 'sealx-sdk';
// Initialization happens automatically
```

This performs:

1. Registration of SealX provider
2. Creation of global sealxSigner instance
3. Setup of message channel with extension

You can verify initialization succeeded:

```typescript
if (sealx.isSealxActive()) {
    console.log('SDK initialized successfully');
}
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
    // Safe to perform signing operations
}
```

## Error Handling

The SDK throws specific exceptions:

-   `SessionException`: Session-related errors
-   `PkException`: Public key validation errors
-   `SignException`: Document signing errors

```typescript
try {
  await signBySealx(...);
} catch (error) {
  if (error instanceof SessionException) {
    // Handle session error
  } else if (error instanceof PkException) {
    // Handle public key error
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
