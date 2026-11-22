/**
 * Un reloj que solo late mientras hace falta (avisos que caducan, cuentas
 * atrás). Vive en el componente que lo pinta: un tic por segundo en un
 * contexto repintaría toda la app.
 */
import { useEffect, useState } from 'react';

export function useNow(active: boolean, everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [active, everyMs]);
  return now;
}
