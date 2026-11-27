import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { COVER_CACHE, S, applyBackup, buildBackup, dropGone, importCsv, setPrefs, setToken, syncNow, validateBackup, wipeAll } from "./store";
import { identity, DiscogsError } from "./discogs";
import { countBy, decadeOf } from "./logic";
import { Bars, Icon, ask, toast } from "./ui";
import { NB, agoTs, download, fmtN, plural, today } from "./util";

declare const __APP_VERSION__: string;
declare const __CACHE_VERSION__: string;

const Card = ({ id, title, children }: { id?: string; title: string; children: any }) => <section class="card-box" id={id}><h2>{title}</h2>{children}</section>;

function Connection() {
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function test() {
    if (!S.token.trim()) { setMsg({ ok: false, t: "Pega primero tu token personal." }); return; }
    setBusy(true); setMsg(null);
    try {
      const u = await identity(S.token.trim());
      if (!S.prefs.username.trim()) setPrefs({ username: u });
      setMsg({ ok: true, t: u === S.prefs.username.trim() || !S.prefs.username ? `Conexión correcta: hola, ${u}.` : `El token es válido, pero pertenece a «${u}», no a «${S.prefs.username}».` });
    } catch (e: any) { setMsg({ ok: false, t: e instanceof DiscogsError ? e.message : "No he podido comprobarlo." }); }
    setBusy(false);
  }
  return (
    <Card title="Conexión con Discogs">
      <p class="muted">Para traer tu colección necesitas tu usuario y un token personal de Discogs.</p>
      <details class="how">
        <summary>¿Cómo consigo el token?</summary>
        <ol class="steps">
          <li>Entra en <a href="https://www.discogs.com/settings/developers" target="_blank" rel="noopener noreferrer">discogs.com/settings/developers</a> (Ajustes › Desarrolladores).</li>
          <li>Pulsa <b>«Generate new token»</b>.</li>
          <li>Copia el texto que aparece y pégalo aquí abajo, en «Token personal».</li>
          <li>Escribe tu usuario de Discogs y pulsa «Probar conexión».</li>
        </ol>
      </details>
      <label class="field"><span class="field__l">Usuario de Discogs</span>
        <input class="input" type="text" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck={false} value={S.prefs.username} onInput={(e) => setPrefs({ username: (e.target as HTMLInputElement).value.trim() })} /></label>
      <label class="field"><span class="field__l">Token personal</span>
        <input class="input" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck={false} value={S.token} onInput={(e) => setToken((e.target as HTMLInputElement).value.trim())} /></label>
      <p class="notice">El token solo se guarda en este iPhone. No va a ninguna copia de seguridad ni a ningún servidor.</p>
      <div class="btn-row">
        <button type="button" class="btn btn--primary" disabled={busy} onClick={test}>{busy ? "Probando…" : "Probar conexión"}</button>
        <button type="button" class="btn" disabled={!S.token} onClick={async () => { if (await ask("¿Olvidar el token?", "Se borrará de este dispositivo. Tu colección guardada no se toca.", "Olvidar token", true)) { setToken(""); setMsg(null); toast("Token olvidado"); } }}>Olvidar token</button>
      </div>
      {msg && <p class={"msg " + (msg.ok ? "msg--ok" : "msg--err")} role="status">{msg.t}</p>}
    </Card>
  );
}

