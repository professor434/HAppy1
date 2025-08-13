// src/lib/api.ts
const RAW = import.meta.env.VITE_API_BASE_URL as string;   // π.χ. https://happy-pennis.up.railway.app
if (!RAW) console.warn("[ENV] VITE_API_BASE_URL is empty");
const BASE = RAW.replace(/\/+$/, "");                      // κόψε τυχόν τελικά '/'

function url(path: string) {
  return path.startsWith("/") ? `${BASE}${path}` : `${BASE}/${path}`;
}

export async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000); // 15s timeout για να μη μένεις «λευκός»
  try {
    const res = await fetch(url(path), {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      signal: ctrl.signal,
      // credentials: "include", // μόνο αν χρησιμοποιείς cookies
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`API ${res.status} ${res.statusText} @ ${url(path)} ${txt ? "– " + txt : ""}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}
