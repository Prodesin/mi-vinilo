import { render } from "preact";
import App from "./app";

render(<App />, document.getElementById("app")!);

/* Service worker: registro sin caché HTTP, comprobación al cargar y al volver a primer plano,
 * y una única recarga cuando se activa una versión nueva. */
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded || sessionStorage.getItem("mv-reloaded") === "1") return;
    reloaded = true; sessionStorage.setItem("mv-reloaded", "1"); location.reload();
  });
  window.addEventListener("load", () => {
    sessionStorage.removeItem("mv-reloaded");
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((reg) => {
      reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
    }).catch(() => {});
  });
}

/* Lado del rail: si la safe area grande queda a la izquierda (cámara de ese lado al girar), el rail va a la izquierda. */
const probe = document.createElement("div");
probe.setAttribute("aria-hidden", "true");
probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)";
document.body.appendChild(probe);
function syncRailSide() {
  const cs = getComputedStyle(probe);
  const l = parseFloat(cs.paddingLeft) || 0;
  const r = parseFloat(cs.paddingRight) || 0;
  document.documentElement.dataset.rail = l > r ? "left" : "right";
}
syncRailSide();
window.addEventListener("resize", syncRailSide);
window.addEventListener("orientationchange", syncRailSide);
