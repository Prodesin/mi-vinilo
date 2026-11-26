import sys, json
from playwright.sync_api import sync_playwright
URL="http://localhost:8782/index.html"
SAMPLE="/workspace/mi-vinilo/tools/sample-collection.json"
OUT="/workspace/mi-vinilo-capturas/"
VPS=[(390,844),(466,678),(678,466),(951,669),(669,951)]
errs=[]; problems=[]
def overflow(page, tag):
    r=page.evaluate("""()=>{const W=document.documentElement.clientWidth;const bad=[];
      document.querySelectorAll('body *').forEach(e=>{const cs=getComputedStyle(e);if(cs.position==='fixed'&&e.closest('.tabbar'))return;
        if(e.closest('[hidden]')||e.closest('dialog:not([open])')||e.closest('.toast'))return;
        const b=e.getBoundingClientRect(); if(b.width===0)return; if(b.right>W+1||b.left<-1) bad.push(e.className+'|'+e.tagName+'|'+Math.round(b.left)+'-'+Math.round(b.right));});
      return {sw:document.documentElement.scrollWidth,W,bad:bad.slice(0,6)}}""")
    if r['sw']>r['W']+1 or r['bad']: problems.append((tag,r))
def run(w,h,scheme,tabs=True):
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
        ctx=b.new_context(viewport={"width":w,"height":h},color_scheme=scheme,device_scale_factor=2,service_workers="block")
        pg=ctx.new_page()
        pg.on("console",lambda m: errs.append((w,h,scheme,m.text)) if m.type in("error","warning") and "blocked by Playwright" not in m.text else None)
        pg.on("pageerror",lambda e: errs.append((w,h,scheme,str(e))))
        pg.goto(URL); pg.wait_for_selector(".first")
        name=f"{w}x{h}"; sc="claro" if scheme=="light" else "oscuro"
        pg.screenshot(path=f"{OUT}{name}-vacio-{sc}.png"); overflow(pg,f"{name} vacio {sc}")
        pg.click("#tab-ajustes"); 
        pg.set_input_files("input[accept*=json]",SAMPLE); pg.click(".dlg .btn--primary"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}{name}-ajustes-{sc}.png",full_page=True); overflow(pg,f"{name} ajustes {sc}")
        pg.click("#tab-coleccion"); pg.wait_for_selector(".card"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}{name}-coleccion-{sc}.png"); overflow(pg,f"{name} coleccion {sc}")
        pg.click(".filt-btn") if pg.is_visible(".filt-btn") else None
        pg.wait_for_timeout(200); pg.screenshot(path=f"{OUT}{name}-filtros-{sc}.png"); overflow(pg,f"{name} filtros {sc}")
        pg.click(".filt-btn") if pg.is_visible(".filt-btn") else None
        pg.click(".card >> nth=1"); pg.wait_for_timeout(400)
        pg.screenshot(path=f"{OUT}{name}-ficha-{sc}.png"); overflow(pg,f"{name} ficha {sc}")
        pg.click(".detail__bar .btn:visible, .detail__x:visible")
        pg.click("#tab-azar"); pg.click("text=Ponme uno al azar"); pg.wait_for_timeout(400)
        pg.screenshot(path=f"{OUT}{name}-azar-{sc}.png"); overflow(pg,f"{name} azar {sc}")
        pg.click("#tab-escuchas"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}{name}-escuchas-{sc}.png"); overflow(pg,f"{name} escuchas {sc}")
        pg.screenshot(path=f"{OUT}{name}-escuchas-completa-{sc}.png",full_page=True)
        b.close()
if __name__=="__main__":
    combos=[(w,h,s) for (w,h) in VPS for s in ("light","dark") if s=="light" or (w,h) in ((466,678),(951,669),(390,844))]
    for c in combos:
        try: run(*c)
        except Exception as e: print("FALLO",c,repr(e)[:300])
    print("ERRS",errs); print("PROB"); [print(x) for x in problems]
