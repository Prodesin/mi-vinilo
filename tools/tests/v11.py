"""Pruebas v1.1 (Apple Music + retoques). Uso: /workspace/pwenv/bin/python -I tools/tests/v11.py  (servidor en :8793)"""
import json, copy, time, sys
from playwright.sync_api import sync_playwright
URL="http://localhost:8793/index.html"; OUT="/workspace/mi-vinilo-capturas/"
base=json.load(open("/workspace/mi-vinilo/tools/sample-collection.json"))
def rec(i,title,artist,**kw):
    r=copy.deepcopy(base["collection"][0]); r.update(key=f"t{i}",id=i,iid=i,mid=i+500,title=title,artists=[artist],gone=False,styles=["Contemporary Jazz"],labels=[{"name":"Nippon Columbia","catno":"X"}]); r.update(kw); return r
MOCK=[rec(9100001,"Mock Exact","Exacto Artista"),rec(9100002,"Mock Editions","The Edicion (2)"),rec(9100003,"Mock None","Sin Match"),rec(9100004,"Mock Error","Error Net"),
      rec(9200001,"A Love Supreme","John Coltrane"),rec(9200002,"Scenery","Ryo Fukui"),rec(9200003,"Kind of Blue","Miles Davis")]
bk=copy.deepcopy(base); bk["collection"]=MOCK+bk["collection"]; json.dump(bk,open("/tmp/bk11.json","w"))
fails=[]; errs=[]
def ok(c,m):
    print(("OK   " if c else "FALLO ")+m)
    if not c: fails.append(m)
def A(n,t,u): return {"artistName":n,"collectionName":t,"collectionViewUrl":u}
def mock(route):
    q=route.request.url
    if "Mock%20Exact" in q: body=[A("Otro","Mock Exact","https://music.apple.com/es/album/x/9?uo=4"),A("Exacto Artista","Mock Exact","https://music.apple.com/es/album/mock-exact/111?uo=4")]
    elif "Mock%20Editions" in q: body=[A("Edicion","Mock Editions (Deluxe Edition)","https://music.apple.com/es/album/de/222?uo=4"),A("The Edicion","Mock Editions (Remastered)","https://music.apple.com/es/album/re/223?uo=4"),A("Edicion","Mock Editions","https://music.apple.com/es/album/plain/224?uo=4&x=1"),A("Zzz","Mock Editions","https://music.apple.com/es/album/other/225")]
    elif "Mock%20None" in q: body=[A("Alguien Distinto","Mock None","https://music.apple.com/es/album/n/333")]
    elif "Mock%20Error" in q: return route.abort()
    else: return route.continue_()
    route.fulfill(status=200,headers={"access-control-allow-origin":"*"},content_type="text/javascript",body=json.dumps({"resultCount":len(body),"results":body}))
def boot(b,w,h,scheme="light",ua=None,touch=False,real=False,sw=False):
    ctx=b.new_context(viewport={"width":w,"height":h},color_scheme=scheme,device_scale_factor=2,service_workers="allow" if sw else "block",user_agent=ua,has_touch=touch)
    pg=ctx.new_page(); reqs=[]
    pg.on("console",lambda m: errs.append((w,h,m.text)) if m.type in("error","warning") and "blocked by Playwright" not in m.text and "ERR_FAILED" not in m.text and "Failed to load resource" not in m.text else None)
    pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.on("request",lambda r: reqs.append((time.time(),r.url)) if "itunes.apple.com" in r.url else None)
    if not real: pg.route("**/itunes.apple.com/**",mock)
    pg.goto(URL); pg.wait_for_selector(".first")
    pg.click("#tab-ajustes"); pg.set_input_files("input[accept*=json]","/tmp/bk11.json"); pg.click(".dlg .btn--primary"); pg.wait_for_timeout(300)
    pg.click("#tab-coleccion"); pg.wait_for_selector(".card")
    return ctx,pg,reqs
def openrec(pg,title):
    if pg.locator(".detail:not([hidden])").count(): pg.locator(".detail__bar .btn:visible, .detail__x:visible").first.click(); pg.wait_for_timeout(150)
    pg.fill(".search input",title); pg.wait_for_timeout(200)
    pg.locator(".card",has_text=title).first.click(); pg.wait_for_selector(".detail:not([hidden]) .btn--apple")
