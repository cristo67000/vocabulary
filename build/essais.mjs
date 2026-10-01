/*
 * Cas de contrôle du code de l'application, hors navigateur.
 *
 * Trois fonctions y sont éprouvées, choisies parce qu'elles décident seules de
 * ce que l'apprenant vit :
 *
 *   Exercices.corriger()      ce qui est compté juste, presque, ou faux
 *   Exercices.typeDExercice() ce qu'on demande, et à quel moment
 *   Revision.juger()          quand un mot revient
 *
 * Toutes trois sont pures — même entrée, même sortie — donc vérifiables sans
 * navigateur ni base de données. Une erreur y passerait autrement inaperçue :
 * un intervalle mal calculé ne casse rien, il fait seulement oublier.
 *
 *     node build/essais.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ici = path.dirname(fileURLToPath(import.meta.url));

// Les fichiers de l'application sont des scripts classiques accrochés à
// `window` ; en dehors du navigateur il suffit de leur en fournir un, et de
// simuler le peu qu'ils touchent d'autre.
globalThis.window = globalThis;
globalThis.Voix = { possible: () => false };
globalThis.Store = { identifiant: (l, m, t) => l + ' ' + m + ' ' + t };
for (const fichier of ['lexique.js', 'exercices.js', 'revision.js']) {
  (0, eval)(readFileSync(path.join(ici, '..', 'js', fichier), 'utf8'));
}

let fautesTotales = 0;

function titre(texte) {
  console.log('');
  console.log(texte);
}

// ── La correction des réponses ─────────────────────────────────────────────

/* Le palier exigeant : un nom français s'écrit avec son article, qui dit le
 * genre. */
const FR_FEM = { langue: 'fr', estNom: true, articleExige: true, genres: ['fem'] };
const FR_MASC = { langue: 'fr', estNom: true, articleExige: true, genres: ['masc'] };
const FR_DEUX = { langue: 'fr', estNom: true, articleExige: true, genres: ['masc', 'fem'] };

const AUTRE_SENS = { langue: 'en', estNom: false, autresSens: ['slowly', 'little by little'],
                     contexte: 'Cuire à petit feu.' };

const CAS = [
  // saisie,        attendus,               options,                        verdict,   remarque
  // L'anglais : casse, ponctuation, article et « to » tolérés.
  ['house',         ['house'],              { langue: 'en', estNom: true }, 'juste',   null],
  ['House',         ['house'],              { langue: 'en', estNom: true }, 'juste',   null],
  ['  house. ',     ['house'],              { langue: 'en', estNom: true }, 'juste',   null],
  ['the house',     ['house'],              { langue: 'en', estNom: true }, 'juste',   null],
  ['a house',       ['house'],              { langue: 'en', estNom: true }, 'juste',   null],
  ['to go',         ['go'],                 { langue: 'en' },               'juste',   null],
  ['hous',          ['house'],              { langue: 'en', estNom: true }, 'presque', null],
  ['mouse',         ['house'],              { langue: 'en', estNom: true }, 'presque', null],
  ['garden',        ['house'],              { langue: 'en', estNom: true }, 'faux',    null],
  ['',              ['house'],              { langue: 'en', estNom: true }, 'faux',    null],
  ['knackered',     ['knackered', 'exhausted'], { langue: 'en' },           'juste',   null],
  ['exhausted',     ['knackered', 'exhausted'], { langue: 'en' },           'juste',   null],
  // Le français : accents tolérés (mais signalés), fautes de frappe « presque ».
  ['eleve',         ['élève'],              { langue: 'fr' },               'juste',   'accents'],
  ['élève',         ['élève'],              { langue: 'fr' },               'juste',   null],
  ['maison',        ['maison', 'logis'],    { langue: 'fr' },               'juste',   null],
  ['logis',         ['maison', 'logis'],    { langue: 'fr' },               'juste',   null],
  ['maisone',       ['maison'],             { langue: 'fr' },               'presque', null],
  ['voiture',       ['maison'],             { langue: 'fr' },               'faux',    null],
  ['la maison',     ['maison'],             { langue: 'fr' },               'juste',   null],

  // Le nom français avec son article : le palier exigeant.
  ['une maison',    ['une maison'],         FR_FEM,                         'juste',   null],
  ['la maison',     ['une maison'],         FR_FEM,                         'juste',   null],
  ['un maison',     ['une maison'],         FR_FEM,                         'faux',    'article-faux'],
  ['maison',        ['une maison'],         FR_FEM,                         'presque', 'article-manque'],
  ['un évier',      ['un évier'],           FR_MASC,                        'juste',   null],
  // L'article élidé est du bon français, mais il ne dit pas le genre.
  ['l’évier',       ['un évier'],           FR_MASC,                        'presque', 'article-forme'],
  // « livre » : l'ouvrage et le poids — les deux articles sont justes.
  ['une livre',     ['un livre', 'une livre'], FR_DEUX,                     'juste',   null],
  ['le livre',      ['un livre', 'une livre'], FR_DEUX,                     'juste',   null],

  // Une question qui vise un sens : l'autre sens n'est pas faux, il est
  // « presque » ; une réponse étrangère aux deux reste fausse.
  ['over a low heat', ['over a low heat', 'on a low heat'], AUTRE_SENS,    'juste',   null],
  ['slowly',        ['over a low heat', 'on a low heat'], AUTRE_SENS,      'presque', 'autre-sens'],
  ['quickly',       ['over a low heat', 'on a low heat'], AUTRE_SENS,      'faux',    null],
];

