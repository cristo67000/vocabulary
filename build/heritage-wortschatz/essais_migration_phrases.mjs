/*
 * La mise à jour vers « Phrases et dialogues », vécue par quelqu'un qui avait
 * déjà des mots, des notes et des révisions — sur un vrai Chrome.
 *
 * ── Ce qu'on éprouve ───────────────────────────────────────────────────────
 *
 * La version publiée (l'arbre `main`, servi tel quel) s'installe ; on y
 * apprend un mot du dictionnaire et un mot à soi, on mûrit une carte comme le
 * feraient des semaines de révisions, on écrit deux notes, on change trois
 * réglages, et on relève l'empreinte exacte de tout cela — puis on exporte une
 * sauvegarde, au format d'alors. Ensuite la version en cours est servie **au
 * même endroit**, comme le ferait un déploiement, et l'on vérifie :
 *
 *   1. que la base passe à la version 4 et que **rien** n'a bougé : chaque
 *      carte, chaque note, chaque mot, chaque réglage, champ par champ ;
 *   2. que les phrases et dialogues sont là, qu'une phrase s'apprend, et que
 *      les cartes d'avant et celles d'après cohabitent ;
 *   3. que l'ancienne sauvegarde se relit : rien de neuf, rien de refusé ;
 *   4. que la nouvelle version, une fois activée, tient hors ligne, phrases
 *      comprises.
 *
 *     node build/essais_migration_phrases.mjs [révision de la version publiée]
 *
 * La révision vaut `main` par défaut. Depuis que `main` porte les phrases,
 * c'est `c99b13a` — la 3.1 — qu'il faut donner pour que l'épreuve garde son
 * sens ; elle le vérifie, et s'arrête si la révision servie connaît déjà les
 * phrases.
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lancerChrome, fermerChrome, ouvrirOnglet } from './pilote_chrome.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVISION = process.argv[2] || 'main';
const PORT_WEB = 8153;
const versionDe = (dossier) => (readFileSync(path.join(dossier, 'sw.js'), 'utf8').match(/const VERSION = '([^']+)'/) || [])[1];
const ORIGINE = 'http://localhost:' + PORT_WEB + '/';
const ANCIENNE = path.join(tmpdir(), 'wortschatz-version-publiee');

let fautes = 0;
let passees = 0;
function verifier(condition, message, detail) {
  if (condition) { passees += 1; console.log('  ok  ' + message); return true; }
  fautes += 1;
  console.log('  NON ' + message + (detail === undefined ? '' : '  → ' + JSON.stringify(detail)));
  return false;
}
function titre(t) { console.log(''); console.log(t); }

function vieillir(dossier, date) {
  for (const nom of readdirSync(dossier)) {
    if (nom === '.git') continue;
    const chemin = path.join(dossier, nom);
    if (statSync(chemin).isDirectory()) vieillir(chemin, date);
    else utimesSync(chemin, date, date);
  }
}

function servir(dossier) {
  return spawn('python', ['-m', 'http.server', String(PORT_WEB), '--directory', dossier],
               { stdio: 'ignore' });
}

async function attendreServeur(present) {
  for (let essai = 0; essai < 60; essai += 1) {
    try {
      await (await fetch(ORIGINE + 'index.html', { cache: 'no-store' })).arrayBuffer();
      if (present) return true;
    } catch (erreur) {
      if (!present) return true;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

const ATTENDRE_PRET = `
  for (let i = 0; i < 240; i++) {
    if (window.App && window.Lexique && Lexique.paquet && Lexique.manifeste) break;
    await new Promise(x => setTimeout(x, 250));
  }
  for (let i = 0; i < 240; i++) {
    const noms = await caches.keys();
    const coquille = noms.find(n => n.startsWith('wortschatz-coquille-'));
    if (coquille) {
      const c = await caches.open(coquille);
      const attendus = Lexique.manifeste.paquets.noyau.fichiers.length + 20;
      if ((await c.keys()).length >= attendus) break;
    }
    await new Promise(x => setTimeout(x, 250));
  }
`;

/* L'empreinte de tout ce qui appartient à la personne : ce qui doit être
 * identique, à l'octet près, avant et après. Les identifiants de carte
 * contiennent un NUL, que JSON transporte en \\u0000. */
