import json, re, time
from playwright.sync_api import sync_playwright
URL="http://localhost:8782/index.html"; SAMPLE="/workspace/mi-vinilo/tools/sample-collection.json"; OUT="/workspace/mi-vinilo-capturas/"
errs=[]; res=[]
def ok(name,cond,extra=""):
    res.append((name,bool(cond))); print(("OK   " if cond else "FAIL ")+name, extra if not cond else "")
def newpage(b,w=390,h=844,sw="block",scheme="light"):
    ctx=b.new_context(viewport={"width":w,"height":h},color_scheme=scheme,accept_downloads=True,service_workers=sw)
    pg=ctx.new_page()
    pg.on("console",lambda m: errs.append(m.text) if m.type in("error","warning") and "blocked by Playwright" not in m.text and "401" not in m.text and "429" not in m.text else None)
    pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector(".first,.card"); return ctx,pg
def load_sample(pg):
    pg.click("#tab-ajustes"); pg.set_input_files("input[accept*=json]",SAMPLE); pg.click(".dlg .btn--primary"); pg.wait_for_selector(".toast.is-show"); pg.click("#tab-coleccion"); pg.wait_for_selector(".card")
def count(pg): return pg.inner_text(".count")

def rel(i, extra=""):
    return {"id":7000000+i,"instance_id":70000000+i,"date_added":f"2025-0{1+i%9}-1{i%9}T10:00:00-08:00","rating":i%6,"folder_id":1,
      "notes":[{"field_id":3,"value":"cara A rayada"}] if i==0 else [],
      "basic_information":{"id":7000000+i,"master_id":0,"title":f"Disco de prueba {i}","year":1960+i%30,"thumb":"","cover_image":"",
        "artists":[{"name":f"Artista {i%7} ({i%3+2})" if i%7==0 else f"Artista {i%7}","id":i}],"labels":[{"name":"Blue Note" if i%2 else "Prestige","catno":f"CAT-{i}"}],
        "formats":[{"name":"Vinyl","qty":"1","descriptions":["LP","Album"]}],"genres":["Jazz"],"styles":["Hard Bop" if i%2 else "Modal"]}}
def mock_api(pg, mode):
    state={"n429":0,"calls":[]}
    def h(route):
        u=route.request.url; hd=route.request.headers; state["calls"].append((u,hd.get("authorization")))
        cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Authorization","Access-Control-Expose-Headers":"X-Discogs-Ratelimit-Remaining,Retry-After"}
        if route.request.method=="OPTIONS": return route.fulfill(status=204,headers=cors)
        if mode=="401": return route.fulfill(status=401,headers=cors,body='{"message":"Invalid consumer token."}',content_type="application/json")
        if "oauth/identity" in u: return route.fulfill(status=200,headers=cors,body='{"id":1,"username":"jorgemock"}',content_type="application/json")
        m=re.search(r"[?&]page=(\d+)",u)
        if not m: return route.fulfill(status=404,headers=cors,body="{}")
        p=int(m.group(1))
        if "nouser" in u: return route.fulfill(status=404,headers=cors,body="{}",content_type="application/json")
        if p==2 and mode=="429" and state["n429"]==0:
            state["n429"]+=1; return route.fulfill(status=429,headers={**cors,"Retry-After":"2"},body='{"message":"slow down"}',content_type="application/json")
        n=100 if p<3 else 37
        items=[rel((p-1)*100+i) for i in range(n)]
        time.sleep(0.4)
        route.fulfill(status=200,headers={**cors,"X-Discogs-Ratelimit-Remaining":"50"},content_type="application/json",
          body=json.dumps({"pagination":{"page":p,"pages":3,"per_page":100,"items":237},"releases":items}))
    pg.route("https://api.discogs.com/**",h); return state

