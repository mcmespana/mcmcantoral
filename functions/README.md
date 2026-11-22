# Funciones de MCM Cantoral

Solo `claimCantoralAdmin` (admin por código, `docs/planes/fork-cantoral/06-administracion.md`).
Van en su propio **codebase `cantoral`**: desplegarlas no toca las de MCM App.

## Ponerlo en marcha (una vez)

1. Consola de Firebase → Authentication → **activar «Anónimo»**.
2. Elegir el código y sacar su huella: `node functions/hash-code.js "el código"`.
   Pegarla en la base de datos en `/_config/cantoral/adminCodeHashes/<nombre>`
   (se pueden tener varias; para cambiar el código, cambiar la huella).
3. Reglas (son de `mcmapp`, se cambian allí):
   - `/_config/cantoral`: `.read: false`, `.write: false` (solo la función).
   - `users/$uid/isAdmin`: `.read: auth.uid === $uid`, `.write: false`.
4. Desplegar: `cd functions && npm install && cd .. &&
npx firebase-tools deploy --only functions:cantoral --project <proyecto>`.

## Quitar a un administrador

Borrar `users/<uid>/isAdmin` (la lista de concedidos está en
`/_config/cantoral/admins`), o cambiar el código: los ya concedidos siguen
hasta que se borre su marca.
