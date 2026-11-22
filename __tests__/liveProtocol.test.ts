/**
 * Protocolo del directo (`services/live/protocol.ts`, `04-directo.md` §3):
 * lo último manda por `seq`, los duplicados de los dos caminos no cuentan,
 * los avisos dirigidos solo los ve su instrumento, y el relevo lo gana
 * siempre el mismo maestro.
 */
import {
  EMPTY_VIEW,
  agregarReacciones,
  avisosVivos,
  contentHash,
  defaultTransports,
  initialState,
  isValidPin,
  liveReducer,
  logSong,
  nextState,
  pinHash,
  presenceSummary,
  relayWinner,
  stepIndex,
  summarize,
  type Aviso,
  type LiveState,
} from '@/services/live/protocol';
import { readCloudExtras } from '@/services/live/cloud';

const base = (): LiveState =>
  initialState({
    sessionId: 's1',
    repertorio: {
      id: 'r',
      name: 'Misa',
      items: [
        { category: 'a', filename: '1.cho' },
        { category: 'a', filename: '2.cho' },
        { category: 'a', filename: '3.cho' },
      ],
    },
    by: { deviceId: 'm1' },
    catalogUpdatedAt: 5,
    transports: ['cloud'],
    now: 100,
  });

const aviso = (id: string, extra: Partial<Aviso> = {}): Aviso => ({
  t: 'aviso',
  id,
  kind: 'cinta',
  text: '¡Más fuerte!',
  ttlMs: 8000,
  from: 'm1',
  at: 1000,
  ...extra,
});

describe('liveReducer: el estado', () => {
  it('lo último manda por seq; lo viejo o repetido no entra', () => {
    const s1 = base();
    const s2 = nextState(s1, { index: 1 }, { deviceId: 'm1' }, 200);
    let v = liveReducer(EMPTY_VIEW, { type: 'state', state: s2 }, 0);
    expect(v.state?.index).toBe(1);
    // El viejo llega tarde por el otro camino: no se vuelve atrás.
    v = liveReducer(v, { type: 'state', state: s1 }, 0);
    expect(v.state?.seq).toBe(2);
    // El mismo dos veces: no cambia nada (misma identidad).
    expect(liveReducer(v, { type: 'state', state: s2 }, 0)).toBe(v);
  });

  it('mismo seq con instante posterior (relevo de maestro) sí entra', () => {
    const s = base();
    const v = liveReducer(EMPTY_VIEW, { type: 'state', state: s }, 0);
    const relay = { ...s, at: s.at + 1, by: { deviceId: 'm2' } };
    expect(
      liveReducer(v, { type: 'state', state: relay }, 0).state?.by.deviceId,
    ).toBe('m2');
  });

  it('otro directo (otra sessionId) entra aunque su seq sea menor', () => {
    const v = liveReducer(
      EMPTY_VIEW,
      { type: 'state', state: { ...base(), seq: 50 } },
      0,
    );
    const other = { ...base(), sessionId: 's2', seq: 1 };
    expect(
      liveReducer(v, { type: 'state', state: other }, 0).state?.sessionId,
    ).toBe('s2');
  });
});

describe('liveReducer: avisos, reacciones y fin', () => {
  it('un aviso que llega por los dos caminos cuenta una vez', () => {
    let v = liveReducer(EMPTY_VIEW, { type: 'event', event: aviso('a1') }, 0);
    v = liveReducer(v, { type: 'event', event: aviso('a1') }, 0);
    expect(v.avisos).toHaveLength(1);
  });

  it('se recuerdan como mucho 20 avisos', () => {
    let v = EMPTY_VIEW;
    for (let i = 0; i < 25; i++) {
      v = liveReducer(
        v,
        { type: 'event', event: aviso(`a${i}`, { at: i }) },
        0,
      );
    }
    expect(v.avisos).toHaveLength(20);
    expect(v.avisos[0].id).toBe('a5');
  });

  it('reacciones: dedupe y ventana de un minuto', () => {
    const r = { t: 'reaccion' as const, e: '🔥', from: 'x', at: 1000 };
    let v = liveReducer(EMPTY_VIEW, { type: 'event', event: r }, 1000);
    v = liveReducer(v, { type: 'event', event: r }, 1000);
    expect(v.reacciones).toHaveLength(1);
    v = liveReducer(
      v,
      { type: 'event', event: { ...r, at: 70_000, from: 'y' } },
      70_000,
    );
    expect(v.reacciones.map((x) => x.from)).toEqual(['y']);
  });

  it('fin marca el directo como terminado', () => {
    expect(
      liveReducer(EMPTY_VIEW, { type: 'event', event: { t: 'fin', at: 1 } }, 0)
        .ended,
    ).toBe(true);
  });
});