function Sync() {
  const sy = S.sync;
  const gone = S.records.filter((r) => r.gone).length;
  return (
    <Card title="Sincronizar">
      <p class="muted">{S.meta.lastSync ? `Última sincronización: ${agoTs(S.meta.lastSync)}${S.meta.source === "csv" ? " (desde CSV)" : ""}. ${plural(S.records.length, "disco", "discos")}.` : "Todavía no has sincronizado."}</p>
      {typeof navigator !== "undefined" && !navigator.onLine && <p class="msg msg--err">Sin conexión: se muestra la copia guardada.</p>}
      <div class="btn-row"><button type="button" class="btn btn--primary" disabled={sy.running} onClick={syncNow}>{sy.running ? "Sincronizando…" : "Sincronizar ahora"}</button></div>
      {sy.running && (
        <div class="prog" role="progressbar" aria-valuemin={0} aria-valuemax={sy.pages || 1} aria-valuenow={sy.page}>
          <div class="prog__bar"><i style={{ width: `${sy.pages ? Math.round((sy.page / sy.pages) * 100) : 5}%` }} /></div>
          <p class="small">{sy.wait > 0 ? `Discogs pide esperar: reintento en ${sy.wait}${NB}s…` : sy.pages ? `Sincronizando… página ${sy.page} de ${sy.pages}` : "Conectando con Discogs…"}</p>
        </div>
      )}
      {sy.error && <p class="msg msg--err" role="alert">{sy.error}</p>}
      {sy.ok && <p class="msg msg--ok" role="status">{sy.ok}</p>}
      {gone > 0 && <div class="btn-row"><button type="button" class="btn" onClick={async () => { if (await ask("¿Quitar los retirados?", `${plural(gone, "disco ya no está", "discos ya no están")} en Discogs. Se quitarán de la lista; sus escuchas se conservan en el historial.`, "Quitar de la lista")) dropGone(); }}>Quitar {plural(gone, "disco retirado", "discos retirados")}</button></div>}
      <p class="muted small">Se vuelve a descargar toda la colección (unas 9 páginas para 850 discos). Tu historial de escuchas se conserva.</p>
    </Card>
  );
}

function Csv() {
  const inp = useRef<HTMLInputElement>(null);
  async function pick(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]; (e.target as HTMLInputElement).value = "";
    if (!f) return;
    try {
      const text = await f.text();
      if (S.records.length && !(await ask("¿Sustituir la colección?", "La colección actual se sustituirá por la del CSV (sin géneros, estilos ni portadas). El historial de escuchas se conserva.", "Importar CSV"))) return;
      const n = importCsv(text);
      toast(`CSV importado: ${plural(n, "disco", "discos")}`);
    } catch (err: any) { toast(err?.message || "No he podido leer el CSV.", { error: true }); }
  }
  return (
    <Card id="csv" title="Importar CSV de Discogs">
      <p class="muted">Alternativa sin token: en Discogs, entra en Colección › Exportar y descarga el CSV. Después impórtalo aquí.</p>
      <p class="notice">El CSV no trae géneros, estilos ni portadas, así que los filtros por estilo quedan limitados. La vía principal es la sincronización con Discogs.</p>
      <div class="btn-row"><button type="button" class="btn" onClick={() => inp.current?.click()}>Elegir archivo CSV…</button></div>
      <input ref={inp} type="file" accept=".csv,text/csv,text/plain" hidden onChange={pick} />
    </Card>
  );
}

