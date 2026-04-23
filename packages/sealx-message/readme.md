# sealx-message

Message handling library for SealX digital signature system.

## Installation

```bash
npm install sealx-message
```

## Usage

```typescript
import { MessageChannel, MessagerManager, SealxTopic, SealxRequest } from 'sealx-message';

// Create messager manager
const manager = MessagerManager.getMessager();

// Listen for messages
manager.on(SealxTopic.SIGN, (request: SealxRequest<any>) => {
  console.log('Sign request received:', request.payload);
}, MessageChannel.POPUP);
```

## Features

- Message channel management (BACKGROUND, POPUP, CONTENT)
- Request/Response pattern
- Topic-based messaging
- Messager manager singleton

## API Reference

### Classes

- `MessageChannel` - Channel constants enum
- `MessagerManager` - Messager singleton manager
- `Messager` - Base messager class
- `ContentMessager` - Content script messager

### Types

- `SealxTopic` - Topic constants
- `SealxRequest<T>` - Request type
- `ReplyFunc` - Reply callback function

### Topics

- `SealxTopic.CHECK_INITIALIZED` - Check initialization status
- `SealxTopic.CONNECT` - Connect to extension
- `SealxTopic.BIND_PK` - Bind public key
- `SealxTopic.SIGN` - Sign data
- `SealxTopic.BATCH_SIGN` - Batch sign
- `SealxTopic.SIGN_RESPONSE` - Sign response

## License

MIT
