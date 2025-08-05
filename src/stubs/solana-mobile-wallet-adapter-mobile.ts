export class SolanaMobileWalletAdapter {
  constructor(options?: Record<string, unknown>) {
    // Stub implementation
  }
}

export function createDefaultAuthorizationResultCache(): {
  get: () => Promise<unknown>;
  set: (...args: unknown[]) => Promise<void>;
  clear: () => Promise<void>;
} {
  return {
    get: async () => null,
    set: async () => {},
    clear: async () => {},
  };
}