function Covers() {
  const [st, setSt] = useState({ running: false, done: 0, total: 0 });
  const cancel = useRef(false);
  const urls = useMemo(() => [...new Set(S.records.map((r) => r.thumb).filter((u) => /^https?:/.test(u)))], [S.records]);
  async function start() {
    if (!("caches" in window)) { toast("Este navegador no permite guardar portadas.", { error: true }); return; }
    cancel.current = false;
    const cache = await caches.open(COVER_CACHE);
    const todo: string[] = [];
    for (const u of urls) if (!(await cache.match(u))) todo.push(u);
    setSt({ running: true, done: 0, total: todo.length });
    let i = 0, done = 0;
    const worker = async () => {
      while (!cancel.current && i < todo.length) {
        const u = todo[i++];
        try { const res = await fetch(u, { mode: "no-cors" }); await cache.put(u, res); } catch { /* sin red: se salta */ }
        done++; setSt({ running: true, done, total: todo.length });
        await new Promise((r) => setTimeout(r, 120));
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    // Límite de la caché de portadas (las más antiguas primero)
    const keys = await cache.keys(); for (let k = 0; k < keys.length - 1200; k++) await cache.delete(keys[k]);
    setSt({ running: false, done, total: todo.length });
    toast(cancel.current ? "Descarga cancelada" : "Portadas guardadas");
  }
  return (
    <Card title="Portadas sin conexión">
      <p class="muted">Las portadas que ves se guardan solas. Si quieres tenerlas todas disponibles sin conexión, descárgalas ahora (se hace poco a poco).</p>
      <div class="btn-row">
        {st.running ? <button type="button" class="btn" onClick={() => { cancel.current = true; }}>Cancelar</button>
          : <button type="button" class="btn" disabled={!urls.length} onClick={start}>Descargar portadas para usar sin conexión</button>}
      </div>
      {!urls.length && <p class="muted small">Primero sincroniza con Discogs: el CSV no trae portadas.</p>}
      {(st.running || st.total > 0) && <div class="prog"><div class="prog__bar"><i style={{ width: `${st.total ? (st.done / st.total) * 100 : 0}%` }} /></div><p class="small">{st.running ? `Descargando… ${st.done} de ${st.total}` : `Hecho: ${st.done} de ${st.total}`}</p></div>}
    </Card>
  );
}

function Stats() {
  const recs = S.records.filter((r) => !r.gone);
  const g = useMemo(() => countBy(recs, (r) => r.genres).slice(0, 8), [recs]);
  const st = useMemo(() => countBy(recs, (r) => r.styles).slice(0, 10), [recs]);
  const lb = useMemo(() => countBy(recs, (r) => r.labels.map((l) => l.name)).slice(0, 10), [recs]);
  const dc = useMemo(() => countBy(recs, (r) => [decadeOf(r.year)]).sort((a, b) => a[0].localeCompare(b[0])), [recs]);
  if (!recs.length) return null;
  return (
    <Card title="Estadísticas de la colección">
      <div class="metrics metrics--1"><div class="metric"><b>{fmtN(recs.length)}</b><span>discos</span></div></div>
      {g.length > 0 && <><h3 class="side-h">Por género</h3><Bars rows={g} total={recs.length} /></>}
      {st.length > 0 && <><h3 class="side-h">Estilos más frecuentes</h3><Bars rows={st} /></>}
      {lb.length > 0 && <><h3 class="side-h">Sellos más frecuentes</h3><Bars rows={lb} /></>}
      {dc.length > 0 && <><h3 class="side-h">Por década</h3><Bars rows={dc.map(([k, n]) => [k || "Sin año", n] as [string, number])} /></>}
    </Card>
  );
}

function Backup({ onWiped }: { onWiped: () => void }) {
  const inp = useRef<HTMLInputElement>(null);
  async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]; (e.target as HTMLInputElement).value = "";
    if (!f) return;
    try {
      const b = validateBackup(JSON.parse(await f.text()));
      if (await ask("¿Importar esta copia?", `Contiene ${plural(b.records.length, "disco", "discos")} y ${plural(b.plays.length, "escucha", "escuchas")}. Sustituirá lo que hay ahora en este dispositivo (tu token no se toca).`, "Importar")) { applyBackup(b); toast("Copia importada"); }
    } catch (err: any) { toast(err instanceof SyntaxError ? "El archivo no es un JSON válido." : err?.message || "No he podido importar la copia.", { error: true }); }
  }
  return (
    <Card title="Copia de seguridad">
      <p class="muted">La copia incluye la colección, las escuchas y tus preferencias. <b>No incluye el token.</b></p>
      <div class="btn-row">
        <button type="button" class="btn" onClick={async () => { download(`mi-vinilo-${today()}.json`, JSON.stringify(await buildBackup(), null, 1)); toast("Copia exportada"); }}>Exportar copia (JSON)</button>
        <button type="button" class="btn" onClick={() => inp.current?.click()}>Importar copia…</button>
      </div>
      <input ref={inp} type="file" accept="application/json,.json" hidden onChange={onFile} />
      <div class="btn-row"><button type="button" class="btn btn--danger-o" onClick={async () => { if (await ask("¿Borrar todos los datos?", "Se borrarán la colección, las escuchas, las preferencias, el token y las portadas guardadas de este dispositivo. No se puede deshacer: exporta antes una copia si la quieres.", "Borrar todo", true)) { await wipeAll(); onWiped(); toast("Datos borrados"); } }}>Borrar todos los datos</button></div>
    </Card>
  );
}

