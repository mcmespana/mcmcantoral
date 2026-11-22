/**
 * La función del admin por código (`functions/logic.js`): el código se
 * compara en el servidor por su huella, sin mayúsculas ni espacios, y con
 * 5 intentos por hora y dispositivo.
 */
import * as logicModule from '../functions/logic';

const logic = logicModule as unknown as {
  MAX_ATTEMPTS: number;
  WINDOW_MS: number;
  hashCode: (c: string) => string;
  readHashes: (raw: unknown) => string[];
  codeMatches: (c: unknown, hashes: string[]) => boolean;
  countAttempt: (
    prev: unknown,
    now: number,
  ) => { allowed: boolean; next: { count: number; since: number } };
};

it('la huella es SHA-256 del código normalizado', () => {
  expect(logic.hashCode('prueba')).toBe(
    '655e786674d9d3e77bc05ed1de37b4b6bc89f788829f9f3c679e7687b410c89b',
  );
  expect(logic.hashCode('  PRUEBA ')).toBe(logic.hashCode('prueba'));
});

it('solo vale un código cuya huella esté guardada', () => {
  const hashes = logic.readHashes({
    izan: logic.hashCode('villancicos2026'),
    roto: 'no-es-una-huella',
    num: 3,
  });
  expect(hashes).toHaveLength(1);
  expect(logic.codeMatches('Villancicos2026 ', hashes)).toBe(true);
  expect(logic.codeMatches('villancicos2025', hashes)).toBe(false);
  expect(logic.codeMatches('', hashes)).toBe(false);
  expect(logic.codeMatches(undefined, hashes)).toBe(false);
  expect(logic.codeMatches('x', [])).toBe(false);
  expect(logic.readHashes([logic.hashCode('a'), null])).toHaveLength(1);
  expect(logic.readHashes(null)).toEqual([]);
});

it('5 intentos por hora; luego, a esperar', () => {
  let prev: unknown = null;
  const t0 = 1_000_000;
  for (let i = 0; i < logic.MAX_ATTEMPTS; i++) {
    const r = logic.countAttempt(prev, t0 + i);
    expect(r.allowed).toBe(true);
    prev = r.next;
  }
  expect(logic.countAttempt(prev, t0 + 10).allowed).toBe(false);
  // Pasada la hora, se vuelve a poder.
  const later = logic.countAttempt(prev, t0 + logic.WINDOW_MS);
  expect(later.allowed).toBe(true);
  expect(later.next.count).toBe(1);
  // Lo guardado con mala forma no bloquea a nadie.
  expect(logic.countAttempt({ count: 'x' }, t0).allowed).toBe(true);
});
