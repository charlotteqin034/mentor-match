/**
 * `server-only` is resolved by the Next bundler, not npm, so tests alias it here.
 * Its whole job is to fail a client bundle at build time — a no-op under vitest.
 */
export {};
