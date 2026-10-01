/*
 * Le passage de l'ancienne version à la nouvelle, sur le site publié.
 *
 * ── Pourquoi il faut deux temps ────────────────────────────────────────────
 *
 * La seule migration qui compte est celle que vivent les gens : une application
 * posée sur l'écran d'accueil depuis des mois, avec ses cartes, ses échéances,
 * ses mots à soi, son dictionnaire complet téléchargé — à qui l'on sert un jour
 * une version nouvelle. On ne peut pas l'éprouver après coup : il faut avoir
 * semé les données **avec l'ancienne version**, avant la fusion.
 *
 *     node build/essais_migration_en_ligne.mjs semer     # avant la fusion
 *     …publier la nouvelle version, attendre le déploiement…
 *     node build/essais_migration_en_ligne.mjs relever   # après le déploiement
 *     node build/essais_migration_en_ligne.mjs nettoyer  # ne rien laisser traîner
 *
 * Cette mouture du fichier éprouve le passage de la version 3.0 à la 3.1 : le
 * format des données change (version 2 → 3), et c'est le dictionnaire complet
 * qui est en jeu. Semer l'installe et apprend un mot qui n'existe que là ;
 * relever vérifie que l'ancien paquet sert encore — sans mélange —, que
 * l'application annonce le nouveau téléchargement, que le téléchargement
 * remplace l'ancien d'un bloc, que la carte s'ouvre toujours, et que les
 * expressions usuelles sont là.
 *
 * ── Où vit l'atelier ───────────────────────────────────────────────────────
 *
 * Dans un dossier du répertoire temporaire du système, jamais dans le dépôt :
 * un profil de navigateur pèse quelques dizaines de méga-octets — cent avec le
 * dictionnaire complet —, contient des bases de données et n'a rien à faire
 * sous git. `WORTSCHATZ_ESSAIS` permet de le placer ailleurs.
 *
 * Ce profil est créé pour l'occasion et n'a rien à voir avec le navigateur de
 * qui que ce soit : aucune donnée personnelle réelle n'est touchée, et
 * `nettoyer` l'efface.
 *
 * ── L'empreinte passe par un fichier ───────────────────────────────────────
 *
 * `semer` relève l'état exact des cartes et l'écrit ; `relever` le relit. Elle
 * ne peut pas passer par la ligne de commande : un identifiant de carte contient
 * des caractères nuls — c'est le séparateur de `Store.identifiant()` — et aucun
 * shell ne les transporte. Le fichier, lui, les garde tels quels.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lancerChrome, fermerChrome, ouvrirOnglet } from './pilote_chrome.mjs';

const SITE = process.env.WORTSCHATZ_SITE
  || 'https://cristo67000.github.io/wortschatz/';

/* L'atelier : le profil de navigateur et l'empreinte, hors du dépôt. */
const ATELIER = process.env.WORTSCHATZ_ESSAIS
  || path.join(tmpdir(), 'wortschatz-essais-migration');
const PROFIL = path.join(ATELIER, 'profil');
const EMPREINTE = path.join(ATELIER, 'empreinte.json');

// Un mot du dictionnaire complet, absent du noyau dans les deux moutures.
const HORS_NOYAU = ['Pfefferspray', 'Gelaber', 'Dorfstraße'];

let fautes = 0;
let passees = 0;
function verifier(condition, message, detail) {
  if (condition) { passees += 1; console.log('  ok  ' + message); return true; }
  fautes += 1;
  console.log('  NON ' + message + (detail === undefined ? '' : '  → ' + JSON.stringify(detail)));
  return false;
}
function titre(t) { console.log(''); console.log(t); }

/* Attendre que l'application soit branchée : le site distant met plus de temps
 * que le serveur local, et le noyau fait vingt méga-octets. */
const ATTENDRE_PRET = `
  for (let i = 0; i < 240; i++) {
    if (window.App && window.Lexique && Lexique.paquet && Lexique.manifeste && window.Store) break;
    await new Promise(x => setTimeout(x, 500));
  }
  await new Promise(x => setTimeout(x, 800));
`;

