/*
 * La mise à jour 3.2 → 3.3, vécue par quelqu'un qui apprenait déjà des
 * phrases — sur un vrai Chrome.
 *
 * ── Ce qu'on éprouve ───────────────────────────────────────────────────────
 *
 * Cette fois, c'est le contenu qui change : `data/conversation.json` passe de
 * 148 à 280 phrases, de 9 à 11 situations, et gagne les mentions de
 * relecture. Il voyage avec la coquille, en cache d'abord ; il faut donc
 * vérifier ce que promet le README :
 *
 *   1. **rien ne bouge** — cartes (dont celles d'une phrase et d'une réplique),
 *      notes, phrase et dialogue à soi, réglages (dont la voix choisie),
 *      identiques champ par champ, avant, pendant et après ;
 *   2. **rien n'est mélangé ni coupé** — tant que le bandeau n'a pas été
 *      accepté, la page tourne avec le code neuf mais le contenu d'avant,
 *      entier (148 phrases, 9 situations), et aucune phrase de la 3.3 ne
 *      s'y glisse ; on le vérifie **fichier par fichier**, par empreinte :
 *      chaque fichier de la coquille est celui de la version neuve, chaque
 *      fichier sous `data/` celui de la version d'avant, et le cache de
 *      l'ancien service worker a reçu les fichiers neufs au passage ; après
 *      le clic, le contenu neuf est là, entier, et les cartes d'avant
 *      s'ouvrent toujours ;
 *   3. la sauvegarde exportée par la 3.2 se relit sans rien proposer ;
 *   4. une phrase de la 3.3 s'apprend depuis un dialogue neuf, sans doublon ;
 *   5. tout tient hors ligne, contenu neuf compris.
 *
 *     node build/essais_migration_contenu.mjs [révision de la version publiée]
 *
 * La révision vaut `main` par défaut : la 3.2, tant que la 3.3 n'est pas
 * fusionnée. Une fois qu'elle l'est, donner `0aa5707`.
 */
import { execSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync, statSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lancerChrome, fermerChrome, ouvrirOnglet } from './pilote_chrome.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVISION = process.argv[2] || 'main';
const PORT_WEB = 8154;
const ORIGINE = 'http://localhost:' + PORT_WEB + '/';
const ANCIENNE = path.join(tmpdir(), 'wortschatz-version-publiee-contenu');
const VERSION_NEUVE = (readFileSync(path.join(RACINE, 'sw.js'), 'utf8').match(/const VERSION = '([^']+)'/) || [])[1];

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
    if (window.App && window.Lexique && Lexique.paquet && window.Conversation && Conversation.charge) break;
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

/* Tout ce qui appartient à la personne, à l'octet près. */
const EMPREINTE = `
  const cartes = (await Store.toutesLesCartes()).sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(c => [c.id, c.langue, c.mot, c.type, c.etat, c.palier, c.intervalle, c.facilite,
               c.echeance, c.reussites, c.echecs, c.cree, c.vu, c.perso || null, c.conversation || null, c.tranche]);
  const notes = (await Store.toutesLesNotes()).sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(n => [n.id, n.texte, n.cree, n.modifie, n.langue, n.mot]);
  const perso = (await Store.tousLesMotsPerso()).sort((a, b) => (a.id < b.id ? -1 : 1));
  const conversation = (await Store.touteLaConversation()).sort((a, b) => (a.id < b.id ? -1 : 1));
  const reglages = await Store.lireReglages();
  const journal = (await Store.journalDepuis(0)).length;
  return { cartes, notes, perso, conversation,
           reglages: { langue: reglages.langue, sensDeTravail: reglages.sensDeTravail, voix: reglages.voix,
                       voixFr: reglages.voixFr || null, voixDe: reglages.voixDe || null,
                       conversationLangue: reglages.conversationLangue || null,
                       nouveautesParJour: reglages.nouveautesParJour, exigerArticle: reglages.exigerArticle },
           journal };
`;