def idb(pg): return pg.evaluate("""()=>new Promise(r=>{const q=indexedDB.open('mi-vinilo');q.onsuccess=()=>{const g=q.result.transaction('kv').objectStore('kv').get('apple');g.onsuccess=()=>r(g.result||null)}})""")
def apple(pg): 
    a=pg.locator(".detail .btn--apple"); return a.get_attribute("href"), (a.locator("small").inner_text() if a.locator("small").count() else "")
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    # ---- mocks, escritorio
    ctx,pg,reqs=boot(b,466,678)
    openrec(pg,"Mock Exact"); pg.wait_for_timeout(1500)
    h,s=apple(pg); ok(h=="https://music.apple.com/es/album/mock-exact/111" and s=="","exacta: "+h+" sub="+repr(s))
    ok(pg.locator(".detail .btn--apple").get_attribute("target")=="_blank","target=_blank en no iOS")
    openrec(pg,"Mock Editions"); pg.wait_for_timeout(1800); h,s=apple(pg); ok(h=="https://music.apple.com/es/album/plain/224?x=1","ediciones -> exacto sin edición: "+h)
    openrec(pg,"Mock None"); pg.wait_for_timeout(1800); h,s=apple(pg); ok(h=="https://music.apple.com/es/search?term=Sin%20Match%20Mock%20None" and s=="Buscar en Apple Music","sin match -> búsqueda: "+h+" | "+s)
    openrec(pg,"Mock Error"); pg.wait_for_timeout(1800); h,s=apple(pg); ok("/es/search?term=Error%20Net%20Mock%20Error" in h and s=="Buscar en Apple Music","error de red -> búsqueda: "+h)
    c=idb(pg); ks=sorted(c.keys()) if c else []
    ok(ks==["9100001".replace("9100001","9100501"),"9100502","9100503"] or set(ks)=={"9100501","9100502","9100503"},"caché por master (sin el error): "+str(ks)); print(json.dumps(c)[:400])
    ts=[t for t,_ in reqs]; ok(all(b2-a2>=0.95 for a2,b2 in zip(ts,ts[1:])),"≥1 s entre peticiones: "+str([round(y-x,2) for x,y in zip(ts,ts[1:])]))
    n=len(reqs); openrec(pg,"Mock Exact"); pg.wait_for_timeout(1500); ok(len(reqs)==n,"reabrir usa caché (sin petición nueva)")
    # caducidad search > 30 días
    pg.evaluate("""()=>new Promise(r=>{const q=indexedDB.open('mi-vinilo');q.onsuccess=()=>{const t=q.result.transaction('kv','readwrite');const s=t.objectStore('kv');const g=s.get('apple');g.onsuccess=()=>{const c=g.result;c['9100503'].d-=31*86400000;s.put(c,'apple')};t.oncomplete=()=>r()}})""")
    pg.reload(); pg.wait_for_selector(".card"); n=len(reqs); openrec(pg,"Mock None"); pg.wait_for_timeout(1500); ok(len(reqs)==n+1,"search caducado (>30 d) se reintenta")
    # sin conexión
    ctx.set_offline(True); pg.reload  # noqa
    # backup incluye apple; wipe limpia
    pg.click("#tab-ajustes")
    with pg.expect_download() as d: pg.click("text=Exportar copia (JSON)")
    ex=json.load(open(d.value.path())); ok("apple" in ex and len(ex["apple"])>=3,"la copia JSON incluye la caché apple")
    ctx.set_offline(False)
    pg.click("text=Borrar todos los datos"); pg.click(".dlg .btn--danger, .dlg .btn--primary"); pg.wait_for_timeout(500); ok(idb(pg) is None,"borrar todo limpia la caché de Apple")
    ctx.close()
    # ---- offline sin caché
    ctx,pg,reqs=boot(b,466,678); ctx.set_offline(True); openrec(pg,"Mock Exact"); pg.wait_for_timeout(800)
    h,s=apple(pg); ok("search?term=Exacto%20Artista%20Mock%20Exact" in h and len(reqs)==0,"offline sin caché -> búsqueda, sin petición"); ctx.close()
    # ---- iOS simulado
    IOS="Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
    ctx,pg,reqs=boot(b,390,844,ua=IOS,touch=True)
    nav=[]; pg.on("request",lambda r: nav.append(r.url) if r.is_navigation_request() else None); pg.on("requestfailed",lambda r: nav.append("FAILED "+r.url))
    pg.route("https://music.apple.com/**",lambda r: r.fulfill(status=200,content_type="text/html",body="<title>stub</title>"))
    openrec(pg,"Mock Exact"); pg.wait_for_timeout(1500)
    print("is iOS:",pg.evaluate("/iPhone/.test(navigator.userAgent)"))
    pg.click(".detail .btn--apple"); pg.wait_for_timeout(600)
    ok(any(u.startswith("music://music.apple.com/es/album/mock-exact/111") for u in nav),"iOS: navega a music://… "+str(nav))
    pg.wait_for_timeout(1400)
    ok(any(u=="https://music.apple.com/es/album/mock-exact/111" for u in nav),"iOS: respaldo https tras ~1,5 s "+str(nav)); ctx.close()
    # iPadOS (se presenta como Mac; maxTouchPoints>1)
    ctx=b.new_context(viewport={"width":820,"height":1100},user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15")
    ctx.add_init_script("Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5});Object.defineProperty(navigator,'platform',{get:()=>'MacIntel'})")
    pg=ctx.new_page(); nav=[]; pg.on("request",lambda r: nav.append(r.url) if r.url.startswith("music://") else None)
    pg.route("**/itunes.apple.com/**",mock); pg.route("https://music.apple.com/**",lambda r: r.fulfill(status=200,content_type="text/html",body="x"))
    pg.goto(URL); pg.wait_for_selector(".first"); pg.click("#tab-ajustes"); pg.set_input_files("input[accept*=json]","/tmp/bk11.json"); pg.click(".dlg .btn--primary"); pg.click("#tab-coleccion"); pg.wait_for_selector(".card")
    openrec(pg,"Mock Exact"); pg.wait_for_timeout(1500); pg.click(".detail .btn--apple"); pg.wait_for_timeout(500)
    ok(any(u.startswith("music://") for u in nav),"iPadOS (Mac+touch) usa music://: "+str(nav)); ctx.close()
    # Mac de escritorio sin táctil: https en pestaña nueva
    ctx=b.new_context(viewport={"width":1000,"height":800},user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15"); pg=ctx.new_page()
    pg.route("**/itunes.apple.com/**",mock); pg.route("https://music.apple.com/**",lambda r: r.fulfill(status=200,content_type="text/html",body="x"))
    pg.goto(URL); pg.wait_for_selector(".first"); pg.click("#tab-ajustes"); pg.set_input_files("input[accept*=json]","/tmp/bk11.json"); pg.click(".dlg .btn--primary"); pg.click("#tab-coleccion"); pg.wait_for_selector(".card")
    openrec(pg,"Mock Exact"); pg.wait_for_timeout(1500)
    with ctx.expect_page() as np: pg.click(".detail .btn--apple")
    ok(np.value.url=="https://music.apple.com/es/album/mock-exact/111","no iOS: pestaña nueva https "+np.value.url); ctx.close()
    # ---- Al azar: botón
    ctx,pg,reqs=boot(b,466,678); pg.click("#tab-azar"); pg.click("text=Ponme uno al azar"); pg.wait_for_selector(".rnd__card .btn--apple"); ok(True,"botón en la tarjeta de Al azar"); pg.wait_for_timeout(1500); ctx.close()
    # ---- retoques
    for (w,h) in [(669,951),(466,678),(390,844),(951,669),(320,640)]:
        ctx,pg,_=boot(b,w,h)
        r=pg.evaluate("""()=>{const c=document.querySelector('.count');const b=c.getBoundingClientRect();const lh=parseFloat(getComputedStyle(c).lineHeight)||b.height;return {h:b.height,t:c.textContent,w:b.width,sel:document.querySelector('.sortsel').getBoundingClientRect().width}}""")
        ok(r["h"]<28,f"{w}x{h} contador en una línea: {r}")
        ov=pg.evaluate("()=>{const m=document.querySelector('.coll__main').getBoundingClientRect();const s=document.querySelector('.sortsel').getBoundingClientRect();return s.right<=m.right+1&&s.left>=m.left-1}")
        ok(ov,f"{w}x{h} selector de orden dentro de su columna")
        ctx.close()
    ctx,pg,_=boot(b,390,844); pg.click("#tab-ajustes"); pg.wait_for_timeout(300)
    r=pg.evaluate("""()=>{const bad=[];document.querySelectorAll('.bars__k').forEach(e=>{if(e.scrollWidth>e.clientWidth+1||getComputedStyle(e).textOverflow==='ellipsis'&&e.scrollWidth>e.clientWidth)bad.push(e.textContent)});
      const k=[...document.querySelectorAll('.bars__k')].find(e=>/Nippon|Contemporary/.test(e.textContent)&&e.offsetParent);return {bad,txt:k&&k.textContent,h:k&&k.getBoundingClientRect().height,sw:document.documentElement.scrollWidth,W:document.documentElement.clientWidth}}""")
    ok(not r["bad"] and r["sw"]<=r["W"],"estadísticas: etiquetas completas "+str(r)); ctx.close()
    # filtro huérfano
    ctx,pg,_=boot(b,466,678)
    pg.click(".filt-btn"); pg.select_option(".fpanel select >> nth=1","Contemporary Jazz"); pg.click(".fpanel .btn--sm"); pg.wait_for_timeout(200)
    pg.click("#tab-azar"); pg.select_option(".rnd__side select >> nth=1","Contemporary Jazz") if False else None
    # Al azar: fija género
    pg.select_option(".rnd__side select >> nth=0",index=1)
    # importar colección sin ese estilo
    small=copy.deepcopy(base); small["collection"]=[r for r in small["collection"] if "Contemporary Jazz" not in r["styles"]]; json.dump(small,open("/tmp/bk11b.json","w"))
    pg.click("#tab-ajustes"); pg.set_input_files("input[accept*=json]","/tmp/bk11b.json"); pg.click(".dlg .btn--primary"); pg.wait_for_timeout(500)
    ok("Se ha quitado un filtro que ya no existe" in pg.locator(".toast").inner_text(),"toast de filtro depurado")
    pg.click("#tab-coleccion"); pg.wait_for_timeout(200)
    ok(pg.locator(".chip:has-text('Estilo')").count()==0 and pg.locator(".card").count()>0,"la lista ya no queda vacía (sin chip de estilo)"); ctx.close()
    # ---- capturas
    for (w,h,sch) in [(466,678,"light"),(466,678,"dark"),(390,844,"light"),(390,844,"dark")]:
        ctx,pg,_=boot(b,w,h,sch); sc="claro" if sch=="light" else "oscuro"
        pg.screenshot(path=f"{OUT}v11-{w}x{h}-coleccion-{sc}.png")
        openrec(pg,"Mock None"); pg.wait_for_timeout(1800); pg.fill(".search input",""); 
        pg.locator(".detail .links2").scroll_into_view_if_needed(); pg.wait_for_timeout(200)
        pg.screenshot(path=f"{OUT}v11-{w}x{h}-ficha-busqueda-{sc}.png")
        pg.locator(".detail__bar .btn:visible, .detail__x:visible").first.click(); openrec(pg,"Mock Exact"); pg.wait_for_timeout(1500)
        pg.locator(".detail .links2").scroll_into_view_if_needed(); pg.wait_for_timeout(200)
        pg.screenshot(path=f"{OUT}v11-{w}x{h}-ficha-album-{sc}.png")
        pg.locator(".detail__bar .btn:visible, .detail__x:visible").first.click(); pg.click("#tab-ajustes"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}v11-{w}x{h}-ajustes-{sc}.png",full_page=True)
        pg.locator(".card-box:has(h2:has-text('Estad'))").screenshot(path=f"{OUT}v11-{w}x{h}-estadisticas-{sc}.png")
        pg.click("#tab-azar"); pg.click("text=Ponme uno al azar"); pg.wait_for_timeout(1800); pg.screenshot(path=f"{OUT}v11-{w}x{h}-azar-{sc}.png")
        ctx.close()
    ctx,pg,_=boot(b,669,951); pg.screenshot(path=OUT+"v11-669x951-coleccion-claro.png"); openrec(pg,"Mock Exact"); pg.wait_for_timeout(1500); pg.locator(".detail .links2").scroll_into_view_if_needed(); pg.screenshot(path=OUT+"v11-669x951-ficha-claro.png"); ctx.close()
    ctx,pg,reqs=boot(b,466,678,real=True)
    for t in ["Kind of Blue","A Love Supreme","Scenery"]:
        openrec(pg,t)
        pg.wait_for_function("()=>!document.querySelector('.detail .btn--apple')||true"); pg.wait_for_timeout(3500)
        h,s2=apple(pg); print("REAL",t,"->",h,"|",s2 or "(álbum exacto)")
        ok(h.startswith("https://music.apple.com/es/"),"real "+t)
    ctx.close()
    b.close()
print("ERRORES DE CONSOLA:",errs); print("FALLOS:",fails); sys.exit(1 if fails or errs else 0)
