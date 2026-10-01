/*
 * Cas de contrôle des libellés.
 *
 * Une clé absente ne casse rien : l'interface affiche ‹cle.absente› entre
 * chevrons et continue. C'est précisément ce qui la rend dangereuse — elle ne
 * se voit qu'en ouvrant l'écran concerné, dans la bonne langue, et l'écran
 * anglais est celui qu'on ouvre le moins souvent en développant.
 *
 * Ce fichier lit toutes les clés employées — dans le HTML par `data-t*`, dans
 * le JavaScript par `I18n.t()` et `I18n.n()` — et vérifie que chacune existe
 * dans les deux langues.
 *
 *     node build/essais_i18n.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.join(ici, '..');

globalThis.window = globalThis;
// `navigator` est en lecture seule dans Node : on le redéfinit, i18n.js le lit.
Object.defineProperty(globalThis, 'navigator', {
  value: { languages: ['fr'] }, configurable: true,
});
globalThis.document = {
  documentElement: {},
  querySelectorAll: () => [],
  dispatchEvent: () => {},
};
globalThis.CustomEvent = class { constructor(nom, options) { this.nom = nom; this.detail = options && options.detail; } };
(0, eval)(readFileSync(path.join(racine, 'js', 'i18n.js'), 'utf8'));

const I18n = globalThis.I18n;

/* Les tables elles-mêmes, pour comparer les deux langues clé à clé. La seule
 * façon d'y accéder de l'extérieur est de demander chaque clé : `t()` retombe
 * sur le français quand l'anglais manque, ce qui masquerait justement le
 * défaut qu'on cherche. On relit donc la source. */
