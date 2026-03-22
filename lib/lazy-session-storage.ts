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

/**
 * Backup of PiAPI task_ids per scene after submit (Supabase is source of truth;
 * used when DB list is briefly empty after refresh).
 */
export const SCRIPTFLOW_KLING_SNAPSHOT_KEY = "scriptflow_kling_task_snapshot";

export type KlingTaskSnapshotV1 = {
  v: 1;
  projectId: string;
  taskIds: string[];
  updatedAt: number;
};

const STORAGE_KEYS_TO_CLEAR = [
  SCRIPTFLOW_SESSION_STORAGE_KEY,
  SCRIPTFLOW_LAZY_SESSION_STORAGE_KEY,
  SCRIPTFLOW_KLING_SNAPSHOT_KEY,
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

/** Persist scene task_ids after Kling submit (backup alongside kling_tasks rows). */
export function writeKlingTaskSnapshotToStorage(
  projectId: string,
  taskIds: string[],
): void {
  if (typeof window === "undefined") return;
  const pid = projectId.trim();
  if (!UUID_LIKE.test(pid)) return;
  const ids = taskIds.map((t) => String(t).trim()).filter(Boolean);
  try {
    const payload: KlingTaskSnapshotV1 = {
      v: 1,
      projectId: pid,
      taskIds: ids,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(SCRIPTFLOW_KLING_SNAPSHOT_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function readKlingTaskSnapshotFromStorage(): KlingTaskSnapshotV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SCRIPTFLOW_KLING_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (o.v !== 1) return null;
    const projectId = typeof o.projectId === "string" ? o.projectId.trim() : "";
    if (!UUID_LIKE.test(projectId)) return null;
    const taskIds = Array.isArray(o.taskIds)
      ? o.taskIds.map((t) => String(t).trim()).filter(Boolean)
      : [];
    const updatedAt = typeof o.updatedAt === "number" ? o.updatedAt : 0;
    return { v: 1, projectId, taskIds, updatedAt };
  } catch {
    return null;
  }
}
