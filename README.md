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
-   Real-time status monitoring

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

## Documentation

-   [SDK Documentation](./packages/sealx-sdk/readme.md) - Complete guide for SDK usage
-   [Extension Development](./extension/README.md) - Extension development guide
-   [API Reference](./packages/sealx-sdk/readme.md#api-reference) - Detailed API documentation

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
4. Real-time status monitoring

## Security

-   Secure message passing between extension components
-   Session-based authentication
-   Public key cryptography for signing operations
-   Sandboxed execution environments

## Browser Support

-   Chrome 88+
-   Firefox 85+
-   Edge 88+

## Contributing

Please read our [Contributing Guidelines](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

-   [Documentation](./packages/sealx-sdk/readme.md)
-   [Issue Tracker](https://github.com/taiyi-research-institute/sealx-signer/issues)
-   [Discussion Forum](https://github.com/taiyi-research-institute/sealx-signer/discussions)