const EMPREINTE = `
  const cartes = (await Store.toutesLesCartes()).sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(c => [c.id, c.langue, c.mot, c.type, c.etat, c.palier, c.intervalle, c.facilite,
               c.echeance, c.reussites, c.echecs, c.cree, c.vu, c.perso || null, c.tranche]);
  const notes = (await Store.toutesLesNotes()).sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(n => [n.id, n.texte, n.cree, n.modifie, n.langue, n.mot]);
  const perso = (await Store.tousLesMotsPerso()).sort((a, b) => (a.id < b.id ? -1 : 1));
  const reglages = await Store.lireReglages();
  const journal = (await Store.journalDepuis(0)).length;
  return { cartes, notes, perso, reglages: { langue: reglages.langue, sensDeTravail: reglages.sensDeTravail,
           nouveautesParJour: reglages.nouveautesParJour, exigerArticle: reglages.exigerArticle }, journal };
`;

async function principal() {
  if (existsSync(ANCIENNE)) {
    try { execSync(`git worktree remove --force "${ANCIENNE}"`, { cwd: RACINE, stdio: 'ignore' }); } catch (e) { /* … */ }
    rmSync(ANCIENNE, { recursive: true, force: true });
  }
  execSync(`git worktree add --detach "${ANCIENNE}" ${REVISION}`, { cwd: RACINE, stdio: 'ignore' });
  vieillir(ANCIENNE, new Date('2020-01-01T00:00:00Z'));
  const versionAncienne = versionDe(ANCIENNE);
  const versionNeuve = versionDe(RACINE);
  console.log(`Version publiée : ${REVISION} (${versionAncienne}) → ${versionNeuve}`);

  let serveur = servir(ANCIENNE);
  await attendreServeur(true);
  const chrome = await lancerChrome({ port: 9417 });
  console.log('Chrome : ' + chrome.version.Browser);
  const onglet = await ouvrirOnglet(chrome, 'about:blank');

  try {
    titre('1. La version publiée : des mots, des notes, des révisions, des réglages');
    await onglet.naviguer(ORIGINE);
    const avant = await onglet.evaluer(`
      ${ATTENDRE_PRET}
      const version = (await new Promise((res) => {
        const d = indexedDB.open('wortschatz'); d.onsuccess = () => { const v = d.result.version; d.result.close(); res(v); };
      }));
      await Store.ecrireReglage('langue', 'de');
      await Store.ecrireReglage('sensDeTravail', 'les-deux');
      await Store.ecrireReglage('nouveautesParJour', 25);
      Revision.sensDeTravail = 'les-deux';
      // Un mot du noyau, appris dans les deux sens, avec son genre.
      const haus = await Lexique.ouvrir(Lexique.vedette('de', 'Haus'));
      const cartesHaus = await Revision.apprendre(haus);
      // Un mot à soi, appris, avec sa note.
      const ffi = await Perso.creer({ mot: 'FFI', langue: 'fr', nature: '',
        traductions: 'Widerstandsbewegung, Résistance intérieure française' });
      const cartesFFI = await Revision.apprendre(Perso.entree(ffi.id));
      await Notes.ecrire({ perso: ffi.id, langue: 'fr', mot: 'FFI' }, 'Forces françaises de l’intérieur.');
      await Notes.ecrire({ langue: 'de', mot: 'Haus' }, 'Comme « house ».');
      // Des semaines de révisions, condensées.
      const toutes = await Store.toutesLesCartes();
      let n = 0;
      for (const c of toutes) {
        n += 1;
        c.etat = 'revision'; c.intervalle = 10 + n * 7; c.facilite = 2.1 + n * 0.05;
        c.echeance = 1900000000000 + n * 86400000; c.reussites = n; c.echecs = n % 2; c.vu = 1899000000000;
        await Store.ecrireCarte(c);
      }
      // Une réponse au journal, comme une séance.
      await Revision.noter((await Store.toutesLesCartes())[0], Revision.CORRECT, 'saisie');
      const sauvegarde = JSON.stringify(await Sauvegarde.rassembler());
      const empreinte = await (async () => { ${EMPREINTE} })();
      return { version, coquille: (await caches.keys()).find(n => n.startsWith('wortschatz-coquille-')),
               cartesHaus: cartesHaus.map(c => c.type).sort(), cartesFFI: cartesFFI.length,
               ffi: ffi.id, sauvegarde, empreinte, aConversation: !!window.Conversation };
    `);
    verifier(avant.version === 3, 'la base est en version 3', avant.version);
    verifier(avant.coquille === 'wortschatz-coquille-' + versionAncienne, 'la coquille est celle de la version publiée', avant.coquille);
    if (!verifier(!avant.aConversation, 'cette version ne connaît pas les phrases et dialogues — c’est bien l’ancienne')) {
      throw new Error('La révision ' + REVISION + ' porte déjà les phrases : donner celle de la 3.1 (c99b13a).');
    }
    verifier(JSON.stringify(avant.cartesHaus) === JSON.stringify(['genre', 'vers-de', 'vers-fr'])
             && avant.cartesFFI === 2, 'cinq cartes : « Haus » (3) et « FFI » (2)');
    verifier(avant.empreinte.cartes.length === 5 && avant.empreinte.notes.length === 2
             && avant.empreinte.perso.length === 1 && avant.empreinte.journal === 1,
      'l’empreinte relève 5 cartes, 2 notes, 1 mot, 1 ligne de journal');
    const ancienne = JSON.parse(avant.sauvegarde);
    verifier(ancienne.version === 1 && !ancienne.conversation,
      'la sauvegarde exportée est au format 1, sans phrases ni dialogues');

    titre('2. La nouvelle version est servie au même endroit');
    serveur.kill();
    await attendreServeur(false);
    serveur = servir(RACINE);
    await attendreServeur(true);
    await onglet.naviguer(ORIGINE);
    const apres = await onglet.evaluer(`
      for (let i = 0; i < 240; i++) {
        if (window.App && window.Lexique && Lexique.paquet && window.Conversation && Conversation.charge) break;
        await new Promise(x => setTimeout(x, 250));
      }
      const version = (await new Promise((res) => {
        const d = indexedDB.open('wortschatz'); d.onsuccess = () => { const v = d.result.version; d.result.close(); res(v); };
      }));
      const empreinte = await (async () => { ${EMPREINTE} })();
      await MiseAJour.verifier(true);
      let reg = null;
      for (let i = 0; i < 400; i++) {
        reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.waiting) break;
        await new Promise(x => setTimeout(x, 250));
      }
      return { version, empreinte, attend: !!(reg && reg.waiting),
               compte: Conversation.compter(), onglet: !!document.querySelector('[data-vue="conversation"]'),
               langue: I18n.langue, titreOnglet: document.querySelector('[data-vue="conversation"] span:last-child').textContent };
    `);
    verifier(apres.version === 4, 'la base est passée en version 4', apres.version);
    verifier(JSON.stringify(apres.empreinte) === JSON.stringify(avant.empreinte),
      'cartes, notes, mots, réglages et journal sont identiques, champ par champ',
      { avant: avant.empreinte, apres: apres.empreinte });
    verifier(apres.compte.phrases >= 100 && apres.compte.dialogues >= 20,
      `les phrases et dialogues sont là (${apres.compte.phrases} / ${apres.compte.dialogues})`);
    verifier(apres.onglet && apres.langue === 'de' && apres.titreOnglet === 'Sätze',
      'l’onglet existe, dans la langue réglée avant — l’allemand');
    verifier(apres.attend, 'le nouveau service worker est installé et attend le feu vert');

    titre('3. Les cartes d’avant et celles d’après cohabitent ; l’ancienne sauvegarde se relit');
    const cohabitation = await onglet.evaluer(`
      Revision.sensDeTravail = 'les-deux';
      const creees = await Revision.apprendre(Conversation.entree('dg-chemin-poste/r3'));
      const encore = await Revision.apprendre(Conversation.entree('ph-chemin-loin'));
      const haus = await Store.cartesDuMot('de', 'Haus');
      const ffi = await Store.cartesDuMot(null, null, '${avant.ffi}');
      const toutes = await Store.toutesLesCartes();
      const fichier = new File([${JSON.stringify(avant.sauvegarde)}], 'ancienne.json', { type: 'application/json' });
      const bilan = await Sauvegarde.examiner(fichier);
      const suivis = (await (async () => { await Seance.rafraichir(); return [...document.querySelectorAll('#suivis-liste li')].map(li => li.textContent.replace(/\\s+/g, ' ').trim()); })());
      return { creees: creees.map(c => c.type).sort(), encore: encore.length,
               haus: haus.length, ffi: ffi.length, total: toutes.length,
               bilan: bilan.erreur || { neufs: bilan.neufs, conflits: bilan.conflits, identiques:
                 bilan.mots.pareils.length + bilan.notes.pareils.length + bilan.cartes.pareils.length,
                 ignorees: bilan.ignorees, conversation: bilan.conversation.neufs.length },
               suivis };
    `);
    verifier(JSON.stringify(cohabitation.creees) === JSON.stringify(['vers-de', 'vers-fr']) && cohabitation.encore === 0,
      '« Ist es weit? » s’apprend depuis le dialogue — deux cartes — et la fiche n’en ajoute aucune');
    verifier(cohabitation.haus === 3 && cohabitation.ffi === 2 && cohabitation.total === 7,
      'les cinq cartes d’avant restent, les deux nouvelles s’y ajoutent (7)', cohabitation);
    verifier(cohabitation.bilan && cohabitation.bilan.neufs === 0 && cohabitation.bilan.conflits === 0
             && cohabitation.bilan.identiques === 8 && cohabitation.bilan.conversation === 0,
      'la sauvegarde de l’ancienne version se relit : tout y est déjà, rien n’est refusé', cohabitation.bilan);
    verifier(cohabitation.suivis.some((l) => /Ist es weit\\?/.test(l)) && cohabitation.suivis.some((l) => /Haus/.test(l)),
      'la liste des mots suivis mêle la phrase et les mots', cohabitation.suivis);

    titre('4. Le feu vert, puis le hors-ligne');
    await onglet.evaluer(`
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.waiting) reg.waiting.postMessage({ type: 'passer-devant' });
      await new Promise((res) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => res(), { once: true });
        setTimeout(res, 8000);
      });
      return true;
    `);
    await onglet.naviguer(ORIGINE);
    const active = await onglet.evaluer(`
      ${ATTENDRE_PRET}
      return { caches: await caches.keys() };
    `);
    verifier(active.caches.includes('wortschatz-coquille-' + versionNeuve) && !active.caches.includes('wortschatz-coquille-' + versionAncienne),
      `la coquille ${versionNeuve} a remplacé la ${versionAncienne}`, active.caches);

    serveur.kill();
    await attendreServeur(false);
    await onglet.naviguer(ORIGINE);
    const horsLigne = await onglet.evaluer(`
      for (let i = 0; i < 120; i++) {
        if (window.App && window.Lexique && Lexique.paquet && window.Conversation && Conversation.charge) break;
        await new Promise(x => setTimeout(x, 250));
      }
      // La coquille est servie depuis le cache quand le réseau manque : la
      // sonde passe par une adresse que le service worker ne connaît pas.
      const reseau = await fetch('data/manifeste.json?sonde=' + Date.now(), { cache: 'no-store' })
        .then(() => 'répond').catch(() => 'coupé');
      const empreinte = await (async () => { ${EMPREINTE} })();
      App.basculer('conversation');
      await new Promise(x => setTimeout(x, 300));
      const lignes = document.querySelectorAll('#vue-conversation .conv-ligne').length;
      Situations.ouvrirDialogue('dg-chemin-poste');
      await new Promise(x => setTimeout(x, 300));
      const repliques = document.querySelectorAll('#fiche .replique').length;
      return { reseau, compte: Conversation.compter(), lignes, repliques,
               cartes: empreinte.cartes.length, notes: empreinte.notes.length,
               recherche: Conversation.chercher('Bahnhof').length };
    `);
    verifier(horsLigne.reseau === 'coupé', 'le serveur ne répond plus — la coupure est réelle');
    verifier(horsLigne.compte.phrases >= 100 && horsLigne.lignes > 100 && horsLigne.repliques === 6,
      'hors ligne, les phrases s’affichent et un dialogue s’ouvre', horsLigne);
    verifier(horsLigne.cartes === 7 && horsLigne.notes === 2 && horsLigne.recherche > 0,
      'hors ligne, les cartes, les notes et la recherche sont là', horsLigne);
  } finally {
    onglet.fermer();
    await fermerChrome(chrome);
    try { serveur.kill(); } catch (e) { /* déjà arrêté */ }
    try { execSync(`git worktree remove --force "${ANCIENNE}"`, { cwd: RACINE, stdio: 'ignore' }); } catch (e) { /* … */ }
    rmSync(ANCIENNE, { recursive: true, force: true });
  }
}

principal().then(() => {
  console.log('');
  console.log(fautes ? `${passees} contrôles passés, ${fautes} ÉCHEC(S).`
                     : `${passees} contrôles passés. La mise à jour ne perd rien.`);
  process.exit(fautes ? 1 : 0);
}).catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