const EMPREINTE_DES_CARTES = `
  (await Store.toutesLesCartes()).map(c => [c.id, c.echeance, c.intervalle, c.facilite,
    c.reussites, c.echecs, c.etat, c.cree].join('|')).sort()`;

async function semer() {
  mkdirSync(PROFIL, { recursive: true });
  console.log('Atelier : ' + ATELIER);
  const chrome = await lancerChrome({ port: 9421, profil: PROFIL });
  const onglet = await ouvrirOnglet(chrome, 'about:blank');
  try {
    titre('Semer — on installe la version en ligne et on lui donne une histoire');
    await onglet.naviguer(SITE);
    const etat = await onglet.evaluer(`
      ${ATTENDRE_PRET}
      await navigator.serviceWorker.register('sw.js').catch(() => {});
      for (let i = 0; i < 240; i++) {
        const r = await navigator.serviceWorker.getRegistration();
        if (r && r.active) break;
        await new Promise(x => setTimeout(x, 500));
      }
      // On laisse le pré-cache du noyau se terminer.
      for (let i = 0; i < 240; i++) {
        const noms = await caches.keys();
        const coquille = noms.find(n => n.startsWith('wortschatz-coquille-'));
        if (coquille) {
          const c = await caches.open(coquille);
          if ((await c.keys()).length > 90) break;
        }
        await new Promise(x => setTimeout(x, 500));
      }
      const bases = await indexedDB.databases();
      return { version: bases.find(b => b.name === 'wortschatz'),
               format: Lexique.manifeste.version, construit: Lexique.manifeste.construit,
               paquet: Lexique.paquet, aPerso: !!window.Perso,
               aExpressions: typeof Lexique.chercherExpressions === 'function' };
    `);
    verifier(etat.version && etat.version.version === 3 && etat.aPerso,
      'la version en ligne est la 3.0 : base IndexedDB 3, mots personnels', etat.version);
    verifier(etat.format === 2 && !etat.aExpressions,
      'ses données sont au format 2 et elle ignore les expressions usuelles — c’est bien l’ancienne',
      { format: etat.format, construit: etat.construit });

    titre('Le dictionnaire complet, et une révision sur un mot qui n’est que là');
    const complet = await onglet.evaluer(`
      const horsNoyau = ${JSON.stringify(HORS_NOYAU)}.filter(m => !Lexique.vedette('de', m));
      const fini = await Paquets.telecharger(Lexique.manifeste, null, null);
      await Lexique.charger('complet');
      await Store.ecrireReglage('paquet', 'complet');
      const mot = horsNoyau.find(m => Lexique.vedette('de', m));
      const entree = mot ? await Lexique.ouvrir(Lexique.vedette('de', mot)) : null;
      const cartes = entree ? await Revision.apprendre(entree) : [];
      return { fini, paquet: Lexique.paquet, mot, tranche: entree && entree.tranche,
               cartes: cartes.length, caches: await caches.keys(),
               entrees: Lexique.manifeste.paquets.complet.entrees };
    `);
    verifier(complet.fini && complet.paquet === 'complet'
             && complet.caches.includes('wortschatz-donnees-2'),
      'le paquet complet 3.0 est installé dans « wortschatz-donnees-2 » ('
      + complet.entrees.de + ' de + ' + complet.entrees.fr + ' fr)', complet.caches);
    verifier(!!complet.mot && complet.cartes >= 2,
      '« ' + complet.mot + ' », absent du noyau, est appris (tranche ' + complet.tranche + ')');

    const seme = await onglet.evaluer(`
      // Des mots en révision, comme après quelques semaines d'usage.
      for (const [langue, mot] of [['de','Haus'], ['de','gehen'], ['fr','maison']]) {
        const v = Lexique.vedette(langue, mot);
        if (v) await Revision.apprendre(await Lexique.ouvrir(v));
      }
      // On leur donne une histoire : intervalles, facilités, échéances.
      const cartes = await Store.toutesLesCartes();
      let n = 0;
      for (const c of cartes) {
        n += 1;
        c.etat = 'revision';
        c.intervalle = 10 + n * 3;
        c.facilite = 2.1 + n * 0.05;
        c.reussites = 4 + n;
        c.echecs = 1;
        c.echeance = 1950000000000 + n * 86400000;
        await Store.ecrireCarte(c);
      }
      for (let i = 0; i < 5; i++) {
        await Store.noter({ quand: Date.now() - i * 3600000, carte: cartes[0].id,
          langue: cartes[0].langue, mot: cartes[0].mot, type: cartes[0].type,
          exercice: 'saisie', qualite: 2, etatAvant: 'revision' });
      }
      await Store.ecrireReglage('nouveautesParJour', 35);
      await Store.ecrireReglage('sensDeTravail', 'les-deux');
      await Store.ecrireReglage('exigerArticle', false);
      await Store.ecrireReglage('langue', 'fr');
      await Store.consulter('de', 'Haus');
      await Store.consulter('fr', 'maison');
      // Un mot à soi, en plusieurs mots — d'avant la question « expression ? » —
      // et deux notes.
      const perso = await Perso.creer({ mot: 'Deutsche Bahn', langue: 'de', nature: 'n',
        genre: 'fem', traductions: 'chemins de fer allemands' });
      await Notes.ecrire({ perso: perso.id, langue: 'de', mot: 'Deutsche Bahn' }, 'La DB.');
      await Notes.ecrire({ langue: 'de', mot: 'Haus' }, 'das Haus, die Häuser.');
      await Revision.apprendre(Perso.entree(perso.id));
      return {
        cartes: ${EMPREINTE_DES_CARTES},
        journal: (await Store.journalDepuis(0)).length,
        reglages: await Store.lireReglages(),
        historique: (await Store.historique()).map(h => h.id).sort(),
        perso: perso.id,
        cartesPerso: (await Store.cartesDuMot(null, null, perso.id)).map(c => c.type).sort(),
        notes: (await Store.toutesLesNotes()).length,
      };
    `);
    verifier(seme.cartes.length >= 8, seme.cartes.length + ' cartes semées');
    verifier(seme.journal === 5, '5 lignes de journal', seme.journal);
    verifier(seme.cartesPerso.length === 3,
      '« Deutsche Bahn », mot personnel en deux mots, a trois cartes dont une de genre',
      seme.cartesPerso);
    verifier(seme.notes === 2, 'deux notes', seme.notes);

    /* JSON échappe les caractères nuls en `\\u0000` : le fichier reste du texte
     * lisible, et `JSON.parse` les rend intacts à la relecture. C'est tout ce
     * qu'il fallait, et c'est ce qu'une ligne de commande ne sait pas faire. */
    writeFileSync(EMPREINTE, JSON.stringify({
      mot: complet.mot, tranche: complet.tranche,
      cartes: seme.cartes, journal: seme.journal,
      reglages: seme.reglages, historique: seme.historique,
      perso: seme.perso, cartesPerso: seme.cartesPerso, notes: seme.notes,
    }, null, 1), 'utf8');
    console.log('');
    console.log('Empreinte écrite : ' + EMPREINTE);
    console.log('Publiez la nouvelle version, puis : node '
      + 'build/essais_migration_en_ligne.mjs relever');
  } finally {
    onglet.fermer();
    await fermerChrome(chrome);
  }
}