function About() {
  const [ver, setVer] = useState("");
  const [upd, setUpd] = useState("");
  const [d, setD] = useState(() => diag());
  useEffect(() => {
    const f = () => setD(diag()); window.addEventListener("resize", f); window.addEventListener("orientationchange", f);
    return () => { window.removeEventListener("resize", f); window.removeEventListener("orientationchange", f); };
  }, []);
  useEffect(() => {
    const c = navigator.serviceWorker?.controller; if (!c) return;
    const ch = new MessageChannel(); ch.port1.onmessage = (e) => setVer(`caché ${e.data.cacheVersion}`);
    c.postMessage({ type: "version" }, [ch.port2]);
  }, []);
  async function check() {
    if (!("serviceWorker" in navigator)) { setUpd("Este navegador no usa service worker."); return; }
    setUpd("Buscando…");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) { setUpd("La app aún no está instalada para uso sin conexión."); return; }
      let found = false; const onf = () => { found = true; }; reg.addEventListener("updatefound", onf);
      await reg.update(); await new Promise((r) => setTimeout(r, 1500)); reg.removeEventListener("updatefound", onf);
      setUpd(found || reg.installing || reg.waiting ? "Hay una versión nueva: la app se recargará sola en un momento." : "Ya tienes la última versión.");
    } catch { setUpd("No he podido comprobarlo (¿sin conexión?)."); }
  }
  return (
    <Card title="Acerca de">
      <p><b>Mi vinilo</b> · versión {__APP_VERSION__}{ver ? ` (${ver})` : ` (caché ${__CACHE_VERSION__})`}</p>
      <p class="muted small">Tu colección de Discogs en el móvil, para consultarla, elegir qué poner y apuntar lo que escuchas.</p>
      <div class="btn-row"><button type="button" class="btn" onClick={check}>Buscar actualización</button></div>
      {upd && <p class="msg" role="status">{upd}</p>}
      <details class="how"><summary>Diagnóstico de pantalla</summary>
        <dl class="facts facts--tight">
          <dt>Ventana</dt><dd>{d.w}{NB}×{NB}{d.h}{NB}px</dd>
          <dt>Orientación</dt><dd>{d.orient}</dd>
          <dt>Layout</dt><dd>{d.mode}</dd>
          <dt>Safe area</dt><dd>arriba {d.t}, derecha {d.r}, abajo {d.b}, izquierda {d.l}</dd>
          <dt>Píxeles</dt><dd>×{d.dpr}</dd>
          <dt>Modo</dt><dd>{d.standalone ? "app instalada" : "navegador"}</dd>
        </dl>
      </details>
    </Card>
  );
}
function diag() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;visibility:hidden;width:0;height:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
  document.body.appendChild(probe); const cs = getComputedStyle(probe);
  const v = (x: string) => `${Math.round(parseFloat(x) || 0)}${NB}px`;
  const out = { t: v(cs.paddingTop), r: v(cs.paddingRight), b: v(cs.paddingBottom), l: v(cs.paddingLeft) };
  probe.remove();
  const wide = matchMedia("(min-width: 600px) and (min-height: 560px)").matches;
  return {
    ...out, w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio,
    orient: window.innerWidth >= window.innerHeight ? "horizontal" : "vertical",
    mode: wide ? "amplio (interior)" : "compacto (exterior)", standalone: matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true,
  };
}

export function SettingsTab({ onWiped }: { onWiped: () => void }) {
  return (
    <div class="cols2">
      <div class="col"><Connection /><Sync /><Csv /><Covers /></div>
      <div class="col">
        <Stats />
        <Backup onWiped={onWiped} />
        <Card title="Mis otras apps">
          <ul class="links">
            <li><a href="https://prodesin.github.io/mi-tension/" target="_blank" rel="noopener noreferrer">Mi tensión<small>Tensión arterial</small></a></li>
            <li><a href="https://prodesin.github.io/mi-entrenador/" target="_blank" rel="noopener noreferrer">Mi entrenador<small>Fuerza, caminar y nutrición</small></a></li>
            <li><a href="https://prodesin.github.io/mi-menu/" target="_blank" rel="noopener noreferrer">Mi menú<small>Menús y compra</small></a></li>
          </ul>
        </Card>
        <Card title="Privacidad"><p>Todo se guarda en este dispositivo. No hay cuentas, analítica ni rastreadores. La app solo se conecta a <b>api.discogs.com</b> (para sincronizar) e <b>i.discogs.com</b> (portadas). Para el enlace de Apple Music también consulta <b>itunes.apple.com</b>, enviando solo el artista y el título del disco.</p></Card>
        <About />
      </div>
    </div>
  );
}
