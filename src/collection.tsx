import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Filters, Play, Rec, SortKey } from "./types";
import { PS, countBy, countFilters, filterRecs, hasFilters, noFilters } from "./logic";
import { S, addPlay, removePlay, restorePlay, setPrefs, undoLastPlay } from "./store";
import { openApple, useApple } from "./apple";
import { Cover, Icon, Select, Stars, toast } from "./ui";
import { NB, agoDays, artistLine, catLine, fmtDate, fmtN, formatLine, fmtDateShort, labelLine, plural, today } from "./util";

export const SORTS: [SortKey, string][] = [
  ["added", "Recién añadidos"], ["artist", "Artista (A–Z)"], ["title", "Título (A–Z)"], ["year", "Año (antiguos primero)"],
  ["most", "Más escuchados"], ["least", "Menos escuchados"], ["oldest", "Más tiempo sin sonar"],
];
export interface Ctx {
  ps: Map<number, PS>; byId: Map<number, Rec>;
  open: (id: number) => void; setTab: (t: string) => void; editPlay: (p: Play) => void;
}

export function quickPlay(r: Rec, date = today(), note = "") {
  const p = addPlay(r.id, date, note);
  toast(`Apuntado: ${r.title}`, { action: { label: "Deshacer", run: () => removePlay(p.id) } });
}

function Card({ r, list, ps, onOpen, active }: { r: Rec; list: boolean; ps?: PS; onOpen: () => void; active: boolean }) {
  const meta = [r.year || "", labelLine(r)].filter(Boolean).join(" · ");
  return (
    <li>
      <button type="button" class={"card" + (list ? " card--row" : "") + (active ? " is-active" : "")} onClick={onOpen} aria-label={`${r.title}, ${artistLine(r)}`}>
        <Cover r={r} />
        <span class="card__txt">
          <span class="card__t">{r.title}</span>
          <span class="card__a">{artistLine(r)}</span>
          {list && <span class="card__m">{meta}{ps ? ` · ${plural(ps.n, "escucha", "escuchas")}` : ""}</span>}
        </span>
        {r.gone && <span class="badge" title="Ya no está en Discogs">Retirado</span>}
      </button>
    </li>
  );
}

export function FilterPanel({ recs, f, setF, onClose }: { recs: Rec[]; f: Filters; setF: (f: Filters) => void; onClose?: () => void }) {
  const set = (k: keyof Filters) => (v: string) => setF({ ...f, [k]: v });
  const genres = useMemo(() => countBy(recs, (r) => r.genres), [recs]);
  const styles = useMemo(() => countBy(recs, (r) => r.styles), [recs]);
  const artists = useMemo(() => countBy(recs, (r) => r.artists).sort((a, b) => a[0].localeCompare(b[0], "es")), [recs]);
  const labels = useMemo(() => countBy(recs, (r) => r.labels.map((l) => l.name)).sort((a, b) => a[0].localeCompare(b[0], "es")), [recs]);
  const formats = useMemo(() => countBy(recs, (r) => [...new Set(r.formats.flatMap((x) => [x.name, ...x.descriptions]))]), [recs]);
  const opts = (rows: [string, number][], cur: string) => {
    const all = rows.some(([k]) => k === cur) || !cur ? rows : [...rows, [cur, 0] as [string, number]];
    return <><option value="">Todos</option>{all.map(([k, n]) => <option key={k} value={k}>{k} ({n})</option>)}</>;
  };
  return (
    <div class="fpanel">
      <div class="fpanel__head"><h2>Filtros</h2>{onClose && <button type="button" class="btn btn--sm" onClick={onClose}>Listo</button>}</div>
      {genres.length > 0 && <Select label="Género" value={f.genre} onChange={set("genre")}>{opts(genres, f.genre)}</Select>}
      {styles.length > 0 && <Select label="Estilo" value={f.style} onChange={set("style")}>{opts(styles, f.style)}</Select>}
      <Select label="Artista" value={f.artist} onChange={set("artist")}>{opts(artists, f.artist)}</Select>
      <Select label="Sello" value={f.label} onChange={set("label")}>{opts(labels, f.label)}</Select>
      {formats.length > 0 && <Select label="Formato" value={f.format} onChange={set("format")}>{opts(formats, f.format)}</Select>}
      <div class="field"><span class="field__l">Años (rango)</span>
        <div class="range">
          <input class="input" type="number" inputMode="numeric" min="1900" max="2100" placeholder="Desde" aria-label="Año desde" value={f.from} onInput={(e) => set("from")((e.target as HTMLInputElement).value.slice(0, 4))} />
          <span aria-hidden="true">–</span>
          <input class="input" type="number" inputMode="numeric" min="1900" max="2100" placeholder="Hasta" aria-label="Año hasta" value={f.to} onInput={(e) => set("to")((e.target as HTMLInputElement).value.slice(0, 4))} />
        </div>
      </div>
      {hasFilters(f) && <button type="button" class="btn btn--block" onClick={() => setF(noFilters())}>Quitar filtros</button>}
    </div>
  );
}

