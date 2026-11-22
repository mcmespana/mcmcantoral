/**
 * Seguir por sección: la lista del maestro sale de `buildSheet` y la hoja
 * marca cada sección con ese mismo índice (`data-i`), también cuando junta
 * estribillos repetidos en una sola (`data-n`).
 */
import { sectionsForCue, liveSectionScript } from '@/utils/liveSections';
import { buildSheet, renderSheetHtml } from '@/utils/songSheet';
import { parseChordPro } from '@/utils/songDocument';

const CHO = `{title: Prueba}
[C]Primera estrofa que [G]canta
[Am]todo el coro [F]junto

{soc}
[F]Estribillo [C]alegre
{eoc}

[C]Segunda estrofa que [G]canta
[Am]otra vez el [F]coro

{soc}
[F]Estribillo [C]alegre
{eoc}

{soc}
[F]Estribillo [C]alegre
{eoc}
`;

it('la lista de secciones para «Ahora hacemos…»', () => {
  const cues = sectionsForCue(CHO);
  expect(cues.map((c) => c.label)).toEqual([
    'Estrofa 1',
    'Estribillo',
    'Estrofa 2',
    'Estribillo · 2',
    'Estribillo · 3',
  ]);
  expect(cues.map((c) => c.index)).toEqual([0, 1, 2, 3, 4]);
  expect(sectionsForCue(undefined)).toEqual([]);
  expect(sectionsForCue('')).toEqual([]);
});

it('la hoja marca cada sección con su índice (y las repetidas juntas)', () => {
  const { song } = parseChordPro(CHO);
  const html = renderSheetHtml(buildSheet(song!, { notation: 'EN' }));
  expect(html).toContain('data-i="0"');
  expect(html).toContain('data-i="1"');
  expect(html).toContain('data-i="2"');
  // Los dos estribillos del final van en UNA sección: «×2».
  expect(html).toMatch(/data-i="3" data-n="2"/);
  expect(html).not.toContain('data-i="4"');
});

it('el script de resalte es JS válido y acotado a un entero', () => {
  expect(() => new Function(liveSectionScript(3))).not.toThrow();
  expect(liveSectionScript(2.7)).toContain('var n=2;');
});
