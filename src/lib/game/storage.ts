import type { GameData, Recording } from "./types";

/* -------- Legacy device-only data (read once to move it into the cloud) -------- */

const DATA_KEY = "pinata-talk.data.v1";
const REC_KEY = "pinata-talk.recordings.v1";
const MIGRATED_KEY = "pinata-talk.migrated-to-cloud";

export function loadLegacyData(): GameData | null {
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return null;
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameData;
    return parsed?.version === 1 && Array.isArray(parsed.conversations) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadLegacyRecordings(): Recording[] {
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return [];
    const raw = localStorage.getItem(REC_KEY);
    const list = raw ? (JSON.parse(raw) as Recording[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function markLegacyMigrated() {
  try {
    localStorage.setItem(MIGRATED_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

/* -------- Local audio cache in IndexedDB (the cloud is the source of truth) -------- */

const DB_NAME = "pinata-talk";
const STORE = "audio";
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador no permite guardar audios en caché."));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("No se pudo abrir el almacenamiento."));
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const cachePut = (id: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, id)).catch(() => undefined);
export const cacheGet = (id: string) =>
  tx<Blob | undefined>("readonly", (s) => s.get(id) as IDBRequest<Blob | undefined>).catch(() => undefined);
export const cacheDelete = (id: string) => tx("readwrite", (s) => s.delete(id)).catch(() => undefined);