async function principal() {
  if (existsSync(ANCIENNE)) {
    try { execSync(`git worktree remove --force "${ANCIENNE}"`, { cwd: RACINE, stdio: 'ignore' }); } catch (e) { /* … */ }
    rmSync(ANCIENNE, { recursive: true, force: true });
  }
  execSync(`git worktree add --detach "${ANCIENNE}" ${REVISION}`, { cwd: RACINE, stdio: 'ignore' });
  vieillir(ANCIENNE, new Date('2020-01-01T00:00:00Z'));
  const versionAncienne = (readFileSync(path.join(ANCIENNE, 'sw.js'), 'utf8').match(/const VERSION = '([^']+)'/) || [])[1];
  /* Les fichiers de la coquille neuve, et leur empreinte dans chaque version :
   * c'est ce qui permet de dire, dans l'entre-deux, d'où vient chacun. */
  const empreinteDe = (dossier, fichier) => (existsSync(path.join(dossier, fichier))
    ? createHash('sha256').update(readFileSync(path.join(dossier, fichier))).digest('hex') : null);
  const listeCoquille = readFileSync(path.join(RACINE, 'sw.js'), 'utf8').split('const FICHIERS = [')[1].split('];')[0];
  const FICHIERS = [...listeCoquille.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== './');
  const EMPREINTES = FICHIERS.map((f) => ({ fichier: f, neuve: empreinteDe(RACINE, f), ancienne: empreinteDe(ANCIENNE, f) }));
  const contenuAncien = JSON.parse(readFileSync(path.join(ANCIENNE, 'data', 'conversation.json'), 'utf8'));
  const contenuNeuf = JSON.parse(readFileSync(path.join(RACINE, 'data', 'conversation.json'), 'utf8'));
  console.log(`Version publiée : ${REVISION} (${versionAncienne}, ${contenuAncien.phrases.length} phrases) → ${VERSION_NEUVE} (${contenuNeuf.phrases.length} phrases)`);

  let serveur = servir(ANCIENNE);
  await attendreServeur(true);
  const chrome = await lancerChrome({ port: 9419 });
  console.log('Chrome : ' + chrome.version.Browser);
  const onglet = await ouvrirOnglet(chrome, 'about:blank');

  try {
    titre('1. La version publiée : phrases apprises, dialogue à soi, notes, réglages');
    await onglet.naviguer(ORIGINE);
    const avant = await onglet.evaluer(`
      ${ATTENDRE_PRET}
      await Store.ecrireReglage('langue', 'de');
      await Store.ecrireReglage('sensDeTravail', 'les-deux');
      await Store.ecrireReglage('conversationLangue', 'fr');
      Revision.sensDeTravail = 'les-deux';
      // Un mot du dictionnaire, une phrase depuis un dialogue, une réplique sans phrase listée.
      await Revision.apprendre(await Lexique.ouvrir(Lexique.vedette('de', 'Haus')));
      const depuisDialogue = await Revision.apprendre(Conversation.entree('dg-chemin-poste/r3'));
      const replique = await Revision.apprendre(Conversation.entree('dg-chemin-poste/r1'));
      // Une phrase et un dialogue à soi, une réplique du dialogue apprise.
      const mienne = await Conversation.creer('phrase', { fr: 'Je cherche le rayon des surgelés.',
        de: 'Ich suche die Tiefkühlabteilung.', theme: 'achats', registre: 'poli' });
      const mien = await Conversation.creer('dialogue', { titre: 'Au marché', theme: 'achats', registre: 'poli',
        roles: { A: 'Moi', B: 'La maraîchère' },
        repliques: [{ qui: 'A', fr: 'Bonjour, un kilo de pommes.', de: 'Guten Tag, ein Kilo Äpfel.' },
                    { qui: 'B', fr: 'Des rouges ou des vertes ?', de: 'Rote oder grüne?' }] });
      await Revision.apprendre(Conversation.entree(mienne.id));
      await Revision.apprendre(Conversation.entree(mien.id + '/' + mien.repliques[1].id));
      // Des notes : sur la phrase, sur le dialogue fourni, sur la mienne.
      await Notes.ecrire({ conversation: 'ph-chemin-loin', langue: 'de', mot: 'Ist es weit?' }, 'Weit = loin, comme « wide ».');
      await Notes.ecrire({ conversation: 'dg-chemin-poste', langue: 'de', mot: 'Nach der Post fragen' }, 'Relu avec Anne.');
      await Notes.ecrire({ conversation: mienne.id, langue: 'de', mot: mienne.de }, 'Entendu chez Edeka.');
      // Des semaines de révisions, condensées.
      const toutes = await Store.toutesLesCartes();
      let n = 0;
      for (const c of toutes) {
        n += 1;
        c.etat = 'revision'; c.intervalle = 10 + n * 7; c.facilite = 2.1 + n * 0.05;
        c.echeance = 1900000000000 + n * 86400000; c.reussites = n; c.echecs = n % 2; c.vu = 1899000000000;
        await Store.ecrireCarte(c);
      }
      await Revision.noter((await Store.toutesLesCartes())[0], Revision.CORRECT, 'saisie');
      const sauvegarde = JSON.stringify(await Sauvegarde.rassembler());
      const empreinte = await (async () => { ${EMPREINTE} })();
      return { coquille: (await caches.keys()).find(n => n.startsWith('wortschatz-coquille-')),
               depuisDialogue: depuisDialogue.map(c => c.conversation), replique: replique.map(c => c.conversation),
               mienne: mienne.id, mien: mien.id, compte: Conversation.compter(), themes: Conversation.themes().length,
               aVoixChoix: typeof Voix.choisir === 'function', sauvegarde, empreinte };
    `);
    verifier(avant.coquille === 'wortschatz-coquille-' + versionAncienne, 'la coquille est celle de la version publiée', avant.coquille);
    verifier(!avant.aVoixChoix, 'cette version ne sait pas choisir une voix — c’est bien l’ancienne');
    verifier(avant.compte.phrases === contenuAncien.phrases.length + 1 && avant.themes === contenuAncien.themes.length,
      `${contenuAncien.phrases.length} phrases fournies et ${contenuAncien.themes.length} situations, plus la sienne`, avant.compte);
    verifier(avant.depuisDialogue.every((c) => c === 'ph-chemin-loin') && avant.replique.every((c) => c === 'dg-chemin-poste/r1'),
      '« Ist es weit? » rangée sous sa phrase, la première réplique sous elle-même');
    verifier(avant.empreinte.cartes.length === 11 && avant.empreinte.notes.length === 3
             && avant.empreinte.conversation.length === 2 && avant.empreinte.journal === 1,
      'l’empreinte relève 11 cartes, 3 notes, 2 écrits à soi, 1 ligne de journal', avant.empreinte.cartes.length);
    const ancienne = JSON.parse(avant.sauvegarde);
    verifier(ancienne.version === 2 && ancienne.conversation.length === 2, 'la sauvegarde exportée est au format 2, avec les écrits à soi');

    titre('2. La nouvelle version est servie au même endroit — avant le clic, l’ancien contenu sert, entier');
    serveur.kill();
    await attendreServeur(false);
    serveur = servir(RACINE);
    await attendreServeur(true);
    await onglet.naviguer(ORIGINE);
    const pendant = await onglet.evaluer(`
      ${ATTENDRE_PRET}
      const version = (await new Promise((res) => {
        const d = indexedDB.open('wortschatz'); d.onsuccess = () => { const v = d.result.version; d.result.close(); res(v); };
      }));
      // Le code neuf est là (choix de voix), avec le contenu d'avant, sans mélange.
      const voix = Voix.diagnostic('fr');
      const liste = Voix.lister('fr');
      let choix = null;
      if (liste.length) {
        choix = Voix.choisir('fr', liste[liste.length - 1].uri);
        await Store.ecrireReglage('voixFr', choix);
      }
      const empreinte = await (async () => { ${EMPREINTE} })();
      /* Fichier par fichier : ce que la page reçoit du service worker en
       * place, et ce que son cache contient maintenant. */
      const sha = async (r) => {
        if (!r) return null;
        const h = await crypto.subtle.digest('SHA-256', await r.arrayBuffer());
        return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
      };
      const servis = {};
      for (const f of ${JSON.stringify(FICHIERS)}) servis[f] = await sha(await fetch(f));
      const ancienCache = await caches.open('wortschatz-coquille-' + ${JSON.stringify(versionAncienne)});
      const enCache = {};
      for (const f of ['index.html', 'js/voix.js', 'js/app.js', 'js/conversation.js', 'css/app.css', 'data/conversation.json']) {
        enCache[f] = await sha(await ancienCache.match(f));
      }
      await MiseAJour.verifier(true);
      let reg = null;
      for (let i = 0; i < 400; i++) {
        reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.waiting) break;
        await new Promise(x => setTimeout(x, 250));
      }
      await new Promise(x => setTimeout(x, 500));
      return { version, empreinte, servis, enCache, attend: !!(reg && reg.waiting),
               bandeau: !document.getElementById('mise-a-jour').hidden,
               codeNeuf: typeof Voix.choisir === 'function' && typeof Conversation.expressionsDans === 'function',
               compte: Conversation.compter(), themes: Conversation.themes().map(t => t.id),
               neuve: Conversation.phrase('ph-quotidien-pas-de-souci'), relu: Conversation.entree('dg-chemin-poste/r1').relu,
               cartesPhrase: (await Store.cartesDeConversation('ph-chemin-loin')).length,
               ouvre: !!(await Lexique.ouvrir({ conversation: 'ph-chemin-loin' })),
               voix: { pret: voix.pret, total: voix.total, choix }, caches: await caches.keys() };
    `);
    verifier(pendant.version === 4, 'la base reste en version 4 : rien à migrer', pendant.version);
    verifier(pendant.codeNeuf, 'le code neuf tourne (réseau d’abord)');
    verifier(pendant.compte.phrases === contenuAncien.phrases.length + 1 && pendant.themes.length === contenuAncien.themes.length,
      `mais le contenu servi est encore l’ancien, entier : ${contenuAncien.phrases.length} phrases, ${contenuAncien.themes.length} situations`, pendant.compte);
    verifier(pendant.neuve === null, 'aucune phrase de la 3.3 ne s’y glisse');
    verifier(pendant.relu === null, 'et le code neuf, devant l’ancien fichier sans mention, ne dit rien de relu');
    verifier(pendant.cartesPhrase === 2 && pendant.ouvre, 'la phrase apprise s’ouvre, ses deux cartes sont là');
    const empreintePendant = Object.assign({}, pendant.empreinte, { reglages: Object.assign({}, pendant.empreinte.reglages, { voixFr: null }) });
    verifier(JSON.stringify(empreintePendant) === JSON.stringify(avant.empreinte),
      'cartes, notes, écrits à soi, réglages et journal : identiques champ par champ',
      { avant: avant.empreinte.reglages, pendant: pendant.empreinte.reglages });
    verifier(pendant.attend && pendant.bandeau, 'le nouveau service worker est installé, attend, et le bandeau le dit');
    verifier(pendant.caches.includes('wortschatz-coquille-' + versionAncienne),
      'la coquille d’avant est toujours là — c’est elle qui sert', pendant.caches);

    titre('2 bis. Fichier par fichier : la coquille en version neuve, les données en version d’avant');
    const coquille = EMPREINTES.filter((e) => !e.fichier.startsWith('data/'));
    const donnees = EMPREINTES.filter((e) => e.fichier.startsWith('data/'));
    const changes = coquille.filter((e) => e.neuve !== e.ancienne).map((e) => e.fichier);
    const mauvais = coquille.filter((e) => pendant.servis[e.fichier] !== e.neuve).map((e) => e.fichier);
    verifier(mauvais.length === 0 && coquille.length >= 25,
      `les ${coquille.length} fichiers de la coquille sont servis en version neuve — dont les ${changes.length} qui ont changé : ${changes.join(', ')}`, mauvais);
    const dAvant = donnees.filter((e) => pendant.servis[e.fichier] !== e.ancienne).map((e) => e.fichier);
    verifier(dAvant.length === 0 && donnees.some((e) => e.fichier === 'data/conversation.json'),
      `les ${donnees.length} fichiers sous data/ sont servis en version d’avant : ${donnees.map((e) => e.fichier).join(', ')}`, dAvant);
    const conv = donnees.find((e) => e.fichier === 'data/conversation.json');
    verifier(conv.neuve !== conv.ancienne && pendant.servis['data/conversation.json'] === conv.ancienne,
      'conversation.json a changé, et c’est bien l’ancien qui est servi — aucun fichier ne vient d’une version et demie');
    const manifeste = donnees.find((e) => e.fichier === 'data/manifeste.json');
    verifier(manifeste && manifeste.neuve === manifeste.ancienne,
      'le manifeste des données est le même dans les deux versions : la mouture du dictionnaire n’a pas changé');
    const neufsEnCache = ['index.html', 'js/voix.js', 'js/app.js', 'js/conversation.js', 'css/app.css']
      .filter((f) => pendant.enCache[f] === EMPREINTES.find((e) => e.fichier === f).neuve);
    verifier(neufsEnCache.length === 5 && pendant.enCache['data/conversation.json'] === conv.ancienne,
      'le cache de l’ancien service worker a reçu les fichiers neufs au passage, et garde ses données : hors ligne avant le clic, même état',
      pendant.enCache);
    console.log(`  (voix : liste ${pendant.voix.pret ? 'arrivée' : 'non arrivée'}, ${pendant.voix.total} voix ; choix français enregistré : ${pendant.voix.choix ? pendant.voix.choix.nom : 'aucune voix'})`);

    titre('3. Le feu vert : le contenu neuf, entier, et rien de perdu');
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
    const apres = await onglet.evaluer(`
      ${ATTENDRE_PRET}
      const empreinte = await (async () => { ${EMPREINTE} })();
      const reglages = await Store.lireReglages();
      const dVoix = Voix.diagnostic('fr');
      // Une phrase neuve, apprise depuis un dialogue neuf.
      const creees = await Revision.apprendre(Conversation.entree('dg-aide-service/r1'));
      const encore = await Revision.apprendre(Conversation.entree('ph-aide-petit-service'));
      // La fiche : provenance des deux sortes.
      Situations.ouvrirDialogue('dg-chemin-poste');
      await new Promise(x => setTimeout(x, 300));
      const provenanceAncien = document.querySelector('#fiche-contenu .conv-provenance').textContent;
      document.querySelector('.fiche-fermer').click();
      Situations.ouvrirDialogue('dg-aide-service');
      await new Promise(x => setTimeout(x, 300));
      const provenanceNeuf = document.querySelector('#fiche-contenu .conv-provenance').textContent;
      const repliquesNeuf = document.querySelectorAll('#fiche .replique').length;
      document.querySelector('.fiche-fermer').click();
      const fichier = new File([${JSON.stringify(avant.sauvegarde)}], 'ancienne.json', { type: 'application/json' });
      const bilan = await Sauvegarde.examiner(fichier);
      return { caches: await caches.keys(), empreinte, compte: Conversation.compter(), themes: Conversation.themes().map(t => t.id),
               relu: Conversation.entree('dg-chemin-poste/r1').relu, reluNeuf: Conversation.entree('dg-aide-service/r2').relu,
               cartesPhrase: (await Store.cartesDeConversation('ph-chemin-loin')).length,
               cartesReplique: (await Store.cartesDeConversation('dg-chemin-poste/r1')).length,
               mienne: !!Conversation.brut('${avant.mienne}'), mien: !!Conversation.brut('${avant.mien}'),
               creees: creees.map(c => c.conversation), encore: encore.length,
               voixFr: reglages.voixFr || null, dVoix: { choix: dVoix.choix, introuvable: dVoix.choixIntrouvable },
               provenanceAncien, provenanceNeuf, repliquesNeuf,
               bilan: bilan.erreur || { neufs: bilan.neufs, conflits: bilan.conflits, ignorees: bilan.ignorees },
               passerelle: Conversation.expressionsDans('ph-quotidien-pas-de-souci', 'de').map(v => v.mot) };
    `);
    verifier(apres.caches.includes('wortschatz-coquille-' + VERSION_NEUVE) && !apres.caches.includes('wortschatz-coquille-' + versionAncienne),
      `la coquille ${VERSION_NEUVE} a remplacé la ${versionAncienne}`, apres.caches);
    verifier(apres.compte.phrases === contenuNeuf.phrases.length + 1 && apres.compte.dialogues === contenuNeuf.dialogues.length + 1
             && apres.themes.length === contenuNeuf.themes.length,
      `le contenu neuf est là, entier : ${contenuNeuf.phrases.length} phrases, ${contenuNeuf.dialogues.length} dialogues, ${contenuNeuf.themes.length} situations`, apres.compte);
    verifier(JSON.stringify(apres.empreinte) === JSON.stringify(pendant.empreinte),
      'cartes, notes, écrits à soi, réglages et journal : identiques champ par champ après le clic',
      { pendant: pendant.empreinte.reglages, apres: apres.empreinte.reglages });
    verifier(apres.cartesPhrase === 2 && apres.cartesReplique === 2 && apres.mienne && apres.mien,
      'la phrase apprise, la réplique apprise, la phrase et le dialogue à soi sont toujours là');
    verifier(JSON.stringify(apres.relu) === JSON.stringify({ de: 'natif' }) && apres.reluNeuf === null,
      'le dialogue de la 3.2 se dit validé en allemand, celui de la 3.3 non');
    // L'interface est en allemand depuis l'étape 1 : les mentions le sont aussi.
    verifier(/locutrice native|Muttersprachlerin bestätigt/.test(apres.provenanceAncien)
             && /n’ont encore été relus|von Muttersprachlern durchgesehen/.test(apres.provenanceNeuf) && apres.repliquesNeuf === 7,
      'la fiche le dit, en deux mentions distinctes ; le dialogue neuf s’ouvre avec ses 7 répliques',
      { ancien: apres.provenanceAncien, neuf: apres.provenanceNeuf });
    verifier(apres.creees.every((c) => c === 'ph-aide-petit-service') && apres.creees.length === 2 && apres.encore === 0,
      'une phrase de la 3.3 s’apprend depuis son dialogue — deux cartes — et sa fiche n’en ajoute aucune');
    verifier(pendant.voix.choix ? (apres.voixFr && apres.voixFr.uri === pendant.voix.choix.uri && apres.dVoix.choix && !apres.dVoix.introuvable)
                                : (apres.voixFr === null),
      pendant.voix.choix ? 'la voix choisie avant le clic est toujours choisie, et toujours là' : 'sans voix sur ce Chrome, aucun choix n’a été écrit', apres.dVoix);
    verifier(apres.bilan && apres.bilan.neufs === 0 && apres.bilan.conflits === 0,
      'la sauvegarde de la 3.2 se relit : tout y est déjà, rien n’est refusé', apres.bilan);
    verifier(apres.passerelle.includes('kein Problem'), '« Kein Problem. » mène à l’expression du dictionnaire, noyau compris', apres.passerelle);

    titre('4. Hors ligne, contenu neuf compris');
    serveur.kill();
    await attendreServeur(false);
    await onglet.naviguer(ORIGINE);
    const horsLigne = await onglet.evaluer(`
      for (let i = 0; i < 120; i++) {
        if (window.App && window.Lexique && Lexique.paquet && window.Conversation && Conversation.charge) break;
        await new Promise(x => setTimeout(x, 250));
      }
      const reseau = await fetch('data/manifeste.json?sonde=' + Date.now(), { cache: 'no-store' })
        .then(() => 'répond').catch(() => 'coupé');
      const empreinte = await (async () => { ${EMPREINTE} })();
      App.basculer('conversation');
      await new Promise(x => setTimeout(x, 300));
      const situations = [...document.querySelectorAll('#vue-conversation .conv-theme')].map(b => b.dataset.theme).filter(Boolean);
      Situations.ouvrirDialogue('dg-visite-amis');
      await new Promise(x => setTimeout(x, 300));
      const repliques = document.querySelectorAll('#fiche .replique').length;
      document.querySelector('.fiche-fermer').click();
      App.basculer('reglages');
      await new Promise(x => setTimeout(x, 300));
      const blocsVoix = document.querySelectorAll('#zone-voix .reglage-voix-langue').length;
      return { reseau, compte: Conversation.compter(), situations, repliques, blocsVoix,
               cartes: empreinte.cartes.length, notes: empreinte.notes.length,
               recherche: Conversation.chercher('Daumen').map(r => r.id) };
    `);
    verifier(horsLigne.reseau === 'coupé', 'le serveur ne répond plus — la coupure est réelle');
    verifier(horsLigne.compte.phrases === contenuNeuf.phrases.length + 1 && horsLigne.situations.length === contenuNeuf.themes.length
             && horsLigne.repliques === 6,
      'hors ligne, les 280 phrases et les 11 situations s’affichent, un dialogue neuf s’ouvre', horsLigne);
    verifier(horsLigne.cartes === 13 && horsLigne.notes === 3 && horsLigne.recherche.length >= 2 && horsLigne.blocsVoix === 2,
      'hors ligne, les 13 cartes, les 3 notes, la recherche « Daumen » et le réglage des voix sont là', horsLigne);
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
                     : `${passees} contrôles passés. La mise à jour du contenu ne perd rien et ne mélange rien.`);
  process.exit(fautes ? 1 : 0);
}).catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