titre('Correction des réponses (Exercices.corriger)');
let fautesCorrection = 0;
for (const [saisie, attendus, options, verdictAttendu, remarqueAttendue] of CAS) {
  const r = globalThis.Exercices.corriger(saisie, attendus, options);
  const remarque = r.remarque ? r.remarque.cle.split('.').pop() : null;
  const ok = r.verdict === verdictAttendu && remarque === remarqueAttendue;
  if (!ok) fautesCorrection += 1;
  console.log(`  ${ok ? 'ok ' : 'NON'} ${JSON.stringify(saisie).padEnd(18)} → `
    + `${attendus[0].padEnd(16)} ${r.verdict.padEnd(8)}`
    + `${remarque ? '(' + remarque + ')' : ''}`
    + (ok ? '' : `   attendu : ${verdictAttendu} (${remarqueAttendue})`));
}
console.log(`  ${CAS.length - fautesCorrection}/${CAS.length} cas conformes`);
fautesTotales += fautesCorrection;

// ── Le choix de l'exercice ─────────────────────────────────────────────────

const E = globalThis.Exercices;
const R0 = globalThis.Revision;

function entree(langue, mot, lectures) {
  return { langue, mot, tranche: 0, bande: 0, lectures, phrases: [], voisins: [] };
}
/* Une carte de la direction demandée. « produire » : écrire la vedette ;
 * « comprendre » : écrire sa traduction. */
function produire(langue, mot, reussites) {
  return { type: 'vers-' + langue, langue, mot, tranche: 0, reussites };
}
function comprendre(langue, mot, reussites) {
  return { type: 'vers-' + (langue === 'en' ? 'fr' : 'en'), langue, mot, tranche: 0, reussites };
}

const MAISON = entree('fr', 'maison', [['n', 'fem', 'mɛ.zɔ̃', [], [['', ['house', 'home']]]]]);
const LIVRE = entree('fr', 'livre', [['n', 'masc', 'livʁ', [], [['', ['book']]]],
                                     ['n', 'fem', 'livʁ', [], [['', ['pound']]]]]);
const ALLER = entree('fr', 'aller', [['v', '', 'a.le', [], [['', ['go']]]]]);
const HOUSE = entree('en', 'house', [['n', '', 'haʊs', [], [['', ['maison']]]]]);

const PALIERS = [
  ['un nom français donne son article et son genre',
    () => JSON.stringify(E.avecArticle(MAISON)) === '{"genres":["fem"],"formes":["une maison"]}'],
  ['un nom à deux genres donne les deux formes',
    () => E.avecArticle(LIVRE).formes.join(' · ') === 'un livre · une livre'],
  ['un verbe n’a pas d’article à réclamer',
    () => E.avecArticle(ALLER) === null],
  ['un nom anglais non plus',
    () => E.avecArticle(HOUSE) === null],
  ['une carte nomme la langue de sa réponse',
    () => R0.produitLaVedette(produire('fr', 'maison', 0)) === true
       && R0.produitLaVedette(comprendre('fr', 'maison', 0)) === false],
  ['produire commence par le choix parmi quatre',
    () => E.typeDExercice(produire('en', 'house', 0), HOUSE, []) === 'qcm-produire'],
  ['puis fait écrire le mot',
    () => E.typeDExercice(produire('en', 'house', 1), HOUSE, []) === 'saisie'],
  ['l’article n’est réclamé que si on le demande',
    () => E.typeDExercice(produire('fr', 'maison', 1), MAISON, []) === 'saisie'
       && E.typeDExercice(produire('fr', 'maison', 1), MAISON, [], { exigerArticle: true }) === 'saisie-article'],
  ['un verbe reste à la saisie ordinaire, même exigeant',
    () => E.typeDExercice(produire('fr', 'aller', 1), ALLER, [], { exigerArticle: true }) === 'saisie'],
  ['comprendre commence par reconnaître le sens',
    () => E.typeDExercice(comprendre('en', 'house', 0), HOUSE, []) === 'qcm-comprendre'],
  ['puis fait écrire la traduction',
    () => E.typeDExercice(comprendre('en', 'house', 1), HOUSE, []) === 'saisie-traduction'],
  ['un atelier impose son exercice, quelle que soit la carte',
    () => E.typeDExercice(produire('en', 'house', 0), HOUSE, [], { type: 'ecoute' }) === 'ecoute'],
];

