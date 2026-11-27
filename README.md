# Mi vinilo

PWA estática e instalable para tener la colección de vinilos de Discogs en el móvil: consultarla, elegir qué poner y llevar un registro sencillo de lo que se escucha. Funciona sin conexión una vez sincronizada.

- Publicación: <https://prodesin.github.io/mi-vinilo/>
- Apps hermanas: [Mi tensión](https://prodesin.github.io/mi-tension/) · [Mi entrenador](https://prodesin.github.io/mi-entrenador/) · [Mi menú](https://prodesin.github.io/mi-menu/)

## Funciones

- **Colección**: cuadrícula o lista, buscador instantáneo (artista, título, sello, nº de catálogo; sin distinguir tildes ni mayúsculas), filtros combinables (género, estilo, artista, sello, formato, rango de años), chips de filtros activos, «Quitar filtros», contador «237 de 851 discos» y 7 órdenes (recién añadidos, artista, título, año, más/menos escuchados, más tiempo sin sonar). Se pinta por lotes para ir fluido con 850 discos.
- **Ficha**: portada grande, datos, géneros y estilos (pulsables para filtrar), nota de Discogs, fecha de alta, «Ver en Discogs», historial de escuchas y botón «Lo he puesto hoy» (con fecha y nota opcionales). Editar, borrar y deshacer la última escucha.
- **Al azar**: «Ponme uno al azar» con filtros (género, estilo, artista, década), opción de preferir los que hace tiempo que no suenan y sin repetir los últimos 10.
- **Escuchas**: registro por día, totales (semana, mes, año), artistas y estilos más escuchados del mes, «Hace tiempo que no suena» y «Nunca escuchados desde que usas la app», con acceso directo a «Lo he puesto hoy».
- **Ajustes**: conexión con Discogs, sincronización, importación de CSV, portadas sin conexión, estadísticas, copia de seguridad, borrar datos, enlaces y «Acerca de» (versión, buscar actualización, diagnóstico de pantalla).
- Layout adaptado al iPhone Duo (exterior, interior, vertical y apaisado) y al iPhone normal: rail vertical de pestañas, una columna en el exterior, y filtros laterales + ficha como panel en el interior. Claro y oscuro.

## Conectar Discogs

1. Entra en <https://www.discogs.com/settings/developers> (Ajustes › Desarrolladores).
2. Pulsa **«Generate new token»** y copia el token.
3. En **Ajustes › Conexión con Discogs** escribe tu usuario y pega el token. «Probar conexión» comprueba que funciona.
4. Pulsa **«Sincronizar ahora»**. Se descargan todas las páginas (≈ 9 para 850 discos) respetando el límite de peticiones; si Discogs pide esperar, la app espera y reintenta. Si la sincronización falla, se conserva la copia anterior.

Tras volver a sincronizar se conserva el historial de escuchas, y los discos que ya no estén en Discogs se **marcan** como «Retirado» en vez de borrarse (hay un botón para quitarlos de la lista).

**Alternativa sin token**: en Discogs, Colección › Exportar, y en la app «Importar CSV». El CSV no trae géneros, estilos ni portadas, así que los filtros por estilo quedan limitados.

## Instalar en el iPhone

Safari › Compartir › **«Añadir a pantalla de inicio»**.

## Abrir en Apple Music

En la ficha de cada disco (y en «Al azar») el botón **Abrir en Apple Music** busca el álbum en la API pública de iTunes Search (sin cuenta ni claves; `country=es`) la primera vez que abres la ficha, con como mucho una petición por segundo y 8 s de timeout. Se elige el resultado que mejor coincide en artista y título (ignorando tildes, «The», «(2)», «Deluxe», «(Remastered)»…). Si no hay coincidencia clara, o falla la red, el botón lleva a una búsqueda en Apple Music y lo indica con el subtítulo «Buscar en Apple Music». El resultado se guarda en IndexedDB (las búsquedas se reintentan pasados 30 días), entra en la copia JSON y «Borrar todos los datos» lo limpia. En iPhone/iPad se abre directamente la app Música (`music://`), con la web como respaldo.

## Copia de seguridad y privacidad

- Todo se guarda en el dispositivo (IndexedDB). No hay servidor, cuentas, analítica ni rastreadores ni CDNs.
- La app solo se conecta a `api.discogs.com` (sincronizar), `i.discogs.com` (portadas) e `itunes.apple.com` (enlace a Apple Music; solo se envían artista y título).
- **El token solo se guarda en este dispositivo**: se envía en la cabecera `Authorization`, nunca en la URL, y **no** entra en la copia JSON exportada. «Olvidar token» lo borra.
- «Exportar copia» genera `mi-vinilo-AAAA-MM-DD.json` (colección, escuchas y preferencias); «Importar copia» valida el archivo y pide confirmación.
- Las portadas no se pueden leer por CORS, así que se muestran como `<img>` y el service worker las guarda (respuestas opacas) en una caché aparte con límite de 1.200 entradas. «Descargar portadas para usar sin conexión» las precarga poco a poco.

## Estructura

```
index.html, styles.css, app.js   publicados (app.js es el bundle generado)
sw.js                            service worker (CACHE_VERSION, APP_VERSION)
manifest.webmanifest, icon-*.png, apple-touch-icon.png
src/                             TSX + preact (se compila con esbuild)
  main.tsx   arranque, registro del SW, lado del rail
  app.tsx    pestañas, estado de la interfaz, rail
  collection.tsx · random.tsx · plays.tsx · settings.tsx
  store.ts   estado, persistencia, sincronización, copia
  discogs.ts · csv.ts · db.ts (wrapper IndexedDB) · logic.ts · util.ts · ui.tsx
tools/
  make_icons.py           genera los iconos (PIL)
  make_sample.py          genera sample-collection.json (solo pruebas; NO se carga en la app)
  tests/                  pruebas con Playwright (capturas y funcionales, con Discogs simulado)
```

Desarrollo: `npm install`, `npm run build` (o `npm run watch`), `npm run check`.

## Publicar

Sube **`CACHE_VERSION`** en `sw.js` (y `APP_VERSION` si procede) y ejecuta `npm run build`: actualiza el `?v=` de `index.html` y regenera `app.js`. Sin subir `CACHE_VERSION`, los móviles seguirán con la versión anterior del shell. La caché de portadas no se borra al actualizar.
