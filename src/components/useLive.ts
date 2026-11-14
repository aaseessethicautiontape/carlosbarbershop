"use client";
import { createRealtimeClient, type LiveQuerySnapshot } from "@neon/realtime/client";
import { useEffect, useRef } from "react";

type Client = ReturnType<typeof createRealtimeClient>;
let shared: Client | undefined;
const client = () => (shared ??= createRealtimeClient({ url: process.env.NEXT_PUBLIC_NEON_REALTIME_URL! }));

export type LiveSource = "queue" | "public" | "admin";

/**
 * Subscribe to a sealed live query exposed at /api/live?s=<source> and call onRows(rows) on every result.
 * Renews the sealed query 10s before it expires. Loads after the page is idle (keeps first paint fast).
 */
export function useLive<Row>(source: LiveSource, onRows: (rows: Row[]) => void, enabled = true) {
  const cb = useRef(onRows);
  cb.current = onRows;
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let cleanup: (() => void) | undefined;
    const fetchSealed = async () => {
      const res = await fetch(`/api/live?s=${source}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`live ${res.status}`);
      return res.json();
    };
    const start = async () => {
      try {
        const sealed = await fetchSealed();
        if (stopped) return;
        const sub = client().subscribe<Row>(sealed);
        sub.onChange((snap: LiveQuerySnapshot<Row>) => { if (snap.data) cb.current(snap.data as Row[]); });
        let timer: ReturnType<typeof setTimeout>;
        const schedule = (expiresAt: number) => {
          timer = setTimeout(async () => {
            if (stopped) return;
            try { const next = await fetchSealed(); schedule(next.expiresAt); await sub.renew(next); } catch { timer = setTimeout(() => schedule(Date.now() + 11_000), 1000); }
          }, Math.max(0, expiresAt - Date.now() - 10_000));
        };
        schedule(sealed.expiresAt);
        cleanup = () => { clearTimeout(timer); sub.unsubscribe(); };
      } catch {
        /* Realtime is progressive enhancement: the pages still work without it */
      }
    };
    const idle = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const handle = idle ? idle(() => void start(), { timeout: 2500 }) : window.setTimeout(() => void start(), 1200);
    return () => {
      stopped = true;
      if (idle) (window as unknown as { cancelIdleCallback: (h: number) => void }).cancelIdleCallback(handle);
      else clearTimeout(handle);
      cleanup?.();
    };
  }, [source, enabled]);
}