async function relever(empreinte) {
  const chrome = await lancerChrome({ port: 9422, profil: PROFIL });
  const onglet = await ouvrirOnglet(chrome, 'about:blank');
  const MOT = empreinte.mot;
  try {
    titre('Relever — le même profil reçoit la nouvelle version');
    await onglet.naviguer(SITE);

    /* Une application posée sur l'écran d'accueil ne se recharge jamais toute
     * seule : la nouvelle version s'installe et attend le feu vert. On le lui
     * donne, comme le ferait le bandeau, puis on recharge. */
    const bascule = await onglet.evaluer(`
      ${ATTENDRE_PRET}
      const r = await navigator.serviceWorker.getRegistration();
      if (r) await r.update().catch(() => {});
      let attendait = false;
      for (let i = 0; i < 240; i++) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.waiting) { attendait = true; reg.waiting.postMessage({ type: 'passer-devant' }); break; }
        await new Promise(x => setTimeout(x, 500));
      }
      await new Promise(x => setTimeout(x, 3000));
      return { attendait, paquetAvant: Lexique.paquet,
               ancienAvant: Lexique.ancien ? Lexique.ancien.nom : null };
    `);
    verifier(bascule.attendait, 'la nouvelle version s’est installée et attendait le feu vert', bascule);
    await onglet.naviguer(SITE);
    await onglet.naviguer(SITE);

    const apres = await onglet.evaluer(`
      ${ATTENDRE_PRET}
      const cartes = await Store.cartesDuMot('de', '${MOT}');
      const carte = cartes[0];
      const entree = carte ? await Lexique.ouvrir({ langue: 'de', mot: carte.mot, tranche: carte.tranche }) : null;
      const bandeau = document.querySelector('#donnees-anciennes');
      document.querySelector('[data-vue="reglages"]').click();
      await new Promise(x => setTimeout(x, 500));
      const reglages = document.querySelector('#vue-reglages').textContent.replace(/\\s+/g, ' ');
      return {
        format: Lexique.manifeste.version, construit: Lexique.manifeste.construit,
        paquet: Lexique.paquet, ancien: Lexique.ancien ? Lexique.ancien.nom : null,
        ouvre: !!entree, expressions: Lexique.chercherExpressions('feu').length,
        keinProblem: !!Lexique.vedette('de', 'kein Problem'),
        bandeau: bandeau && !bandeau.hidden ? bandeau.textContent : null,
        reglages: reglages.slice(0, 700),
        cartes: ${EMPREINTE_DES_CARTES},
        journal: (await Store.journalDepuis(0)).length,
        reglagesStockes: await Store.lireReglages(),
        historique: (await Store.historique()).map(h => h.id).sort(),
        persoLa: !!Perso.brut('${empreinte.perso}'),
        persoExpression: Perso.estExpression(Perso.brut('${empreinte.perso}')),
        cartesPerso: (await Store.cartesDuMot(null, null, '${empreinte.perso}')).map(c => c.type).sort(),
        notes: (await Store.toutesLesNotes()).length,
        caches: await caches.keys(),
      };
    `);
    verifier(apres.format === 3, 'les données servies sont au format 3 (construites le '
      + apres.construit + ')', apres.format);
    verifier(apres.paquet === 'complet' && apres.ancien === 'wortschatz-donnees-2',
      'le dictionnaire complet 3.0 sert toujours, lu dans son propre cache', apres);
    verifier(apres.ouvre, 'la carte sur « ' + MOT + ' », absent du noyau, s’ouvre : rien n’est perdu');
    verifier(apres.expressions === 0 && !apres.keinProblem,
      'aucune expression usuelle n’apparaît : pas de mélange entre les moutures',
      { expressions: apres.expressions, keinProblem: apres.keinProblem });
    verifier(!!apres.bandeau && /nouveau téléchargement|neuen Download/.test(apres.bandeau),
      'un bandeau annonce le nouveau téléchargement', apres.bandeau);
    verifier(/mouture précédente|vorherige Ausgabe/.test(apres.reglages)
             && /Mettre à jour le dictionnaire complet|aktualisieren/.test(apres.reglages),
      'les réglages le disent et proposent la mise à jour');

    titre('Rien de ce qui était là ne doit avoir bougé');
    verifier(JSON.stringify(apres.cartes) === JSON.stringify(empreinte.cartes),
      'les cartes sont identiques — échéance, intervalle, facilité, réussites, échecs, création',
      { avant: empreinte.cartes.length, apres: apres.cartes.length });
    verifier(apres.journal === empreinte.journal, 'le journal est intact (' + apres.journal + ' lignes)');
    for (const cle of ['nouveautesParJour', 'sensDeTravail', 'exigerArticle', 'langue', 'paquet']) {
      verifier(apres.reglagesStockes[cle] === empreinte.reglages[cle],
        'réglage « ' + cle + ' » conservé : ' + JSON.stringify(apres.reglagesStockes[cle]));
    }
    verifier(JSON.stringify(apres.historique) === JSON.stringify(empreinte.historique),
      'l’historique de consultation est intact');
    verifier(apres.persoLa && !apres.persoExpression
             && JSON.stringify(apres.cartesPerso) === JSON.stringify(empreinte.cartesPerso),
      '« Deutsche Bahn » est là, reste un nom, et garde ses trois cartes', apres.cartesPerso);
    verifier(apres.notes === empreinte.notes, 'les deux notes sont là');

    titre('Le téléchargement remplace l’ancien paquet d’un bloc');
    const remplace = await onglet.evaluer(`
      const zone = document.querySelector('#vue-reglages');
      const bouton = [...zone.querySelectorAll('button.bouton-principal')]
        .find(b => /Mettre à jour le dictionnaire complet|aktualisieren/.test(b.textContent));
      if (!bouton) return { erreur: 'bouton introuvable' };
      bouton.click();
      for (let i = 0; i < 2400; i++) {
        if (!Lexique.ancien && (await Paquets.complet(Lexique.manifeste))) break;
        await new Promise(x => setTimeout(x, 500));
      }
      await new Promise(x => setTimeout(x, 1000));
      const carte = (await Store.cartesDuMot('de', '${MOT}'))[0];
      const entree = await Lexique.ouvrir({ langue: 'de', mot: carte.mot, tranche: carte.tranche });
      const v = Lexique.vedette('de', '${MOT}');
      return { ancien: Lexique.ancien ? Lexique.ancien.nom : null, paquet: Lexique.paquet,
               complet: await Paquets.complet(Lexique.manifeste), caches: await caches.keys(),
               ouvre: !!entree, trancheCarte: carte.tranche, trancheNeuve: v && v.tranche,
               cartes: ${EMPREINTE_DES_CARTES},
               bandeauCache: document.querySelector('#donnees-anciennes').hidden,
               etat: document.querySelector('#etat-dictionnaire').textContent };
    `);
    verifier(!remplace.erreur && remplace.complet && remplace.ancien === null && remplace.paquet === 'complet',
      'le paquet complet 3.1 est entier et c’est lui qui sert', remplace);
    verifier(!remplace.caches.includes('wortschatz-donnees-2')
             && remplace.caches.some(n => /^wortschatz-donnees-3-/.test(n)),
      'l’ancien cache est parti, le nouveau porte format et date', remplace.caches);
    verifier(remplace.ouvre, 'la carte sur « ' + MOT + ' » s’ouvre encore (tranche '
      + remplace.trancheCarte + ' → ' + remplace.trancheNeuve + ')');
    verifier(JSON.stringify(remplace.cartes) === JSON.stringify(empreinte.cartes),
      'aucune carte n’a bougé pendant la mise à jour');
    verifier(remplace.bandeauCache && !/mouture précédente|vorherige/.test(remplace.etat),
      'le bandeau est parti, les réglages disent « complet installé »', remplace.etat);

    titre('Et les expressions usuelles marchent sur le site publié');
    const expressions = await onglet.evaluer(`
      document.querySelector('[data-vue="chercher"]').click();
      await new Promise(x => setTimeout(x, 300));
      const q = document.querySelector('#q');
      const taper = async (t) => {
        q.value = t; q.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(x => setTimeout(x, 500));
        return [...document.querySelectorAll('#resultats-expressions .resultat .mot')].map(e => e.textContent);
      };
      const bonheur = await taper('bonheur');
      const ahnung = await taper('Ahnung');
      const gluck = await taper('Gluck');
      document.querySelector('#resultats .resultat').click();
      await new Promise(x => setTimeout(x, 1500));
      const section = document.querySelector('#fiche-contenu .expressions-usuelles');
      const dansLaFiche = section ? [...section.querySelectorAll('.expression-ligne .mot')].map(e => e.textContent) : [];
      const ligne = section && [...section.querySelectorAll('.expression-ligne')]
        .find(b => b.querySelector('.mot').textContent === 'viel Glück');
      if (ligne) ligne.click();
      await new Promise(x => setTimeout(x, 1500));
      const apprendre = document.querySelector('#fiche-contenu .apprendre');
      if (apprendre) apprendre.click();
      await new Promise(x => setTimeout(x, 800));
      const cartes = await Store.cartesDuMot('de', 'viel Glück');
      return { bonheur, ahnung, gluck, dansLaFiche,
               ouverteDepuisLaFiche: !!ligne, apprendre: !!apprendre,
               cartes: cartes.map(c => c.type).sort() };
    `);
    verifier(expressions.bonheur.includes('au petit bonheur la chance'),
      '« bonheur » → « au petit bonheur la chance »', expressions.bonheur);
    verifier(expressions.ahnung.includes('keine Ahnung'), '« Ahnung » → « keine Ahnung »', expressions.ahnung);
    verifier(expressions.gluck.includes('viel Glück'), '« Gluck » → « viel Glück »', expressions.gluck);
    verifier(expressions.dansLaFiche.includes('viel Glück'),
      'la fiche « Glück » se termine par ses expressions', expressions.dansLaFiche);
    verifier(expressions.ouverteDepuisLaFiche && expressions.apprendre
             && expressions.cartes.length === 2 && !expressions.cartes.includes('genre'),
      '« viel Glück », ouverte depuis la fiche et apprise : deux cartes, aucune de genre',
      expressions);

    titre('Après un dernier rechargement, tout tient');
    await onglet.naviguer(SITE);
    const final = await onglet.evaluer(`
      ${ATTENDRE_PRET}
      return { paquet: Lexique.paquet, ancien: Lexique.ancien ? Lexique.ancien.nom : null,
               cartes: ${EMPREINTE_DES_CARTES},
               perso: Perso.compte(), notes: (await Store.toutesLesNotes()).length,
               ouvre: !!(await Lexique.ouvrir(Lexique.vedette('de', '${MOT}'))) };
    `);
    verifier(final.paquet === 'complet' && final.ancien === null && final.ouvre,
      'le paquet complet 3.1 sert, « ' + MOT + ' » s’ouvre');
    verifier(final.cartes.length === empreinte.cartes.length + 2 && final.perso === 1
             && final.notes === empreinte.notes,
      'cartes, mot personnel et notes survivent au rechargement', final);
  } finally {
    onglet.fermer();
    await fermerChrome(chrome);
  }
}

