/**
 * Partituras ABC en la hoja (`05-apuntes-y-partituras.md` §5, tarea 5.5):
 * `{start_of_abc}` … `{end_of_abc}` sale como un marcador que pinta abcjs
 * dentro del documento, siguiendo el tono de la canción. Lo que se blinda:
 *
 *  - una canción SIN ABC queda exactamente igual (ni CSS ni abcjs de más);
 *  - el bloque llega entero (con sus `"`, `<` y `>`) y en su sitio, sin
 *    tocar la numeración ni el mapa;
 *  - el transporte llega como `data-tr` → `visualTranspose`;
 *  - el abcjs en línea es el instalado y se puede meter en un `<script>`.
 */
import fs from 'fs';
import path from 'path';
import {
  parseChordPro,
  renderSongDocument,
  type SongStyleState,
} from '@/utils/songDocument';
import {
  buildSheet,
  renderSheetHtml,
  renderSongMapHtml,
  sheetHasAbc,
  type SheetModel,
} from '@/utils/songSheet';
import {
  ABC_CSS,
  ABC_DRAW_JS,
  abcSheetCss,
  abcSheetScripts,
} from '@/utils/songSheetAbc';
import { ABCJS_JS, ABCJS_VERSION } from '@/utils/songSheetAbcjs';
import { canSwapInPlace } from '@/utils/songDisplayBridge';

const style: SongStyleState = {
  fontSize: 1,
  fontFamily: 'system-ui',
  isDark: false,
  chordsVisible: true,
  arrangementsVisible: true,
  compact: false,
  verseNumbers: true,
  chorusStyle: 'negrita',
  chorusLabel: true,
  airy: false,
  paged: false,
  topPadding: 16,
  bottomPadding: 40,
};

const RIFF = ['X:1', 'L:1/8', 'K:G', '"G"d2 dB c2 cA | B>c [K:D] !>!G4 |]'];

const BASE = [
  '{title: Prueba}',
  '1. [G]Primera [C]estrofa de la canción',
  '[D]que sigue aquí',
  '',
  '{soc}',
  '[C]Estribillo de [G]prueba',
  '{eoc}',
  '',
  '2. [G]Segunda [C]estrofa de la canción',
  '',
  '{chorus}',
].join('\n');

const WITH_ABC_AT_END = [
  BASE,
  '',
  '{start_of_abc: Trompeta}',
  ...RIFF,
  '{end_of_abc}',
].join('\n');

function model(cho: string): SheetModel {
  const { song } = parseChordPro(cho);
  return buildSheet(song!, { notation: 'EN' });
}

const doc = (cho: string, transpose = 0, extra = {}) =>
  renderSongDocument(cho, {
    style,
    currentTranspose: transpose,
    notation: 'EN',
    key: 'G',
    ...extra,
  });

describe('canción sin ABC', () => {
  it('no lleva ni abcjs, ni su CSS, ni marcadores', () => {
    for (const extra of [{}, { isFullscreen: true }, { adminMode: true }]) {
      const { html } = doc(BASE, 2, extra);
      expect(html).not.toContain('class="abc"');
      expect(html).not.toContain('data-abc');
      expect(html).not.toContain('ABCJS');
      expect(html).not.toContain('.abc ');
    }
    expect(abcSheetCss(false)).toBe('');
    expect(abcSheetScripts(false)).toBe('');
    expect(sheetHasAbc(model(BASE))).toBe(false);
  });

  it('un bloque ABC al final solo AÑADE: quitándolo, el HTML es el de siempre', () => {
    for (const t of [0, 3]) {
      for (const extra of [{}, { isFullscreen: true }, { lineNotes: true }]) {
        const plain = doc(BASE, t, extra);
        const abc = doc(WITH_ABC_AT_END, t, extra);
        const stripped = abc.html
          .replace(ABC_CSS, '')
          .replace(abcSheetScripts(true), '')
          .replace(
            /<section class="sec note[^"]*" data-i="\d+">.*?<\/section>/,
            '',
          );
        expect(stripped).toBe(plain.html);
        expect(abc.sheetInfo).toEqual(plain.sheetInfo);
      }
    }
  });
});