const CHIP_L: Record<keyof Filters, string> = { genre: "Género", style: "Estilo", artist: "Artista", label: "Sello", format: "Formato", from: "Desde", to: "Hasta" };

export interface CollProps {
  ctx: Ctx; q: string; setQ: (s: string) => void; f: Filters; setF: (f: Filters) => void; fOpen: boolean; setFOpen: (b: boolean) => void;
  openId: number | null; close: () => void;
}
export function Collection(p: CollProps) {
  const { ctx, q, setQ, f, setF, fOpen, setFOpen, openId, close } = p;
  const recs = S.records;
  const sort = S.prefs.sort, list = S.prefs.view === "list";
  const shown = useMemo(() => filterRecs(recs, q, f, sort, ctx.ps), [recs, q, f, sort, ctx.ps]);
  const [limit, setLimit] = useState(90);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => setLimit(90), [q, f, sort, recs]);
  useEffect(() => {
    const el = sentinel.current; if (!el || !("IntersectionObserver" in window)) { setLimit(1e6); return; }
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) setLimit((l) => l + 90); }, { rootMargin: "900px" });
    io.observe(el); return () => io.disconnect();
  }, [shown, limit > 90]);
  const rec = openId != null ? ctx.byId.get(openId) || null : null;
  const chips = (Object.keys(f) as (keyof Filters)[]).filter((k) => f[k]);
  const gone = recs.filter((r) => r.gone).length;
  const csvOnly = recs.length > 0 && recs.every((r) => r.src === "csv");
  const n = countFilters(f);

  return (
    <div class="coll" data-open={rec ? "1" : "0"}>
      <aside class="filters" data-open={fOpen ? "1" : "0"} aria-label="Filtros">
        <FilterPanel recs={recs} f={f} setF={setF} onClose={() => setFOpen(false)} />
      </aside>
      <div class="coll__main">
        <div class="toolbar">
          <label class="search"><Icon name="search" size={20} />
            <input type="search" enterKeyHint="search" autocomplete="off" autocapitalize="off" spellcheck={false} placeholder="Artista, título, sello o catálogo" aria-label="Buscar en la colección" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          </label>
          <button type="button" class={"btn btn--icon filt-btn" + (n ? " is-on" : "")} aria-expanded={fOpen} aria-label={`Filtros${n ? `, ${n} activos` : ""}`} onClick={() => setFOpen(!fOpen)}><Icon name="filter" size={21} />{n > 0 && <b>{n}</b>}</button>
          <div class="seg seg--icons" role="group" aria-label="Vista">
            <button type="button" aria-pressed={!list} aria-label="Cuadrícula" onClick={() => setPrefs({ view: "grid" })}><Icon name="grid" size={20} /></button>
            <button type="button" aria-pressed={list} aria-label="Lista" onClick={() => setPrefs({ view: "list" })}><Icon name="list" size={20} /></button>
          </div>
        </div>
        <div class="toolbar2">
          <p class="count" aria-live="polite">{fmtN(shown.length)} de {fmtN(recs.length)}{NB}discos</p>
          <label class="sortsel"><span class="sr">Ordenar por</span>
            <span class="sel"><select value={sort} aria-label="Ordenar por" onChange={(e) => setPrefs({ sort: (e.target as HTMLSelectElement).value as SortKey })}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></span>
          </label>
        </div>
        {(chips.length > 0 || q) && (
          <div class="chips">
            {q && <button type="button" class="chip" onClick={() => setQ("")}>«{q}» <Icon name="close" size={14} /></button>}
            {chips.map((k) => <button type="button" key={k} class="chip" onClick={() => setF({ ...f, [k]: "" })} aria-label={`Quitar ${CHIP_L[k]}: ${f[k]}`}>{CHIP_L[k]}: {f[k]} <Icon name="close" size={14} /></button>)}
            {(chips.length > 0 || q) && <button type="button" class="chip chip--clear" onClick={() => { setF(noFilters()); setQ(""); }}>Quitar filtros</button>}
          </div>
        )}
        {csvOnly && <p class="hint">Esta colección viene del CSV: no trae géneros, estilos ni portadas, así que esos filtros no están disponibles. Sincroniza con Discogs para tenerlos.</p>}
        {gone > 0 && <p class="hint">{plural(gone, "disco ya no está", "discos ya no están")} en Discogs (marcados como «Retirado»; se conservan con su historial).</p>}
        {shown.length === 0 ? (
          <div class="empty"><p><b>No hay discos con esa búsqueda.</b></p><p>Prueba con menos palabras o quita algún filtro.</p>
            <button type="button" class="btn" onClick={() => { setF(noFilters()); setQ(""); }}>Quitar filtros y búsqueda</button></div>
        ) : (
          <ul class={"cards" + (list ? " cards--list" : "")}>
            {shown.slice(0, limit).map((r) => <Card key={r.key} r={r} list={list} ps={ctx.ps.get(r.id)} active={rec?.key === r.key} onOpen={() => ctx.open(r.id)} />)}
          </ul>
        )}
        {limit < shown.length && <div ref={sentinel} class="sentinel">Cargando más discos…</div>}
      </div>
      <aside class="detail" aria-label="Ficha del disco" hidden={!rec}>
        {rec && <Detail key={rec.key} r={rec} ctx={ctx} f={f} setF={setF} close={close} />}
      </aside>
    </div>
  );
}