function nettoyer() {
  if (!existsSync(ATELIER)) {
    console.log('Rien à nettoyer : ' + ATELIER + ' n’existe pas.');
    return Promise.resolve();
  }
  rmSync(ATELIER, { recursive: true, force: true });
  console.log('Effacé : ' + ATELIER);
  return Promise.resolve();
}

function lireEmpreinte() {
  if (!existsSync(EMPREINTE)) {
    throw new Error(
      'Aucune empreinte dans ' + EMPREINTE + '.'
      + ' Lancez d’abord « semer », avec l’ancienne version encore en ligne.');
  }
  return JSON.parse(readFileSync(EMPREINTE, 'utf8'));
}

const COMMANDES = {
  semer: () => semer(),
  relever: () => relever(lireEmpreinte()),
  nettoyer: () => nettoyer(),
};

const commande = process.argv[2];
if (!COMMANDES[commande]) {
  console.error('Usage : node build/essais_migration_en_ligne.mjs '
    + '<semer|relever|nettoyer>');
  console.error('');
  console.error('  semer     installe la version en ligne dans un profil neuf, avec le');
  console.error('            dictionnaire complet, des cartes, un journal, des réglages');
  console.error('  relever   sert la nouvelle version au même profil, et compare');
  console.error('  nettoyer  efface le profil et l’empreinte');
  process.exit(2);
}

/* `lireEmpreinte()` lève quand elle manque : on l'appelle donc à l'intérieur de
 * la promesse, pour que le message arrive sans pile d'appels — qui lance
 * « relever » trop tôt doit lire une phrase, pas une trace. */
Promise.resolve()
  .then(COMMANDES[commande])
  .then(() => {
    if (commande === 'nettoyer') return;
    console.log('');
    console.log(fautes ? `${passees} contrôles passés, ${fautes} ÉCHEC(S).`
                       : `${passees} contrôles passés.`);
  })
  .then(() => process.exit(fautes ? 1 : 0))
  .catch((e) => {
    console.error('');
    console.error(e && e.message ? e.message : e);
    process.exit(1);
  });