titre('Le choix de l’exercice (Exercices.typeDExercice)');
let fautesPaliers = 0;
for (const [libelle, verifier] of PALIERS) {
  let ok = false;
  try { ok = verifier(); } catch (erreur) { ok = false; }
  if (!ok) fautesPaliers += 1;
  console.log(`  ${ok ? 'ok ' : 'NON'} ${libelle}`);
}
console.log(`  ${PALIERS.length - fautesPaliers}/${PALIERS.length} cas conformes`);
fautesTotales += fautesPaliers;

// ── Le planificateur ───────────────────────────────────────────────────────

const R = globalThis.Revision;
const JOUR = R.JOUR;
const T = 1000000000000;

function carte(champs) {
  return Object.assign(R.neuve('en', 'house', 0, 'vers-fr'), champs);
}
function jours(suite) {
  return Math.round((suite.echeance - T) / JOUR * 100) / 100;
}

const ATTENDUS = [
  ['une carte neuve réussie passe en apprentissage',
    carte({ etat: 'nouveau' }), R.CORRECT,
    (s) => s.etat === 'apprentissage' && jours(s) < 0.02],
  ['une carte neuve jugée facile saute l’apprentissage',
    carte({ etat: 'nouveau' }), R.FACILE,
    (s) => s.etat === 'revision' && jours(s) === 4],
  ['le dernier palier fait entrer en révision',
    carte({ etat: 'apprentissage', palier: 1 }), R.CORRECT,
    (s) => s.etat === 'revision' && jours(s) === 1],
  ['une réussite en révision multiplie l’intervalle par la facilité',
    carte({ etat: 'revision', intervalle: 10, facilite: 2.5 }), R.CORRECT,
    (s) => s.intervalle === 25 && jours(s) === 25],
  ['« difficile » allonge peu et rabote la facilité',
    carte({ etat: 'revision', intervalle: 10, facilite: 2.5 }), R.DIFFICILE,
    (s) => s.intervalle === 12 && Math.abs(s.facilite - 2.35) < 1e-9],
  ['« facile » ne dépasse pas le plafond de facilité',
    carte({ etat: 'revision', intervalle: 10, facilite: 2.8 }), R.FACILE,
    (s) => s.facilite === 2.8],
  ['un échec renvoie en apprentissage et divise l’intervalle',
    carte({ etat: 'revision', intervalle: 30, facilite: 2.5 }), R.RATE,
    (s) => s.etat === 'apprentissage' && s.intervalle === 9
        && Math.abs(s.facilite - 2.3) < 1e-9 && jours(s) < 0.02],
  ['la facilité ne descend pas sous le plancher',
    carte({ etat: 'revision', intervalle: 5, facilite: 1.3 }), R.RATE,
    (s) => s.facilite === 1.3],
  ['l’intervalle est plafonné à deux ans',
    carte({ etat: 'revision', intervalle: 700, facilite: 2.5 }), R.CORRECT,
    (s) => s.intervalle === 730],
  ['un échec compte un échec, pas une réussite',
    carte({ etat: 'revision', intervalle: 5, reussites: 3, echecs: 1 }), R.RATE,
    (s) => s.echecs === 2 && s.reussites === 3],
];

titre('Planification des révisions (Revision.juger)');
let fautesPlan = 0;
for (const [libelle, avant, qualite, verifier] of ATTENDUS) {
  const apres = R.juger(avant, qualite, T);
  const ok = verifier(apres);
  if (!ok) fautesPlan += 1;
  console.log(`  ${ok ? 'ok ' : 'NON'} ${libelle}`);
  if (!ok) {
    console.log(`      obtenu : état=${apres.etat} intervalle=${apres.intervalle} `
      + `facilité=${apres.facilite} échéance=+${jours(apres)} j`);
  }
}
console.log(`  ${ATTENDUS.length - fautesPlan}/${ATTENDUS.length} cas conformes`);
fautesTotales += fautesPlan;

console.log('');
console.log(fautesTotales ? `${fautesTotales} cas en échec` : 'Tous les cas passent.');
process.exit(fautesTotales ? 1 : 0);
