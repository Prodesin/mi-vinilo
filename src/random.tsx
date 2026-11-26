import { useMemo, useState } from "preact/hooks";
import type { Rec } from "./types";
import { Ctx, quickPlay } from "./collection";
import { countBy, decadeOf, pickRandom } from "./logic";
import { S, setPrefs } from "./store";
import { Cover, Icon, Select } from "./ui";
import { NB, agoDays, artistLine, catLine, labelLine, plural } from "./util";

export interface RF { genre: string; style: string; artist: string; decade: string }
export const noRF = (): RF => ({ genre: "", style: "", artist: "", decade: "" });

export function RandomTab({ ctx, rf, setRf, pick, setPick, done, setDone, goColl }: {
  ctx: Ctx; rf: RF; setRf: (r: RF) => void; pick: number | null; setPick: (n: number | null) => void; done: boolean; setDone: (b: boolean) => void; goColl: () => void;
}) {
  const live = S.records.filter((r) => !r.gone);
  const genres = useMemo(() => countBy(live, (r) => r.genres), [live]);
  const styles = useMemo(() => countBy(live, (r) => r.styles), [live]);
  const artists = useMemo(() => countBy(live, (r) => r.artists).sort((a, b) => a[0].localeCompare(b[0], "es")), [live]);
  const decades = useMemo(() => countBy(live, (r) => [decadeOf(r.year)]).sort((a, b) => a[0].localeCompare(b[0])), [live]);
  const pool = useMemo(() => live.filter((r) =>
    (!rf.genre || r.genres.includes(rf.genre)) && (!rf.style || r.styles.includes(rf.style)) && (!rf.artist || r.artists.includes(rf.artist)) && (!rf.decade || decadeOf(r.year) === rf.decade)), [live, rf]);
  const [none, setNone] = useState(false);
  const cur: Rec | undefined = pick != null ? ctx.byId.get(pick) : undefined;
  const set = (k: keyof RF) => (v: string) => setRf({ ...rf, [k]: v });
  const opts = (rows: [string, number][]) => <><option value="">Todos</option>{rows.map(([k, n]) => <option key={k} value={k}>{k} ({n})</option>)}</>;

  function go() {
    const r = pickRandom(pool, ctx.ps, S.prefs.recent, S.prefs.preferOld);
    setNone(!r);
    if (!r) return;
    setPick(r.id); setDone(false);
    setPrefs({ recent: [r.id, ...S.prefs.recent.filter((x) => x !== r.id)].slice(0, 10) });
  }
  const last = cur ? ctx.ps.get(cur.id) : undefined;
  return (
    <div class="rnd">
      <div class="rnd__stage">
        {cur ? (
          <div class="rnd__card">
            <div class="rnd__cover"><Cover r={cur} big /></div>
            <h2 class="detail__t">{cur.title}</h2>
            <p class="detail__a">{artistLine(cur)}</p>
            <p class="muted">{[cur.year || "", labelLine(cur), catLine(cur)].filter(Boolean).join(" · ")}</p>
            <p class="muted">{last ? `La última vez: ${agoDays(last.last)} (${plural(last.n, "escucha", "escuchas")})` : "Nunca lo has apuntado."}</p>
            <div class="rnd__btns">
              <button type="button" class="btn btn--primary btn--big" disabled={done} onClick={() => { quickPlay(cur); setDone(true); }}>
                <Icon name={done ? "check" : "play"} size={20} /> {done ? "Apuntado" : "Lo pongo"}</button>
              <button type="button" class="btn btn--big" onClick={go}><Icon name="shuffle" size={20} /> Otro</button>
              <button type="button" class="btn btn--big" onClick={() => ctx.open(cur.id)}>Ver ficha</button>
            </div>
          </div>
        ) : (
          <div class="rnd__empty">
            <div class="rnd__disc" aria-hidden="true"><Icon name="vinyl" size={96} sw={1.2} /></div>
            <p>¿No sabes qué poner? Deja que decida el azar.</p>
          </div>
        )}
      </div>
      <div class="rnd__side card-box">
        {live.length === 0 ? (
          <div class="empty"><p><b>Aún no hay discos.</b></p><p>Conecta Discogs o importa el CSV para poder elegir uno al azar.</p><button class="btn btn--primary" type="button" onClick={goColl}>Empezar</button></div>
        ) : (
          <>
            {!cur && <button type="button" class="btn btn--primary btn--big btn--block" onClick={go}><Icon name="shuffle" size={20} /> Ponme uno al azar</button>}
            <h3 class="side-h">Elegir entre…</h3>
            {genres.length > 0 && <Select label="Género" value={rf.genre} onChange={set("genre")}>{opts(genres)}</Select>}
            {styles.length > 0 && <Select label="Estilo" value={rf.style} onChange={set("style")}>{opts(styles)}</Select>}
            <Select label="Artista" value={rf.artist} onChange={set("artist")}>{opts(artists)}</Select>
            {decades.length > 0 && decades[0][0] !== "" && <Select label="Década" value={rf.decade} onChange={set("decade")}>{opts(decades)}</Select>}
            <button type="button" class="toggle" role="switch" aria-checked={S.prefs.preferOld} onClick={() => setPrefs({ preferOld: !S.prefs.preferOld })}>
              <span>Preferir los que hace tiempo que no suenan</span><span class="toggle__t"><i /></span>
            </button>
            <p class="muted small">{none || pool.length === 0 ? "Ningún disco cumple esos filtros." : `Hay ${plural(pool.length, "disco", "discos")} para elegir. No se repite ninguno de los últimos 10.`}</p>
            {cur && <button type="button" class="btn btn--block" onClick={go} disabled={pool.length === 0}>Otro al azar</button>}
          </>
        )}
      </div>
    </div>
  );
}
