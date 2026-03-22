/**
 * Painless #17: persist lazy-mode project (session) id so refresh keeps clip progress.
 * Client-only; safe no-ops when `window` is undefined.
 *
 * Primary key matches product/docs: `scriptflow_session_id`.
 * Legacy `scriptflow_lazy_session_id` is still read (one-time) and cleared on write/clear.
 */
export const SCRIPTFLOW_SESSION_STORAGE_KEY = "scriptflow_session_id";

/** @deprecated use SCRIPTFLOW_SESSION_STORAGE_KEY */
export const SCRIPTFLOW_LAZY_SESSION_STORAGE_KEY = "scriptflow_lazy_session_id";

const STORAGE_KEYS_TO_CLEAR = [
  SCRIPTFLOW_SESSION_STORAGE_KEY,
  SCRIPTFLOW_LAZY_SESSION_STORAGE_KEY,
] as const;

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseStoredSessionId(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  return UUID_LIKE.test(v) ? v : null;
}

export function readLazySessionIdFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const primary = parseStoredSessionId(
      window.localStorage.getItem(SCRIPTFLOW_SESSION_STORAGE_KEY),
    );
    if (primary) return primary;
    const legacy = parseStoredSessionId(
      window.localStorage.getItem(SCRIPTFLOW_LAZY_SESSION_STORAGE_KEY),
    );
    return legacy;
  } catch {
    return null;
  }
}

export function writeLazySessionIdToStorage(sessionId: string): void {
  if (typeof window === "undefined") return;
  const id = sessionId.trim();
  if (!UUID_LIKE.test(id)) return;
  try {
    window.localStorage.setItem(SCRIPTFLOW_SESSION_STORAGE_KEY, id);
    // Drop legacy key so a single source of truth remains.
    window.localStorage.removeItem(SCRIPTFLOW_LAZY_SESSION_STORAGE_KEY);
  } catch {
    /* quota / private mode */
  }
}

export function clearLazySessionFromStorage(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of STORAGE_KEYS_TO_CLEAR) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
