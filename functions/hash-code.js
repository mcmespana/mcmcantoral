#!/usr/bin/env node
/**
 * Huella de un código de administrador, para pegarla en
 * `/_config/cantoral/adminCodeHashes/<nombre>` desde la consola de Firebase:
 *
 *   node functions/hash-code.js "el código"
 */
'use strict';
const { hashCode } = require('./logic');

const code = process.argv.slice(2).join(' ');
if (!code.trim()) {
  process.stderr.write('Uso: node functions/hash-code.js "el código"\n');
  process.exit(1);
}
process.stdout.write(`${hashCode(code)}\n`);
