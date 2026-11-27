import { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Rec } from "./types";
import { hash, initials } from "./util";

const P: Record<string, ComponentChildren> = {
  vinyl: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M12 6.5a5.5 5.5 0 0 1 5.5 5.5" /></>,
  shuffle: <><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></>,
  headphones: <><path d="M4 16v-4a8 8 0 0 1 16 0v4" /><rect x="3" y="14" width="4" height="7" rx="1.5" /><rect x="17" y="14" width="4" height="7" rx="1.5" /></>,
  sliders: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.8" cy="6" r="1" /><circle cx="4.8" cy="12" r="1" /><circle cx="4.8" cy="18" r="1" /></>,
  filter: <><path d="M4 5h16l-6 7.5V19l-4-2v-4.5z" /></>,
  close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  back: <><path d="m15 5-7 7 7 7" /></>,
  ext: <><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  play: <><path d="M8 5v14l11-7z" /></>,
  note: <><path d="M9 18V5l11-2v13" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></>,
  undo: <><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></>,
};
export function Icon({ name, size = 24, sw = 1.9 }: { name: string; size?: number; sw?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={sw} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{P[name]}</svg>;
}

/* Disco de marcador: iniciales y color derivado del título. */
export function Placeholder({ r }: { r: Pick<Rec, "title" | "artists"> }) {
  const h = hash(r.title + (r.artists[0] || "")) % 360;
  return (
    <svg class="ph" viewBox="0 0 100 100" role="img" aria-label="Sin portada" preserveAspectRatio="xMidYMid slice">
      <rect width="100" height="100" fill={`hsl(${h} 38% 30%)`} />
      <circle cx="50" cy="50" r="44" fill="#141216" />
      {[38, 32, 26].map((x) => <circle key={x} cx="50" cy="50" r={x} fill="none" stroke="#fff" stroke-opacity=".09" />)}
      <circle cx="50" cy="50" r="19" fill={`hsl(${h} 62% 58%)`} />
      <text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="800" fill="#1b1320" font-family="system-ui,sans-serif">{initials(r)}</text>
    </svg>
  );
}
export function Cover({ r, big }: { r: Rec; big?: boolean }) {
  const srcs = (big ? [r.cover, r.thumb] : [r.thumb]).filter(Boolean);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [r.key, big]);
  return (
    <div class={"cover" + (big ? " cover--big" : "")}>
      {srcs[i] ? <img src={srcs[i]} alt={`Portada de ${r.title}`} loading={big ? "eager" : "lazy"} decoding="async" onError={() => setI(i + 1)} /> : <Placeholder r={r} />}
    </div>
  );
}

/* ---------- Toasts ---------- */
interface ToastCfg { msg: string; error?: boolean; action?: { label: string; run: () => void } }
let setToastFn: ((t: ToastCfg | null) => void) | null = null;
let tTimer: number | undefined;
export function toast(msg: string, o: Omit<ToastCfg, "msg"> = {}) {
  setToastFn?.({ msg, ...o });
  clearTimeout(tTimer);
  tTimer = window.setTimeout(() => setToastFn?.(null), o.action ? 6000 : 3200);
}
export function ToastHost() {
  const [t, set] = useState<ToastCfg | null>(null);
  useEffect(() => { setToastFn = set; return () => { setToastFn = null; }; }, []);
  return (
    <div class={"toast" + (t ? " is-show" : "") + (t?.error ? " is-error" : "")} role="status" aria-live="polite">
      {t && <span>{t.msg}</span>}
      {t?.action && <button type="button" onClick={() => { t.action!.run(); set(null); }}>{t.action.label}</button>}
    </div>
  );
}

/* ---------- Diálogo de confirmación ---------- */
interface AskCfg { title: string; body: string; ok: string; danger?: boolean; resolve: (v: boolean) => void }
let setAskFn: ((a: AskCfg | null) => void) | null = null;
export function ask(title: string, body: string, ok = "Aceptar", danger = false): Promise<boolean> {
  return new Promise((resolve) => { if (!setAskFn) return resolve(false); setAskFn({ title, body, ok, danger, resolve }); });
}
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ComponentChildren }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { try { d.showModal(); } catch { d.setAttribute("open", ""); } }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} class="dlg" onClose={onClose} onCancel={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-label={title}>
      {open && <div class="dlg__in"><h2>{title}</h2>{children}</div>}
    </dialog>
  );
}
export function AskHost() {
  const [a, set] = useState<AskCfg | null>(null);
  useEffect(() => { setAskFn = set; return () => { setAskFn = null; }; }, []);
  const done = (v: boolean) => { a?.resolve(v); set(null); };
  return (
    <Modal open={!!a} onClose={() => done(false)} title={a?.title || ""}>
      <p>{a?.body}</p>
      <div class="dlg__actions">
        <button type="button" class="btn" onClick={() => done(false)}>Cancelar</button>
        <button type="button" class={"btn " + (a?.danger ? "btn--danger" : "btn--primary")} onClick={() => done(true)}>{a?.ok}</button>
      </div>
    </Modal>
  );
}

export function Bars({ rows, total }: { rows: [string, number][]; total?: number }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <ul class="bars">
      {rows.map(([k, n]) => (
        <li key={k}>
          <span class="bars__k">{k}</span>
          <span class="bars__t" aria-hidden="true"><i style={{ width: `${Math.max(3, (n / max) * 100)}%` }} /></span>
          <span class="bars__n">{n}{total ? ` · ${Math.round((n / total) * 100)}${" "}%` : ""}</span>
        </li>
      ))}
    </ul>
  );
}
export function Stars({ n }: { n: number }) {
  return <span class="stars" role="img" aria-label={`${n} de 5`}>{"★".repeat(n)}<span>{"★".repeat(5 - n)}</span></span>;
}
export function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ComponentChildren }) {
  return (
    <label class="field"><span class="field__l">{label}</span>
      <span class="sel"><select value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>{children}</select></span>
    </label>
  );
}
