import { useEffect, useState } from "preact/hooks";
import type { Meta, Play, Prefs, Rec } from "./types";
import { dbDel, dbGet, dbSet } from "./db";
import { fetchCollection, DiscogsError } from "./discogs";
import { csvToRecs } from "./csv";
import { getAppleCache, setAppleCache, wipeApple } from "./apple";
import { cleanArtist, today, uid } from "./util";

export const COVER_CACHE = "mi-vinilo-portadas";
const defPrefs = (): Prefs => ({ view: "grid", sort: "added", preferOld: false, recent: [], username: "" });
const defMeta = (): Meta => ({ lastSync: 0, lastSyncCount: 0, source: "" });

export interface SyncState { running: boolean; page: number; pages: number; wait: number; error: string; ok: string }
export const S = {
  ready: false,
  records: [] as Rec[],
  plays: [] as Play[],
  prefs: defPrefs(),
  meta: defMeta(),
  token: "",
  sync: { running: false, page: 0, pages: 0, wait: 0, error: "", ok: "" } as SyncState,
  v: 0,
};
const subs = new Set<() => void>();
export function emit() { S.v++; subs.forEach((f) => f()); }
export function useStore() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return S;
}

export async function loadAll() {
  const [records, plays, prefs, meta, auth] = await Promise.all([
    dbGet<Rec[]>("collection"), dbGet<Play[]>("plays"), dbGet<Prefs>("prefs"), dbGet<Meta>("meta"), dbGet<{ token: string }>("auth"),
  ]);
  S.records = Array.isArray(records) ? records : [];
  S.plays = Array.isArray(plays) ? plays : [];
  S.prefs = { ...defPrefs(), ...(prefs || {}) };
  S.meta = { ...defMeta(), ...(meta || {}) };
  S.token = auth?.token || "";
  S.ready = true;
  emit();
}
const saveRecs = () => dbSet("collection", S.records);
const savePlays = () => dbSet("plays", S.plays);
const saveMeta = () => dbSet("meta", S.meta);
export function setPrefs(p: Partial<Prefs>) { S.prefs = { ...S.prefs, ...p }; dbSet("prefs", S.prefs); emit(); }
export function setToken(t: string) { S.token = t; if (t) dbSet("auth", { token: t }); else dbDel("auth"); emit(); }

/* ---------- Escuchas ---------- */
export function addPlay(rid: number, date = today(), note = ""): Play {
  const p: Play = { id: uid(), rid, date, note: note.trim().slice(0, 120), ts: Date.now() };
  S.plays = [...S.plays, p]; savePlays(); emit(); return p;
}
export function restorePlay(p: Play) { S.plays = [...S.plays, p]; savePlays(); emit(); }
export function removePlay(id: string) { S.plays = S.plays.filter((p) => p.id !== id); savePlays(); emit(); }
export function updatePlay(id: string, date: string, note: string) {
  S.plays = S.plays.map((p) => (p.id === id ? { ...p, date, note: note.trim().slice(0, 120) } : p)); savePlays(); emit();
}
export function undoLastPlay(rid: number): boolean {
  const mine = S.plays.filter((p) => p.rid === rid).sort((a, b) => b.ts - a.ts)[0];
  if (!mine) return false; removePlay(mine.id); return true;
}

/* ---------- Colección ---------- */
function applyRecords(next: Rec[], source: "api" | "csv") {
  S.records = next; S.meta = { lastSync: Date.now(), lastSyncCount: next.filter((r) => !r.gone).length, source }; saveRecs(); saveMeta(); emit();
}
export async function syncNow(): Promise<void> {
  if (S.sync.running) return;
  const user = S.prefs.username.trim();
  if (!user || !S.token) { S.sync = { ...S.sync, error: "Falta el usuario o el token de Discogs. Rellénalos arriba." }; emit(); return; }
  S.sync = { running: true, page: 0, pages: 0, wait: 0, error: "", ok: "" }; emit();
  try {
    const fresh = await fetchCollection(user, S.token, (page, pages) => { S.sync = { ...S.sync, page, pages }; emit(); }, {
      onWait: (wait) => { S.sync = { ...S.sync, wait }; emit(); },
    });
    const keys = new Set(fresh.map((r) => r.key));
    const rids = new Set(fresh.map((r) => r.id));
    // Los que ya no vienen de Discogs se conservan marcados; las filas de CSV se sustituyen por las de la API.
    const kept = S.records.filter((r) => r.src === "api" && !keys.has(r.key)).map((r) => ({ ...r, gone: true }));
    void rids;
    applyRecords([...fresh, ...kept], "api");
    const gone = kept.length;
    S.sync = { running: false, page: 0, pages: 0, wait: 0, error: "", ok: `Colección sincronizada: ${fresh.length} discos${gone ? `; ${gone} ya no están en Discogs (marcados)` : ""}.` };
    try { navigator.storage?.persist?.(); } catch { /* nada */ }
  } catch (e: any) {
    const msg = e instanceof DiscogsError ? e.message : e?.name === "AbortError" ? "Sincronización cancelada." : "No he podido sincronizar. Inténtalo de nuevo.";
    S.sync = { running: false, page: 0, pages: 0, wait: 0, error: msg, ok: "" };
  }
  emit();
}
export function importCsv(text: string): number {
  const recs = csvToRecs(text);
  applyRecords(recs, "csv"); return recs.length;
}
export function dropGone() { S.records = S.records.filter((r) => !r.gone); saveRecs(); emit(); }

