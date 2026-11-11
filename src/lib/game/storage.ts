import { DEFAULT_DATA } from "./defaults";
import type { GameData, Recording } from "./types";

const DATA_KEY = "pinata-talk.data.v1";
const REC_KEY = "pinata-talk.recordings.v1";

export function loadData(): GameData {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return structuredClone(DEFAULT_DATA);
    const parsed = JSON.parse(raw) as GameData;
    if (parsed?.version !== 1 || !Array.isArray(parsed.conversations)) {
      return structuredClone(DEFAULT_DATA);
    }
    return {
      ...parsed,
      names: { ...DEFAULT_DATA.names, ...parsed.names },
    };
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

export function saveData(data: GameData) {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch {
    /* storage full or disabled */
  }
}

export function loadRecordings(): Recording[] {
  try {
    const raw = localStorage.getItem(REC_KEY);
    const list = raw ? (JSON.parse(raw) as Recording[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveRecordings(list: Recording[]) {
  try {
    localStorage.setItem(REC_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/* ---------------- Audio blobs in IndexedDB ---------------- */

const DB_NAME = "pinata-talk";
const STORE = "audio";
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador no permite guardar audios."));
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

export const putBlob = (id: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, id));
export const getBlob = (id: string) =>
  tx<Blob | undefined>("readonly", (s) => s.get(id) as IDBRequest<Blob | undefined>);
export const deleteBlob = (id: string) => tx("readwrite", (s) => s.delete(id));
