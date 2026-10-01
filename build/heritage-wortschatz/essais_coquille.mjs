/*
 * La coquille d'une seule version — éprouvée sur un vrai Chrome, réseau
 * coupé au milieu.
 *
 * ── Ce qu'on éprouve ───────────────────────────────────────────────────────
 *
 * Depuis la 3.3, le service worker sert la page, les scripts et les styles
 * depuis le cache de sa version, et prépare la suivante dans un cache
 * distinct, tout ou rien, sans la proposer avant qu'elle soit entière. Ce
 * fichier en apporte la preuve, empreinte par empreinte :
 *
 *   A. **le premier passage**, depuis le service worker publié (la 3.2, qui
 *      sert encore « réseau d'abord ») — une carte, une note, une phrase
 *      apprise et le dictionnaire complet téléchargé sur l'ancienne version ;
 *      la nouvelle est publiée ; le réseau est coupé *pendant* que le nouveau
 *      service worker télécharge sa coquille : rien n'est proposé, aucun cache
 *      à moitié plein ne reste, l'application reste utilisable, rechargée
 *      aussi ; le réseau revient, la nouvelle version s'installe entière,
 *      le bandeau le dit, le clic bascule ; tout — cartes, notes, paquet
 *      complet — est là ;
 *   B. **sous la nouvelle règle**, vers une version suivante fabriquée pour
 *      l'occasion : tant que le bandeau n'a pas été accepté, chaque fichier
 *      servi est celui de la version en place, réseau ou pas ; une coupure
 *      pendant l'installation ne laisse rien ; au retour du réseau, la
 *      suivante s'installe entière à côté, puis remplace l'ancienne d'un
 *      bloc — jamais deux versions dans une même page ;
 *   C. **une publication incohérente** — un `sw.js` d'une version, une page
 *      d'une autre — est refusée à l'installation, sans rien laisser.
 *
 * Le serveur est celui de `serveur_essai.mjs` : on lui change son dossier,
 * on lui coupe le réseau, on ralentit ses seules requêtes d'installation.
 *
 *     node build/essais_coquille.mjs [révision de la version publiée]
 *
 * La révision vaut `main` par défaut ; l'épreuve lit dans son `sw.js` si
 * cette version sert « réseau d'abord » ou « cache d'abord », et attend ce
 * qui convient.
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lancerChrome, fermerChrome, ouvrirOnglet } from './pilote_chrome.mjs';
import { demarrerServeur } from './serveur_essai.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVISION = process.argv[2] || 'main';
/* « Le code neuf s'exécute » se lit à la version inscrite dans la page
 * (`<meta name="application-version">`), comparée à celle du dépôt. Le repère
 * d'origine — `Voix.choisir`, apparu avec la 3.3 — ne distinguait plus rien
 * dès que la version publiée l'avait aussi (passage 3.3.0 → 3.3.1). */
const PORT_WEB = 8155;
const ORIGINE = 'http://localhost:' + PORT_WEB + '/';
const TEMP = path.join(tmpdir(), 'wortschatz-coquille');
const ANCIENNE = path.join(TEMP, 'publiee');
const SUIVANTE = path.join(TEMP, 'suivante');
const BANCALE = path.join(TEMP, 'bancale');

let fautes = 0;
let passees = 0;
function verifier(condition, message, detail) {
  if (condition) { passees += 1; console.log('  ok  ' + message); return true; }
  fautes += 1;
  console.log('  NON ' + message + (detail === undefined ? '' : '  → ' + JSON.stringify(detail)));
  return false;
}
function titre(t) { console.log(''); console.log(t); }
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Les versions et leurs empreintes ────────────────────────────────────────

function versionDe(dossier) {
  return (readFileSync(path.join(dossier, 'sw.js'), 'utf8').match(/const VERSION = '([^']+)'/) || [])[1];
}
function fichiersDe(dossier) {
  const liste = readFileSync(path.join(dossier, 'sw.js'), 'utf8').split('const FICHIERS = [')[1].split('];')[0];
  return [...liste.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== './');
}
function empreintesDe(dossier, fichiers) {
  const sortie = {};
  for (const f of fichiers) {
    const chemin = path.join(dossier, f);
    sortie[f] = existsSync(chemin) ? createHash('sha256').update(readFileSync(chemin)).digest('hex') : null;
  }
  return sortie;
}

