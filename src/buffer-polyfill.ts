// src/buffer-polyfill.ts
import { Buffer } from "buffer";

declare global {
  interface Window {
    Buffer?: typeof Buffer;
    process?: { env: Record<string, unknown> };
  }
}

if (!window.Buffer) {
  window.Buffer = Buffer;
}

if (!window.process) {
  window.process = { env: {} };
}
