/*
 * Le passage d'une mouture des données à la suivante, vécu par quelqu'un qui
 * avait installé le dictionnaire complet.
 *
 * ── Ce qu'on éprouve ───────────────────────────────────────────────────────
 *
 * La version précédente de l'application (l'arbre `main`, servi tel quel)
 * s'installe, télécharge son paquet complet, et une carte de révision est
 * créée sur un mot qui n'existe que là — hors du noyau. Puis la version en
 * cours de travail est servie **au même endroit**, comme le ferait un
 * déploiement, et l'on vérifie :
 *
 *   1. que rien n'est perdu : le dictionnaire complet d'avant sert encore,
 *      entier, la carte s'ouvre, le mot hors noyau se trouve ;
 *   2. que rien n'est mélangé : l'ancien paquet se lit dans son cache et pas
 *      ailleurs, sans les nouveautés — l'index des expressions de la nouvelle
 *      mouture ne s'applique pas aux tranches de l'ancienne ;
 *   3. que l'application le dit clairement, en bandeau et dans les réglages ;
 *   4. qu'un téléchargement interrompu ne détruit pas l'ancien paquet ;
 *   5. qu'un téléchargement complet remplace l'ancien d'un bloc, que la carte
 *      s'ouvre toujours — même si son mot a changé de tranche —, et que les
 *      expressions usuelles sont là ;
 *   6. que tout cela tient hors ligne.
 *
 * ── Comment ────────────────────────────────────────────────────────────────
 *
 * L'ancienne version vient d'un `git worktree` de `main`, posé dans le
 * répertoire temporaire du système et retiré à la fin. Deux serveurs se
 * succèdent sur le même port — l'origine ne change pas, c'est ce qui fait que
 * le service worker et les caches sont ceux d'une mise à jour réelle. Le
 * navigateur est un Chrome sans tête, avec un profil neuf, effacé à la fin.
 *
 *     node build/essais_mise_a_jour.mjs
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lancerChrome, fermerChrome, ouvrirOnglet } from './pilote_chrome.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT_WEB = 8152;
const ORIGINE = 'http://localhost:' + PORT_WEB + '/';
const ANCIENNE = path.join(tmpdir(), 'wortschatz-ancienne-version');

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
      // Le corps est lu : une réponse laissée en suspens fait tomber Node 24
      // (undici) quand le serveur referme la connexion.
      await (await fetch(ORIGINE + 'index.html', { cache: 'no-store' })).arrayBuffer();
      if (present) return true;
    } catch (erreur) {
      if (!present) return true;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/* Attendre l'application branchée et la coquille pré-cachée en entier — sans
 * quoi le hors-ligne de la fin n'aurait rien à lire. */
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

