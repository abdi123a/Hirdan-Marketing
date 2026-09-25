import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// zustand's persist middleware grabs `localStorage` when the auth store module
// loads, and jsdom's copy has no working setItem under vitest. Give it an
// in-memory one before the imports below run.
vi.hoisted(() => {
  const mem = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v); },
      removeItem: (k: string) => { mem.delete(k); },
      clear: () => mem.clear(),
      key: () => null,
      get length() { return mem.size; },
    },
  });
});
import { apiFetch } from "./api-client";
import { useAuthStore } from "./auth-store";

/**
 * The server rotates refresh tokens, so two refreshes in flight at once make the
 * second one fail and log the user out. Every 401 must funnel through a single
 * shared refresh.
 */
describe("apiFetch token refresh", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: "old", isAuthenticated: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refreshes once when several requests hit 401 together, then retries them all", async () => {
    let refreshCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/auth/refresh")) {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 10));
        return new Response(JSON.stringify({ accessToken: "new" }), { status: 200 });
      }
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (auth === "Bearer new") return new Response(JSON.stringify({ ok: true }), { status: 200 });
      return new Response(JSON.stringify({ message: "expired" }), { status: 401 });
    }));

    const results = await Promise.all([apiFetch("/a"), apiFetch("/b"), apiFetch("/c")]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
    expect(useAuthStore.getState().token).toBe("new");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("logs out when the refresh itself is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const status = String(url).endsWith("/auth/refresh") ? 401 : 401;
      return new Response(JSON.stringify({ message: "expired" }), { status });
    }));

    await expect(apiFetch("/a")).rejects.toThrow(/Session expired/);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });
});
