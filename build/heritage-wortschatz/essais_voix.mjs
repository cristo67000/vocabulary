/*
 * Cas de contrôle de la voix : quelle voix est demandée, et pour quelle langue.
 *
 * ── Ce que ceci prouve, et ce que ça ne prouve pas ─────────────────────────
 *
 * `js/voix.js` tourne ici sur une synthèse vocale de laboratoire : une liste
 * de voix qu'on compose, un `speak()` qui note ce qu'on lui donne. On vérifie
 * la **logique** — un texte allemand ne part jamais qu'avec une voix
 * allemande, la liste qui arrive en retard est prise en compte, un choix des
 * Réglages est honoré, un choix disparu rend la main —, c'est-à-dire ce que
 * l'application demande au moteur. Ce que le moteur en fait, comment il
 * prononce « Zehn Züge », aucun programme ne l'entend : cela se juge à
 * l'oreille, sur l'appareil, avec le bouton « Essayer » des Réglages.
 *
 *     node build/essais_voix.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.join(ici, '..');

let fautes = 0;
let passees = 0;
function verifier(condition, message, detail) {
  if (condition) { passees += 1; console.log('  ok  ' + message); return true; }
  fautes += 1;
  console.log('  NON ' + message + (detail === undefined ? '' : '  → ' + JSON.stringify(detail)));
  return false;
}
function titre(t) { console.log(''); console.log(t); }

// ── Le décor : un document minimal, une synthèse de laboratoire ─────────────

const evenements = [];
globalThis.window = globalThis;
globalThis.document = {
  documentElement: {},
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: () => {},
  dispatchEvent: (e) => { evenements.push(e.type); return true; },
};
globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options && options.detail; } };
Object.defineProperty(globalThis, 'navigator', {
  value: { languages: ['fr'], userAgent: 'Laboratoire/1.0', platform: 'Labo' }, configurable: true,
});
globalThis.I18n = { t: (cle) => '‹' + cle + '›', langue: 'fr' };

const voix = (name, lang, localService, voiceURI) => ({ name, lang, localService, voiceURI: voiceURI || name, default: false });
const labo = {
  liste: [],
  ecouteurs: [],
  paroles: [],
  annulations: 0,
  getVoices() { return this.liste; },
  addEventListener(type, fn) { this.ecouteurs.push([type, fn]); },
  speak(p) { this.paroles.push(p); },
  cancel() { this.annulations += 1; },
  changer(liste) {
    this.liste = liste;
    for (const [type, fn] of this.ecouteurs) if (type === 'voiceschanged') fn();
  },
};
globalThis.speechSynthesis = labo;
globalThis.SpeechSynthesisUtterance = class {
  constructor(text) { this.text = text; this.voice = null; this.lang = ''; this.rate = 1; this.ecouteurs = {}; }
  addEventListener(type, fn) { this.ecouteurs[type] = fn; }
};

function charger() {
  (0, eval)(readFileSync(path.join(racine, 'js', 'voix.js'), 'utf8'));
  return globalThis.Voix;
}

const derniere = () => labo.paroles[labo.paroles.length - 1];
const bouton = () => ({ disabled: false, title: '', isConnected: true, removeAttribute() { this.title = ''; } });

// ── 1. Sans voix allemande, l'allemand n'est pas lu — jamais en français ────

titre('1. Une seule voix, française : l’allemand se tait plutôt que de parler français');
labo.liste = [voix('Amélie', 'fr-FR', true)];
let V = charger();
verifier(V.possible('fr') && !V.possible('de'), 'le français est possible, l’allemand non');
const avant = labo.paroles.length;
verifier(V.dire('Zehn Züge fahren zum Zoo.', 'de') === false && labo.paroles.length === avant,
  '« Zehn Züge fahren zum Zoo. » ne part pas : aucune parole, aucun repli sur la voix française');
verifier(V.essayer('de') === false, 'le bouton « Essayer » de l’allemand ne fait rien non plus');
verifier(V.dire('Bonjour.', 'fr') === true && derniere().voice.name === 'Amélie' && derniere().lang === 'fr-FR',
  'le français, lui, part avec Amélie, en fr-FR');
let d = V.diagnostic('de');
verifier(d.voix === null && d.nombre === 0 && d.total === 1 && d.pret === true && d.automatique,
  'le diagnostic de l’allemand dit : aucune voix sur une seule annoncée', d);
let items = [], fin = null;
V.enchainer([{ texte: 'Guten Tag.', langue: 'de' }, { texte: 'Bonjour.', langue: 'fr' }],
  { pause: 5, surItem: (i) => items.push(i), surFin: (i) => { fin = i; } });
verifier(labo.paroles.filter((p) => p.text === 'Guten Tag.').length === 0,
  'dans un dialogue, la réplique allemande est passée en silence, pas lue en français');
await new Promise((r) => setTimeout(r, 40));
verifier(derniere().text === 'Bonjour.' && derniere().voice.name === 'Amélie',
  'et la réplique française suit, avec la voix française');
V.taire();

// ── 2. La liste arrive en retard ────────────────────────────────────────────

titre('2. La liste des voix arrive après coup : tout se met à jour');
labo.liste = [];
labo.ecouteurs = [];
V = charger();
verifier(V.pret === false && !V.possible('de') && !V.possible('fr'), 'au départ, rien n’est là et l’on sait que la liste n’est pas arrivée');
const b = bouton();
V.brancherBouton(b, 'de');
verifier(b.disabled === true && b.title === '‹voix.aucune.de›', 'un bouton ▸ branché est grisé, et dit pourquoi');
d = V.diagnostic('de');
verifier(d.pret === false && d.total === 0, 'le diagnostic dit que la liste n’est pas encore arrivée');
evenements.length = 0;
labo.changer([voix('Google Deutsch', 'de-DE', false), voix('Google français', 'fr-FR', false)]);
verifier(V.pret === true && V.possible('de') && V.possible('fr'), 'après `voiceschanged`, les deux langues sont possibles');
verifier(b.disabled === false && b.title === '', 'le bouton ▸ est repeint : actif, sans avertissement');
verifier(evenements.includes('voix-changees'), 'le document reçoit « voix-changees »');
evenements.length = 0;
labo.changer([voix('Google Deutsch', 'de-DE', false), voix('Google français', 'fr-FR', false)]);
verifier(!evenements.includes('voix-changees'), 'la même liste, redonnée, ne dérange personne');
const parti = bouton();
parti.isConnected = false;
V.brancherBouton(parti, 'fr');
labo.changer([voix('Google Deutsch', 'de-DE', false)]);
verifier(b.disabled === false, 'la voix allemande reste, le bouton allemand reste actif');
labo.changer([]);
verifier(b.disabled === true, 'les voix disparaissent (changement de moteur) : le bouton se grise à nouveau');

// ── 3. La voix et la balise de langue ───────────────────────────────────────

titre('3. La voix demandée, sa langue, et la balise « de_DE » des moteurs Android');
labo.liste = [
  voix('Google français', 'fr-FR', false),
  voix('Deutsch (Netz)', 'de-DE', false, 'net-de'),
  voix('Deutsch (lokal)', 'de_DE', true, 'local-de'),
  voix('Deutsch (Schweiz)', 'de-CH', true, 'ch-de'),
  voix('Amélie', 'fr-FR', true),
  voix('English', 'en-US', true),
];
labo.ecouteurs = [];
V = charger();
verifier(V.dire('Zehn Züge fahren zum Zoo.', 'de') === true, 'la phrase d’essai part');
let p = derniere();
verifier(p.voice.name === 'Deutsch (lokal)', 'une voix locale allemande est préférée à une voix en ligne', p.voice.name);
verifier(p.lang === 'de-DE', 'la balise « de_DE » du moteur est rendue « de-DE » sur l’énoncé', p.lang);
verifier(p.rate === 0.9, 'un peu en dessous de la vitesse normale');
verifier(p.text.split('').filter((c) => c === 'z' || c === 'Z').length === 4,
  'le texte est transmis tel quel : quatre « z », aucun n’est réécrit en « ts »');
V.dire('Bonjour.', 'fr');
verifier(derniere().voice.name === 'Amélie' && derniere().lang === 'fr-FR', 'le français prend la voix française locale');
verifier(V.lister('de').map((v) => v.nom).join(', ') === 'Deutsch (lokal), Deutsch (Netz), Deutsch (Schweiz)',
  'la liste des voix allemandes ne contient que de l’allemand, de-CH compris, dans l’ordre du choix automatique :'
  + ' Allemagne sur l’appareil, Allemagne en ligne, Suisse', V.lister('de'));
verifier(V.lister('fr').every((v) => v.lang.startsWith('fr')) && V.lister('fr').length === 2,
  'et celle des françaises que du français');

// ── 4. Le choix des Réglages ────────────────────────────────────────────────

titre('4. Un choix dans les Réglages est honoré, un choix disparu rend la main');
let choix = V.choisir('de', 'net-de');
verifier(choix && choix.uri === 'net-de' && choix.nom === 'Deutsch (Netz)', 'choisir rend ce qu’il faut enregistrer', choix);
V.dire('Zwanzig.', 'de');
verifier(derniere().voice.voiceURI === 'net-de', 'la voix choisie est celle qui parle, même en ligne');
d = V.diagnostic('de');
verifier(!d.automatique && !d.choixIntrouvable && d.voix.nom === 'Deutsch (Netz)', 'le diagnostic le dit', d);
V.enchainer([{ texte: 'Eins.', langue: 'de' }], { pause: 5 });
verifier(derniere().voice.voiceURI === 'net-de', 'un dialogue aussi passe par la voix choisie');
V.taire();

verifier(V.choisir('de', null) === null, 'revenir à l’automatique');
V.dire('Zwei.', 'de');
verifier(derniere().voice.voiceURI === 'local-de', 'et la voix locale revient');

V.configurer({ voixDe: { uri: 'ancienne-uri', nom: 'Deutsch (Schweiz)' }, voixFr: null });
V.dire('Drei.', 'de');
verifier(derniere().voice.voiceURI === 'ch-de', 'une voix retrouvée par son nom quand son adresse a changé');

V.configurer({ voixDe: { uri: 'disparue', nom: 'Voix désinstallée' } });
V.dire('Vier.', 'de');
d = V.diagnostic('de');
verifier(derniere().voice.voiceURI === 'local-de' && d.choixIntrouvable && d.automatique,
  'une voix disparue : le choix automatique s’applique et le diagnostic le signale', d);

V.configurer({ voixDe: { uri: 'Amélie', nom: 'Amélie' } });
V.dire('Fünf.', 'de');
verifier(derniere().voice.name === 'Deutsch (lokal)',
  'un réglage qui désignerait une voix française pour l’allemand est ignoré : jamais l’allemand en français');
verifier(V.choisir('de', 'Amélie') === null, 'et l’on ne peut pas le choisir non plus');
verifier(V.choisir('it', 'x') === null, 'une langue inconnue est refusée');
V.configurer({});

// ── 5. Interrupteur, phrases d'essai, appareil ──────────────────────────────

titre('5. L’interrupteur des Réglages, les phrases d’essai, l’appareil');
V.actif = false;
const n = labo.paroles.length;
verifier(V.essayer('de') === false && labo.paroles.length === n, 'voix désactivée : « Essayer » ne parle pas');
V.actif = true;
verifier(V.essayer('de') && derniere().text === 'Zehn Züge fahren zum Zoo.' && derniere().voice.lang.startsWith('de'),
  '« Essayer » lit « Zehn Züge fahren zum Zoo. » avec une voix allemande');
verifier(V.essayer('fr') && derniere().text === V.phraseDEssai('fr') && derniere().voice.lang.startsWith('fr'),
  'et la phrase française avec une voix française');
const a = V.appareil();
verifier(a.plateforme === 'Labo' && a.navigateur === 'Laboratoire/1.0', 'l’appareil se décrit par le système et le navigateur', a);
const enCours = derniere();
verifier(typeof enCours.ecouteurs.end === 'function' && typeof enCours.ecouteurs.error === 'function',
  'l’énoncé en cours est tenu jusqu’à sa fin — Chrome ne le ramassera pas avant');

titre('6. La pièce à conviction : le dernier énoncé demandé, et à quelle voix');
evenements.length = 0;
V.dire('Zwanzig Züge.', 'de');
let d6 = V.dernier();
verifier(d6 && d6.texte === 'Zwanzig Züge.' && d6.voix === 'Deutsch (lokal)' && d6.lang === 'de-DE' && d6.langue === 'de',
  'après une lecture, `dernier()` dit le texte, la voix, sa balise et la langue voulue', d6);
verifier(evenements.includes('voix-parle'), 'et le document reçoit « voix-parle », pour que les Réglages se mettent à jour');
verifier(typeof d6.quand === 'number' && Date.now() - d6.quand < 5000, 'daté de l’instant');
V.enchainer([{ texte: 'Bonjour.', langue: 'fr' }], { pause: 5 });
d6 = V.dernier();
verifier(d6.texte === 'Bonjour.' && d6.langue === 'fr' && d6.voix === 'Amélie', 'un dialogue le renseigne aussi, réplique par réplique', d6);
V.taire();
d6.texte = 'trafiqué';
verifier(V.dernier().texte === 'Bonjour.', 'ce qui est rendu est une copie');

// ── 7. L'accent : la France et l'Allemagne d'abord, le Canada en dernier ────
//
// Des listes telles que les rendent les systèmes, dans leur ordre : la voix
// canadienne arrive souvent la première, et c'est elle qu'on entendait.

titre('7. L’accent attendu : France et Allemagne d’abord, le Canada en dernier');
function avecVoix(liste, enLigne) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { languages: ['fr'], userAgent: 'Laboratoire/1.0', platform: 'Labo', onLine: enLigne !== false },
    configurable: true,
  });
  labo.liste = liste;
  labo.ecouteurs = [];
  return charger();
}
const apple = (nom, lang, uri) => voix(nom, lang, true, 'com.apple.' + uri);
const IPHONE = [
  apple('Amélie', 'fr-CA', 'voice.compact.fr-CA.Amelie'),
  apple('Anna', 'de-DE', 'voice.compact.de-DE.Anna'),
  apple('Eddy (français (Canada))', 'fr-CA', 'eloquence.fr-CA.Eddy'),
  apple('Eddy (français (France))', 'fr-FR', 'eloquence.fr-FR.Eddy'),
  apple('Eddy (Deutsch (Deutschland))', 'de-DE', 'eloquence.de-DE.Eddy'),
  apple('Flo (français (France))', 'fr-FR', 'eloquence.fr-FR.Flo'),
  apple('Grand-mère (français (France))', 'fr-FR', 'eloquence.fr-FR.Grandma'),
  apple('Thomas', 'fr-FR', 'voice.compact.fr-FR.Thomas'),
];
V = avecVoix(IPHONE);
V.dire('Bonjour.', 'fr');
verifier(derniere().voice.name === 'Thomas' && derniere().lang === 'fr-FR',
  'iPhone : le français part avec Thomas (France), ni Amélie (Canada) ni Eddy', derniere().voice.name);
V.dire('Guten Tag.', 'de');
verifier(derniere().voice.name === 'Anna', 'iPhone : l’allemand avec Anna, pas avec Eddy (Eloquence)', derniere().voice.name);
verifier(V.lister('fr')[0].nom === 'Thomas' && V.lister('fr').at(-1).region === 'CA',
  'iPhone : la liste des Réglages commence par la France et finit par le Canada', V.lister('fr').map((x) => x.nom));
verifier(V.diagnostic('fr').avis === null && V.diagnostic('fr').voix.region === 'FR',
  'iPhone : voix de France présente, aucun avis', V.diagnostic('fr'));
V = avecVoix([...IPHONE, apple('Audrey (amélioré)', 'fr-FR', 'voice.enhanced.fr-FR.Audrey')]);
V.dire('Bonjour.', 'fr');
verifier(derniere().voice.name === 'Audrey (amélioré)', 'iPhone : une voix améliorée téléchargée passe devant la compacte');

const android = (nom, lang) => voix(nom, lang, true);
V = avecVoix([android('Français Canada', 'fr-CA'), android('Français France', 'fr-FR'), android('Deutsch Deutschland', 'de-DE')]);
V.dire('Bonjour.', 'fr');
verifier(derniere().voice.name === 'Français France', 'Android : fr-FR, pas fr-CA venu d’abord', derniere().voice.name);
V = avecVoix([android('fr_CA', 'fr_CA'), android('fr_FR', 'fr_FR')]);
V.dire('Bonjour.', 'fr');
verifier(derniere().voice.name === 'fr_FR' && derniere().lang === 'fr-FR',
  'Android, balises à tiret bas : fr_FR retenue, balise rendue « fr-FR »', derniere().voice.name);
V = avecVoix([android('Français (Canada)', 'fr'), android('eSpeak French', 'fr')]);
V.dire('Bonjour.', 'fr');
verifier(derniere().voice.name === 'eSpeak French', 'balise sans région : le nom « Canada » suffit à la reléguer', derniere().voice.name);

const windows = (nom, lang, locale) => voix(nom, lang, locale);
V = avecVoix([
  windows('Microsoft Sylvie Online (Natural) - French (Canada)', 'fr-CA', false),
  windows('Microsoft Denise Online (Natural) - French (France)', 'fr-FR', false),
  windows('Microsoft Hortense - French (France)', 'fr-FR', true),
  windows('Microsoft Karsten - German (Switzerland)', 'de-CH', true),
  windows('Microsoft Katja - German (Germany)', 'de-DE', true),
]);
V.dire('Bonjour.', 'fr');
verifier(derniere().voice.name === 'Microsoft Hortense - French (France)', 'Edge : la voix française de l’appareil, avant les voix en ligne');
V.dire('Guten Tag.', 'de');
verifier(derniere().voice.name === 'Microsoft Katja - German (Germany)', 'Edge : l’allemand d’Allemagne avant celui de Suisse, venu d’abord');

const QUEBEC = [windows('Microsoft Caroline - French (Canada)', 'fr-CA', true), windows('Google français', 'fr-FR', false)];
V = avecVoix(QUEBEC);
V.dire('Bonjour.', 'fr');
verifier(derniere().voice.name === 'Google français', 'en ligne : une voix de France en ligne plutôt qu’une canadienne');
V = avecVoix(QUEBEC, false);
V.dire('Bonjour.', 'fr');
verifier(derniere().voice.name === 'Microsoft Caroline - French (Canada)', 'hors ligne : la voix de l’appareil, seule à pouvoir parler');
verifier(V.diagnostic('fr').avis === 'france-en-ligne', 'et les Réglages disent pourquoi : « france-en-ligne »', V.diagnostic('fr').avis);

V = avecVoix([android('Français Canada', 'fr-CA'), android('Deutsch Deutschland', 'de-DE')]);
verifier(V.diagnostic('fr').avis === 'pas-de-france', 'aucune voix française d’Europe : avis « pas-de-france »', V.diagnostic('fr').avis);
verifier(V.diagnostic('de').avis === null, 'l’allemand n’a pas d’avis canadien');

V = avecVoix(IPHONE);
V.configurer({ voixFr: { uri: 'com.apple.voice.compact.fr-CA.Amelie', nom: 'Amélie' } });
V.dire('Bonjour.', 'fr');
verifier(derniere().voice.name === 'Amélie', 'une voix choisie dans les Réglages reste la sienne, même canadienne');
verifier(V.diagnostic('fr').avis === 'choix-canadien', 'et l’avis propose de revenir à la France : « choix-canadien »', V.diagnostic('fr').avis);
V.choisir('fr', null);
V.dire('Bonjour.', 'fr');
verifier(derniere().voice.name === 'Thomas' && V.diagnostic('fr').avis === null, 'retour à l’automatique : Thomas, plus d’avis');

V = avecVoix([windows('Google Deutsch', 'de-DE', false), windows('Microsoft Karsten - German (Switzerland)', 'de-CH', true)], false);
V.configurer({ voixDe: { uri: 'Google Deutsch', nom: 'Google Deutsch' } });
V.dire('Guten Tag.', 'de');
verifier(derniere().voice.name === 'Microsoft Karsten - German (Switzerland)',
  'hors ligne, une voix en ligne choisie se tairait : la voix de l’appareil prend le relais', derniere().voice.name);
verifier(V.diagnostic('de').automatique === true && V.diagnostic('de').choixIntrouvable === false,
  'le diagnostic dit que l’automatique s’applique, sans prétendre la voix disparue', V.diagnostic('de'));
avecVoix([]);

console.log('');
console.log(fautes ? `${passees} cas conformes, ${fautes} DÉFAUT(S).`
                   : `${passees} cas conformes. La logique de la voix tient — la prononciation, elle, se juge à l’oreille.`);
process.exit(fautes ? 1 : 0);
