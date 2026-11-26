import type { Rec } from "./types";
import { cleanArtist } from "./util";

export class DiscogsError extends Error {
  constructor(public kind: "auth" | "notfound" | "offline" | "rate" | "http" | "forbidden", msg: string) { super(msg); }
}
const API = "https://api.discogs.com";
const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((res, rej) => {
  const t = setTimeout(res, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); rej(new DOMException("abort", "AbortError")); });
});

export interface Hooks { onWait?: (secs: number) => void; signal?: AbortSignal }

async function call(url: string, token: string, user: string, h: Hooks = {}): Promise<{ json: any; remaining: number }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response;
    try { res = await fetch(url, { headers: { Authorization: `Discogs token=${token}`, Accept: "application/json" }, signal: h.signal }); }
    catch (e: any) { if (e?.name === "AbortError") throw e; throw new DiscogsError("offline", "Sin conexión: se muestra la copia guardada."); }
    if (res.status === 429) {
      const ra = Number(res.headers.get("Retry-After"));
      const wait = Math.min(90, ra > 0 ? ra : 60);
      for (let s = wait; s > 0; s--) { h.onWait?.(s); await sleep(1000, h.signal); }
      h.onWait?.(0);
      continue;
    }
    if (res.status === 401) throw new DiscogsError("auth", "Discogs no ha aceptado el token (error 401). Revisa que lo hayas copiado entero.");
    if (res.status === 403) throw new DiscogsError("forbidden", "Discogs ha denegado el acceso (403). Comprueba que el token pertenece a ese usuario.");
    if (res.status === 404) throw new DiscogsError("notfound", user ? `El usuario «${user}» no existe en Discogs (error 404). Revisa cómo está escrito.` : "Discogs no encuentra ese recurso (404).");
    if (!res.ok) throw new DiscogsError("http", `Discogs ha respondido con un error (${res.status}). Inténtalo de nuevo dentro de un rato.`);
    const remaining = Number(res.headers.get("X-Discogs-Ratelimit-Remaining"));
    return { json: await res.json(), remaining: Number.isFinite(remaining) && res.headers.has("X-Discogs-Ratelimit-Remaining") ? remaining : 99 };
  }
  throw new DiscogsError("rate", "Discogs limita las peticiones y sigue pidiendo esperar. Inténtalo de nuevo en un minuto.");
}

export async function identity(token: string): Promise<string> {
  const { json } = await call(`${API}/oauth/identity`, token, "");
  return String(json.username || "");
}

function toRec(it: any): Rec {
  const b = it.basic_information || {};
  const notes = Array.isArray(it.notes) ? it.notes.map((n: any) => n?.value).filter(Boolean).join(" · ") : "";
  return {
    key: `i${it.instance_id ?? b.id}`, id: Number(b.id ?? it.id), iid: it.instance_id, mid: b.master_id || undefined,
    title: String(b.title || "Sin título"), year: Number(b.year) || 0,
    artists: (b.artists || []).map((a: any) => cleanArtist(String(a.name || ""))).filter(Boolean),
    labels: (b.labels || []).map((l: any) => ({ name: cleanArtist(String(l.name || "")), catno: String(l.catno || "") })),
    formats: (b.formats || []).map((f: any) => ({ name: String(f.name || ""), descriptions: f.descriptions || [], qty: Number(f.qty) || 1 })),
    genres: b.genres || [], styles: b.styles || [], thumb: b.thumb || "", cover: b.cover_image || "",
    added: String(it.date_added || ""), rating: Number(it.rating) || 0, folder: Number(it.folder_id) || 0, notes, src: "api",
  };
}

export async function fetchCollection(user: string, token: string, onPage: (p: number, pages: number) => void, h: Hooks = {}): Promise<Rec[]> {
  const out: Rec[] = [];
  let page = 1, pages = 1;
  do {
    onPage(page, pages);
    const url = `${API}/users/${encodeURIComponent(user)}/collection/folders/0/releases?per_page=100&page=${page}&sort=added&sort_order=desc`;
    const { json, remaining } = await call(url, token, user, h);
    pages = Number(json?.pagination?.pages) || 1;
    onPage(page, pages);
    for (const it of json.releases || []) out.push(toRec(it));
    page++;
    if (page <= pages && remaining <= 1) { for (let s = 61; s > 0; s--) { h.onWait?.(s); await sleep(1000, h.signal); } h.onWait?.(0); }
  } while (page <= pages);
  return out;
}
