# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **注意：** 版本号 1.0.2 至 1.0.26 的变更未在此文件记录。当前版本号与 `package.json` 保持一致，跳号属历史遗留问题。

## [1.0.27] - 2026-05-10

### Added

-   **Gesture Relay**: 新增 `sealx-component` HTML 属性，用于在 Chrome Side Panel 模式下自动桥接用户点击事件，确保 `signBySealx()` 携带有效的手势上下文。SDK 在 `DOMContentLoaded` 时自动扫描，并通过 MutationObserver 支持动态渲染的元素（如 React/Vue）
-   **setupSealxActions()**: 新增工具函数，自动扫描并标记页面上所有带 `sealx-component` 属性的元素，零配置自动执行

## [1.0.1] - 2025-11-28

### Added

-   None

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
