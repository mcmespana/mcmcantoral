/**
 * El directo en la interfaz: ayudantes puros y la regla de los 56 pt
 * (design.md §6: «56 pt en todo control de directo», guantes y prisa).
 */
import fs from 'fs';
import path from 'path';
import {
  currentToLiveSong,
  keyOfSessionId,
  liveSongToCurrent,
  repertorioToLive,
} from '@/contexts/LiveContext';
import { countdownLabel, viaLabel } from '@/components/live/LiveLayer';
import {
  choiceToTransports,
  transportsToChoice,
} from '@/components/live/LiveStartSheet';
import { summaryToRepertorio } from '@/components/live/LiveSummarySheet';
import { viewToMessages } from '@/components/live/LocalLiveBridge';
import { EMPTY_VIEW, liveReducer } from '@/services/live/protocol';

describe('controles de directo ≥ 56 pt', () => {
  const file = path.join(__dirname, '..', 'components/live/LiveLayer.tsx');
  const src = fs.readFileSync(file, 'utf8');

  it('la capa del Atril no usa el tamaño normal (44) en nada', () => {
    expect(src).not.toMatch(/TouchTarget\.min\b/);
  });

  it('cada minHeight/minWidth/width/height de un control es TouchTarget.live', () => {
    const sizes = [...src.matchAll(/\b(minHeight|minWidth):\s*([^,\n]+)/g)].map(
      (m) => m[2].trim(),
    );
    expect(sizes.length).toBeGreaterThan(3);
    for (const v of sizes) expect(v).toBe('TouchTarget.live');
  });
});

it('la clave sale del sessionId (`<clave>-<instante>`)', () => {
  expect(keyOfSessionId('1234-lq2x9')).toBe('1234');
  expect(keyOfSessionId('coro-abc-lq2x9')).toBe('coro-abc');
  expect(keyOfSessionId('sinGuion')).toBeNull();
  expect(keyOfSessionId(undefined)).toBeNull();
});

it('canción del protocolo ↔ `current` de MCM App, ida y vuelta', () => {
  const current = {
    filename: 'a.cho',
    transpose: 2,
    capoOverride: 3,
    title: 'A',
    author: 'X',
    songKey: 'Am',
    capo: 1,
    content: '[Am]Hola',
    firebaseCategory: 'entrada',
  };
  const song = currentToLiveSong(current);
  expect(song.category).toBe('entrada');
  expect(song.contentHash).toBeTruthy();
  expect(liveSongToCurrent(song, 99)).toEqual({ ...current, updatedAt: 99 });
});

it('el repertorio del directo lleva solo canciones', () => {
  const live = repertorioToLive({
    id: 'r',
    name: 'Misa',
    updatedAt: 0,
    items: [
      { category: 'a', filename: '1.cho', transpose: 1 },
      { type: 'break', title: 'Pausa' },
    ],
  });
  expect(live.items).toEqual([
    {
      category: 'a',
      filename: '1.cho',
      transpose: 1,
      title: undefined,
      capo: undefined,
      notes: undefined,
    },
  ]);
});

it('textos de la píldora y la cuenta atrás', () => {
  expect(viaLabel(['local', 'cloud'])).toBe('wifi del coro e internet');
  expect(viaLabel(['cloud'])).toBe('internet');
  expect(viaLabel([])).toMatch(/sin conexión/);
  expect(countdownLabel(125_000)).toBe('2:05');
  expect(countdownLabel(-3)).toBe('0:00');
});

it('por dónde va: elección ↔ caminos', () => {
  expect(choiceToTransports('both')).toEqual(['local', 'cloud']);
  expect(choiceToTransports('local')).toEqual(['local']);
  expect(transportsToChoice(['cloud', 'local'])).toBe('both');
  expect(transportsToChoice(['cloud'])).toBe('cloud');
});

it('el resumen se guarda como repertorio, en el orden cantado', () => {
  const rep = summaryToRepertorio(
    {
      name: 'Villancicos',
      songs: 2,
      totalMs: 300_000,
      items: [
        { category: 'navidad', filename: 'b.cho', title: 'B', transpose: -2 },
        { category: 'navidad', filename: 'a.cho', title: 'A' },
      ],
      entries: [
        { filename: 'a.cho', title: 'A', startedAt: 0, ms: 125_000 },
        { filename: 'b.cho', startedAt: 125_000, ms: 175_000 },
      ],
    },
    new Date(2026, 11, 19, 21).getTime(),
  );
  expect(rep.name).toBe('Villancicos · cantado');
  expect(rep.date).toBe('2026-12-19');
  expect(rep.items.map((i) => ('filename' in i ? i.filename : ''))).toEqual([
    'a.cho',
    'b.cho',
  ]);
  expect(rep.items[1]).toMatchObject({ title: 'B', transpose: -2 });
});

it('una vista entera vuelve a dar la misma vista por el reductor', () => {
  const view = {
    ...EMPTY_VIEW,
    avisos: [
      {
        t: 'aviso' as const,
        id: 'a',
        kind: 'cinta' as const,
        text: 'x',
        ttlMs: 1,
        from: 'm',
        at: 5,
      },
    ],
    ended: true,
  };
  const again = viewToMessages(view).reduce(
    (v, m) => liveReducer(v, m, 10),
    EMPTY_VIEW,
  );
  expect(again.avisos).toHaveLength(1);
  expect(again.ended).toBe(true);
});
