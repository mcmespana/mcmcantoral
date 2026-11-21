/** Comparación de versiones para la versión mínima (`cantoralConfig.minAppVersion`). */

/**
 * Compara dos versiones semver de forma tolerante (acepta `1.0.1`, `1.0.1-beta`, etc.)
 * Devuelve true si `appVersion` >= `minVersion`.
 */
export function isAppVersionSupported(
  appVersion: string,
  minVersion: string,
): boolean {
  // Sin minVersion (o "0.0.0") = sin bloqueo. Caso defensivo extra contra
  //   strings vacíos / undefined coercidos.
  if (!minVersion || minVersion === '0.0.0') return true;

  // Política "fail-open": si `minVersion` remoto es inválido (NaN, basura),
  // `parse()` devuelve [0,0,0] y la app NO bloquea al usuario. Decisión
  // intencional — un kill-switch corrupto no debe dejar a nadie fuera. El
  // bloqueo solo se aplica cuando hay un semver válido por encima de la
  // versión instalada.

  const parse = (v: string): [number, number, number] => {
    const safe = typeof v === 'string' && v.length > 0 ? v : '0.0.0';
    const clean = safe.split('-')[0].split('+')[0];
    const parts = clean.split('.').map((n) => {
      const parsed = parseInt(n, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
    while (parts.length < 3) parts.push(0);
    return [parts[0], parts[1], parts[2]];
  };
  const [a1, a2, a3] = parse(appVersion);
  const [m1, m2, m3] = parse(minVersion);
  if (a1 !== m1) return a1 > m1;
  if (a2 !== m2) return a2 > m2;
  return a3 >= m3;
}
