/*
 * Le passage d'une version à la suivante, sur le site publié — celui que
 * vivent les gens.
 *
 * ── Deux temps ─────────────────────────────────────────────────────────────
 *
 * Une application posée sur l'écran d'accueil depuis des mois, avec ses
 * cartes, ses notes, ses mots et ses phrases à soi, son dictionnaire complet,
 * reçoit un jour une version nouvelle. Cela ne s'éprouve pas après coup : il
 * faut avoir semé les données **avec l'ancienne version encore en ligne**.
 *
 *     node build/essais_publication.mjs semer     # avant la fusion
 *     …fusionner, attendre le déploiement…
 *     node build/essais_publication.mjs relever   # après
 *     node build/essais_publication.mjs nettoyer  # ne rien laisser traîner
 *
 * `relever` vérifie, dans le même profil :
 *   1. que la nouvelle version est **proposée** — installée entière, bandeau
 *      affiché — et qu'elle n'a pas pris la main d'elle-même ;
 *   2. que le **clic** sur le bandeau l'active, et que c'est bien elle qui
 *      sert ensuite — chaque fichier de la coquille comparé, par empreinte,
 *      à la révision qu'on croit avoir déployée ;
 *   3. que mots, notes, phrases et dialogues à soi, cartes et échéances,
 *      réglages, dictionnaire complet sont là, à l'identique ;
 *   4. le contenu : 280 phrases, 40 dialogues, 11 situations, les mentions
 *      qui distinguent les dialogues validés des contenus non relus ;
 *   5. les réglages de voix ;
 *   6. le **hors ligne** : Chrome est relancé sur le même profil avec le site
 *      rendu introuvable (`--host-resolver-rules`), et tout doit tenir.
 *
 * ── Où vit l'atelier ───────────────────────────────────────────────────────
 *
 * Dans un dossier du répertoire temporaire du système, jamais dans le dépôt,
 * et jamais dans le navigateur de qui que ce soit : le profil est créé pour
 * l'occasion, et `nettoyer` l'efface. `WORTSCHATZ_ESSAIS` le place ailleurs,
 * `WORTSCHATZ_SITE` vise un autre déploiement, `WORTSCHATZ_REVISION` dit à
 * quelle révision comparer les fichiers servis (`HEAD` par défaut).
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lancerChrome, fermerChrome, ouvrirOnglet } from './pilote_chrome.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.WORTSCHATZ_SITE || 'https://cristo67000.github.io/wortschatz/';
const HOTE = new URL(SITE).hostname;
const REVISION = process.env.WORTSCHATZ_REVISION || 'HEAD';
const ATELIER = process.env.WORTSCHATZ_ESSAIS || path.join(tmpdir(), 'wortschatz-essais-publication');
const PROFIL = path.join(ATELIER, 'profil');
const EMPREINTE = path.join(ATELIER, 'empreinte.json');
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

const PRET = `
  for (let i = 0; i < 300; i++) {
    if (window.App && window.Lexique && Lexique.paquet && Lexique.manifeste && window.Store
        && (!window.Conversation || Conversation.charge)) break;
    await new Promise(x => setTimeout(x, 500));
  }
  await new Promise(x => setTimeout(x, 800));
`;
const VERSION_SW = `
  const versionSw = await new Promise((res) => {
    const actif = navigator.serviceWorker.controller;
    if (!actif) { res(null); return; }
    const canal = new MessageChannel();
    canal.port1.onmessage = (e) => res(e.data && e.data.version);
    actif.postMessage({ type: 'version' }, [canal.port2]);
    setTimeout(() => res('?'), 4000);
  });
`;
/* Tout ce qui appartient à la personne : identique à l'octet près, ou rien
 * ne va. Les identifiants contiennent un NUL, que JSON transporte en \\u0000. */
