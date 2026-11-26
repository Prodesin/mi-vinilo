export interface Rec {
  key: string;            // clave única en la colección local
  id: number;             // release_id de Discogs
  iid?: number;           // instance_id (solo API)
  mid?: number;           // master_id
  title: string;
  year: number;           // 0 si se desconoce
  artists: string[];      // ya sin el sufijo «(2)»
  labels: { name: string; catno: string }[];
  formats: { name: string; descriptions: string[]; qty: number }[];
  genres: string[];
  styles: string[];
  thumb: string;
  cover: string;
  added: string;          // ISO
  rating: number;         // 0–5
  folder: number;
  notes: string;
  media?: string;
  sleeve?: string;
  gone?: boolean;         // ya no está en Discogs
  src: "api" | "csv";
}
export interface Play { id: string; rid: number; date: string; note: string; ts: number }
export type SortKey = "added" | "artist" | "title" | "year" | "most" | "least" | "oldest";
export interface Prefs {
  view: "grid" | "list";
  sort: SortKey;
  preferOld: boolean;
  recent: number[];
  username: string;
}
export interface Meta { lastSync: number; lastSyncCount: number; source: "api" | "csv" | "" }
export interface Filters {
  genre: string; style: string; artist: string; label: string; format: string; from: string; to: string;
}