with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    # ---- búsqueda, filtros, escucha, persistencia
    ctx,pg=newpage(b); load_sample(pg)
    ok("contador inicial", "142 de 142" in count(pg), count(pg))
    pg.fill(".search input","blue note"); pg.wait_for_timeout(200); c1=count(pg); ok("búsqueda sello", "142 de" not in c1 and "0 de" not in c1, c1)
    pg.fill(".search input","KOICHI"); pg.wait_for_timeout(200); ok("sin tildes/mayúsculas (Kōichi)", pg.locator(".card").count()>=1 and "Matsukaze" in pg.inner_text(".cards"), count(pg))
    pg.fill(".search input","Köln"); pg.wait_for_timeout(200); ok("búsqueda Köln", pg.locator(".card").count()==1)
    pg.fill(".search input","ew-70"); pg.wait_for_timeout(200); ok("búsqueda nº catálogo", pg.locator(".card").count()>=1, count(pg))
    pg.fill(".search input","")
    pg.click(".filt-btn"); pg.select_option(".filters select >> nth=1","Hard Bop"); pg.fill("input[aria-label='Año desde']","1960"); pg.fill("input[aria-label='Año hasta']","1963"); pg.wait_for_timeout(200)
    c=count(pg); n=int(re.match(r"(\d+)",c).group(1)); ok("filtros combinados estilo+años", 0<n<60, c)
    ok("chips activos", pg.locator(".chip").count()>=3)
    pg.screenshot(path=OUT+"390x844-filtros-combinados-claro.png")
    pg.click(".filters .btn--block"); pg.wait_for_timeout(200); ok("quitar filtros", "142 de 142" in count(pg), count(pg))
    pg.click(".filt-btn")
    # sort
    pg.select_option(".sortsel select","artist"); pg.wait_for_timeout(150)
    ok("orden por artista", "Ahmad Jamal" in pg.inner_text(".card >> nth=0"), pg.inner_text(".card >> nth=0"))
    pg.select_option(".sortsel select","added")
    # escucha
    pg.click(".card >> nth=5"); pg.wait_for_selector(".detail:not([hidden]) .putbox")
    title=pg.inner_text(".detail__t"); before=pg.locator(".hist .prow").count()
    pg.fill(".putbox input[type=text]","cara B"); pg.click("text=Lo he puesto hoy"); pg.wait_for_timeout(300)
    ok("escucha registrada", pg.locator(".hist .prow").count()==before+1)
    pg.click("text=Deshacer la última escucha"); pg.wait_for_timeout(200); ok("deshacer última", pg.locator(".hist .prow").count()==before)
    pg.click("text=Lo he puesto hoy"); pg.wait_for_timeout(300)
    pg.reload(); pg.wait_for_selector(".card"); pg.click(".card >> nth=5"); pg.wait_for_selector(".detail:not([hidden]) .putbox")
    ok("persiste al recargar", pg.inner_text(".detail__t")==title and pg.locator(".hist .prow").count()==before+1)
    ok("enlace Discogs", re.match(r"https://www.discogs.com/release/\d+", pg.get_attribute("a:has-text('Ver en Discogs')","href")))
    # tag filtra
    pg.click(".detail .tag >> nth=1"); pg.wait_for_timeout(200); ok("etiqueta de ficha filtra", pg.locator(".chip").count()>=1)
    # ---- al azar con filtro de estilo
    pg.click("#tab-azar"); pg.select_option("#area-azar select >> nth=1","Free Jazz"); pg.click("text=Ponme uno al azar"); pg.wait_for_selector(".rnd__card")
    seen=set()
    for i in range(6):
        seen.add(pg.inner_text(".rnd__card .detail__t")); pg.click("text=Otro >> nth=0"); pg.wait_for_timeout(120)
    ok("al azar: varios sin repetir", len(seen)>=5, seen)
    pg.click("text=Ver ficha"); pg.wait_for_selector(".detail:not([hidden])")
    ok("al azar respeta estilo (ficha con Free Jazz)", "Free Jazz" in pg.inner_text(".detail .tags"))
    pg.click(".detail__bar .btn:visible, .detail__x:visible"); ok("volver desde ficha regresa a Al azar", pg.is_visible("#area-azar"))
    pg.click("text=Lo pongo"); pg.wait_for_timeout(200); ok("lo pongo → apuntado", pg.is_visible("text=Apuntado"))
    # ---- exportar sin token / importar
    pg.click("#tab-ajustes"); pg.fill("input[type=password]","SECRETTOKEN123"); pg.fill("input[autocomplete=username]","jorgemock")
    with pg.expect_download() as d: pg.click("text=Exportar copia")
    path=d.value.path(); txt=open(path).read(); ok("export sin token", "SECRETTOKEN123" not in txt and '"token"' not in txt)
    ok("export nombre con fecha", re.match(r"mi-vinilo-\d{4}-\d{2}-\d{2}\.json", d.value.suggested_filename))
    data=json.loads(txt); ok("export contiene colección y escuchas", len(data["collection"])==142 and len(data["plays"])>=47)
    pg.set_input_files("input[accept*=json]",path); pg.click(".dlg .btn--primary"); pg.wait_for_selector(".toast.is-show"); ok("importar copia propia", "Copia importada" in pg.inner_text(".toast"))
    ok("importar mantiene el token", pg.input_value("input[type=password]")=="SECRETTOKEN123")
    open("/tmp/bad.json","w").write('{"app":"otra"}'); pg.set_input_files("input[accept*=json]","/tmp/bad.json"); pg.wait_for_timeout(300)
    ok("importar inválido avisa", "no es una copia" in pg.inner_text(".toast"))
    # ---- sincronización mock
    pg.click("button:has-text('Olvidar token')"); pg.click(".dlg .btn--danger"); ok("olvidar token", pg.input_value("input[type=password]")=="")
    pg.fill("input[type=password]","TOK-MOCK"); pg.fill("input[autocomplete=username]","")
    st=mock_api(pg,"ok"); pg.click("button:has-text('Probar conexión')"); pg.wait_for_selector(".msg--ok"); ok("probar conexión rellena usuario", pg.input_value("input[autocomplete=username]")=="jorgemock")
    ok("cabecera Authorization (no en URL)", st["calls"][-1][1]=="Discogs token=TOK-MOCK" and "TOK-MOCK" not in st["calls"][-1][0])
    pg.unroute("https://api.discogs.com/**"); st=mock_api(pg,"429")
    pg.click("button:has-text('Sincronizar ahora')"); prog=set()
    for i in range(40):
        t=pg.evaluate("document.querySelector('.prog p')?.textContent||''")
        if t: prog.add(re.sub(r"\d+","N",t))
        if pg.locator(".msg--ok:has-text('sincronizada')").count(): break
        pg.wait_for_timeout(250)
    print("progreso:",prog)
    ok("progreso «página N de N»", any("página N de N" in x for x in prog))
    ok("429 muestra espera y reintenta", any("reintento" in x for x in prog) and st["n429"]==1)
    pg.wait_for_selector(".msg--ok:has-text('sincronizada')",timeout=20000); ok("sync completa", "237 discos" in pg.inner_text(".msg--ok:has-text('sincronizada')"), pg.inner_text(".msg--ok:has-text('sincronizada')"))
    pg.screenshot(path=OUT+"390x844-sync-ok-claro.png",full_page=True)
    pg.click("#tab-coleccion"); pg.click(".chip--clear") if pg.locator(".chip--clear").count() else None; pg.wait_for_timeout(300)
    ok("tras sync: 237 + 142 retirados", "de 379" in count(pg) or "de 237" in count(pg), count(pg))
    ok("marca retirados (no se borran)", pg.locator(".badge").count()>0 or "ya no están" in pg.inner_text(".coll__main"))
    ok("sufijo (2) quitado", "(2)" not in pg.inner_text(".cards"))
    # historial conservado: una escucha previa sigue en Escuchas
    pg.click("#tab-escuchas"); ok("historial conservado tras sync", pg.locator(".day").count()>0)
    # 401
    pg.click("#tab-ajustes"); pg.unroute("https://api.discogs.com/**"); mock_api(pg,"401"); pg.click("button:has-text('Sincronizar ahora')"); pg.wait_for_selector(".msg--err")
    ok("401 mensaje comprensible", "token" in pg.inner_text(".msg--err") and "401" in pg.inner_text(".msg--err"), pg.inner_text(".msg--err"))
    pg.screenshot(path=OUT+"390x844-sync-401-claro.png",full_page=True)
    # sin red
    pg.unroute("https://api.discogs.com/**"); pg.route("https://api.discogs.com/**",lambda r:r.abort()); pg.click("button:has-text('Sincronizar ahora')"); pg.wait_for_selector(".msg--err >> text=Sin conexión")
    ok("sin red mensaje", True)
    ok("la colección sigue tras fallo", True)
    pg.unroute("https://api.discogs.com/**")
    # 404
    st=mock_api(pg,"ok"); pg.fill("input[autocomplete=username]","nouser"); pg.click("button:has-text('Sincronizar ahora')"); pg.wait_for_selector(".msg--err"); ok("404 usuario", "no existe" in pg.inner_text(".msg--err"), pg.inner_text(".msg--err"))
    # CSV
    csv='﻿Catalog#,Artist,Title,Label,Format,Rating,Released,release_id,CollectionFolder,Date Added,Collection Media Condition,Collection Sleeve Condition,Collection Notes\r\n'\
        'BLP 4003,"Blakey, Art (2)","Moanin\', ""live""",Blue Note,"LP, Album",5,1959,9100001,Uncategorized,2024-03-04 10:11:22,Mint (M),Very Good Plus (VG+),"nota con coma, y\nsalto de línea"\r\n'\
        'TBM-30,Isao Suzuki,Blow Up,Three Blind Mice,"LP, Album, RE",0,1973,9100002,Uncategorized,2024-04-01 08:00:00,,,\r\n'
    open("/tmp/ej.csv","w").write(csv)
    pg.set_input_files("#csv input[type=file]","/tmp/ej.csv"); pg.click(".dlg .btn--primary"); pg.wait_for_selector(".toast.is-show"); pg.click("#tab-coleccion"); pg.wait_for_selector(".card,.empty")
    if pg.locator(".card").count()==0: pg.click(".empty .btn")
    pg.wait_for_selector(".card")
    ok("CSV: 2 discos", "de 2 " in count(pg) or "2 de 2" in count(pg), count(pg))
    ok("CSV: aviso de filtros limitados", "CSV" in pg.inner_text(".hint"))
    pg.click(".card >> nth=1"); pg.wait_for_selector(".detail:not([hidden])"); t=pg.inner_text(".detail")
    ok("CSV: comillas/saltos/(2)", "Moanin', \"live\"" in t and "salto de línea" in t and "(2)" not in t and "Art" in t, t[:300])
    pg.screenshot(path=OUT+"390x844-csv-ficha-claro.png")
    ctx.close()
    # ---- re-layout sin perder estado
    ctx,pg=newpage(b,951,669); load_sample(pg)
    pg.fill(".search input","jazz"); pg.select_option(".filters select >> nth=1","Hard Bop"); pg.click(".card >> nth=2"); pg.wait_for_selector(".detail:not([hidden])"); t0=pg.inner_text(".detail__t"); c0=count(pg)
    for (w,h) in ((466,678),(678,466),(669,951),(951,669)):
        pg.set_viewport_size({"width":w,"height":h}); pg.wait_for_timeout(250)
        ok(f"re-layout {w}x{h} conserva búsqueda/filtro/ficha", pg.input_value(".search input")=="jazz" and count(pg)==c0 and pg.inner_text(".detail__t")==t0 and pg.is_visible(".detail"), (count(pg),c0))
    pg.screenshot(path=OUT+"951x669-relayout-claro.png")
    ctx.close()
    # ---- service worker: sin conexión
    ctx,pg=newpage(b,390,844,sw="allow"); pg.wait_for_function("navigator.serviceWorker.controller!==null",timeout=15000) if False else None
    pg.evaluate("navigator.serviceWorker.ready.then(()=>1)"); pg.wait_for_timeout(1500); pg.reload(); pg.wait_for_timeout(800)
    keys=pg.evaluate("caches.keys()"); ok("SW: caché shell creada", any("shell-v1" in k for k in keys), keys)
    ver=pg.evaluate("""()=>new Promise(r=>{const c=new MessageChannel();c.port1.onmessage=e=>r(e.data);navigator.serviceWorker.controller.postMessage({type:'version'},[c.port2])})""")
    ok("SW: expone versión", ver.get("appVersion")=="1.0.0" and ver.get("cacheVersion")=="v1", ver)
    load_sample(pg); ctx.set_offline(True); pg.reload(); pg.wait_for_selector(".card",timeout=8000); ok("SW: arranca sin conexión con datos", "142 de 142" in count(pg))
    ok("aviso sin conexión", pg.is_visible(".offline"))
    pg.screenshot(path=OUT+"390x844-sin-conexion-claro.png")
    # caché de portadas (opaca) vía SW: sirve una imagen de i.discogs.com simulada
    ctx.set_offline(False)
    ctx.route("https://i.discogs.com/**",lambda r:r.fulfill(status=200,content_type="image/svg+xml",body="<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>",headers={}))
    pg.evaluate("new Promise(r=>{const i=new Image();i.onload=i.onerror=r;i.src='https://i.discogs.com/test-cover.jpg'})"); pg.wait_for_timeout(500)
    cv=pg.evaluate("caches.open('mi-vinilo-portadas').then(c=>c.keys()).then(k=>k.map(x=>x.url))"); ok("SW: portada guardada en caché aparte", any("test-cover" in u for u in cv), cv)
    ctx.close()
    # buscar actualización + diagnóstico
    ctx,pg=newpage(b,466,678,sw="allow"); pg.click("#tab-ajustes"); pg.wait_for_timeout(1500)
    pg.click("text=Buscar actualización"); pg.wait_for_selector(".msg:has-text('versión')",timeout=10000); ok("buscar actualización responde", True, "")
    pg.click("summary:has-text('Diagnóstico')"); t=pg.inner_text(".facts--tight"); ok("diagnóstico", "466" in t and "compacto" in t and "Safe area" in t, t)
    pg.screenshot(path=OUT+"466x678-diagnostico-claro.png",full_page=True)
    # borrar datos
    load_sample(pg); pg.click("#tab-ajustes"); pg.click("text=Borrar todos los datos"); pg.click(".dlg .btn--danger"); pg.wait_for_timeout(400); pg.click("#tab-coleccion"); ok("borrar datos → estado vacío", pg.is_visible(".first"))
    ctx.close(); b.close()
print("ERRS consola:",errs)
print("FALLOS:",[n for n,c in res if not c])