const TOUT = `
  const cartes = (await Store.toutesLesCartes()).sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(c => [c.id, c.langue, c.mot, c.type, c.etat, c.palier, c.intervalle, c.facilite,
               c.echeance, c.reussites, c.echecs, c.cree, c.vu, c.perso || null, c.conversation || null, c.tranche]);
  const notes = (await Store.toutesLesNotes()).sort((a, b) => (a.id < b.id ? -1 : 1))
    .map(n => [n.id, n.texte, n.cree, n.modifie, n.langue, n.mot]);
  const perso = (await Store.tousLesMotsPerso()).sort((a, b) => (a.id < b.id ? -1 : 1));
  const conversation = (await Store.touteLaConversation()).sort((a, b) => (a.id < b.id ? -1 : 1));
  const reglages = await Store.lireReglages();
  const tout = { cartes, notes, perso, conversation,
    reglages: { langue: reglages.langue, sensDeTravail: reglages.sensDeTravail, voix: reglages.voix,
                nouveautesParJour: reglages.nouveautesParJour, exigerArticle: reglages.exigerArticle,
                conversationLangue: reglages.conversationLangue || null, paquet: reglages.paquet },
    journal: (await Store.journalDepuis(0)).length,
    historique: (await Store.historique()).map(h => h.id).sort() };
`;
const SHA = `
  async function sha(r) {
    if (!r) return null;
    const h = await crypto.subtle.digest('SHA-256', await r.arrayBuffer());
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
`;

function fichiersDe(revision) {
  const sw = execSync(`git show ${revision}:sw.js`, { cwd: RACINE }).toString('utf8');
  const liste = sw.split('const FICHIERS = [')[1].split('];')[0];
  return { version: (sw.match(/const VERSION = '([^']+)'/) || [])[1],
           fichiers: [...liste.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== './') };
}
function empreintesDe(revision, fichiers) {
  const sortie = {};
  for (const f of fichiers) {
    try {
      const octets = execSync(`git show ${revision}:${f}`, { cwd: RACINE, maxBuffer: 64 * 1024 * 1024 });
      sortie[f] = createHash('sha256').update(octets).digest('hex');
    } catch (e) { sortie[f] = null; }
  }
  return sortie;
}

// ── Semer ───────────────────────────────────────────────────────────────────

