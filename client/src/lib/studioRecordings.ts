export type StudioRecordingMeta = {
  id: string;
  createdAt: number;
  name: string;
  mime: string;
  size: number;
  complete: boolean;
  partial?: boolean;
};

const DB_NAME = "gracedflow-studio";
const DB_VERSION = 1;
const REC_STORE = "recordings";
const CHUNK_STORE = "chunks";

export function recordingFileName(at = new Date(), incomplete = false): string {
  const stamp = at.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return sealRecordingName(`igc-service-${stamp}.webm`, incomplete);
}

export function sealRecordingName(name: string, partial: boolean): string {
  if (!partial || name.includes("-partial")) return name;
  return name.replace(/(\.[^.]+)$/, "-partial$1");
}

export function formatRecordingWhen(at: number): string {
  return new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function newRecordingId(at = Date.now()): string {
  return `rec_${at}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatRecordingBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function assembleRecordingBlob(chunks: Blob[], mime: string): Blob {
  return new Blob(chunks, { type: mime || "video/webm" });
}

export function triggerDownload(blob: Blob, name: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser cannot keep recordings on disk."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(REC_STORE)) {
        db.createObjectStore(REC_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const chunks = db.createObjectStore(CHUNK_STORE, { keyPath: "id" });
        chunks.createIndex("recordingId", "recordingId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open recordings storage."));
  });
}

function withTx<T>(
  db: IDBDatabase,
  stores: string | string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction, settle: (value: T) => void) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let value: T | undefined;
    let settled = false;
    tx.oncomplete = () => resolve(settled ? (value as T) : (undefined as T));
    tx.onerror = () => reject(tx.error ?? new Error("Recordings storage failed."));
    tx.onabort = () => reject(tx.error ?? new Error("Recordings storage aborted."));
    try {
      work(tx, (next) => {
        value = next;
        settled = true;
      });
    } catch (err) {
      reject(err);
    }
  });
}

export async function requestRecordingPersistence(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Private windows and some browsers omit this.
  }
}

async function withRecordingsDb<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDb();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

export async function beginRecording(meta: Omit<StudioRecordingMeta, "size" | "complete">): Promise<void> {
  await withRecordingsDb((db) =>
    withTx(db, REC_STORE, "readwrite", (tx) => {
      tx.objectStore(REC_STORE).put({
        ...meta,
        size: 0,
        complete: false,
        partial: false,
      } satisfies StudioRecordingMeta);
    }),
  );
}

export async function appendRecordingChunk(recordingId: string, seq: number, blob: Blob): Promise<void> {
  await withRecordingsDb((db) =>
    withTx(db, [REC_STORE, CHUNK_STORE], "readwrite", (tx) => {
      tx.objectStore(CHUNK_STORE).put({
        id: `${recordingId}:${seq}`,
        recordingId,
        seq,
        blob,
      });
      const getReq = tx.objectStore(REC_STORE).get(recordingId);
      getReq.onsuccess = () => {
        const rec = getReq.result as StudioRecordingMeta | undefined;
        if (!rec) return;
        rec.size += blob.size;
        tx.objectStore(REC_STORE).put(rec);
      };
    }),
  );
}

export async function getRecordingMeta(id: string): Promise<StudioRecordingMeta | null> {
  return withRecordingsDb((db) =>
    withTx(db, REC_STORE, "readonly", (tx, settle) => {
      const req = tx.objectStore(REC_STORE).get(id);
      req.onsuccess = () => settle((req.result as StudioRecordingMeta | undefined) ?? null);
    }),
  );
}

export async function getRecordingBlob(id: string): Promise<Blob | null> {
  return withRecordingsDb((db) =>
    withTx(db, [REC_STORE, CHUNK_STORE], "readonly", (tx, settle) => {
      const recReq = tx.objectStore(REC_STORE).get(id);
      recReq.onsuccess = () => {
        const rec = recReq.result as StudioRecordingMeta | undefined;
        if (!rec) {
          settle(null);
          return;
        }
        const rowsReq = tx.objectStore(CHUNK_STORE).index("recordingId").getAll(id);
        rowsReq.onsuccess = () => {
          const rows = ((rowsReq.result as { seq: number; blob: Blob }[]) ?? []).slice().sort((a, b) => a.seq - b.seq);
          if (rows.length === 0) {
            settle(null);
            return;
          }
          settle(assembleRecordingBlob(rows.map((row) => row.blob), rec.mime));
        };
      };
    }),
  );
}

export async function finishRecording(id: string, crashed = false): Promise<StudioRecordingMeta | null> {
  return withRecordingsDb((db) =>
    withTx(db, REC_STORE, "readwrite", (tx, settle) => {
      const req = tx.objectStore(REC_STORE).get(id);
      req.onsuccess = () => {
        const rec = req.result as StudioRecordingMeta | undefined;
        if (!rec) {
          settle(null);
          return;
        }
        rec.complete = true;
        rec.partial = Boolean(crashed || rec.partial);
        rec.name = sealRecordingName(rec.name, rec.partial);
        tx.objectStore(REC_STORE).put(rec);
        settle(rec);
      };
    }),
  );
}

export async function listRecordings(): Promise<StudioRecordingMeta[]> {
  return withRecordingsDb((db) =>
    withTx(db, REC_STORE, "readonly", (tx, settle) => {
      const req = tx.objectStore(REC_STORE).getAll();
      req.onsuccess = () => {
        const rows = (req.result as StudioRecordingMeta[]) ?? [];
        settle(rows.sort((a, b) => b.createdAt - a.createdAt));
      };
    }),
  );
}

export async function deleteRecording(id: string): Promise<void> {
  await withRecordingsDb((db) =>
    withTx(db, [REC_STORE, CHUNK_STORE], "readwrite", (tx) => {
      const keysReq = tx.objectStore(CHUNK_STORE).index("recordingId").getAllKeys(id);
      keysReq.onsuccess = () => {
        for (const key of keysReq.result ?? []) {
          tx.objectStore(CHUNK_STORE).delete(key);
        }
        tx.objectStore(REC_STORE).delete(id);
      };
    }),
  );
}

export async function recoverIncompleteRecordings(): Promise<StudioRecordingMeta[]> {
  const all = await listRecordings();
  const recovered: StudioRecordingMeta[] = [];
  for (const rec of all) {
    if (rec.complete) continue;
    if (rec.size === 0) {
      await deleteRecording(rec.id);
      continue;
    }
    const next = await finishRecording(rec.id, true);
    if (next) recovered.push(next);
  }
  return recovered;
}
