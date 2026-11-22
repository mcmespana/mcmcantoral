/**
 * @jest-environment jsdom
 */
/**
 * El pintor de partituras de la hoja (`ABC_DRAW_JS`) en un DOM de verdad,
 * con un abcjs de mentira (el de verdad mide texto con `getBBox`, que jsdom
 * no tiene): llama a `renderAbc` con el ABC decodificado y el transporte como
 * `visualTranspose`, enseña el ABC en texto si abcjs falla, y repinta lo que
 * cambia cuando se transporta sin recargar (`swapBodyScript`).
 */
import { renderSongDocument, type SongStyleState } from '@/utils/songDocument';
import { swapBodyScript } from '@/utils/songDisplayBridge';
import { ABC_DRAW_JS } from '@/utils/songSheetAbc';

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

const ABC = 'X:1\nL:1/8\nK:G\n"G"d2 dB B>c |]';
const cho = [
  '{title: Riff}',
  '[G]Letra de [C]prueba',
  '',
  '{start_of_abc: Trompeta}',
  ABC,
  '{end_of_abc}',
].join('\n');

const html = (t: number) =>
  renderSongDocument(cho, {
    style,
    currentTranspose: t,
    notation: 'EN',
    key: 'G',
  }).html;

/** Carga el documento como lo dejaría el WebView (sin ejecutar scripts). */
function load(source: string) {
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  document.documentElement.replaceWith(
    document.importNode(parsed.documentElement, true),
  );
}

const run = (js: string) => {
  (0, eval)(js);
};

type W = Window & { ABCJS?: unknown; __SONG_ABC__?: unknown };

/** abcjs de mentira: deja un `<svg>` donde se le pide. */
const fakeRender = (
  el: HTMLElement,
  _src: string,
  _opts: Record<string, unknown>,
) => {
  el.innerHTML = '<svg></svg>';
};

afterEach(() => {
  delete (window as W).ABCJS;
  delete (window as W).__SONG_ABC__;
});

it('pinta con renderAbc: ABC decodificado, visualTranspose y etiqueta', () => {
  const renderAbc = jest.fn(fakeRender);
  (window as W).ABCJS = { renderAbc };
  load(html(2));
  run(ABC_DRAW_JS);

  expect(renderAbc).toHaveBeenCalledTimes(1);
  const [box, src, opts] = renderAbc.mock.calls[0];
  expect(src).toBe(ABC);
  expect(opts).toMatchObject({ responsive: 'resize', visualTranspose: 2 });
  const marker = document.querySelector('.abc')!;
  expect(marker.contains(box)).toBe(true);
  expect(marker.querySelector('.abc-lbl')?.textContent).toBe('Trompeta');
  expect(marker.getAttribute('data-drawn')).toBe('1');
});

it('sin abcjs, enseña el ABC en texto', () => {
  load(html(0));
  run(ABC_DRAW_JS);
  expect(document.querySelector('.abc pre.abc-src')?.textContent).toBe(ABC);
});

it('al transportar sin recargar, repinta con el tono nuevo', async () => {
  const renderAbc = jest.fn(fakeRender);
  (window as W).ABCJS = { renderAbc };
  load(html(0));
  run(ABC_DRAW_JS);
  expect(renderAbc.mock.calls[0][2]).toMatchObject({ visualTranspose: 0 });

  run(swapBodyScript(html(-3)));
  // El MutationObserver avisa en una microtarea.
  await Promise.resolve();
  expect(renderAbc).toHaveBeenCalledTimes(2);
  expect(renderAbc.mock.calls[1][2]).toMatchObject({ visualTranspose: -3 });
});
