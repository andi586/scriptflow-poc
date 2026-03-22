/**
 * Painless #17: persist lazy-mode project (session) id so refresh keeps clip progress.
 * Client-only; safe no-ops when `window` is undefined.
 */
export const SCRIPTFLOW_LAZY_SESSION_STORAGE_KEY = "scriptflow_lazy_session_id";

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readLazySessionIdFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(SCRIPTFLOW_LAZY_SESSION_STORAGE_KEY)?.trim();
    if (!v) return null;
    return UUID_LIKE.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeLazySessionIdToStorage(sessionId: string): void {
  if (typeof window === "undefined") return;
  const id = sessionId.trim();
  if (!UUID_LIKE.test(id)) return;
  try {
    window.localStorage.setItem(SCRIPTFLOW_LAZY_SESSION_STORAGE_KEY, id);
  } catch {
    /* quota / private mode */
  }
}

export function clearLazySessionFromStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SCRIPTFLOW_LAZY_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