async function semer() {
  mkdirSync(PROFIL, { recursive: true });
  console.log('Atelier : ' + ATELIER);
  console.log('Site    : ' + SITE);
  const chrome = await lancerChrome({ port: 9431, profil: PROFIL });
  console.log('Chrome  : ' + chrome.version.Browser);
  const onglet = await ouvrirOnglet(chrome, 'about:blank');
  try {
    titre('Semer — la version en ligne s’installe, puis reçoit une histoire');
    await onglet.naviguer(SITE);
    const etat = await onglet.evaluer(`
      ${PRET}
      for (let i = 0; i < 300; i++) {
        const r = await navigator.serviceWorker.getRegistration();
        if (r && r.active && navigator.serviceWorker.controller) break;
        await new Promise(x => setTimeout(x, 500));
      }
      for (let i = 0; i < 300; i++) {
        const noms = await caches.keys();
        const coquille = noms.find(n => n.startsWith('wortschatz-coquille-'));
        if (coquille) {
          const c = await caches.open(coquille);
          if ((await c.keys()).length >= Lexique.manifeste.paquets.noyau.fichiers.length + 20) break;
        }
        await new Promise(x => setTimeout(x, 500));
      }
      ${VERSION_SW}
      return { versionSw, caches: await caches.keys(), compte: Conversation.compter(),
               themes: Conversation.themes().length, choixDeVoix: typeof Voix.choisir === 'function',
               construit: Lexique.manifeste.construit };
    `);
    verifier(etat.versionSw === 'v3.2.0' && !etat.choixDeVoix,
      'la version en ligne est la 3.2.0 — sans choix de voix, c’est bien l’ancienne', etat.versionSw);
    verifier(etat.compte.phrases === 148 && etat.compte.dialogues === 26 && etat.themes === 9,
      '148 phrases, 26 dialogues, 9 situations', etat.compte);
    verifier(etat.caches.includes('wortschatz-coquille-v3.2.0'), 'la coquille 3.2.0 est en cache', etat.caches);

    titre('Le dictionnaire complet, depuis le site publié');
    const complet = await onglet.evaluer(`
      const horsNoyau = ${JSON.stringify(HORS_NOYAU)}.filter(m => !Lexique.vedette('de', m));
      const fini = await Paquets.telecharger(Lexique.manifeste, null, null);
      await Lexique.charger('complet');
      await Store.ecrireReglage('paquet', 'complet');
      const mot = horsNoyau.find(m => Lexique.vedette('de', m));
      const entree = mot ? await Lexique.ouvrir(Lexique.vedette('de', mot)) : null;
      const cartes = entree ? await Revision.apprendre(entree) : [];
      return { fini, paquet: Lexique.paquet, mot, cartes: cartes.length, caches: await caches.keys() };
    `);
    verifier(complet.fini && complet.paquet === 'complet' && !!complet.mot && complet.cartes >= 2,
      `le paquet complet est installé ; « ${complet.mot} », absent du noyau, est appris`, complet);

    titre('Des mots, des notes, des phrases, des dialogues à soi, des réglages');
    const seme = await onglet.evaluer(`
      Revision.sensDeTravail = 'les-deux';
      for (const [langue, mot] of [['de', 'Haus'], ['de', 'gehen'], ['fr', 'maison']]) {
        await Revision.apprendre(await Lexique.ouvrir(Lexique.vedette(langue, mot)));
      }
      const motASoi = await Perso.creer({ mot: 'Deutsche Bahn', langue: 'de', nature: 'n', genre: 'fem',
        expression: false, traductions: 'chemins de fer allemands' });
      await Revision.apprendre(Perso.entree(motASoi.id));
      await Notes.ecrire({ perso: motASoi.id, langue: 'de', mot: 'Deutsche Bahn' }, 'La DB.');
      await Notes.ecrire({ langue: 'de', mot: 'Haus' }, 'das Haus, die Häuser.');
      // Une phrase apprise depuis un dialogue, une réplique sans phrase listée.
      await Revision.apprendre(Conversation.entree('dg-chemin-poste/r3'));
      await Revision.apprendre(Conversation.entree('dg-chemin-poste/r1'));
      await Notes.ecrire({ conversation: 'ph-chemin-loin', langue: 'de', mot: 'Ist es weit?' }, 'weit = loin.');
      // Une phrase et un dialogue à soi.
      const mienne = await Conversation.creer('phrase', { fr: 'Je cherche le rayon des surgelés.',
        de: 'Ich suche die Tiefkühlabteilung.', theme: 'achats', registre: 'poli' });
      const mien = await Conversation.creer('dialogue', { titre: 'Au marché', theme: 'achats', registre: 'poli',
        roles: { A: 'Moi', B: 'La maraîchère' },
        repliques: [{ qui: 'A', fr: 'Bonjour, un kilo de pommes.', de: 'Guten Tag, ein Kilo Äpfel.' },
                    { qui: 'B', fr: 'Des rouges ou des vertes ?', de: 'Rote oder grüne?' }] });
      await Revision.apprendre(Conversation.entree(mienne.id));
      await Revision.apprendre(Conversation.entree(mien.id + '/' + mien.repliques[1].id));
      await Notes.ecrire({ conversation: mien.id, langue: 'de', mot: 'Au marché' }, 'Marché du samedi.');
      // Des semaines de révisions, condensées.
      const toutes = await Store.toutesLesCartes();
      let n = 0;
      for (const c of toutes) {
        n += 1;
        c.etat = 'revision'; c.intervalle = 10 + n * 3; c.facilite = 2.1 + n * 0.05;
        c.echeance = 1950000000000 + n * 86400000; c.reussites = 4 + n; c.echecs = n % 2; c.vu = 1899000000000;
        await Store.ecrireCarte(c);
      }
      await Revision.noter((await Store.toutesLesCartes())[0], Revision.CORRECT, 'saisie');
      await Store.ecrireReglage('nouveautesParJour', 35);
      await Store.ecrireReglage('sensDeTravail', 'les-deux');
      await Store.ecrireReglage('exigerArticle', false);
      await Store.ecrireReglage('langue', 'fr');
      await Store.ecrireReglage('conversationLangue', 'de');
      await Store.consulter('de', 'Haus');
      ${TOUT}
      return { tout, perso: motASoi.id, mienne: mienne.id, mien: mien.id, replique: mien.id + '/' + mien.repliques[1].id };
    `);
    verifier(seme.tout.cartes.length >= 14 && seme.tout.notes.length === 4 && seme.tout.conversation.length === 2
             && seme.tout.perso.length === 1 && seme.tout.journal === 1,
      `semé : ${seme.tout.cartes.length} cartes, 4 notes, 1 mot, 1 phrase et 1 dialogue à soi, 1 ligne de journal`);

    writeFileSync(EMPREINTE, JSON.stringify({
      site: SITE, versionSw: etat.versionSw, mot: complet.mot,
      perso: seme.perso, mienne: seme.mienne, mien: seme.mien, replique: seme.replique,
      tout: seme.tout,
    }, null, 1), 'utf8');
    console.log('');
    console.log('Empreinte écrite : ' + EMPREINTE);
    console.log('Publiez la nouvelle version, puis : node build/essais_publication.mjs relever');
  } finally {
    onglet.fermer();
    await fermerChrome(chrome);
  }
}

