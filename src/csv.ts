import type { Rec } from "./types";
import { cleanArtist } from "./util";

/** Parser CSV (RFC 4180): comillas, comas, saltos de línea dentro de campos, BOM, \r\n y separador ; opcional. */
export function parseCSV(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const first = text.split(/\r?\n/, 1)[0] || "";
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); f = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; }
    else f += c;
  }
  if (f !== "" || row.length) { row.push(f); if (row.length > 1 || row[0] !== "") rows.push(row); }
  return rows;
}

export function csvToRecs(text: string): Rec[] {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error("El archivo está vacío.");
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => { for (const n of names) { const i = head.indexOf(n.toLowerCase()); if (i >= 0) return i; } return -1; };
  const iId = col("release_id"), iT = col("title"), iA = col("artist");
  if (iId < 0 || iT < 0 || iA < 0) throw new Error("No parece la exportación de Discogs: faltan las columnas release_id, Artist y Title.");
  const iCat = col("catalog#"), iLab = col("label"), iFmt = col("format"), iRat = col("rating"), iRel = col("released"), iDate = col("date added"), iMed = col("collection media condition"), iSl = col("collection sleeve condition"), iNo = col("collection notes");
  const seen = new Map<number, number>();
  const out: Rec[] = [];
  for (const r of rows.slice(1)) {
    const id = Number((r[iId] || "").trim());
    if (!id) continue;
    const n = (seen.get(id) || 0) + 1; seen.set(id, n);
    const fm = (r[iFmt] || "").split(",").map((s) => s.trim()).filter(Boolean);
    const date = (r[iDate] || "").trim();
    out.push({
      key: n === 1 ? `r${id}` : `r${id}-${n}`, id, title: (r[iT] || "").trim() || "Sin título", year: parseInt(iRel >= 0 ? r[iRel] : "", 10) || 0,
      artists: [cleanArtist((r[iA] || "").trim())].filter(Boolean),
      labels: (r[iLab] || "").split(/\s*,\s*/).filter(Boolean).map((name, i) => ({ name: cleanArtist(name), catno: (iCat >= 0 ? r[iCat] || "" : "").split(/\s*,\s*/)[i] || "" })),
      formats: fm.length ? [{ name: fm[0], descriptions: fm.slice(1), qty: 1 }] : [],
      genres: [], styles: [], thumb: "", cover: "", added: date ? date.replace(" ", "T") : "", rating: Number(iRat >= 0 ? r[iRat] : 0) || 0,
      folder: 0, notes: (iNo >= 0 ? r[iNo] || "" : "").trim(), media: iMed >= 0 ? (r[iMed] || "").trim() || undefined : undefined,
      sleeve: iSl >= 0 ? (r[iSl] || "").trim() || undefined : undefined, src: "csv",
    });
  }
  if (!out.length) throw new Error("No he encontrado discos en el archivo.");
  return out;
}