export function PlayRow({ p, ctx }: { p: Play; ctx: Ctx }) {
  return (
    <li class="prow">
      <span class="prow__d">{fmtDateShort(p.date)}<small>{agoDays(p.date)}</small></span>
      <span class="prow__n">{p.note || <i>Sin nota</i>}</span>
      <button type="button" class="btn btn--icon btn--ghost" aria-label="Editar escucha" onClick={() => ctx.editPlay(p)}><Icon name="edit" size={19} /></button>
      <button type="button" class="btn btn--icon btn--ghost" aria-label="Borrar escucha" onClick={() => { removePlay(p.id); toast("Escucha borrada", { action: { label: "Deshacer", run: () => restorePlay(p) } }); }}><Icon name="trash" size={19} /></button>
    </li>
  );
}

export function AppleBtn({ r }: { r: Rec }) {
  const a = useApple(r);
  return (
    <a class="btn btn--apple" href={a.u} target="_blank" rel="noopener noreferrer" onClick={(e) => openApple(e, a.u)}>
      <Icon name="note" size={20} />
      <span class="btn__2"><span>Abrir en Apple Music</span>{a.t === "search" && !a.busy && <small>Buscar en Apple Music</small>}</span>
    </a>
  );
}

function Detail({ r, ctx, f, setF, close }: { r: Rec; ctx: Ctx; f: Filters; setF: (f: Filters) => void; close: () => void }) {
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const mine = S.plays.filter((p) => p.rid === r.id).sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  const isToday = date === today();
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => { el.current?.scrollTo?.(0, 0); }, [r.key]);
  const tag = (k: "genre" | "style", v: string) => setF({ ...f, [k]: v });
  const put = () => {
    if (!date) return;
    const pl = addPlay(r.id, date, note);
    setNote(""); setDate(today());
    toast(isToday ? "Apuntado para hoy" : `Apuntado para el ${fmtDate(date)}`, { action: { label: "Deshacer", run: () => removePlay(pl.id) } });
  };
  const cat = catLine(r), lab = labelLine(r);
  return (
    <div class="detail__in" ref={el}>
      <div class="detail__bar">
        <button type="button" class="btn btn--sm" onClick={close}><Icon name="back" size={18} /> Volver</button>
        <button type="button" class="btn btn--icon btn--ghost detail__x" onClick={close} aria-label="Cerrar ficha"><Icon name="close" size={22} /></button>
      </div>
      <div class="dsplit">
      <div class="dhead">
      <div class="detail__cover"><Cover r={r} big /></div>
      <h2 class="detail__t">{r.title}</h2>
      <p class="detail__a">{artistLine(r)}</p>
      {r.gone && <p class="hint">Este disco ya no aparece en tu colección de Discogs. Se conserva aquí con su historial.</p>}
      </div>
      <div class="dbody">
      <dl class="facts">
        {r.year > 0 && <><dt>Año</dt><dd>{r.year}</dd></>}
        {lab && <><dt>Sello</dt><dd>{lab}</dd></>}
        {cat && <><dt>Catálogo</dt><dd>{cat}</dd></>}
        {formatLine(r) && <><dt>Formato</dt><dd>{formatLine(r)}</dd></>}
        {r.rating > 0 && <><dt>Mi nota</dt><dd><Stars n={r.rating} /></dd></>}
        {r.added && <><dt>Añadido</dt><dd>{fmtDate(r.added)}</dd></>}
        {r.media && <><dt>Estado</dt><dd>Disco {r.media}{r.sleeve ? ` · funda ${r.sleeve}` : ""}</dd></>}
        {r.notes && <><dt>Notas</dt><dd>{r.notes}</dd></>}
      </dl>
      {(r.genres.length > 0 || r.styles.length > 0) && (
        <div class="tags" aria-label="Géneros y estilos">
          {r.genres.map((g) => <button type="button" key={"g" + g} class={"tag tag--g" + (f.genre === g ? " is-on" : "")} onClick={() => tag("genre", g)}>{g}</button>)}
          {r.styles.map((g) => <button type="button" key={"s" + g} class={"tag" + (f.style === g ? " is-on" : "")} onClick={() => tag("style", g)}>{g}</button>)}
        </div>
      )}
      <div class="putbox">
        <button type="button" class="btn btn--primary btn--big" onClick={put}><Icon name="play" size={20} /> {isToday ? "Lo he puesto hoy" : `Apuntar el ${fmtDateShort(date)}`}</button>
        <div class="putbox__row">
          <label class="field"><span class="field__l">Fecha</span><input class="input" type="date" value={date} max={today()} onInput={(e) => setDate((e.target as HTMLInputElement).value)} /></label>
          <label class="field"><span class="field__l">Nota (cara A, B…)</span><input class="input" type="text" maxLength={120} placeholder="Opcional" value={note} onInput={(e) => setNote((e.target as HTMLInputElement).value)} /></label>
        </div>
      </div>
      <div class="links2">
        <AppleBtn r={r} />
        <a class="btn" href={`https://www.discogs.com/release/${r.id}`} target="_blank" rel="noopener noreferrer">Ver en Discogs <Icon name="ext" size={17} /></a>
      </div>
      <section class="hist">
        <h3>Historial de escuchas <small>{mine.length ? plural(mine.length, "vez", "veces") : ""}</small></h3>
        {mine.length === 0 ? <p class="muted">Todavía no lo has apuntado.</p> : (
          <>
            <ul>{mine.map((p) => <PlayRow key={p.id} p={p} ctx={ctx} />)}</ul>
            <button type="button" class="btn btn--sm" onClick={() => { if (undoLastPlay(r.id)) toast("Última escucha deshecha"); }}><Icon name="undo" size={17} /> Deshacer la última escucha</button>
          </>
        )}
      </section>
      </div>
      </div>
    </div>
  );
}
