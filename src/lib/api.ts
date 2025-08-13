// src/lib/api.ts
import { VITE_API_BASE_URL } from "@/lib/env";

const base = () => VITE_API_BASE_URL || "";
const url  = (p: string) => `${base()}${p.startsWith("/") ? p : `/${p}`}`;

export async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url(path), {
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status} ${res.statusText} @ ${url(path)}`);
  return res.json() as Promise<T>;
}
