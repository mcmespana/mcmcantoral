#!/usr/bin/env node
/**
 * Genera `utils/songSheetAbcjs.ts`: el pintor de partituras ABC (abcjs) como
 * una cadena de JS, para meterlo INLINE en el HTML de la hoja de canción
 * (`utils/songDocument.ts`) solo cuando la canción trae `{start_of_abc}`.
 *
 *   npm run build:abcjs            # regenera el módulo
 *   npm run build:abcjs -- --check # falla si el módulo no está al día
 *
 * Por qué así: la hoja es un documento HTML suelto (WebView en nativo,
 * iframe `srcDoc` en web y la vista previa del admin del cantoral) que tiene
 * que funcionar SIN RED, así que nada de CDN. En React Native no hay `fs` en
 * tiempo de ejecución para leer `node_modules/abcjs/dist/*.js`, y pasarlo
 * como asset obligaría a leerlo de forma asíncrona y distinta en cada
 * plataforma. Un módulo TS con el minificado como cadena lo empaqueta Metro
 * (y esbuild en `build:sheet-bundle`) sin hacer nada más, y es síncrono.
 *
 * Solo se empaqueta `renderAbc` (`abcjs/src/api/abc_tunebook_svg`), no el
 * `abcjs-basic-min.js` entero: sin el editor ni los controles del
 * sintetizador (~60 KB menos). Para escuchar el riff (▶) habría que añadir
 * `synth` a la entrada y una soundfont empaquetada.
 *
 * El módulo generado se commitea: `abcjs` es solo dependencia de desarrollo.
 * El test `__tests__/songSheetAbc.test.ts` vigila que la versión del módulo
 * sea la instalada.
 */
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');
const prettier = require('prettier');

const root = path.join(__dirname, '..');
const out = path.join(root, 'utils/songSheetAbcjs.ts');
const check = process.argv.includes('--check');

const pkg = require('abcjs/package.json');
const license = fs
  .readFileSync(require.resolve('abcjs/LICENSE.md'), 'utf8')
  .trim();

async function main() {
  const result = await esbuild.build({
    stdin: {
      contents:
        "var renderAbc = require('abcjs/src/api/abc_tunebook_svg');\n" +
        `window.ABCJS = { renderAbc: renderAbc, signature: 'abcjs-basic v${pkg.version} (renderAbc)' };\n`,
      resolveDir: root,
      sourcefile: 'abcjs-entry.js',
    },
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2017'],
    platform: 'browser',
    legalComments: 'none',
    write: false,
    logLevel: 'warning',
  });
  let js = result.outputFiles[0].text.trim();
  // Va dentro de un `<script>` en línea: `</script` lo cerraría y `<!--`
  // cambia cómo el navegador lee el resto del script.
  js = js.replace(/<\/(script)/gi, '<\\/$1');
  if (/<!--/.test(js)) {
    throw new Error(
      'El minificado de abcjs contiene «<!--»: no se puede meter en línea.',
    );
  }

  const source =
    `/**\n` +
    ` * GENERADO por \`npm run build:abcjs\` (scripts/build-abcjs-inline.js): no\n` +
    ` * editar a mano. abcjs ${pkg.version} (solo \`renderAbc\`) minificado, para\n` +
    ` * meterlo en línea en la hoja de las canciones con partitura ABC.\n` +
    ` *\n` +
    license
      .split('\n')
      .map((l) => (l ? ` * ${l.replace(/\*\//g, '* /')}` : ' *'))
      .join('\n') +
    `\n */\n` +
    `export const ABCJS_VERSION = ${JSON.stringify(pkg.version)};\n\n` +
    `export const ABCJS_JS = ${JSON.stringify(js)};\n`;

  const config = (await prettier.resolveConfig(out)) ?? {};
  const formatted = await prettier.format(source, {
    ...config,
    filepath: out,
  });

  const kb = (n) => `${Math.round(n / 1024)} KB`;
  if (check) {
    const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
    if (current !== formatted) {
      process.stderr.write(
        `❌ ${path.relative(root, out)} no está al día: npm run build:abcjs\n`,
      );
      process.exit(1);
    }
    process.stdout.write(`✅ ${path.relative(root, out)} al día\n`);
    return;
  }
  fs.writeFileSync(out, formatted);
  process.stdout.write(
    `✅ ${path.relative(root, out)} — abcjs ${pkg.version}, ${kb(js.length)} de JS\n`,
  );
}

main().catch((e) => {
  process.stderr.write(`${e?.stack ?? e}\n`);
  process.exit(1);
});
