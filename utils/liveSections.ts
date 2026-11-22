/**
 * Seguir por sección (`04-directo.md` §10.1). Quien dirige elige en la lista
 * de secciones de la canción la que viene («Estribillo», «Estrofa 2»,
 * «Puente»…) aunque no toque por orden; a quien sigue se le resalta y se le
 * lleva hasta ella. Los índices son los de `buildSheet`, que la hoja marca en
 * cada `<section data-i>` (zona espejo, `utils/songSheet.ts`).
 */
import { buildSheet, type SheetSection } from '@/utils/songSheet';
import { parseChordPro } from '@/utils/songDocument';

export interface LiveSectionCue {
  index: number;
  label: string;
}

function baseLabel(s: SheetSection): string | null {
  if (s.label) return s.label;
  switch (s.kind) {
    case 'verse':
      return s.number ? `Estrofa ${s.number}` : 'Estrofa';
    case 'chorus':
      return 'Estribillo';
    case 'bridge':
      return 'Puente';
    case 'instrumental':
      return 'Instrumental';
    default:
      return null;
  }
}

/** Las secciones de una canción para el «Ahora hacemos…» del maestro. */
export function sectionsForCue(content: string | undefined): LiveSectionCue[] {
  if (!content) return [];
  try {
    const { song } = parseChordPro(content);
    if (!song) return [];
    const model = buildSheet(song, { notation: 'EN' });
    const seen = new Map<string, number>();
    const out: LiveSectionCue[] = [];
    model.sections.forEach((s, index) => {
      const label = baseLabel(s);
      if (!label) return;
      const n = (seen.get(label) ?? 0) + 1;
      seen.set(label, n);
      out.push({ index, label: n > 1 ? `${label} · ${n}` : label });
    });
    return out;
  } catch {
    return [];
  }
}

/**
 * JS que resalta la sección `index` (y la lleva a la vista si la persona no
 * está desplazando a mano). `index < 0` quita el resalte.
 */
export function liveSectionScript(index: number): string {
  return `(function(){var n=${Math.trunc(index)};var d=document;if(!d.getElementById('live-now-style')){var st=d.createElement('style');st.id='live-now-style';st.textContent='section.sec.live-now{box-shadow:0 0 0 3px var(--sh-chord);border-radius:8px}';d.head.appendChild(st);var mark=function(){window.__liveTouch=Date.now();};d.addEventListener('touchstart',mark,{passive:true});d.addEventListener('wheel',mark,{passive:true});}var els=d.querySelectorAll('section.sec[data-i]');var best=null;for(var k=0;k<els.length;k++){var e=els[k];e.classList.remove('live-now');var i=+e.getAttribute('data-i');var c=+(e.getAttribute('data-n')||1);if(n>=i&&n<i+c)best=e;}if(best){best.classList.add('live-now');if(!window.__liveTouch||Date.now()-window.__liveTouch>4000)best.scrollIntoView({block:'center',behavior:'smooth'});}true;})();`;
}
