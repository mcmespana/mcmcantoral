/**
 * Semilla empaquetada del catálogo (`assets/cantoral/semilla.json`,
 * `02-datos-offline.md` §3.1). En el repo va la de desarrollo (vacía y marcada
 * `placeholder`); la de verdad la escribe `npm run snapshot:cantoral` antes de
 * cada build y OTA, y ese script falla si el cantoral llega vacío. Aquí se
 * comprueba que la que haya se parsea y, si no es la de desarrollo, que trae
 * canciones.
 */
import fs from 'fs';
import path from 'path';
import { countSongs, parseCatalog } from '@/services/catalog/logic';

const DIR = path.join(__dirname, '..', 'assets', 'cantoral');

it('la semilla existe y se parsea', () => {
  const catalog = parseCatalog(
    fs.readFileSync(path.join(DIR, 'semilla.json'), 'utf8'),
  );
  expect(catalog).not.toBeNull();
});

it('si no es la de desarrollo, trae al menos una categoría con canciones', () => {
  const meta = JSON.parse(
    fs.readFileSync(path.join(DIR, 'semilla.meta.json'), 'utf8'),
  );
  const catalog = parseCatalog(
    fs.readFileSync(path.join(DIR, 'semilla.json'), 'utf8'),
  );
  if (meta.placeholder) return;
  expect(countSongs(catalog?.songs?.data)).toBeGreaterThan(0);
  expect(meta.count).toBe(countSongs(catalog?.songs?.data));
});

it('los workflows de publicación generan la semilla antes de publicar', () => {
  const wf = path.join(__dirname, '..', '.github', 'workflows');
  for (const f of [
    'ota-preview.yml',
    'ota-production.yml',
    'deploy-web.yml',
    'eas-build.yml',
  ]) {
    expect(fs.readFileSync(path.join(wf, f), 'utf8')).toContain(
      'npm run snapshot:cantoral',
    );
  }
});