/* À quelle version appartient chaque fichier servi — et si une même version
 * les explique tous. Beaucoup de fichiers ne changent pas d'une version à
 * l'autre : ils sont de plusieurs à la fois, et c'est l'intersection qui
 * compte. Rend `unique` : le nom de la version qui explique tout, ou null
 * quand il y a mélange. */
function jeu(servis, versions) {
  const par = {};
  let communes = null;
  for (const [f, h] of Object.entries(servis)) {
    const noms = Object.entries(versions).filter(([, e]) => e[f] === h).map(([n]) => n);
    par[f] = noms.length ? noms.join('=') : (h ? 'inconnue' : 'absent');
    communes = communes === null ? noms : communes.filter((n) => noms.indexOf(n) !== -1);
  }
  const unique = communes && communes.length ? communes.join('=') : null;
  return { par, unique };
}

/* Fabrique la « version suivante » : la version en cours, un numéro de plus,
 * un script et une feuille de style retouchés, un contenu daté d'ailleurs. */
function fabriquerSuivante(source, cible, version, retoucherPage) {
  rmSync(cible, { recursive: true, force: true });
  cpSync(source, cible, {
    recursive: true,
    filter: (src) => !/[\\/](\.git|build|\.claude|captures[\\/]\.)/.test(src) || /[\\/]captures[\\/]/.test(src),
  });
  const sw = path.join(cible, 'sw.js');
  writeFileSync(sw, readFileSync(sw, 'utf8').replace(/const VERSION = '[^']+'/, `const VERSION = '${version}'`));
  if (retoucherPage) {
    const page = path.join(cible, 'index.html');
    writeFileSync(page, readFileSync(page, 'utf8')
      .replace(/name="application-version" content="[^"]+"/, `name="application-version" content="${version}"`));
    for (const f of ['js/app.js', 'css/app.css']) {
      writeFileSync(path.join(cible, f), readFileSync(path.join(cible, f), 'utf8') + `\n/* ${version} */\n`);
    }
    const conv = path.join(cible, 'data', 'conversation.json');
    writeFileSync(conv, readFileSync(conv, 'utf8').replace(/"construit": "[^"]+"/, '"construit": "2099-01-01"'));
  }
}

// ── Ce que la page sait dire ────────────────────────────────────────────────

const PRET = `
  for (let i = 0; i < 240; i++) {
    if (window.App && window.Lexique && Lexique.paquet && Lexique.manifeste
        && (!window.Conversation || Conversation.charge)) break;
    await new Promise(x => setTimeout(x, 250));
  }
`;
/* Une déclaration de fonction : elle peut apparaître deux fois dans le même
 * script, quand une épreuve lit à la fois ce qui est servi et un cache. */
const SHA = `
  async function sha(r) {
    if (!r) return null;
    const h = await crypto.subtle.digest('SHA-256', await r.arrayBuffer());
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
`;
/* Les fichiers tels que la page les recevrait — par le service worker. */
const servis = (fichiers) => `
  ${SHA}
  const servis = {};
  for (const f of ${JSON.stringify(fichiers)}) {
    try { servis[f] = await sha(await fetch(f)); } catch (e) { servis[f] = null; }
  }
`;
const contenuDuCache = (nom, fichiers) => `
  ${SHA}
  const contenuDuCache = {};
  if (await caches.has(${JSON.stringify(nom)})) {
    const c = await caches.open(${JSON.stringify(nom)});
    for (const f of ${JSON.stringify(fichiers)}) contenuDuCache[f] = await sha(await c.match(f));
  }
`;
const EMPREINTE = `
  const cartes = (await Store.toutesLesCartes()).sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(c => [c.id, c.mot, c.type, c.etat, c.intervalle, c.facilite, c.echeance, c.reussites, c.conversation || null, c.tranche]);
  const notes = (await Store.toutesLesNotes()).sort((a, b) => (a.id < b.id ? -1 : 1)).map(n => [n.id, n.texte]);
  const reglages = await Store.lireReglages();
  const empreinte = { cartes, notes, paquet: reglages.paquet, langue: reglages.langue };
`;
const VERSION_SW = `
  const versionSw = await new Promise((res) => {
    const actif = navigator.serviceWorker.controller;
    if (!actif) { res(null); return; }
    const canal = new MessageChannel();
    canal.port1.onmessage = (e) => res(e.data && e.data.version);
    actif.postMessage({ type: 'version' }, [canal.port2]);
    setTimeout(() => res('?'), 3000);
  });
`;

async function principal() {
  rmSync(TEMP, { recursive: true, force: true });
  try { execSync(`git worktree prune`, { cwd: RACINE, stdio: 'ignore' }); } catch (e) { /* … */ }
  execSync(`git worktree add --detach "${ANCIENNE}" ${REVISION}`, { cwd: RACINE, stdio: 'ignore' });
  const versionAncienne = versionDe(ANCIENNE);
  const versionNeuve = versionDe(RACINE);
  const ancienneCacheDAbord = /const MARQUE/.test(readFileSync(path.join(ANCIENNE, 'sw.js'), 'utf8'));
  fabriquerSuivante(RACINE, SUIVANTE, 'v3.3.1-essai', true);
  fabriquerSuivante(SUIVANTE, BANCALE, 'v3.3.2-essai', false);   // sw.js seul : la page reste v3.3.1-essai

  const FICHIERS = fichiersDe(RACINE);
  const COQUILLE = FICHIERS.filter((f) => !f.startsWith('data/'));
  const versions = {
    ancienne: empreintesDe(ANCIENNE, FICHIERS),
    neuve: empreintesDe(RACINE, FICHIERS),
    suivante: empreintesDe(SUIVANTE, FICHIERS),
  };
  console.log(`Version publiée : ${REVISION} (${versionAncienne}, ${ancienneCacheDAbord ? 'cache' : 'réseau'} d’abord) → ${versionNeuve} → v3.3.1-essai`);

  const serveur = await demarrerServeur({ port: PORT_WEB, dossier: ANCIENNE });
  const chrome = await lancerChrome({ port: 9421 });
  console.log('Chrome : ' + chrome.version.Browser);
  const onglet = await ouvrirOnglet(chrome, 'about:blank');

  /* Coupe le réseau pendant que le service worker télécharge sa coquille :
   * on provoque la vérification, on attend que l'installation commence, on
   * coupe, et l'on attend qu'elle échoue. Rend l'état observé. */
  async function couperPendantLInstallation() {
    const commencee = await onglet.evaluer(`
      const reg = await navigator.serviceWorker.getRegistration();
      reg.update().catch(() => {});
      for (let i = 0; i < 80; i++) {
        if (reg.installing) return true;
        await new Promise(x => setTimeout(x, 100));
      }
      return false;
    `);
    serveur.etat.mode = 'coupe';
    const apres = await onglet.evaluer(`
      const reg = await navigator.serviceWorker.getRegistration();
      for (let i = 0; i < 300; i++) {
        if (!reg.installing) break;
        await new Promise(x => setTimeout(x, 100));
      }
      await new Promise(x => setTimeout(x, 300));
      const bandeau = document.getElementById('mise-a-jour');
      return { installing: !!reg.installing, waiting: !!reg.waiting, caches: await caches.keys(),
               bandeau: !!bandeau && !bandeau.hidden, verification: await MiseAJour.verifier(true) };
    `);
    return Object.assign({ commencee }, apres);
  }

  /* Rend le réseau, provoque la vérification, attend la version en attente. */
  async function laisserInstaller() {
    serveur.etat.mode = 'normal';
    return onglet.evaluer(`
      const bandeauAvant = !document.getElementById('mise-a-jour').hidden;
      const resultat = await MiseAJour.verifier(true);
      let reg = null;
      for (let i = 0; i < 600; i++) {
        reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.waiting) break;
        await new Promise(x => setTimeout(x, 100));
      }
      await new Promise(x => setTimeout(x, 300));
      return { bandeauAvant, resultat, waiting: !!(reg && reg.waiting),
               bandeau: !document.getElementById('mise-a-jour').hidden, caches: await caches.keys() };
    `);
  }

  async function feuVert() {
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
  }

  try {
    // ── A. Le premier passage ─────────────────────────────────────────────
    titre('A1. La version publiée : une carte, une note, une phrase, le dictionnaire complet');
    await onglet.naviguer(ORIGINE);
    const avant = await onglet.evaluer(`
      ${PRET}
      for (let i = 0; i < 400; i++) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.active && navigator.serviceWorker.controller) break;
        await new Promise(x => setTimeout(x, 250));
      }
      await Store.ecrireReglage('langue', 'fr');
      Revision.sensDeTravail = 'les-deux';
      await Revision.apprendre(await Lexique.ouvrir(Lexique.vedette('de', 'Haus')));
      await Notes.ecrire({ langue: 'de', mot: 'Haus' }, 'Comme « house ».');
      if (window.Conversation) await Revision.apprendre(Conversation.entree('dg-chemin-poste/r3'));
      // Le dictionnaire complet, puis un mot qui n'existe que là.
      const candidats = ['Pfefferspray', 'Gelaber', 'Dorfstraße'];
      const horsNoyau = candidats.filter(m => !Lexique.vedette('de', m));
      const fini = await Paquets.telecharger(Lexique.manifeste, null, null);
      await Lexique.charger('complet');
      await Store.ecrireReglage('paquet', 'complet');
      const mot = horsNoyau.find(m => Lexique.vedette('de', m));
      const entree = mot ? await Lexique.ouvrir(Lexique.vedette('de', mot)) : null;
      if (entree) await Revision.apprendre(entree);
      ${EMPREINTE}
      ${VERSION_SW}
      ${servis(COQUILLE)}
      return { fini, mot, tranche: entree && entree.tranche, paquet: Lexique.paquet, versionSw,
               caches: await caches.keys(), empreinte, servis,
               codeNeuf: (document.querySelector('meta[name="application-version"]') || {}).content === '${versionNeuve}' };
    `);
    const MOT = avant.mot;
    verifier(avant.versionSw === versionAncienne && !avant.codeNeuf, `le service worker ${versionAncienne} contrôle la page, avec son code`, avant.versionSw);
    verifier(avant.fini && avant.paquet === 'complet' && !!MOT, `le dictionnaire complet est installé ; « ${MOT} », hors noyau, est appris`);
    verifier(avant.empreinte.cartes.length >= 6 && avant.empreinte.notes.length === 1,
      `l’empreinte relève ${avant.empreinte.cartes.length} cartes et 1 note`);
    const cacheDonnees = avant.caches.find((n) => n.startsWith('wortschatz-donnees-'));
    verifier(!!cacheDonnees && avant.caches.includes('wortschatz-coquille-' + versionAncienne),
      `deux caches : ${cacheDonnees} et la coquille ${versionAncienne}`, avant.caches);
    verifier(jeu(avant.servis, versions).unique === 'ancienne', 'chaque fichier servi est celui de la version publiée');

    titre('A2. La nouvelle version est publiée ; le réseau tombe pendant l’installation');
    serveur.etat.dossier = RACINE;
    serveur.etat.delaiMarque = 600;
    await onglet.naviguer(ORIGINE);
    const sousAncien = await onglet.evaluer(`
      ${PRET}
      ${VERSION_SW}
      ${servis(COQUILLE)}
      return { versionSw, codeNeuf: (document.querySelector('meta[name="application-version"]') || {}).content === '${versionNeuve}', servis, paquet: Lexique.paquet };
    `);
    verifier(sousAncien.versionSw === versionAncienne, 'l’ancien service worker sert encore');
    const attenduSousAncien = ancienneCacheDAbord ? 'ancienne' : 'neuve';
    const jeuSousAncien = jeu(sousAncien.servis, versions);
    verifier(jeuSousAncien.unique === attenduSousAncien && sousAncien.codeNeuf === !ancienneCacheDAbord,
      ancienneCacheDAbord
        ? 'cache d’abord : la page est encore entièrement l’ancienne version'
        : 'réseau d’abord (la règle de l’ancien service worker) : la page reçoit le code neuf, d’une seule version',
      jeuSousAncien.par);
    const coupure = await couperPendantLInstallation();
    verifier(coupure.commencee, 'l’installation de la nouvelle version a commencé (ses requêtes portent la marque, ralenties)');
    verifier(!coupure.installing && !coupure.waiting && !coupure.bandeau,
      'réseau coupé au milieu : l’installation échoue, rien n’est proposé, pas de bandeau', coupure);
    verifier(!coupure.caches.includes('wortschatz-coquille-' + versionNeuve),
      'aucun cache à moitié rempli ne reste sous le nom de la nouvelle version', coupure.caches);
    verifier(coupure.verification === 'echec', 'chercher une mise à jour sans réseau répond « échec »', coupure.verification);
    const pendantCoupure = await onglet.evaluer(`
      const recherche = Lexique.chercher('Haus').some(r => r.mot === 'Haus');
      const ouvre = !!(await Lexique.ouvrir(Lexique.vedette('de', ${JSON.stringify(MOT)})));
      return { recherche, ouvre, paquet: Lexique.paquet };
    `);
    verifier(pendantCoupure.recherche && pendantCoupure.ouvre && pendantCoupure.paquet === 'complet',
      'pendant la coupure, l’application ouverte reste utilisable, dictionnaire complet compris');
    await onglet.naviguer(ORIGINE);
    const rechargee = await onglet.evaluer(`
      ${PRET}
      ${VERSION_SW}
      ${servis(COQUILLE)}
      const ouvre = !!(await Lexique.ouvrir(Lexique.vedette('de', ${JSON.stringify(MOT)})));
      return { versionSw, servis, paquet: Lexique.paquet, ouvre, phrases: window.Conversation ? Conversation.compter().phrases : null };
    `);
    const jeuRechargee = jeu(rechargee.servis, versions);
    verifier(rechargee.versionSw === versionAncienne && rechargee.paquet === 'complet' && rechargee.ouvre && jeuRechargee.unique !== null,
      `rechargée sans réseau, elle s’ouvre encore — servie par ${versionAncienne}, d’une seule version (${jeuRechargee.unique}), dictionnaire complet compris`,
      jeuRechargee.par);

    titre('A3. Le réseau revient : la nouvelle version s’installe entière, puis attend');
    const installee = await laisserInstaller();
    verifier(!installee.bandeauAvant && installee.waiting && installee.bandeau,
      'la version prête est annoncée — et seulement maintenant', installee);
    const cacheNeuf = await onglet.evaluer(`
      ${contenuDuCache('wortschatz-coquille-' + versionNeuve, FICHIERS)}
      return contenuDuCache;
    `);
    const jeuCacheNeuf = jeu(cacheNeuf, versions);
    verifier(jeuCacheNeuf.unique === 'neuve' && Object.keys(cacheNeuf).length === FICHIERS.length,
      `le cache ${versionNeuve} est entier — ${FICHIERS.length} fichiers, tous de la nouvelle version, données fournies comprises`, jeuCacheNeuf.par);
    verifier(installee.caches.includes('wortschatz-coquille-' + versionAncienne) && installee.caches.includes(cacheDonnees),
      'l’ancienne coquille et le cache des données sont intacts pendant l’attente', installee.caches);

    titre('A4. Le clic : la nouvelle version, entière, et rien de perdu');
    await feuVert();
    const apres = await onglet.evaluer(`
      ${PRET}
      ${VERSION_SW}
      ${servis(FICHIERS)}
      ${EMPREINTE}
      const ouvre = !!(await Lexique.ouvrir(Lexique.vedette('de', ${JSON.stringify(MOT)})));
      const complet = await Paquets.complet(Lexique.manifeste);
      return { versionSw, servis, empreinte, paquet: Lexique.paquet, ouvre, complet, caches: await caches.keys(),
               phrases: Conversation.compter().phrases, version: MiseAJour.version };
    `);
    const jeuApres = jeu(apres.servis, versions);
    verifier(apres.versionSw === versionNeuve && jeuApres.unique === 'neuve',
      `le service worker ${versionNeuve} sert la page : les ${FICHIERS.length} fichiers, tous de sa version`, jeuApres.par);
    verifier(apres.caches.length === 2 && apres.caches.includes('wortschatz-coquille-' + versionNeuve) && apres.caches.includes(cacheDonnees),
      'l’ancienne coquille est effacée, le cache des données ne bouge pas', apres.caches);
    verifier(apres.paquet === 'complet' && apres.complet && apres.ouvre,
      `le dictionnaire complet sert toujours : « ${MOT} » s’ouvre`);
    verifier(JSON.stringify(apres.empreinte) === JSON.stringify(avant.empreinte),
      'cartes, notes et réglages : identiques champ par champ', { avant: avant.empreinte, apres: apres.empreinte });
    verifier(apres.phrases >= 280, `le contenu de la ${versionNeuve} est là (${apres.phrases} phrases)`);

    titre('A5. Sous la nouvelle règle, le réseau ne compte plus pour la page');
    for (const mode of ['coupe', 'erreur']) {
      serveur.etat.mode = mode;
      await onglet.naviguer(ORIGINE);
      const sans = await onglet.evaluer(`
        ${PRET}
        ${servis(COQUILLE)}
        const ouvre = !!(await Lexique.ouvrir(Lexique.vedette('de', ${JSON.stringify(MOT)})));
        return { servis, ouvre, verification: await MiseAJour.verifier(true) };
      `);
      verifier(jeu(sans.servis, versions).unique === 'neuve' && sans.ouvre && sans.verification === 'echec',
        mode === 'coupe' ? 'réseau muet : la page vient du cache, entière, et le dit'
                         : 'réseau en erreur (503) : idem — rien du serveur n’entre dans la page', sans);
    }
    serveur.etat.mode = 'normal';

    // ── B. Vers la version suivante ───────────────────────────────────────
    titre('B1. Une version suivante est publiée : la page en place reste entière jusqu’au clic');
    serveur.etat.dossier = SUIVANTE;
    await onglet.naviguer(ORIGINE);
    const enPlace = await onglet.evaluer(`
      ${PRET}
      ${VERSION_SW}
      ${servis(FICHIERS)}
      return { versionSw, servis, construit: Conversation.construit };
    `);
    const jeuEnPlace = jeu(enPlace.servis, versions);
    verifier(enPlace.versionSw === versionNeuve && jeuEnPlace.unique === 'neuve' && enPlace.construit !== '2099-01-01',
      'le serveur sert la suivante, la page reçoit encore la version en place, fichier par fichier', jeuEnPlace.par);

    titre('B2. Coupure pendant l’installation de la suivante');
    const coupure2 = await couperPendantLInstallation();
    verifier(coupure2.commencee && !coupure2.waiting && !coupure2.bandeau
             && !coupure2.caches.includes('wortschatz-coquille-v3.3.1-essai'),
      'l’installation échoue proprement : rien de proposé, rien de laissé', coupure2);
    await onglet.naviguer(ORIGINE);
    const rechargee2 = await onglet.evaluer(`
      ${PRET}
      ${servis(COQUILLE)}
      return { servis, verification: await MiseAJour.verifier(true) };
    `);
    verifier(jeu(rechargee2.servis, versions).unique === 'neuve' && rechargee2.verification === 'echec',
      'rechargée sans réseau : la version en place, entière', jeu(rechargee2.servis, versions).par);

    titre('B3. Retour du réseau : la suivante s’installe à côté, entière, sans toucher à la page');
    const installee2 = await laisserInstaller();
    const cote = await onglet.evaluer(`
      ${contenuDuCache('wortschatz-coquille-v3.3.1-essai', FICHIERS)}
      ${servis(FICHIERS)}
      return { contenuDuCache, servis, construit: Conversation.construit };
    `);
    verifier(installee2.waiting && installee2.bandeau && !installee2.bandeauAvant, 'annoncée une fois entière', installee2);
    verifier(jeu(cote.contenuDuCache, versions).unique === 'suivante' && Object.keys(cote.contenuDuCache).length === FICHIERS.length,
      'le cache de la suivante est entier, tous ses fichiers de la suivante', jeu(cote.contenuDuCache, versions).par);
    verifier(jeu(cote.servis, versions).unique === 'neuve' && cote.construit !== '2099-01-01',
      'la page, elle, est toujours servie en version en place — données fournies comprises');

    titre('B4. Le clic : bascule d’un bloc');
    await feuVert();
    const apres2 = await onglet.evaluer(`
      ${PRET}
      ${VERSION_SW}
      ${servis(FICHIERS)}
      ${EMPREINTE}
      const ouvre = !!(await Lexique.ouvrir(Lexique.vedette('de', ${JSON.stringify(MOT)})));
      return { versionSw, servis, empreinte, ouvre, paquet: Lexique.paquet, caches: await caches.keys(), construit: Conversation.construit };
    `);
    verifier(apres2.versionSw === 'v3.3.1-essai' && jeu(apres2.servis, versions).unique === 'suivante' && apres2.construit === '2099-01-01',
      'la suivante sert tout, données fournies comprises', jeu(apres2.servis, versions).par);
    verifier(apres2.caches.length === 2 && apres2.caches.includes(cacheDonnees) && !apres2.caches.includes('wortschatz-coquille-' + versionNeuve),
      'l’ancienne coquille est partie, les données restent', apres2.caches);
    verifier(apres2.paquet === 'complet' && apres2.ouvre && JSON.stringify(apres2.empreinte) === JSON.stringify(avant.empreinte),
      'dictionnaire complet, cartes, notes et réglages : intacts');

    // ── C. Une publication incohérente ────────────────────────────────────
    titre('C. Un sw.js d’une version, une page d’une autre : refusé, sans rien laisser');
    serveur.etat.dossier = BANCALE;
    serveur.etat.delaiMarque = 0;
    const bancale = await onglet.evaluer(`
      const resultat = await MiseAJour.verifier(true);
      const reg = await navigator.serviceWorker.getRegistration();
      for (let i = 0; i < 300; i++) {
        if (!reg.installing) break;
        await new Promise(x => setTimeout(x, 100));
      }
      await new Promise(x => setTimeout(x, 500));
      ${VERSION_SW}
      return { resultat, waiting: !!reg.waiting, caches: await caches.keys(), versionSw,
               bandeau: !document.getElementById('mise-a-jour').hidden };
    `);
    verifier(!bancale.waiting && !bancale.bandeau && !bancale.caches.includes('wortschatz-coquille-v3.3.2-essai')
             && bancale.versionSw === 'v3.3.1-essai',
      'l’installation est refusée : la page n’est pas de la version du service worker ; rien n’est proposé, rien ne reste', bancale);
  } finally {
    onglet.fermer();
    await fermerChrome(chrome);
    await serveur.fermer();
    try { execSync(`git worktree remove --force "${ANCIENNE}"`, { cwd: RACINE, stdio: 'ignore' }); } catch (e) { /* … */ }
    rmSync(TEMP, { recursive: true, force: true });
  }
}

principal().then(() => {
  console.log('');
  console.log(fautes ? `${passees} contrôles passés, ${fautes} ÉCHEC(S).`
                     : `${passees} contrôles passés. La coquille est d’une seule version, coupure ou pas.`);
  process.exit(fautes ? 1 : 0);
}).catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
