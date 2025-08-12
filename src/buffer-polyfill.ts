// src/buffer-polyfill.ts
import { Buffer } from "buffer";

// Κάνε διαθέσιμο το Buffer παντού (browser)
if (!(window as any).Buffer) {
  (window as any).Buffer = Buffer;
}

// (προαιρετικό) dummy process ώστε κάποια libs να μη σπάνε
if (!(window as any).process) {
  (window as any).process = { env: {} } as any;
}
