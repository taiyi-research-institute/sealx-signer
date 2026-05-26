// Shared ref for coordinating login animation with routeByRequest guard.
// Uses a plain object ref (not React ref) to avoid circular dependency
// between Login component and RequestContextProvider.
export const loginAnimatingRef = { current: false };
export const loginAnimatingMeta = { setAt: 0 };
export const LOGIN_ANIMATING_TIMEOUT_MS = 5_000;
