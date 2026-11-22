/**
 * Pinta los apuntes DENTRO de la hoja (`05` §2): debajo de la línea a la que
 * van (`[data-line]`, con `lineNotes`), con la etiqueta de su capa, y los
 * huérfanos al final con «¿Dónde iba esto?». Tocar uno avisa a la app
 * (`{ type: 'apunte-tap', id }`). Nunca toca el ChordPro ni la hoja: son
 * nodos añadidos que se quitan y se vuelven a poner en cada llamada.
 *
 * El texto entra con `textContent` (nunca como HTML): un apunte que venga de
 * un repertorio ajeno no puede meter nada en la página.
 */
import { layerLabel, type Apunte } from '@/services/apuntes/model';

export interface PaintedApunte {
  id: string;
  line: number;
  text: string;
  label: string;
  kind: Apunte['kind'];
  orphan: boolean;
}

export function toPainted(notes: Apunte[]): PaintedApunte[] {
  return notes.map((n) => ({
    id: n.id,
    line: n.line,
    text: n.text,
    label: layerLabel(n.layer),
    kind: n.kind,
    orphan: !!n.orphan,
  }));
}

const CSS = [
  '.apunte{display:block;margin:2px 0 8px;padding:4px 10px;border-radius:8px;font-size:.82em;line-height:1.35;color:var(--sh-text);background:transparent;background:color-mix(in srgb,var(--sh-chord) 16%,transparent);cursor:pointer;-webkit-user-select:none;user-select:none}',
  '.apunte .ap-l{font-size:.72em;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--sh-label);margin-right:8px}',
  '.apunte.marca .ap-t{font-weight:700;font-style:italic}',
  '.apunte.acorde .ap-t{font-weight:700;color:var(--sh-chord)}',
  '.apuntes-huerfanos{margin-top:24px}',
  '.apuntes-huerfanos .ap-h{font-size:.8em;font-weight:700;color:var(--sh-muted);margin-bottom:6px}',
].join('');

/** JS que (re)pinta `notes` en la hoja. */
export function apuntesScript(notes: PaintedApunte[]): string {
  return `(function(){var d=document;var notes=${JSON.stringify(notes).replace(/</g, '\\u003c')};
if(!d.getElementById('apuntes-style')){var st=d.createElement('style');st.id='apuntes-style';st.textContent=${JSON.stringify(CSS)};d.head.appendChild(st);
d.addEventListener('click',function(e){var el=e.target;while(el&&el!==d.body){if(el.getAttribute&&el.getAttribute('data-ap')){var m=JSON.stringify({type:'apunte-tap',id:el.getAttribute('data-ap')});if(window.ReactNativeWebView&&window.ReactNativeWebView.postMessage)window.ReactNativeWebView.postMessage(m);else if(window.parent&&window.parent!==window)window.parent.postMessage(m,'*');return;}el=el.parentElement;}});}
var old=d.querySelectorAll('.apunte,.apuntes-huerfanos');for(var k=0;k<old.length;k++){old[k].parentNode&&old[k].parentNode.removeChild(old[k]);}
function mk(n){var el=d.createElement('div');el.className='apunte '+n.kind;el.setAttribute('data-ap',n.id);var l=d.createElement('span');l.className='ap-l';l.textContent=n.label;var t=d.createElement('span');t.className='ap-t';t.textContent=n.text;el.appendChild(l);el.appendChild(t);return el;}
var orph=[];for(var i=notes.length-1;i>=0;i--){var n=notes[i];var row=n.orphan?null:d.querySelector('[data-line="'+n.line+'"]');if(!row){orph.unshift(n);continue;}row.parentNode.insertBefore(mk(n),row.nextSibling);}
if(orph.length){var box=d.createElement('div');box.className='apuntes-huerfanos';var h=d.createElement('div');h.className='ap-h';h.textContent='¿Dónde iba esto?';box.appendChild(h);for(var j=0;j<orph.length;j++)box.appendChild(mk(orph[j]));(d.querySelector('.sheet')||d.body).appendChild(box);}
true;})();`;
}
