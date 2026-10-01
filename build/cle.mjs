/*
 * Expose `Lexique.cle()` en ligne de commande, pour que verifier.py puisse la
 * comparer à `commun.cle()` en Python. Les deux doivent coïncider : un écart
 * rend introuvables des mots pourtant présents dans l'index.
 *
 * Lit un tableau JSON de chaînes sur l'entrée standard, écrit le tableau des
 * clés correspondantes sur la sortie standard.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ici = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(ici, '..', 'js', 'lexique.js'), 'utf8');

// lexique.js est un script classique qui s'accroche à `window` ; en dehors du
// navigateur il suffit de lui en fournir un.
globalThis.window = globalThis;
(0, eval)(source);

const entrees = JSON.parse(readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(entrees.map((t) => globalThis.Lexique.cle(t))));