const source = readFileSync(path.join(racine, 'js', 'i18n.js'), 'utf8');
const blocs = source.split(/^\s{4}(fr|en): \{$/m);
const tables = {};
for (let i = 1; i < blocs.length; i += 2) {
  const langue = blocs[i];
  tables[langue] = new Set(
    [...blocs[i + 1].matchAll(/^\s*'([\w.-]+)':/gm)].map((m) => m[1]));
}

let fautes = 0;
function verifier(condition, message) {
  if (condition) return;
  fautes += 1;
  console.log('  NON ' + message);
}

console.log('Libellés');
console.log(`  fr : ${tables.fr.size} clés, en : ${tables.en.size} clés`);

// 1. Les deux langues portent les mêmes clés.
for (const cle of tables.fr) {
  verifier(tables.en.has(cle), `« ${cle} » manque en anglais`);
}
for (const cle of tables.en) {
  verifier(tables.fr.has(cle), `« ${cle} » manque en français`);
}

// 2. Toutes les clés employées existent.
const employees = new Set();

const html = readFileSync(path.join(racine, 'index.html'), 'utf8');
for (const m of html.matchAll(/data-t(?:-ph|-aria|-titre)?="([\w.-]+)"/g)) {
  employees.add(m[1]);
}

/* Les clés composées — `'nature.' + code`, `'bande.' + entree.bande` — ne se
 * lisent pas dans le code. On les énumère ici, une fois, plutôt que de laisser
 * le contrôle passer à côté de familles entières. */
const FAMILLES = {
  'langue.': ['en', 'fr', 'en.court', 'fr.court'],
  'bande.': ['0', '1', '2', '3', 'explication'],
  'genre.': ['masc', 'fem'],
  'nature.': ['n', 'pn', 'v', 'adj', 'adv', 'preposition', 'conjunction',
              'interjection', 'numeral', 'article', 'particle', 'letter',
              'abbreviation', 'suffix', 'prefix', 'locution', 'pronoun',
              'determiner', 'contraction', 'postposition', 'proverb', 'symbol'],
  // Les formes : anglaises (pluriel, 3ᵉ personne, -ing, prétérit, participe,
  // comparatif, superlatif) et françaises (genre, nombre, conjugaison).
  'flexion.': ['sg', 'pl', '3sg', 'ing', 'past', 'pp', 'comp', 'sup',
               'fs', 'mp', 'fp', 'inf', 'part',
               'pres1', 'pres2', 'pres3', 'pres4', 'pres5', 'pres6',
               'imp1', 'imp2', 'imp3', 'imp4', 'imp5', 'imp6',
               'groupe.formes', 'groupe.present', 'groupe.imparfait'],
  'exercice.consigne.': ['conjugaison', 'ecoute', 'famille', 'paire-phrase', 'pluriel',
                         'qcm-comprendre', 'qcm-produire', 'saisie', 'saisie-article',
                         'saisie-traduction', 'synonyme', 'trou', 'ecoute.phrase'],
  // Les ateliers et leur description (atelier.js, ATELIERS).
  'atelier.': ['reconnaitre', 'produire', 'ecrire', 'traduire', 'famille', 'irreguliers',
               'pluriel', 'trou', 'phrase', 'ecoute', 'conjugaison', 'article', 'synonyme',
               'reconnaitre.detail', 'produire.detail', 'ecrire.detail', 'traduire.detail',
               'famille.detail', 'irreguliers.detail', 'pluriel.detail', 'trou.detail',
               'phrase.detail', 'ecoute.detail', 'conjugaison.detail', 'article.detail',
               'synonyme.detail'],
  'perso.manque.': ['mot', 'langue', 'traductions'],
  'sauvegarde.conflits.': ['garder', 'remplacer'],
  // « Phrases et dialogues » : registres, types, marques, formulaires.
  'conv.registre.': ['poli', 'familier'],
  'conv.type.': ['tout', 'phrase', 'dialogue'],
  'conv.marque.': ['phrase', 'dialogue', 'replique'],
  'conv.ecouter.': ['fr', 'en'],
  'conv.manque.': ['fr', 'en', 'titre', 'repliques', 'replique-incomplete'],
  'conv.form.': ['fr', 'en', 'fr.aide', 'en.aide', 'variantes.fr', 'variantes.en',
                 'role.A', 'role.B', 'phrase.ajouter', 'phrase.modifier',
                 'dialogue.ajouter', 'dialogue.modifier'],
  'conv.provenance.': ['fourni', 'fourni.relu-en', 'perso'],
  // La prononciation : une voix par langue, et ce qu'on dit quand elle manque
  // ou qu'elle n'est pas de la bonne région (voix.js, AVIS).
  'voix.aucune.': ['en', 'fr'],
  'reglages.voix.pour.': ['en', 'fr'],
  'reglages.voix.essai.': ['en', 'fr'],
  'reglages.voix.avis.installer.': ['en', 'fr'],
  'reglages.voix.avis.': ['choix-canadien', 'france-en-ligne', 'pas-de-france',
                          'choix-americain', 'gb-en-ligne', 'pas-de-gb'],
  'maj.etat.': ['prete', 'en-cours', 'a-jour', 'trop-tot', 'echec', 'sans-service-worker'],
  // Les marques d'usage (build/marques.py, ORDRE), courtes et longues.
  'marque.': ['inj', 'vulg', 'pej', 'tfam', 'arg', 'fam', 'web', 'abr', 'neo', 'angl',
              'hum', 'iron', 'euph', 'enf', 'fig', 'sout', 'vieilli', 'vx', 'rare', 'dial',
              'gb', 'us', 'ie', 'sc', 'au', 'nz', 'ca', 'za', 'in', 'qc', 'be', 'ch', 'af']
    .flatMap((code) => [code, code + '.long']),
  'module.source.': ['claude', 'code-en-clair', 'franceterme'],
  'modules.irreguliers.': ['base', 'passe', 'participe', 'sens'],
  'fiche.provenance.glose.': ['en', 'fr'],
};
for (const [prefixe, suites] of Object.entries(FAMILLES)) {
  for (const suite of suites) employees.add(prefixe + suite);
}

for (const nom of readdirSync(path.join(racine, 'js'))) {
  if (!nom.endsWith('.js')) continue;
  const code = readFileSync(path.join(racine, 'js', nom), 'utf8');
  for (const m of code.matchAll(/I18n\.[tn]\('([\w.-]+)'/g)) {
    /* Une « clé » qui finit par un point est en fait un préfixe : le code écrit
     * `I18n.t('nature.' + code)`. Ces familles sont énumérées ci-dessus, à la
     * main, parce qu'aucune lecture du texte ne saurait deviner leurs suites. */
    if (!m[1].endsWith('.')) employees.add(m[1]);
  }
}

for (const cle of [...employees].sort()) {
  verifier(tables.fr.has(cle), `« ${cle} » employée mais absente des libellés`);
}

// 3. Les substitutions annoncées existent dans les deux langues.
for (const cle of tables.fr) {
  const jetons = (texte) => new Set([...String(texte).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
  const enFr = jetons(I18n.t(cle));
  I18n.definir('en');
  const enEn = jetons(I18n.t(cle));
  I18n.definir('fr');
  for (const jeton of enEn) {
    verifier(enFr.has(jeton) || jeton === 'n',
      `« ${cle} » : {${jeton}} en anglais, absent du français`);
  }
}

console.log(`  ${employees.size} clés employées vérifiées`);
console.log(fautes ? `\n${fautes} défaut(s).` : '\nTous les libellés sont en place.');
process.exit(fautes ? 1 : 0);
