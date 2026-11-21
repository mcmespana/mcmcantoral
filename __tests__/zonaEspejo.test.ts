/**
 * La zona espejo (`scripts/upstream/zona-espejo.txt`) es lo que se mantiene
 * igual que en MCM App para poder portar con parches en los dos sentidos
 * (`docs/DIVERGENCIAS.md` §2 y §4). Si un fichero de la lista desaparece o se
 * renombra, el diff con upstream deja de mirarlo en silencio: aquí se cae.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const LIST = path.join(ROOT, 'scripts', 'upstream', 'zona-espejo.txt');

function entries(): string[] {
  return fs
    .readFileSync(LIST, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

it('la lista existe y no está vacía', () => {
  expect(entries().length).toBeGreaterThan(10);
});

it.each(entries())('%s existe', (ruta) => {
  expect(fs.existsSync(path.join(ROOT, ruta))).toBe(true);
});

it('DIVERGENCIAS.md apunta a la lista', () => {
  const doc = fs.readFileSync(
    path.join(ROOT, 'docs', 'DIVERGENCIAS.md'),
    'utf8',
  );
  expect(doc).toContain('scripts/upstream/zona-espejo.txt');
});
