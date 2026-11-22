import {
  clampLongPressMs,
  createPedalGesture,
  createVolumeGesture,
  keyToAction,
  normalizeKeyCode,
  volumeAllowedRemotely,
  type PedalAction,
} from '@/utils/pedalKeys';

describe('mapeo de teclas', () => {
  it.each([
    'ArrowRight',
    'ArrowDown',
    'PageDown',
    'Space',
    'Enter',
    'NumpadEnter',
  ])('%s = next', (k) => expect(keyToAction(k)).toBe('next'));
  it.each(['ArrowLeft', 'ArrowUp', 'PageUp'])('%s = prev', (k) =>
    expect(keyToAction(k)).toBe('prev'),
  );
  it('ignora el resto de teclas', () => {
    expect(keyToAction('KeyA')).toBeNull();
    expect(keyToAction('Escape')).toBeNull();
    expect(keyToAction(null)).toBeNull();
  });
  it('normaliza códigos numéricos de iOS y Android y alias', () => {
    expect(normalizeKeyCode('79', 'ios')).toBe('ArrowRight');
    expect(normalizeKeyCode('78', 'ios')).toBe('PageDown');
    expect(normalizeKeyCode('21', 'android')).toBe('ArrowLeft');
    expect(normalizeKeyCode('93', 'android')).toBe('PageDown');
    expect(keyToAction('62', 'android')).toBe('next');
    expect(keyToAction('75', 'ios')).toBe('prev');
    expect(normalizeKeyCode(' ')).toBe('Space');
    expect(normalizeKeyCode('Right')).toBe('ArrowRight');
    expect(normalizeKeyCode('999', 'ios')).toBe('999');
    expect(normalizeKeyCode('79', 'web')).toBe('79');
  });
  it('acota la pulsación larga', () => {
    expect(clampLongPressMs(50)).toBe(300);
    expect(clampLongPressMs(99999)).toBe(1500);
    expect(clampLongPressMs('x')).toBe(600);
    expect(clampLongPressMs(800)).toBe(800);
  });
});

describe('pulsación corta y larga', () => {
  function setup(ms = 600) {
    jest.useFakeTimers();
    const out: PedalAction[] = [];
    const g = createPedalGesture({
      longPressMs: () => ms,
      onAction: (a) => out.push(a),
    });
    return { g, out };
  }
  afterEach(() => jest.useRealTimers());

  it('corta: sale al soltar', () => {
    const { g, out } = setup();
    g.press('ArrowRight');
    expect(out).toEqual([]);
    jest.advanceTimersByTime(200);
    g.release('ArrowRight');
    expect(out).toEqual(['next']);
  });
  it('larga: sale al umbral y no se repite al soltar', () => {
    const { g, out } = setup();
    g.press('PageUp');
    jest.advanceTimersByTime(599);
    expect(out).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(out).toEqual(['prevSong']);
    g.release('PageUp');
    expect(out).toEqual(['prevSong']);
  });
  it('larga hacia delante', () => {
    const { g, out } = setup(400);
    g.press('Enter');
    jest.advanceTimersByTime(400);
    expect(out).toEqual(['nextSong']);
  });
  it('ignora repeticiones del teclado y teclas que no son del pedal', () => {
    const { g, out } = setup();
    g.press('ArrowRight');
    g.press('ArrowRight');
    g.press('ArrowRight');
    g.press('KeyA');
    g.release('KeyA');
    g.release('ArrowRight');
    expect(out).toEqual(['next']);
  });
  it('umbral 0 desactiva la larga: sale al pulsar', () => {
    const { g, out } = setup(0);
    g.press('Space');
    expect(out).toEqual(['next']);
    g.press('Space');
    g.release('Space');
    expect(out).toEqual(['next']);
  });
  it('cancel descarta la pulsación pendiente', () => {
    const { g, out } = setup();
    g.press('ArrowLeft');
    g.cancel();
    jest.advanceTimersByTime(2000);
    g.release('ArrowLeft');
    expect(out).toEqual([]);
  });
});

describe('volumen como pedal', () => {
  function setup() {
    const set = jest.fn();
    const g = createVolumeGesture({ setVolume: set });
    return { g, set };
  }

  it('subir = next, bajar = prev, y re-centra a 0,5 tras cada una', () => {
    const { g, set } = setup();
    g.recenter();
    expect(set).toHaveBeenLastCalledWith(0.5);
    expect(g.onVolume(0.5)).toBeNull(); // eco del re-centrado inicial
    expect(g.onVolume(0.5625)).toBe('next');
    expect(set).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenLastCalledWith(0.5);
    expect(g.onVolume(0.5)).toBeNull(); // eco ignorado
    expect(g.onVolume(0.4375)).toBe('prev');
    expect(set).toHaveBeenCalledTimes(3);
  });

  it('iOS con el volumen al tope: tras activar queda a media escala y «subir» llega', () => {
    const { g, set } = setup();
    g.recenter(); // el sistema estaba a 1.0; lo dejamos en 0.5
    expect(set).toHaveBeenCalledWith(0.5);
    expect(g.onVolume(0.5)).toBeNull();
    expect(g.onVolume(0.5625)).toBe('next');
  });

  it('varias pulsaciones seguidas antes del eco no se pierden', () => {
    const { g } = setup();
    g.recenter();
    expect(g.onVolume(0.5625)).toBe('next'); // sin eco intermedio
    expect(g.onVolume(0.4375)).toBe('prev');
  });

  it('en el último escalón (Android 1/15) también detecta la dirección', () => {
    const { g } = setup();
    g.recenter();
    g.onVolume(0.5);
    expect(g.onVolume(0.5 + 1 / 15)).toBe('next');
    g.onVolume(0.5);
    expect(g.onVolume(0.5 - 1 / 15)).toBe('prev');
  });

  it('ignora valores no numéricos', () => {
    const { g } = setup();
    expect(g.onVolume(NaN)).toBeNull();
  });
});

describe('interruptor remoto', () => {
  const cfg = { volumeButtons: { ios: false, android: true } };
  it('por plataforma', () => {
    expect(volumeAllowedRemotely(cfg, 'ios')).toBe(false);
    expect(volumeAllowedRemotely(cfg, 'android')).toBe(true);
    expect(volumeAllowedRemotely(cfg, 'web')).toBe(false);
  });
});