/* ---------- Copia de seguridad (SIN token) ---------- */
export async function buildBackup() {
  return { app: "mi-vinilo", version: 1, exportedAt: new Date().toISOString(), prefs: S.prefs, meta: S.meta, collection: S.records, plays: S.plays, apple: await getAppleCache() };
}
export function validateBackup(x: any): { records: Rec[]; plays: Play[]; prefs: Partial<Prefs>; meta: Partial<Meta>; apple: unknown } {
  if (!x || typeof x !== "object" || x.app !== "mi-vinilo") throw new Error("Este archivo no es una copia de Mi vinilo.");
  if (!Array.isArray(x.collection) || !Array.isArray(x.plays)) throw new Error("La copia está incompleta (faltan la colección o las escuchas).");
  const records: Rec[] = [];
  x.collection.forEach((r: any, i: number) => {
    if (!r || typeof r.id !== "number" || typeof r.title !== "string") throw new Error(`El disco n.º ${i + 1} de la copia no es válido.`);
    records.push({
      key: String(r.key ?? `r${r.id}`), id: r.id, iid: r.iid, mid: r.mid, title: r.title, year: Number(r.year) || 0,
      artists: (Array.isArray(r.artists) ? r.artists : []).map((a: any) => cleanArtist(String(a))),
      labels: (Array.isArray(r.labels) ? r.labels : []).map((l: any) => ({ name: String(l?.name ?? ""), catno: String(l?.catno ?? "") })),
      formats: (Array.isArray(r.formats) ? r.formats : []).map((f: any) => ({ name: String(f?.name ?? ""), descriptions: Array.isArray(f?.descriptions) ? f.descriptions.map(String) : [], qty: Number(f?.qty) || 1 })),
      genres: Array.isArray(r.genres) ? r.genres.map(String) : [], styles: Array.isArray(r.styles) ? r.styles.map(String) : [],
      thumb: String(r.thumb || ""), cover: String(r.cover || ""), added: String(r.added || ""), rating: Number(r.rating) || 0, folder: Number(r.folder) || 0,
      notes: String(r.notes || ""), media: r.media, sleeve: r.sleeve, gone: !!r.gone, src: r.src === "csv" ? "csv" : "api",
    });
  });
  const plays: Play[] = x.plays.map((p: any, i: number) => {
    if (!p || typeof p.rid !== "number" || !/^\d{4}-\d{2}-\d{2}$/.test(String(p.date))) throw new Error(`La escucha n.º ${i + 1} de la copia no es válida.`);
    return { id: String(p.id || uid()), rid: p.rid, date: p.date, note: String(p.note || ""), ts: Number(p.ts) || Date.parse(p.date) };
  });
  const prefs = (x.prefs && typeof x.prefs === "object") ? { ...x.prefs } : {};
  delete (prefs as any).token;
  return { records, plays, prefs, meta: x.meta && typeof x.meta === "object" ? x.meta : {}, apple: x.apple };
}
export function applyBackup(b: ReturnType<typeof validateBackup>) {
  S.records = b.records; S.plays = b.plays;
  S.prefs = { ...defPrefs(), ...b.prefs, username: b.prefs.username ?? S.prefs.username };
  S.meta = { ...defMeta(), ...b.meta };
  saveRecs(); savePlays(); dbSet("prefs", S.prefs); saveMeta(); void setAppleCache(b.apple); emit();
}
export async function wipeAll() {
  S.records = []; S.plays = []; S.prefs = defPrefs(); S.meta = defMeta(); S.token = "";
  await Promise.all([dbDel("collection"), dbDel("plays"), dbDel("prefs"), dbDel("meta"), dbDel("auth"), wipeApple()]);
  try { await caches.delete(COVER_CACHE); } catch { /* nada */ }
  emit();
}
