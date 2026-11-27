/* Enlace a Apple Music vía iTunes Search API pública (sin cuenta, con CORS). Solo se envían artista y título. */
import { useEffect, useState } from "preact/hooks";
import type { Rec } from "./types";
import { dbDel, dbGet, dbSet } from "./db";
import { cleanArtist } from "./util";

export interface AppleHit { u: string; t: "album" | "search"; d: number }
const KEY = "apple";
const RETRY_MS = 30 * 86400000;
let cache: Record<string, AppleHit> | null = null;
let loading: Promise<Record<string, AppleHit>> | null = null;

async function load(): Promise<Record<string, AppleHit>> {
  if (cache) return cache;
  if (!loading) loading = dbGet<Record<string, AppleHit>>(KEY).then((c) => (cache = c && typeof c === "object" ? c : {}));
  return loading;
}
export const getAppleCache = async () => ({ ...(await load()) });
export async function setAppleCache(c: unknown) {
  const out: Record<string, AppleHit> = {};
  if (c && typeof c === "object") for (const [k, v] of Object.entries(c as Record<string, any>)) {
    if (v && typeof v.u === "string" && (v.t === "album" || v.t === "search") && /^https:\/\/(music|itunes)\.apple\.com\//.test(v.u)) out[k] = { u: v.u, t: v.t, d: Number(v.d) || 0 };
  }
  cache = out; loading = null; await dbSet(KEY, out);
}
export async function wipeApple() { cache = {}; loading = null; await dbDel(KEY); }

/* ---------- Normalización y puntuación ---------- */
const EDITION = /\b(deluxe|edition|edicion|remaster(ed)?|anniversary|expanded|legacy|special|bonus|reissue|mono|stereo|version)\b/;
export function normName(s: string, isArtist = false): string {
  let x = cleanArtist(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  x = x.replace(/\s*[([{][^)\]}]*[)\]}]/g, " ");           // (Remastered), [Mono]…
  x = x.replace(/&/g, " and ").replace(/['’`]/g, "").replace(/[^a-z0-9぀-ヿ一-鿿]+/g, " ").trim();
  if (!isArtist) x = x.replace(/\s+(deluxe|expanded|special|legacy|remastered|anniversary)(\s+(edition|version))?$/, "").replace(/\s+(edition|version)$/, "");
  return x.replace(/^the /, "").replace(/\s+/g, " ").trim();
}
const hasWord = (big: string, small: string) => small.length >= 3 && (` ${big} `).includes(` ${small} `);
function artistScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 2;
  if (hasWord(a, b) || hasWord(b, a)) return 1;
  return 0;
}
function titleScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 3;
  if (hasWord(a, b) || hasWord(b, a)) return 1;
  return 0;
}
export interface ItunesAlbum { artistName?: string; collectionName?: string; collectionViewUrl?: string }
export function pickAlbum(artist: string, title: string, results: ItunesAlbum[]): string | null {
  const A = normName(artist, true), T = normName(title);
  let best: { s: number; u: string } | null = null;
  for (const it of results) {
    if (!it?.collectionViewUrl || !it.collectionName || !it.artistName) continue;
    const as = artistScore(A, normName(it.artistName, true)), ts = titleScore(T, normName(it.collectionName));
    if (!as || !ts) continue;
    const raw = it.collectionName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const plain = !EDITION.test(raw) ? 1 : 0;
    const s = as * 100 + ts * 10 + plain * 5;   // a igualdad, prefiere el título exacto sin «edición»/«deluxe»
    if (!best || s > best.s) best = { s, u: it.collectionViewUrl };
  }
  return best ? cleanUrl(best.u) : null;
}
function cleanUrl(u: string): string | null {
  try {
    const x = new URL(u);
    if (x.protocol !== "https:" || !/^(music|itunes)\.apple\.com$/.test(x.hostname)) return null;
    x.searchParams.delete("uo");
    return x.toString();
  } catch { return null; }
}

export const term = (r: Pick<Rec, "artists" | "title">) => `${cleanArtist(r.artists[0] || "")} ${r.title}`.trim();
export const searchUrl = (r: Pick<Rec, "artists" | "title">) => `https://music.apple.com/es/search?term=${encodeURIComponent(term(r))}`;

/* ---------- Red: una petición por segundo como máximo, timeout de 8 s ---------- */
let chain: Promise<unknown> = Promise.resolve();
let lastReq = 0;
function throttled<T>(f: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastReq + 1000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastReq = Date.now();
    return f();
  });
  chain = run.catch(() => {});
  return run;
}
async function query(r: Rec): Promise<string | null> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(`https://itunes.apple.com/search?entity=album&country=es&limit=10&term=${encodeURIComponent(term(r))}`, { signal: ctl.signal });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    return pickAlbum(r.artists[0] || "", r.title, Array.isArray(j?.results) ? j.results : []);
  } finally { clearTimeout(t); }
}

const inflight = new Map<string, Promise<AppleHit>>();
export async function resolveApple(r: Rec): Promise<AppleHit> {
  const key = String(r.mid || r.id);
  const c = await load();
  const hit = c[key];
  const fallback: AppleHit = { u: searchUrl(r), t: "search", d: Date.now() };
  if (hit && (hit.t === "album" || Date.now() - hit.d < RETRY_MS)) return hit;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return hit || fallback;
  let p = inflight.get(key);
  if (!p) {
    p = throttled(async () => {
      try {
        const u = await query(r);
        const next: AppleHit = u ? { u, t: "album", d: Date.now() } : { u: searchUrl(r), t: "search", d: Date.now() };
        cache = { ...(await load()), [key]: next }; void dbSet(KEY, cache).catch(() => {});
        return next;
      } catch { return hit || fallback; }   // error de red: no se cachea, cae a búsqueda
    }).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}
export function useApple(r: Rec): AppleHit & { busy: boolean } {
  const [st, setSt] = useState<{ key: string; hit: AppleHit } | null>(null);
  useEffect(() => {
    let live = true;
    resolveApple(r).then((h) => { if (live) setSt({ key: r.key, hit: h }); });
    return () => { live = false; };
  }, [r.key]);
  const hit = st && st.key === r.key ? st.hit : null;
  return hit ? { ...hit, busy: false } : { u: searchUrl(r), t: "search", d: 0, busy: true };
}

/* ---------- Abrir (app Música en iOS/iPadOS; pestaña nueva en el resto) ---------- */
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
export const musicScheme = (u: string) => u.replace(/^https:\/\//, "music://");
export function openApple(e: Event, u: string) {
  if (!isIOS()) return;                         // el <a target=_blank> abre la URL https
  e.preventDefault();
  let left = false;
  const gone = () => { left = true; };
  document.addEventListener("visibilitychange", gone, { once: true });
  window.addEventListener("pagehide", gone, { once: true });
  location.href = musicScheme(u);
  setTimeout(() => {
    document.removeEventListener("visibilitychange", gone); window.removeEventListener("pagehide", gone);
    if (!left && document.visibilityState === "visible") location.href = u;   // respaldo si no hay app Música
  }, 1500);
}
