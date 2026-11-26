/* Pequeño wrapper de IndexedDB (almacén clave-valor). Si IndexedDB no está disponible, usa localStorage. */
const DB = "mi-vinilo", STORE = "kv";
let dbp: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then((db) => new Promise<T | undefined>((res, rej) => {
    const t = db.transaction(STORE, mode);
    const rq = f(t.objectStore(STORE));
    t.oncomplete = () => res(rq ? (rq as IDBRequest<T>).result : undefined);
    t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
}
const LS = "mi-vinilo:";
const hasIDB = typeof indexedDB !== "undefined";
export async function dbGet<T>(key: string): Promise<T | undefined> {
  if (!hasIDB) { try { const v = localStorage.getItem(LS + key); return v ? JSON.parse(v) : undefined; } catch { return undefined; } }
  try { return (await tx<T>("readonly", (s) => s.get(key))) as T | undefined; } catch { return undefined; }
}
export async function dbSet(key: string, value: unknown): Promise<void> {
  if (!hasIDB) { try { localStorage.setItem(LS + key, JSON.stringify(value)); } catch { /* lleno */ } return; }
  await tx("readwrite", (s) => { s.put(value, key); });
}
export async function dbDel(key: string): Promise<void> {
  if (!hasIDB) { try { localStorage.removeItem(LS + key); } catch { /* nada */ } return; }
  await tx("readwrite", (s) => { s.delete(key); });
}
