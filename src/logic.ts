import type { Filters, Play, Rec, SortKey } from "./types";
import { daysBetween, formatTokens, norm, sortArtist, today } from "./util";

export const noFilters = (): Filters => ({ genre: "", style: "", artist: "", label: "", format: "", from: "", to: "" });
export const hasFilters = (f: Filters) => Object.values(f).some(Boolean);
export const countFilters = (f: Filters) => Object.values(f).filter(Boolean).length;

export interface PS { n: number; last: string }
export function playStats(plays: Play[]): Map<number, PS> {
  const m = new Map<number, PS>();
  for (const p of plays) { const c = m.get(p.rid); if (!c) m.set(p.rid, { n: 1, last: p.date }); else { c.n++; if (p.date > c.last) c.last = p.date; } }
  return m;
}
const searchCache = new WeakMap<Rec, string>();
function hay(r: Rec) {
  let s = searchCache.get(r);
  if (s === undefined) { s = norm([r.artists.join(" "), r.title, r.labels.map((l) => `${l.name} ${l.catno}`).join(" "), r.year || ""].join(" ")); searchCache.set(r, s); }
  return s;
}
export function matches(r: Rec, q: string[], f: Filters): boolean {
  for (const t of q) if (!hay(r).includes(t)) return false;
  if (f.genre && !r.genres.includes(f.genre)) return false;
  if (f.style && !r.styles.includes(f.style)) return false;
  if (f.artist && !r.artists.includes(f.artist)) return false;
  if (f.label && !r.labels.some((l) => l.name === f.label)) return false;
  if (f.format && !formatTokens(r).includes(f.format)) return false;
  const from = parseInt(f.from, 10), to = parseInt(f.to, 10);
  if (from && (!r.year || r.year < from)) return false;
  if (to && (!r.year || r.year > to)) return false;
  return true;
}
export function filterRecs(recs: Rec[], query: string, f: Filters, sort: SortKey, ps: Map<number, PS>): Rec[] {
  const q = norm(query).split(/\s+/).filter(Boolean);
  const out = recs.filter((r) => matches(r, q, f));
  const cmpStr = (a: string, b: string) => a.localeCompare(b, "es");
  const added = (r: Rec) => r.added || "";
  const nn = (r: Rec) => ps.get(r.id)?.n || 0;
  const last = (r: Rec) => ps.get(r.id)?.last || "";
  const by: Record<SortKey, (a: Rec, b: Rec) => number> = {
    added: (a, b) => cmpStr(added(b), added(a)),
    artist: (a, b) => cmpStr(sortArtist(a), sortArtist(b)) || cmpStr(norm(a.title), norm(b.title)),
    title: (a, b) => cmpStr(norm(a.title), norm(b.title)),
    year: (a, b) => (a.year || 9999) - (b.year || 9999) || cmpStr(sortArtist(a), sortArtist(b)),
    most: (a, b) => nn(b) - nn(a) || cmpStr(last(b), last(a)),
    least: (a, b) => nn(a) - nn(b) || cmpStr(added(a), added(b)),
    // los nunca escuchados primero (por fecha de añadido), luego la última escucha más antigua
    oldest: (a, b) => (last(a) || "0").localeCompare(last(b) || "0") || cmpStr(added(a), added(b)),
  };
  return out.sort(by[sort]);
}
export function countBy(recs: Rec[], pick: (r: Rec) => string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const r of recs) for (const k of new Set(pick(r))) if (k) m.set(k, (m.get(k) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
}
export const decadeOf = (y: number) => (y ? `${Math.floor(y / 10) * 10}s` : "");

export function pickRandom(pool: Rec[], ps: Map<number, PS>, recent: number[], preferOld: boolean): Rec | null {
  if (!pool.length) return null;
  const ex = pool.filter((r) => !recent.includes(r.id));
  const from = ex.length ? ex : pool;
  const t = today();
  const w = from.map((r) => {
    if (!preferOld) return 1;
    const l = ps.get(r.id)?.last;
    return l ? Math.min(900, Math.max(0, daysBetween(l, t))) + 1 : 900;
  });
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < from.length; i++) { x -= w[i]; if (x <= 0) return from[i]; }
  return from[from.length - 1];
}

/* Quita de los filtros los valores que ya no existen en la colección. Devuelve null si no hay nada que quitar. */
export function pruneFilters(f: Filters, recs: Rec[]): Filters | null {
  const has = {
    genre: new Set(recs.flatMap((r) => r.genres)), style: new Set(recs.flatMap((r) => r.styles)), artist: new Set(recs.flatMap((r) => r.artists)),
    label: new Set(recs.flatMap((r) => r.labels.map((l) => l.name))), format: new Set(recs.flatMap(formatTokens)),
  };
  const out = { ...f }; let ch = false;
  for (const k of ["genre", "style", "artist", "label", "format"] as const) if (out[k] && !has[k].has(out[k])) { out[k] = ""; ch = true; }
  return ch ? out : null;
}
export function pruneRandom<T extends { genre: string; style: string; artist: string; decade: string }>(f: T, recs: Rec[]): T | null {
  const live = recs.filter((r) => !r.gone);
  const out = { ...f }; let ch = false;
  if (out.genre && !live.some((r) => r.genres.includes(out.genre))) { out.genre = ""; ch = true; }
  if (out.style && !live.some((r) => r.styles.includes(out.style))) { out.style = ""; ch = true; }
  if (out.artist && !live.some((r) => r.artists.includes(out.artist))) { out.artist = ""; ch = true; }
  if (out.decade && !live.some((r) => decadeOf(r.year) === out.decade)) { out.decade = ""; ch = true; }
  return ch ? out : null;
}
