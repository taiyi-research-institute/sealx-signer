# sealx-core

Core library for SealX digital signature system.

## Installation

```bash
npm install sealx-core
```

## Usage

```typescript
import { SealxSession, SealxAccount, Eip712Struct } from 'sealx-core';

// Initialize session
const session: SealxSession = {
  sessionId: 'xxx',
  userId: 'user-123',
  expire: Date.now() + 3600000,
};

// Create account
const account: SealxAccount = {
  userId: 'user-123',
  pk: '0x...',
};
```

## Features

- EIP-712 structured data signing
- Session management
- Account management
- Cryptographic utilities (encryption/decryption)
- Storage wrappers

## API Reference

### Classes

- `SealxSession` - Session data structure
- `SealxAccount` - Account data structure
- `Eip712Struct` - EIP-712 structured data handler

### Utilities

- `encryptPrivateKey()` - Encrypt private key
- `decryptPrivateKey()` - Decrypt private key
- `slatGenerator()` - Generate salt for encryption
- `localStorageWrapper` - Local storage wrapper
- `dbStorageWrapper` - Database storage wrapper

## License

MIT