async function principal() {
  if (existsSync(ANCIENNE)) {
    try { execSync(`git worktree remove --force "${ANCIENNE}"`, { cwd: RACINE, stdio: 'ignore' }); } catch (e) { /* … */ }
    rmSync(ANCIENNE, { recursive: true, force: true });
  }
  execSync(`git worktree add --detach "${ANCIENNE}" main`, { cwd: RACINE, stdio: 'ignore' });
  /* Les fichiers de l'ancienne version datent d'avant ceux de la nouvelle :
   * le navigateur revalide par `If-Modified-Since`, et `http.server` répond
   * « 304 » à un fichier plus vieux que celui qu'on lui montre. Un arbre
   * extrait à l'instant serait, lui, plus récent que le code en cours, et le
   * navigateur garderait l'ancien — ce qu'aucun déploiement réel ne produit. */
  vieillir(ANCIENNE, new Date('2020-01-01T00:00:00Z'));

  let serveur = servir(ANCIENNE);
  await attendreServeur(true);
  const chrome = await lancerChrome({ port: 9416 });
  console.log('Chrome : ' + chrome.version.Browser);
  const onglet = await ouvrirOnglet(chrome, 'about:blank');

  try {
    titre('1. La version précédente : paquet complet installé, une révision hors noyau');
    await onglet.naviguer(ORIGINE);
    const avant = await onglet.evaluer(`
      ${ATTENDRE_PRET}
      const candidats = ['Pfefferspray', 'Gelaber', 'Dorfstraße'];
      const horsNoyau = candidats.filter(m => !Lexique.vedette('de', m));
      const fini = await Paquets.telecharger(Lexique.manifeste, null, null);
      await Lexique.charger('complet');
      await Store.ecrireReglage('paquet', 'complet');
      const mot = horsNoyau.find(m => Lexique.vedette('de', m));
      const entree = mot ? await Lexique.ouvrir(Lexique.vedette('de', mot)) : null;
      const cartes = entree ? await Revision.apprendre(entree) : [];
      return { version: Lexique.manifeste.version, fini, paquet: Lexique.paquet,
               mot, tranche: entree && entree.tranche, cartes: cartes.map(c => c.type).sort(),
               caches: await caches.keys(),
               expressionsFeu: Lexique.chercherExpressions ? 'présent' : 'absent' };
    `);
    verifier(avant.version === 2 && avant.fini && avant.paquet === 'complet',
      'le paquet complet de la version précédente (format 2) est installé', avant);
    verifier(!!avant.mot && avant.cartes.length >= 2,
      `« ${avant.mot} », absent du noyau, est appris (tranche ${avant.tranche}, ${avant.cartes.length} cartes)`,
      avant);
    verifier(avant.caches.includes('wortschatz-donnees-2'),
      'ses données vivent dans « wortschatz-donnees-2 »', avant.caches);
    verifier(avant.expressionsFeu === 'absent',
      'cette version ne connaît pas les expressions usuelles — c’est bien l’ancienne');
    const MOT = avant.mot;
    const TRANCHE = avant.tranche;

    titre('2. La nouvelle version est servie au même endroit ; la mise à jour s’applique');
    serveur.kill();
    await attendreServeur(false);
    serveur = servir(RACINE);
    await attendreServeur(true);
    await onglet.naviguer(ORIGINE);
    const transition = await onglet.evaluer(`
      for (let i = 0; i < 240; i++) {
        if (window.App && window.Lexique && Lexique.paquet && Lexique.manifeste) break;
        await new Promise(x => setTimeout(x, 250));
      }
      // Le nouveau service worker s'installe en arrière-plan ; on l'attend.
      await MiseAJour.verifier(true);
      let reg = null;
      for (let i = 0; i < 400; i++) {
        reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.waiting) break;
        await new Promise(x => setTimeout(x, 250));
      }
      const etat = { paquet: Lexique.paquet, ancien: Lexique.ancien ? Lexique.ancien.nom : null,
                     version: Lexique.manifeste.version, attend: !!(reg && reg.waiting),
                     ouvre: !!(await Lexique.ouvrir({ langue: 'de', mot: '${MOT}', tranche: ${TRANCHE} })) };
      if (reg && reg.waiting) MiseAJour.appliquer();
      return etat;
    `);
    verifier(transition.paquet === 'complet' && transition.ouvre,
      'sous l’ancien service worker déjà, le nouveau code lit l’ancien paquet : « ' + MOT + ' » s’ouvre',
      transition);
    verifier(transition.attend, 'le nouveau service worker est installé et attend le feu vert', transition);
    await new Promise((r) => setTimeout(r, 4000));
    await onglet.naviguer(ORIGINE);

    titre('3. Sans perte d’accès, sans mélange, et l’application le dit');
    const apres = await onglet.evaluer(`
      ${ATTENDRE_PRET}
      const cartes = await Store.cartesDuMot('de', '${MOT}');
      const carte = cartes[0];
      const entree = carte ? await Lexique.ouvrir({ langue: carte.langue, mot: carte.mot,
                                                     tranche: carte.tranche }) : null;
      const bandeau = document.querySelector('#donnees-anciennes');
      document.querySelector('[data-vue="reglages"]').click();
      await new Promise(x => setTimeout(x, 400));
      const reglages = document.querySelector('#vue-reglages').textContent;
      return { version: Lexique.manifeste.version, paquet: Lexique.paquet,
               ancien: Lexique.ancien ? Lexique.ancien.nom : null,
               reglagePaquet: (await Store.lireReglages()).paquet,
               carte: carte ? { tranche: carte.tranche, echeance: carte.echeance } : null,
               ouvre: !!entree, motOuvert: entree && entree.mot,
               vedette: !!Lexique.vedette('de', '${MOT}'),
               expressions: Lexique.chercherExpressions('feu').length,
               keinProblem: !!Lexique.vedette('de', 'kein Problem'),
               bandeau: bandeau && !bandeau.hidden ? bandeau.textContent : null,
               reglages: reglages.replace(/\\s+/g, ' ').slice(0, 600),
               caches: await caches.keys() };
    `);
    verifier(apres.version === 3, 'le manifeste est passé au format 3', apres.version);
    verifier(apres.paquet === 'complet' && apres.ancien === 'wortschatz-donnees-2'
             && apres.reglagePaquet === 'complet',
      'le dictionnaire complet d’avant sert toujours, lu dans son propre cache', apres);
    verifier(apres.ouvre && apres.motOuvert === MOT && apres.vedette,
      'la carte de révision sur « ' + MOT + ' » s’ouvre : rien n’est perdu', apres);
    verifier(apres.expressions === 0 && !apres.keinProblem,
      'aucune expression usuelle n’apparaît : l’ancienne mouture n’est pas mélangée à la nouvelle',
      { expressions: apres.expressions, keinProblem: apres.keinProblem });
    verifier(!!apres.bandeau && /nouveau téléchargement|neuen Download/.test(apres.bandeau),
      'un bandeau dit qu’un nouveau téléchargement est nécessaire', apres.bandeau);
    verifier(/mouture précédente|vorherige Ausgabe/.test(apres.reglages)
             && /Mettre à jour le dictionnaire complet|aktualisieren/.test(apres.reglages),
      'les réglages le disent aussi, et proposent la mise à jour', apres.reglages);
    verifier(/reste utilisable pendant le téléchargement|bleibt während/.test(apres.reglages),
      'et promettent que l’ancien paquet sert jusqu’au bout');

    titre('4. Un téléchargement interrompu ne touche pas à l’ancien paquet');
    const interrompu = await onglet.evaluer(`
      const ac = new AbortController();
      const fini = await Paquets.telecharger(Lexique.manifeste, ({ faits, total }) => {
        if (faits >= 6) ac.abort();
      }, ac.signal).catch(e => ({ erreur: e.name }));
      const effaces = await Paquets.oublierLesPerimes(Lexique.manifeste);
      const ancien = await Paquets.ancien(Lexique.manifeste);
      return { fini, effaces, ancien: ancien && ancien.nom, caches: await caches.keys(),
               paquet: Lexique.paquet, lit: Lexique.ancien && Lexique.ancien.nom,
               ouvre: !!(await Lexique.ouvrir({ langue: 'de', mot: '${MOT}', tranche: ${TRANCHE} })) };
    `);
    verifier(interrompu.fini === false || (interrompu.fini && interrompu.fini.erreur === 'AbortError'),
      'le téléchargement s’arrête à la demande', interrompu.fini);
    verifier(interrompu.effaces === 0 && interrompu.ancien === 'wortschatz-donnees-2'
             && interrompu.caches.includes('wortschatz-donnees-2'),
      'l’ancien paquet est gardé : le nouveau n’est pas entier', interrompu);
    verifier(interrompu.ouvre && interrompu.lit === 'wortschatz-donnees-2',
      'et « ' + MOT + ' » s’ouvre toujours, dans l’ancien');

    titre('5. Le téléchargement complet remplace l’ancien d’un bloc');
    const remplace = await onglet.evaluer(`
      document.querySelector('#b-donnees-mettre-a-jour').click();
      await new Promise(x => setTimeout(x, 400));
      const zone = document.querySelector('#vue-reglages');
      const bouton = [...zone.querySelectorAll('button.bouton-principal')]
        .find(b => /Mettre à jour le dictionnaire complet|aktualisieren/.test(b.textContent));
      if (!bouton) return { erreur: 'bouton introuvable' };
      bouton.click();
      for (let i = 0; i < 1200; i++) {
        if (!Lexique.ancien && (await Paquets.complet(Lexique.manifeste))) break;
        await new Promise(x => setTimeout(x, 250));
      }
      await new Promise(x => setTimeout(x, 800));
      const cartes = await Store.cartesDuMot('de', '${MOT}');
      const carte = cartes[0];
      const entree = await Lexique.ouvrir({ langue: 'de', mot: carte.mot, tranche: carte.tranche });
      const v = Lexique.vedette('de', '${MOT}');
      const bandeau = document.querySelector('#donnees-anciennes');
      return { ancien: Lexique.ancien ? Lexique.ancien.nom : null, paquet: Lexique.paquet,
               reglagePaquet: (await Store.lireReglages()).paquet,
               caches: await caches.keys(), complet: await Paquets.complet(Lexique.manifeste),
               ouvre: !!entree, trancheCarte: carte.tranche, trancheNeuve: v && v.tranche,
               echeance: carte.echeance,
               expressions: Lexique.chercherExpressions('feu').length,
               keinProblem: !!Lexique.vedette('de', 'kein Problem'),
               bandeauCache: !bandeau || bandeau.hidden,
               etat: document.querySelector('#etat-dictionnaire').textContent };
    `);
    verifier(!remplace.erreur && remplace.complet && remplace.ancien === null
             && remplace.paquet === 'complet' && remplace.reglagePaquet === 'complet',
      'le nouveau paquet est entier et c’est lui qui sert', remplace);
    verifier(!remplace.caches.includes('wortschatz-donnees-2')
             && remplace.caches.some(n => /^wortschatz-donnees-3-/.test(n)),
      'l’ancien cache est parti, le nouveau porte le format et la date de construction',
      remplace.caches);
    verifier(remplace.ouvre,
      `la carte s’ouvre encore — sa tranche ${remplace.trancheCarte} → ${remplace.trancheNeuve} aujourd’hui`
      + (remplace.trancheCarte !== remplace.trancheNeuve ? ' (le mot avait changé de tranche)' : ''),
      remplace);
    verifier(remplace.echeance === apres.carte.echeance, 'son échéance n’a pas bougé');
    verifier(remplace.expressions > 0 && remplace.keinProblem,
      'les expressions usuelles sont là (' + remplace.expressions + ' sur « feu »)');
    verifier(remplace.bandeauCache && !/mouture précédente|vorherige/.test(remplace.etat),
      'le bandeau est parti et les réglages disent « complet installé »', remplace.etat);

    titre('6. Hors ligne, sur la nouvelle mouture');
    serveur.kill();
    await attendreServeur(false);
    await onglet.naviguer(ORIGINE);
    const horsLigne = await onglet.evaluer(`
      for (let i = 0; i < 120; i++) {
        if (window.App && window.Lexique && Lexique.paquet) break;
        await new Promise(x => setTimeout(x, 250));
      }
      const cartes = await Store.cartesDuMot('de', '${MOT}');
      const entree = await Lexique.ouvrir({ langue: 'de', mot: cartes[0].mot, tranche: cartes[0].tranche });
      return { paquet: Lexique.paquet, ancien: Lexique.ancien ? Lexique.ancien.nom : null,
               ouvre: !!entree, expressions: Lexique.chercherExpressions('feu').length,
               reseau: await fetch('index.html', { cache: 'no-store' }).then(() => 'répond').catch(() => 'coupé') };
    `);
    verifier(horsLigne.paquet === 'complet' && horsLigne.ancien === null,
      'l’application s’ouvre hors ligne sur le paquet complet neuf', horsLigne);
    verifier(horsLigne.ouvre && horsLigne.expressions > 0,
      '« ' + MOT + ' » et les expressions usuelles sont là sans réseau');
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
                     : `${passees} contrôles passés. Le passage d’une mouture à l’autre tient.`);
  process.exit(fautes ? 1 : 0);
}).catch((erreur) => {
  console.error(erreur);
  process.exit(2);
});