describe('buildSheet — bloques ABC', () => {
  it('el bloque sale como sección propia, sin escapar y con su etiqueta', () => {
    const m = model(
      [
        '1. [G]Primera',
        '',
        '{start_of_abc: Trompeta}',
        ...RIFF,
        '{end_of_abc}',
        '',
        '2. [G]Segunda',
      ].join('\n'),
    );
    expect(m.sections.map((s) => s.kind)).toEqual(['verse', 'note', 'verse']);
    expect(m.sections.map((s) => s.number)).toEqual([1, null, 2]);
    const [line] = m.sections[1].lines;
    expect(line).toMatchObject({
      kind: 'abc',
      abc: RIFF.join('\n'),
      label: 'Trompeta',
    });
    expect(sheetHasAbc(m)).toBe(true);
  });

  it('sin etiqueta y pegados, dos bloques son dos partituras', () => {
    const m = model(
      [
        '{start_of_abc}',
        'X:1',
        'K:C',
        'CDEF|',
        '{end_of_abc}',
        '{start_of_abc}',
        'X:1',
        'K:D',
        'DEFG|',
        '{end_of_abc}',
      ].join('\n'),
    );
    const abcs = m.sections.flatMap((s) =>
      s.lines.filter((l) => l.kind === 'abc'),
    );
    expect(abcs.map((l) => (l.kind === 'abc' ? l.abc : ''))).toEqual([
      'X:1\nK:C\nCDEF|',
      'X:1\nK:D\nDEFG|',
    ]);
    expect(abcs.every((l) => l.kind === 'abc' && l.label === null)).toBe(true);
  });

  it('justo debajo de «{c: Intro}», el riff es la intro', () => {
    const m = model(
      [
        '{c: Intro}',
        '{start_of_abc}',
        ...RIFF,
        '{end_of_abc}',
        '',
        '[G]Letra',
      ].join('\n'),
    );
    expect(m.sections[0]).toMatchObject({
      kind: 'instrumental',
      label: 'Intro',
    });
    expect(m.sections[0].lines[0].kind).toBe('abc');
    expect(m.sections[1].label).toBeNull();
  });

  it('no entra en el mapa ni cambia los números', () => {
    const plain = renderSongMapHtml(model(BASE));
    expect(renderSongMapHtml(model(WITH_ABC_AT_END))).toBe(plain);
  });
});

describe('renderSheetHtml — marcador', () => {
  const m = model(WITH_ABC_AT_END);

  it('una línea, ABC codificado, etiqueta y sin data-line', () => {
    const html = renderSheetHtml(m, { lineNumbers: true });
    const marker = html.match(/<div class="abc"[^>]*><\/div>/)?.[0] ?? '';
    expect(marker).not.toBe('');
    expect(marker).not.toContain('\n');
    expect(marker).not.toContain('data-line');
    expect(marker).toContain('data-label="Trompeta"');
    const enc = marker.match(/data-abc="([^"]*)"/)![1];
    expect(decodeURIComponent(enc)).toBe(RIFF.join('\n'));
    expect(marker).not.toContain('data-tr');
  });

  it('el transporte llega como data-tr', () => {
    expect(renderSheetHtml(m, { abcTranspose: -2 })).toContain('data-tr="-2"');
  });
});

describe('documento con ABC', () => {
  it('lleva abcjs, el pintor, el CSS y el transporte', () => {
    const { html } = doc(WITH_ABC_AT_END, 2);
    expect(html).toContain(ABC_CSS);
    expect(html).toContain(`<script>${ABCJS_JS}</script>`);
    expect(html).toContain(`<script>${ABC_DRAW_JS}</script>`);
    expect(html).toContain('data-tr="2"');
    expect(ABC_DRAW_JS).toContain('visualTranspose: tr');
    expect(ABC_DRAW_JS).toContain("responsive: 'resize'");
  });

  it('transponer no cambia la carcasa: se pinta encima sin recargar', () => {
    expect(
      canSwapInPlace(
        doc(WITH_ABC_AT_END, 0).html,
        doc(WITH_ABC_AT_END, 5).html,
        true,
      ),
    ).toBe(true);
  });
});

describe('abcjs en línea', () => {
  it('es la versión instalada (si no: npm run build:abcjs)', () => {
    const pkg = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '..', 'node_modules', 'abcjs', 'package.json'),
        'utf8',
      ),
    );
    expect(ABCJS_VERSION).toBe(pkg.version);
    expect(ABCJS_JS).toContain(`abcjs-basic v${ABCJS_VERSION}`);
  });

  it('se puede meter en un <script> (ni «</script» ni «<!--»)', () => {
    expect(ABCJS_JS).not.toMatch(/<\/script/i);
    expect(ABCJS_JS).not.toContain('<!--');
    expect(ABC_DRAW_JS).not.toMatch(/<\/script/i);
  });
});
