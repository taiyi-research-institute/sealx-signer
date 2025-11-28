# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-11-28

### Optimized

-   **Performance**: Enhanced `isSealxActive()` function with caching mechanism (5-second TTL)
-   **Reliability**: Improved `checkSealx()` retry logic with cleaner implementation
-   **Documentation**: Updated README with proper async usage examples and performance benefits

### Technical Improvements

-   Added smart caching to reduce redundant extension checks
-   Simplified retry mechanism from complex Promise-based to clean for-loop
-   Better error handling with debug logging only on final retry attempt
-   Optimized state management and property access patterns

### Breaking Changes

-   None - All changes are backward compatible

### Migration Guide

-   No migration required
-   Existing code continues to work without modifications
-   Performance improvements are automatic