it('avisos dirigidos: solo los ve su instrumento; caducan', () => {
  const avisos = [
    aviso('t', { to: 'todos' }),
    aviso('b', { to: 'bajo', text: 'Bajos: fuera' }),
  ];
  expect(avisosVivos(avisos, 2000, ['guitarra']).map((a) => a.id)).toEqual([
    't',
  ]);
  expect(avisosVivos(avisos, 2000, ['bajo']).map((a) => a.id)).toEqual([
    't',
    'b',
  ]);
  expect(avisosVivos(avisos, 1000 + 8000, ['bajo'])).toEqual([]);
});

it('reacciones agregadas: las más numerosas primero, máx. 5', () => {
  const rs = ['🔥', '🔥', '👏', '🎄', '❤️', '😂', '🙌', '🔥'].map((e, i) => ({
    t: 'reaccion' as const,
    e,
    from: `p${i}`,
    at: 1000,
  }));
  const agg = agregarReacciones(rs, 2000);
  expect(agg[0]).toEqual({ e: '🔥', n: 3 });
  expect(agg).toHaveLength(5);
  expect(agregarReacciones(rs, 20_000)).toEqual([]);
});

it('stepIndex no se sale del repertorio', () => {
  const s = base();
  expect(stepIndex(s, 1)).toBe(0);
  expect(stepIndex({ ...s, index: 2 }, 1)).toBe(2);
  expect(stepIndex({ ...s, index: 0 }, -1)).toBe(0);
});

it('por dónde va el directo, según la conexión de quien dirige (D-23)', () => {
  expect(defaultTransports({ isWifi: false, internet: true })).toEqual([
    'cloud',
  ]);
  expect(defaultTransports({ isWifi: true, internet: false })).toEqual([
    'local',
  ]);
  expect(defaultTransports({ isWifi: true, internet: true })).toEqual([
    'local',
    'cloud',
  ]);
});

it('PIN de 4 cifras con huella por sesión', () => {
  expect(isValidPin('0704')).toBe(true);
  expect(isValidPin('123')).toBe(false);
  expect(pinHash('0704', 's1')).toBe(pinHash(' 0704 ', 's1'));
  expect(pinHash('0704', 's1')).not.toBe(pinHash('0704', 's2'));
  expect(contentHash('a')).not.toBe(contentHash('b'));
});

it('relevo: gana el maestro vivo más antiguo, el mismo para todos', () => {
  const now = 100_000;
  const masters = [
    { deviceId: 'b', joinedAt: 2, lastSeen: now },
    { deviceId: 'a', joinedAt: 1, lastSeen: now - 60_000 }, // caído
    { deviceId: 'c', joinedAt: 2, lastSeen: now },
    { deviceId: 'srv', joinedAt: 0, lastSeen: now },
  ];
  expect(relayWinner(masters, 'srv', now)).toBe('b');
  expect(relayWinner([], null, now)).toBeNull();
});

it('presencia: los vistos en el último minuto, por instrumento y camino', () => {
  const sum = presenceSummary(
    {
      a: { inst: ['voz'], via: 'local', at: 1000 },
      b: { inst: ['voz', 'guitarra'], at: 1000 },
      c: { at: -100_000 },
    },
    2000,
  );
  expect(sum.total).toBe(2);
  expect(sum.byInstrument).toEqual({ voz: 2, guitarra: 1 });
  expect(sum.byVia).toEqual({ local: 1, cloud: 1 });
});

it('resumen: cada canción con su duración real', () => {
  const song = (f: string) => ({
    category: 'a',
    filename: f,
    contentHash: 'x',
  });
  let log = logSong([], song('1.cho'), 0);
  log = logSong(log, song('1.cho'), 10); // misma: nada
  log = logSong(log, song('2.cho'), 180_000);
  log = logSong(log, null, 360_000);
  const s = summarize(log, 400_000);
  expect(s.songs).toBe(2);
  expect(s.entries.map((e) => e.ms)).toEqual([180_000, 180_000]);
});

it('readCloudExtras saca lo del protocolo y tolera una sesión de MCM App', () => {
  expect(readCloudExtras({ v: 1, current: {} })).toMatchObject({
    state: null,
    avisos: [],
    reacciones: [],
    masterPinHash: null,
  });
  const x = readCloudExtras({
    state: base(),
    avisos: { a1: aviso('a1'), basura: 3 },
    reacciones: { p: { t: 'reaccion', e: '🔥', from: 'p', at: 1 } },
    masterPinHash: 'h',
  });
  expect(x.state?.seq).toBe(1);
  expect(x.avisos).toHaveLength(1);
  expect(x.reacciones).toHaveLength(1);
  expect(x.masterPinHash).toBe('h');
});