// ── Relever ─────────────────────────────────────────────────────────────────

async function relever(empreinte) {
  const attendu = fichiersDe(REVISION);
  const empreintes = empreintesDe(REVISION, attendu.fichiers);
  console.log(`Révision attendue : ${REVISION} (${attendu.version}, ${attendu.fichiers.length} fichiers)`);
  const chrome = await lancerChrome({ port: 9432, profil: PROFIL });
  console.log('Chrome  : ' + chrome.version.Browser);
  const onglet = await ouvrirOnglet(chrome, 'about:blank');
  const MOT = empreinte.mot;
  try {
    titre('1. Le même profil revient : la nouvelle version est proposée, pas imposée');
    await onglet.naviguer(SITE);
    const proposee = await onglet.evaluer(`
      ${PRET}
      ${VERSION_SW}
      const resultat = await MiseAJour.verifier(true);
      let reg = null;
      for (let i = 0; i < 600; i++) {
        reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.waiting) break;
        await new Promise(x => setTimeout(x, 500));
      }
      await new Promise(x => setTimeout(x, 800));
      ${TOUT}
      return { versionSw, resultat, waiting: !!(reg && reg.waiting), caches: await caches.keys(),
               bandeau: !document.getElementById('mise-a-jour').hidden,
               texteBandeau: document.getElementById('mise-a-jour').textContent.replace(/\\s+/g, ' ').trim(),
               compte: Conversation.compter(), tout, paquet: Lexique.paquet };
    `);
    verifier(proposee.versionSw === empreinte.versionSw,
      `c’est encore le service worker ${empreinte.versionSw} qui sert`, proposee.versionSw);
    verifier(proposee.waiting && proposee.bandeau && /Mettre à jour|Aktualisieren/.test(proposee.texteBandeau),
      'la nouvelle version est installée, attend, et le bandeau la propose : « ' + proposee.texteBandeau.slice(0, 80) + ' »', proposee);
    verifier(proposee.caches.includes('wortschatz-coquille-' + attendu.version)
             && proposee.caches.includes('wortschatz-coquille-' + empreinte.versionSw),
      'les deux coquilles coexistent, la nouvelle à côté de l’ancienne', proposee.caches);
    verifier(JSON.stringify(proposee.tout) === JSON.stringify(empreinte.tout) && proposee.paquet === 'complet',
      'avant le clic, tout est identique champ par champ, dictionnaire complet compris');

    titre('2. Le clic sur le bandeau');
    await onglet.evaluer(`
      document.getElementById('b-mettre-a-jour').click();
      await new Promise(x => setTimeout(x, 6000));
      return true;
    `).catch(() => {});   // la page se recharge sous nos pieds : c'est attendu
    await onglet.naviguer(SITE);
    const apres = await onglet.evaluer(`
      ${PRET}
      ${VERSION_SW}
      ${SHA}
      const servis = {};
      for (const f of ${JSON.stringify(attendu.fichiers)}) {
        try { servis[f] = await sha(await fetch(f)); } catch (e) { servis[f] = null; }
      }
      ${TOUT}
      const ouvre = !!(await Lexique.ouvrir(Lexique.vedette('de', ${JSON.stringify(MOT)})));
      const complet = await Paquets.complet(Lexique.manifeste);
      return { versionSw, version: MiseAJour.version, caches: await caches.keys(), servis, tout,
               paquet: Lexique.paquet, ouvre, complet, compte: Conversation.compter(),
               themes: Conversation.themes().map(t => t.id),
               relus: Conversation.dialogues().filter(d => d.relu).map(d => d.id),
               phrasesRelues: Conversation.phrases().filter(p => p.relu).length,
               mienne: !!Conversation.brut(${JSON.stringify(empreinte.mienne)}),
               mien: !!Conversation.brut(${JSON.stringify(empreinte.mien)}),
               persoLa: !!Perso.brut(${JSON.stringify(empreinte.perso)}) };
    `);
    verifier(apres.versionSw === attendu.version, `le service worker ${attendu.version} a pris la main au clic`, apres.versionSw);
    const differents = attendu.fichiers.filter((f) => apres.servis[f] !== empreintes[f]);
    verifier(differents.length === 0,
      `les ${attendu.fichiers.length} fichiers servis sont ceux de ${REVISION}, empreinte par empreinte`, differents);
    verifier(apres.caches.length === 2 && apres.caches.includes('wortschatz-coquille-' + attendu.version),
      'l’ancienne coquille est partie, le cache des données reste', apres.caches);
    verifier(JSON.stringify(apres.tout) === JSON.stringify(empreinte.tout),
      'mots, notes, phrases et dialogues à soi, cartes, échéances, réglages, journal, historique : identiques champ par champ',
      { avant: empreinte.tout.reglages, apres: apres.tout.reglages });
    verifier(apres.persoLa && apres.mienne && apres.mien, '« Deutsche Bahn », la phrase et le dialogue à soi sont là');
    verifier(apres.paquet === 'complet' && apres.complet && apres.ouvre, `le dictionnaire complet sert toujours : « ${MOT} » s’ouvre`);

    titre('3. Le contenu publié : 280 phrases, 40 dialogues, 11 situations, les mentions');
    verifier(apres.compte.phrases === 281 && apres.compte.dialogues === 41 && apres.themes.length === 11,
      '280 phrases et 40 dialogues fournis (plus la phrase et le dialogue à soi), 11 situations', apres.compte);
    verifier(apres.relus.length === 26 && apres.phrasesRelues === 0 && apres.relus.includes('dg-chemin-poste') && !apres.relus.includes('dg-aide-service'),
      'les 26 dialogues de la 3.2 portent la mention de relecture, aucune phrase, aucun dialogue neuf', apres.relus.length);
    const mentions = await onglet.evaluer(`
      App.basculer('conversation');
      await new Promise(x => setTimeout(x, 500));
      const situations = [...document.querySelectorAll('#conv-outils .conv-theme')].filter(b => b.dataset.theme).length;
      const lignes = document.querySelectorAll('#conv-liste .conv-ligne').length;
      Situations.ouvrirDialogue('dg-chemin-poste');
      await new Promise(x => setTimeout(x, 400));
      const valide = document.querySelector('#fiche-contenu .conv-provenance').textContent;
      document.querySelector('.fiche-fermer').click();
      Situations.ouvrirDialogue('dg-aide-service');
      await new Promise(x => setTimeout(x, 400));
      const neuf = document.querySelector('#fiche-contenu .conv-provenance').textContent;
      const repliques = document.querySelectorAll('#fiche .replique').length;
      document.querySelector('.fiche-fermer').click();
      await App.ouvrirFiche({ conversation: 'ph-chemin-loin' });
      await new Promise(x => setTimeout(x, 400));
      const phrase = document.querySelector('#fiche-contenu .conv-provenance').textContent;
      document.querySelector('.fiche-fermer').click();
      App.basculer('reglages');
      await new Promise(x => setTimeout(x, 400));
      const apropos = document.getElementById('apropos-versions').textContent;
      return { situations, lignes, valide, neuf, repliques, phrase, apropos };
    `);
    verifier(mentions.situations === 11 && mentions.lignes === 322,
      'l’onglet montre 11 situations et 322 lignes (280 + 40 fournies, 1 + 1 à soi)', mentions);
    verifier(/locutrice native|Muttersprachlerin/.test(mentions.valide),
      'un dialogue de la 3.2 se dit validé en allemand par une locutrice native');
    verifier(/n’ont encore été relus|von Muttersprachlern durchgesehen/.test(mentions.neuf) && !/locutrice|Muttersprachlerin bestätigt/.test(mentions.neuf) && mentions.repliques === 7,
      'un dialogue de la 3.3 se dit non relu, et s’ouvre avec ses 7 répliques');
    verifier(/n’ont encore été relus|von Muttersprachlern durchgesehen/.test(mentions.phrase),
      'une phrase isolée — même reprise par un dialogue validé — se dit non relue');
    verifier(/3\\.3\\.[0-9]/.test(mentions.apropos) && /locutrice native|Muttersprachlerin/.test(mentions.apropos),
      '« À propos » donne une version 3.3.x et la portée de la validation', mentions.apropos);

    titre('4. Les réglages de voix, sur le site publié');
    const voix = await onglet.evaluer(`
      const notees = [];
      const vrai = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = (p) => { notees.push({ texte: p.text, voix: p.voice && p.voice.name, lang: p.lang }); vrai(p); };
      for (let i = 0; i < 40 && !Voix.pret; i++) await new Promise(x => setTimeout(x, 100));
      const blocs = [...document.querySelectorAll('#zone-voix .reglage-voix-langue')];
      const etats = blocs.map(b => b.querySelector('.discret').textContent);
      const de = Voix.diagnostic('de');
      const fr = Voix.diagnostic('fr');
      blocs[0].querySelector('button').click();
      await new Promise(x => setTimeout(x, 400));
      const details = document.querySelector('#zone-voix .reglage-voix-details').textContent.replace(/\\s+/g, ' ');
      speechSynthesis.cancel();
      // Un choix, enregistré et relu.
      const menu = document.querySelector('#reglage-voix-fr');
      const options = [...menu.options].map(o => o.value).filter(Boolean);
      let choix = null;
      if (options.length) {
        menu.value = options[options.length - 1];
        menu.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(x => setTimeout(x, 500));
        choix = (await Store.lireReglages()).voixFr;
      }
      return { blocs: blocs.length, etats, de: { nombre: de.nombre, voix: de.voix }, fr: { nombre: fr.nombre },
               notees, details: details.slice(0, 400), choix, dernier: Voix.dernier() };
    `);
    console.log(`  (${voix.de.nombre} voix allemandes, ${voix.fr.nombre} françaises ; allemand : ${voix.de.voix ? voix.de.voix.nom : 'aucune'})`);
    verifier(voix.blocs === 2 && voix.etats.length === 2, 'un bloc de réglage par langue');
    if (voix.de.voix) {
      verifier(voix.notees.length === 1 && voix.notees[0].texte === 'Zehn Züge fahren zum Zoo.' && /^de/i.test(voix.notees[0].lang)
               && voix.dernier && voix.dernier.voix === voix.notees[0].voix,
        `« Essayer » demande la phrase d’essai à ${voix.notees[0].voix}, en allemand, et les détails le disent`, voix.notees);
      verifier(/demandé à|angefordert bei/.test(voix.details) && /réellement employée|tatsächlich verwendet/.test(voix.details),
        'les détails disent « demandé à », et que le moteur ne dit pas quelle voix il a employée');
    } else {
      verifier(voix.notees.length === 0 && /Aucune voix allemande|keine deutsche Stimme/.test(voix.etats[0]),
        'sans voix allemande sur ce Chrome, rien ne part et l’état le dit');
    }
    verifier(!voix.fr.nombre || (voix.choix && voix.choix.uri),
      voix.fr.nombre ? `un choix de voix française s’enregistre (${voix.choix && voix.choix.nom})` : 'aucune voix française sur ce Chrome');
    await onglet.evaluer(`await Store.ecrireReglage('voixFr', null); Voix.configurer({}); return true;`);
  } finally {
    onglet.fermer();
    await fermerChrome(chrome);
  }

  titre('5. Hors ligne : le site rendu introuvable, le même profil');
  const coupe = await lancerChrome({ port: 9433, profil: PROFIL,
    options: ['--host-resolver-rules=MAP ' + HOTE + ' ~NOTFOUND'] });
  const onglet2 = await ouvrirOnglet(coupe, 'about:blank');
  try {
    await onglet2.naviguer(SITE);
    const horsLigne = await onglet2.evaluer(`
      ${PRET}
      ${VERSION_SW}
      const reseau = await fetch('data/manifeste.json?sonde=' + Date.now(), { cache: 'no-store' })
        .then(() => 'répond').catch(() => 'coupé');
      ${TOUT}
      const ouvre = !!(await Lexique.ouvrir(Lexique.vedette('de', ${JSON.stringify(MOT)})));
      App.basculer('conversation');
      await new Promise(x => setTimeout(x, 400));
      const lignes = document.querySelectorAll('#conv-liste .conv-ligne').length;
      Situations.ouvrirDialogue('dg-visite-amis');
      await new Promise(x => setTimeout(x, 400));
      const repliques = document.querySelectorAll('#fiche .replique').length;
      return { versionSw, reseau, tout, ouvre, paquet: Lexique.paquet, compte: Conversation.compter(), lignes, repliques,
               recherche: Lexique.chercher('Haus').some(r => r.mot === 'Haus'),
               daumen: Conversation.chercher('Daumen').length };
    `);
    verifier(horsLigne.reseau === 'coupé', 'le site est bien injoignable depuis la page', horsLigne.reseau);
    verifier(horsLigne.versionSw === attendu.version, `hors ligne, c’est ${attendu.version} qui sert`, horsLigne.versionSw);
    verifier(JSON.stringify(horsLigne.tout) === JSON.stringify(empreinte.tout),
      'hors ligne, tout est encore là, à l’identique');
    verifier(horsLigne.paquet === 'complet' && horsLigne.ouvre && horsLigne.recherche,
      `hors ligne, le dictionnaire complet et la recherche marchent (« ${MOT} » s’ouvre)`);
    verifier(horsLigne.compte.phrases === 281 && horsLigne.lignes === 322 && horsLigne.repliques === 6 && horsLigne.daumen >= 2,
      'hors ligne, les 280 phrases et 40 dialogues s’affichent, un dialogue neuf s’ouvre, la recherche trouve', horsLigne);
  } finally {
    onglet2.fermer();
    await fermerChrome(coupe);
  }
}

function nettoyer() {
  if (!existsSync(ATELIER)) { console.log('Rien à nettoyer : ' + ATELIER + ' n’existe pas.'); return; }
  rmSync(ATELIER, { recursive: true, force: true });
  console.log('Effacé : ' + ATELIER);
}

function lireEmpreinte() {
  if (!existsSync(EMPREINTE)) {
    throw new Error('Aucune empreinte dans ' + EMPREINTE + '. Lancez d’abord « semer », avec l’ancienne version encore en ligne.');
  }
  return JSON.parse(readFileSync(EMPREINTE, 'utf8'));
}

const commande = process.argv[2];
const COMMANDES = { semer, relever: () => relever(lireEmpreinte()), nettoyer };
if (!COMMANDES[commande]) {
  console.error('Usage : node build/essais_publication.mjs semer | relever | nettoyer');
  process.exit(2);
}
Promise.resolve(COMMANDES[commande]()).then(() => {
  console.log('');
  if (commande === 'nettoyer') process.exit(0);
  console.log(fautes ? `${passees} contrôles passés, ${fautes} ÉCHEC(S).` : `${passees} contrôles passés.`);
  process.exit(fautes ? 1 : 0);
}).catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
