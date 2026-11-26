import { useMemo, useState } from "preact/hooks";
import type { Play, Rec } from "./types";
import { Ctx, quickPlay } from "./collection";
import { S } from "./store";
import { Bars, Cover, Icon } from "./ui";
import { NB, addDays, agoDays, artistLine, fmtDayHead, plural, today, weekStart } from "./util";

function topBy(plays: Play[], by: Map<number, Rec>, pick: (r: Rec) => string[]) {
  const m = new Map<string, number>();
  for (const p of plays) { const r = by.get(p.rid); if (r) for (const k of new Set(pick(r))) m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")).slice(0, 5);
}

function MiniRow({ r, sub, ctx, action = true }: { r: Rec; sub: string; ctx: Ctx; action?: boolean }) {
  return (
    <li class="mini">
      <button type="button" class="mini__open" onClick={() => ctx.open(r.id)} aria-label={`Abrir ficha: ${r.title}`}>
        <Cover r={r} />
        <span class="mini__t"><b>{r.title}</b><span>{artistLine(r)}</span><small>{sub}</small></span>
      </button>
      {action && <button type="button" class="btn btn--sm" onClick={() => quickPlay(r)}>Lo he puesto hoy</button>}
    </li>
  );
}

export function PlaysTab({ ctx, goSettings }: { ctx: Ctx; goSettings: () => void }) {
  const plays = S.plays;
  const t = today();
  const [nPlays, setNPlays] = useState(25);
  const [nNever, setNNever] = useState(8);
  const sorted = useMemo(() => [...plays].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts), [plays]);
  const wk = weekStart(t), mo = t.slice(0, 8), yr = t.slice(0, 5);
  const inWeek = plays.filter((p) => p.date >= wk && p.date <= addDays(wk, 6)).length;
  const inMonth = plays.filter((p) => p.date.startsWith(mo)).length;
  const inYear = plays.filter((p) => p.date.startsWith(yr)).length;
  const monthPlays = plays.filter((p) => p.date.startsWith(mo));
  const topArtists = topBy(monthPlays, ctx.byId, (r) => r.artists);
  const topStyles = topBy(monthPlays, ctx.byId, (r) => (r.styles.length ? r.styles : r.genres));
  const live = S.records.filter((r) => !r.gone);
  const heard = useMemo(() => live.filter((r) => ctx.ps.has(r.id)).sort((a, b) => ctx.ps.get(a.id)!.last.localeCompare(ctx.ps.get(b.id)!.last)).slice(0, 8), [live, ctx.ps]);
  const never = useMemo(() => live.filter((r) => !ctx.ps.has(r.id)).sort((a, b) => (a.added || "").localeCompare(b.added || "")), [live, ctx.ps]);
  const groups: { day: string; items: Play[] }[] = [];
  for (const p of sorted.slice(0, nPlays)) { const g = groups[groups.length - 1]; if (g && g.day === p.date) g.items.push(p); else groups.push({ day: p.date, items: [p] }); }

  if (!S.records.length && !plays.length) {
    return <div class="card-box empty"><p><b>Aquí aparecerá lo que vayas escuchando.</b></p><p>Primero trae tu colección desde Ajustes.</p><button type="button" class="btn btn--primary" onClick={goSettings}>Ir a Ajustes</button></div>;
  }
  return (
    <div class="cols2">
      <div class="col">
        <div class="metrics">
          <div class="metric"><b>{inWeek}</b><span>esta semana</span></div>
          <div class="metric"><b>{inMonth}</b><span>este mes</span></div>
          <div class="metric"><b>{inYear}</b><span>este año</span></div>
        </div>
        <section class="card-box">
          <h2>Registro</h2>
          {sorted.length === 0 ? <p class="muted">Todavía no has apuntado ninguna escucha. Abre un disco y pulsa «Lo he puesto hoy», o prueba «Ponme uno al azar».</p> : (
            <>
              {groups.map((g) => (
                <div key={g.day} class="day">
                  <h3>{fmtDayHead(g.day)} <small>{plural(g.items.length, "disco", "discos")}</small></h3>
                  <ul>
                    {g.items.map((p) => {
                      const r = ctx.byId.get(p.rid);
                      return (
                        <li key={p.id} class="mini">
                          {r ? (
                            <button type="button" class="mini__open" onClick={() => ctx.open(r.id)} aria-label={`Abrir ficha: ${r.title}`}>
                              <Cover r={r} /><span class="mini__t"><b>{r.title}</b><span>{artistLine(r)}</span>{p.note && <small>{p.note}</small>}</span>
                            </button>
                          ) : <span class="mini__open"><span class="mini__t"><b>Disco {p.rid}</b><small>Ya no está en la colección{p.note ? ` · ${p.note}` : ""}</small></span></span>}
                          <button type="button" class="btn btn--icon btn--ghost" aria-label="Editar o borrar escucha" onClick={() => ctx.editPlay(p)}><Icon name="edit" size={19} /></button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {sorted.length > nPlays && <button type="button" class="btn btn--block" onClick={() => setNPlays(nPlays + 25)}>Ver más ({sorted.length - nPlays}{NB}restantes)</button>}
            </>
          )}
        </section>
      </div>
      <div class="col">
        <section class="card-box">
          <h2>Lo más escuchado del mes</h2>
          {monthPlays.length === 0 ? <p class="muted">Este mes todavía no hay escuchas.</p> : (
            <><h3 class="side-h">Artistas</h3><Bars rows={topArtists} /><h3 class="side-h">Estilos</h3><Bars rows={topStyles} /></>
          )}
        </section>
        <section class="card-box">
          <h2>Hace tiempo que no suena</h2>
          {heard.length === 0 ? <p class="muted">Cuando apuntes escuchas, aquí verás los discos que llevan más tiempo sin sonar.</p> : <ul>{heard.map((r) => <MiniRow key={r.key} r={r} ctx={ctx} sub={`Última vez ${agoDays(ctx.ps.get(r.id)!.last)}`} />)}</ul>}
        </section>
        <section class="card-box">
          <h2>Nunca escuchados desde que usas la app</h2>
          <p class="muted small">{plural(never.length, "disco", "discos")}, de los más antiguos de tu colección a los más nuevos.</p>
          <ul>{never.slice(0, nNever).map((r) => <MiniRow key={r.key} r={r} ctx={ctx} sub={r.added ? `Añadido ${agoDays(r.added.slice(0, 10))}` : "Sin fecha de alta"} />)}</ul>
          {never.length > nNever && <button type="button" class="btn btn--block" onClick={() => setNNever(nNever + 12)}>Ver más</button>}
        </section>
      </div>
    </div>
  );
}
