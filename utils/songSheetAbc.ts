/**
 * Partituras ABC dentro de la hoja de canción (`05-apuntes-y-partituras.md`
 * §5): riffs y melodías cortas escritos en el `.cho` como
 *
 *   {start_of_abc: Trompeta}
 *   X:1
 *   L:1/8
 *   K:G
 *   d2 dB c2 cA | B4 G4 |]
 *   {end_of_abc}
 *
 * `buildSheet` (`utils/songSheet.ts`) deja cada bloque como un marcador vacío
 * de una línea, `<div class="abc" data-abc="…" data-label="…" data-tr="…">`,
 * y aquí está lo que lo pinta DENTRO del documento: abcjs en línea (sin red,
 * `utils/songSheetAbcjs.ts`, generado), el script que llama a
 * `ABCJS.renderAbc` y el CSS. Todo eso solo entra en el HTML de las canciones
 * que traen ABC (`sheetHasAbc`): las demás quedan byte a byte como antes.
 *
 * Tono: `data-tr` lleva los semitonos del transporte de la app y abcjs lo
 * aplica con `visualTranspose`, así el riff sigue a los acordes. Cambiar el
 * tono no recarga la página (`utils/songDisplayBridge.ts` cambia el body en
 * su sitio): un `MutationObserver` pinta los marcadores nuevos.
 *
 * Tema: abcjs pinta con `currentColor`, así que el pentagrama toma el
 * `color` del marcador (`--sh-text`) y cambia en vivo con claro, oscuro,
 * escenario y sol, como el resto de la hoja.
 *
 * Zona espejo: igual en MCM App y en MCM Cantoral.
 */
import { ABCJS_JS } from './songSheetAbcjs';

export const ABC_CSS = `
  .abc { color: var(--sh-text); margin: 0.15em 0 0.25em; break-inside: avoid; }
  .abc .abc-lbl {
    color: var(--sh-label);
    font-size: 0.6em;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    line-height: 1.4;
    margin: 0 0 0.15em;
  }
  .abc svg { display: block; overflow: visible; }
  /* Los acordes del riff, como los de la letra: color y letra de la hoja. */
  .abc .abcjs-chord {
    fill: var(--sh-chord);
    font-family: var(--song-font-family);
    font-weight: 700;
  }
  .abc .abcjs-annotation, .abc .abcjs-lyric { fill: var(--sh-muted); }
  .abc .abc-src {
    margin: 0;
    white-space: pre-wrap;
    font-family: 'Roboto Mono', 'Courier New', monospace;
    font-size: 0.8em;
    color: var(--sh-muted);
  }
`;

/**
 * Corre dentro del documento, después de abcjs. Pinta cada `.abc[data-abc]`
 * que aún no esté pintado; si abcjs no está o el ABC no da nada, enseña el
 * texto ABC tal cual (mejor eso que un hueco). Expone
 * `window.__SONG_ABC__.draw(force)` por si alguien necesita repintar.
 */
export const ABC_DRAW_JS = `
(function () {
  var doc = document;
  var WRAP = { minSpacing: 1.8, maxSpacing: 2.7, preferredMeasuresPerLine: 4 };

  function raw(box, src) {
    box.textContent = '';
    var pre = doc.createElement('pre');
    pre.className = 'abc-src';
    pre.textContent = src;
    box.appendChild(pre);
  }

  function draw(el) {
    var src = '';
    try { src = decodeURIComponent(el.getAttribute('data-abc') || ''); } catch (e) {}
    // ChordPro pide que el bloque empiece por «X:1»; abcjs lo necesita para
    // saber dónde empieza la pieza, así que se perdona si falta.
    if (!/^\\s*X:/m.test(src)) src = 'X:1\\n' + src;
    var tr = parseInt(el.getAttribute('data-tr') || '0', 10) || 0;
    var label = el.getAttribute('data-label');
    el.setAttribute('data-drawn', '1');
    el.textContent = '';
    if (label) {
      var lbl = doc.createElement('div');
      lbl.className = 'abc-lbl';
      lbl.textContent = label;
      el.appendChild(lbl);
    }
    var box = doc.createElement('div');
    box.className = 'abc-box';
    el.appendChild(box);
    var width = el.clientWidth || 320;
    el.setAttribute('data-w', String(width));
    watch(el);
    try {
      var A = window.ABCJS;
      if (!A || !A.renderAbc) throw new Error('sin abcjs');
      A.renderAbc(box, src, {
        responsive: 'resize',
        visualTranspose: tr,
        staffwidth: Math.max(200, width - 12),
        wrap: WRAP,
        add_classes: true,
        selectTypes: false,
        paddingleft: 0,
        paddingright: 0,
        paddingtop: 0,
        paddingbottom: 4
      });
      if (!box.querySelector('svg')) raw(box, src);
    } catch (e) {
      raw(box, src);
    }
  }

  // El ancho de verdad llega tarde: la maquetación reparte la hoja en
  // columnas (o páginas, en el atril) DESPUÉS de pintar, y al girar la
  // pantalla. Si el hueco cambia mucho, se vuelve a pintar a su medida (como
  // mucho 3 veces por partitura, para que pintar y maquetar no se persigan).
  function watch(el) {
    if (!window.ResizeObserver || el.__abcWatch) return;
    var redraws = 0, timer = null;
    el.__abcWatch = new ResizeObserver(function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        var drawn = parseInt(el.getAttribute('data-w') || '0', 10) || 0;
        if (!el.isConnected || redraws >= 3) return;
        if (Math.abs(el.clientWidth - drawn) < 40) return;
        redraws++;
        draw(el);
        if (window.__SONG_LAYOUT__) window.__SONG_LAYOUT__.refit();
      }, 150);
    });
    el.__abcWatch.observe(el);
  }

  function drawAll(force) {
    var els = doc.querySelectorAll('.abc[data-abc]');
    var any = false;
    for (var i = 0; i < els.length; i++) {
      if (force || !els[i].getAttribute('data-drawn')) { draw(els[i]); any = true; }
    }
    // El pentagrama cambia el alto de la hoja: columnas y páginas otra vez.
    if (any && window.__SONG_LAYOUT__) window.__SONG_LAYOUT__.refit();
  }

  window.__SONG_ABC__ = { draw: drawAll };
  drawAll(false);

  // Transponer o cambiar la notación cambian el body sin recargar.
  if (window.MutationObserver && doc.body) {
    new MutationObserver(function () { drawAll(false); })
      .observe(doc.body, { childList: true });
  }

  // Sin ResizeObserver: al menos, al girar la pantalla.
  if (window.ResizeObserver) return;
  var lastW = window.innerWidth, timer = null;
  window.addEventListener('resize', function () {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      if (Math.abs(window.innerWidth - lastW) < 40) return;
      lastW = window.innerWidth;
      drawAll(true);
    }, 200);
  });
})();
`;

/** CSS que se añade a la hoja si lleva partituras. */
export function abcSheetCss(hasAbc: boolean): string {
  return hasAbc ? ABC_CSS : '';
}

/** `<script>`s que se añaden a la hoja si lleva partituras (abcjs y el pintor). */
export function abcSheetScripts(hasAbc: boolean): string {
  return hasAbc
    ? `<script>${ABCJS_JS}</script><script>${ABC_DRAW_JS}</script>`
    : '';
}
