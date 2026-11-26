import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Filters, Play } from "./types";
import { Collection, Ctx } from "./collection";
import { noFilters, playStats } from "./logic";
import { PlaysTab } from "./plays";
import { RF, RandomTab, noRF } from "./random";
import { SettingsTab } from "./settings";
import { S, removePlay, restorePlay, loadAll, updatePlay, useStore } from "./store";
import { AskHost, Icon, Modal, ToastHost, toast } from "./ui";
import { fmtN, today } from "./util";

type Tab = "coleccion" | "azar" | "escuchas" | "ajustes";
const TABS: { v: Tab; icon: string; label: string; title: string }[] = [
  { v: "coleccion", icon: "vinyl", label: "Colección", title: "Colección" },
  { v: "azar", icon: "shuffle", label: "Al azar", title: "Ponme uno" },
  { v: "escuchas", icon: "headphones", label: "Escuchas", title: "Escuchas" },
  { v: "ajustes", icon: "sliders", label: "Ajustes", title: "Ajustes" },
];

function Rail({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  function onKey(e: KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const i = TABS.findIndex((a) => a.v === value);
    const n = TABS[(i + (e.key === "ArrowDown" ? 1 : TABS.length - 1)) % TABS.length];
    e.preventDefault(); onChange(n.v);
    requestAnimationFrame(() => document.getElementById(`tab-${n.v}`)?.focus());
  }
  return (
    <nav class="tabbar" role="tablist" aria-orientation="vertical" aria-label="Secciones" onKeyDown={onKey}>
      {TABS.map((a) => {
        const on = a.v === value;
        return (
          <button key={a.v} id={`tab-${a.v}`} type="button" role="tab" aria-selected={on} aria-controls={`area-${a.v}`} aria-label={a.label} tabIndex={on ? 0 : -1} onClick={() => onChange(a.v)}>
            <Icon name={a.icon} size={24} sw={on ? 2.2 : 1.8} /><span>{a.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function EditPlay({ p, onClose }: { p: Play | null; onClose: () => void }) {
  const [date, setDate] = useState(""), [note, setNote] = useState("");
  useEffect(() => { if (p) { setDate(p.date); setNote(p.note); } }, [p?.id]);
  return (
    <Modal open={!!p} onClose={onClose} title="Editar escucha">
      <label class="field"><span class="field__l">Fecha</span><input class="input" type="date" value={date} max={today()} onInput={(e) => setDate((e.target as HTMLInputElement).value)} /></label>
      <label class="field"><span class="field__l">Nota</span><input class="input" type="text" maxLength={120} value={note} placeholder="Cara A, cara B…" onInput={(e) => setNote((e.target as HTMLInputElement).value)} /></label>
      <div class="dlg__actions dlg__actions--wrap">
        <button type="button" class="btn btn--danger-o" onClick={() => { if (p) { removePlay(p.id); toast("Escucha borrada", { action: { label: "Deshacer", run: () => restorePlay(p) } }); } onClose(); }}>Borrar</button>
        <button type="button" class="btn" onClick={onClose}>Cancelar</button>
        <button type="button" class="btn btn--primary" disabled={!date} onClick={() => { if (p && date) updatePlay(p.id, date, note); onClose(); }}>Guardar</button>
      </div>
    </Modal>
  );
}

function FirstRun({ go }: { go: (csv?: boolean) => void }) {
  return (
    <div class="card-box first">
      <div class="first__disc" aria-hidden="true"><Icon name="vinyl" size={64} sw={1.3} /></div>
      <h2>Conecta tu cuenta de Discogs</h2>
      <p class="muted">Aquí tendrás tu colección en el móvil, también sin conexión. Solo hay que hacerlo una vez:</p>
      <ol class="steps">
        <li>Entra en <b>discogs.com › Ajustes › Desarrolladores</b> y pulsa «Generate new token».</li>
        <li>Copia el token y pégalo en <b>Ajustes</b>, junto a tu usuario de Discogs.</li>
        <li>Pulsa «Sincronizar ahora» y espera unos segundos.</li>
      </ol>
      <div class="btn-row"><button type="button" class="btn btn--primary btn--big" onClick={() => go()}>Ir a Ajustes</button></div>
      <p class="muted">¿Prefieres no usar token? <button type="button" class="link" onClick={() => go(true)}>Importa el CSV de la exportación de Discogs</button> (sin géneros, estilos ni portadas).</p>
    </div>
  );
}

export default function App() {
  const st = useStore();
  const [tab, setTabRaw] = useState<Tab>("coleccion");
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filters>(noFilters());
  const [fOpen, setFOpen] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [rf, setRf] = useState<RF>(noRF());
  const [pick, setPick] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [editing, setEditing] = useState<Play | null>(null);
  const prevTab = useRef<Tab | null>(null);
  const scrolls = useRef<Record<string, number>>({});
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    const a = () => setOnline(true), b = () => setOnline(false);
    window.addEventListener("online", a); window.addEventListener("offline", b);
    return () => { window.removeEventListener("online", a); window.removeEventListener("offline", b); };
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && openId != null && !document.querySelector("dialog[open]")) close(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  const ps = useMemo(() => playStats(st.plays), [st.plays]);
  const byId = useMemo(() => {
    const m = new Map<number, (typeof st.records)[number]>();
    for (const r of st.records) { const c = m.get(r.id); if (!c || (c.gone && !r.gone)) m.set(r.id, r); }
    return m;
  }, [st.records]);

  function setTab(t: Tab) {
    if (t === tab) { window.scrollTo(0, 0); return; }
    scrolls.current[tab] = window.scrollY;
    setTabRaw(t);
    requestAnimationFrame(() => window.scrollTo(0, scrolls.current[t] || 0));
  }
  function open(id: number) {
    if (tab !== "coleccion") { prevTab.current = tab; scrolls.current[tab] = window.scrollY; setTabRaw("coleccion"); requestAnimationFrame(() => window.scrollTo(0, scrolls.current.coleccion || 0)); }
    setOpenId(id);
  }
  function close() {
    setOpenId(null);
    const p = prevTab.current;
    if (p) { prevTab.current = null; setTabRaw(p); requestAnimationFrame(() => window.scrollTo(0, scrolls.current[p] || 0)); }
  }
  const ctx: Ctx = { ps, byId, open, setTab: (t) => setTab(t as Tab), editPlay: setEditing };
  const goSettings = (csv?: boolean) => { setTab("ajustes"); if (csv) setTimeout(() => document.getElementById("csv")?.scrollIntoView({ block: "start" }), 60); };

  const empty = st.ready && st.records.length === 0;
  const sub: Record<Tab, string> = {
    coleccion: st.records.length ? `${fmtN(st.records.length)} discos` : "Tu colección de Discogs",
    azar: "Elige qué poner", escuchas: "Lo que has ido escuchando", ajustes: "Conexión, copia y datos",
  };
  return (
    <>
      <main class="areas">
        {!online && <p class="offline" role="status">Sin conexión: se muestra la copia guardada.</p>}
        {TABS.map((t) => (
          <section key={t.v} class="area" id={`area-${t.v}`} role="tabpanel" aria-labelledby={`tab-${t.v}`} hidden={tab !== t.v}>
            <header class="area__head"><h1>{t.title}</h1><p>{sub[t.v]}</p></header>
            {!st.ready ? (t.v === tab && <p class="muted">Cargando…</p>)
              : t.v === "coleccion" ? (empty ? <FirstRun go={goSettings} /> : <Collection ctx={ctx} q={q} setQ={setQ} f={f} setF={setF} fOpen={fOpen} setFOpen={setFOpen} openId={openId} close={close} />)
              : t.v === "azar" ? <RandomTab ctx={ctx} rf={rf} setRf={setRf} pick={pick} setPick={setPick} done={done} setDone={setDone} goColl={() => goSettings()} />
              : t.v === "escuchas" ? <PlaysTab ctx={ctx} goSettings={() => goSettings()} />
              : <SettingsTab onWiped={() => { setQ(""); setF(noFilters()); setOpenId(null); setPick(null); }} />}
          </section>
        ))}
      </main>
      <Rail value={tab} onChange={setTab} />
      <EditPlay p={editing} onClose={() => setEditing(null)} />
      <AskHost />
      <ToastHost />
    </>
  );
}
