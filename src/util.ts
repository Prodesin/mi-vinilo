import type { Rec } from "./types";

export const NB = " ";
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const cleanArtist = (n: string) => n.replace(/\s*\(\d+\)\s*$/, "").trim();
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const p2 = (n: number) => String(n).padStart(2, "0");
export function isoDay(d: Date) { return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }
export const today = () => isoDay(new Date());
export function parseDay(s: string): Date { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1, 12); }
export function daysBetween(a: string, b: string) { return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000); }
export function addDays(s: string, n: number) { const d = parseDay(s); d.setDate(d.getDate() + n); return isoDay(d); }
export function weekStart(s: string) { const d = parseDay(s); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return isoDay(d); }

const fDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" });
const fDateShort = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });
const fDay = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
export const fmtDate = (s: string) => fDate.format(parseDay(s)).replace(/ /g, NB);
export const fmtDateShort = (s: string) => fDateShort.format(parseDay(s)).replace(/ /g, NB);
export function fmtDayHead(s: string) {
  const t = today();
  if (s === t) return "Hoy";
  if (s === addDays(t, -1)) return "Ayer";
  const x = fDay.format(parseDay(s));
  return x.charAt(0).toUpperCase() + x.slice(1);
}
export const plural = (n: number, one: string, many: string) => `${n}${NB}${n === 1 ? one : many}`;
export const fmtN = (n: number) => n.toLocaleString("es-ES").replace(/ /g, NB);

export function agoDays(s: string): string {
  const d = daysBetween(s, today());
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d}${NB}días`;
  if (d < 30) { const w = Math.floor(d / 7); return `hace ${w}${NB}${w === 1 ? "semana" : "semanas"}`; }
  if (d < 365) { const m = Math.max(1, Math.floor(d / 30)); return `hace ${m}${NB}${m === 1 ? "mes" : "meses"}`; }
  const y = Math.floor(d / 365); return `hace ${y}${NB}${y === 1 ? "año" : "años"}`;
}
export function agoTs(ts: number): string {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "hace un momento";
  if (s < 3600) { const m = Math.floor(s / 60); return `hace ${m}${NB}${m === 1 ? "minuto" : "minutos"}`; }
  if (s < 86400) { const h = Math.floor(s / 3600); return `hace ${h}${NB}${h === 1 ? "hora" : "horas"}`; }
  return agoDays(isoDay(new Date(ts)));
}

const FMT: Record<string, string> = {
  Vinyl: "Vinilo", Reissue: "Reedición", "Limited Edition": "Edición limitada", Compilation: "Recopilatorio", Album: "Álbum",
  Stereo: "Estéreo", Mono: "Mono", Remastered: "Remasterizado", Repress: "Reprensado", Promo: "Promo", "Box Set": "Caja",
  Unofficial: "No oficial", Single: "Single", Club: "Club", Misc: "Varios", "Special Edition": "Edición especial", Numbered: "Numerado",
};
export const fmtTerm = (s: string) => FMT[s] || s;
export function formatTokens(r: Rec): string[] {
  const out: string[] = [];
  for (const f of r.formats) for (const t of [f.name, ...f.descriptions]) if (t && !out.includes(t)) out.push(t);
  return out;
}
export const formatLine = (r: Rec) => formatTokens(r).map(fmtTerm).join(", ");
export const artistLine = (r: Rec) => r.artists.join(", ") || "Artista desconocido";
export const labelLine = (r: Rec) => r.labels.map((l) => l.name).filter((v, i, a) => a.indexOf(v) === i).join(" / ");
export const catLine = (r: Rec) => r.labels.map((l) => l.catno).filter((c) => c && c.toLowerCase() !== "none").filter((v, i, a) => a.indexOf(v) === i).join(" / ");
export const sortArtist = (r: Rec) => norm(r.artists[0] || "~").replace(/^the /, "");

export function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function initials(r: { title: string; artists: string[] }) {
  const w = (r.artists[0] || r.title).replace(/^the\s+/i, "").split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || "?") + (w.length > 1 ? w[w.length - 1][0] : w[0]?.[1] || "")).toUpperCase();
}
export function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
