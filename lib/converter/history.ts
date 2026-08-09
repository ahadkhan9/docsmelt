/**
 * Conversion history — done jobs persisted to IndexedDB so a reload can
 * restore the queue (previews, .md downloads, copy). Fully local; a hard
 * storage cap keeps the browser honest. Restored jobs carry `restored` —
 * the original file bytes are gone, so retry/zip stay disabled for them.
 */
import type { JobView } from "./useConverter";

export interface HistoryRecord {
  id: string;
  name: string;
  size: number;
  format?: string;
  kind?: "md" | "txt";
  markdown: string;
  chars: number;
  ms?: number;
  doneAt: number;
}

const DB_NAME = "docsmelt-history";
const STORE = "jobs";
export const DEFAULT_CAP_BYTES = 50 * 1024 * 1024;

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await open();
  try {
    const tx = db.transaction(STORE, mode);
    return await requestToPromise(fn(tx.objectStore(STORE)));
  } finally {
    db.close();
  }
};

/** Save a record; enforce the cap by evicting oldest entries. Returns the
 *  number of records evicted (for honest UI messaging). */
export async function saveRecord(
  record: HistoryRecord,
  capBytes: number = DEFAULT_CAP_BYTES,
): Promise<number> {
  await withStore("readwrite", (store) => store.put(record));
  const all = await loadAll();
  let total = all.reduce((sum, r) => sum + r.markdown.length, 0);
  let evicted = 0;
  const byAge = [...all].sort((a, b) => a.doneAt - b.doneAt);
  for (const old of byAge) {
    if (total <= capBytes) break;
    total -= old.markdown.length;
    evicted += 1;
    await withStore("readwrite", (store) => store.delete(old.id));
  }
  return evicted;
}

export async function loadAll(): Promise<HistoryRecord[]> {
  const all = await withStore("readonly", (store) => store.getAll());
  return all.sort((a, b) => b.doneAt - a.doneAt);
}

export async function clearHistory(): Promise<void> {
  await withStore("readwrite", (store) => store.clear());
}

/** Restored jobs are done with markdown; the original file is gone. */
export function recordToJobView(record: HistoryRecord): JobView {
  return {
    id: record.id,
    file: new File([record.markdown], record.name, { lastModified: record.doneAt }),
    status: "done",
    format: record.format as JobView["format"],
    kind: record.kind,
    markdown: record.markdown,
    chars: record.chars,
    ms: record.ms,
    startedAt: record.doneAt,
    restored: true,
  };
}

export function recordFromJob(job: JobView): HistoryRecord | null {
  if (job.status !== "done" || job.markdown === undefined) return null;
  return {
    id: job.id,
    name: job.file.name,
    size: job.file.size,
    format: job.format,
    kind: job.kind,
    markdown: job.markdown,
    chars: job.chars ?? job.markdown.length,
    ms: job.ms,
    doneAt: Date.now(),
  };
}
