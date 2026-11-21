import { Redirect } from 'expo-router';

/**
 * `/` entra directo en el cantoral: MCM Cantoral no tiene pestañas ni Inicio
 * aparte (T-05). Las rutas `/cancionero/*` se conservan tal cual para que
 * enlaces, `CANTORAL_BASE` y tests sigan valiendo.
 */
export default function Index() {
  return <Redirect href="/cancionero" />;
}
