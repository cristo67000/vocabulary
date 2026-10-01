/*
 * Le mode hors ligne, éprouvé pour de vrai.
 *
 * On lance un Chrome complet, on le laisse installer son service worker et
 * pré-cacher le noyau, on ajoute « FFI » avec sa note, puis **on arrête le
 * serveur**. Il n'y a alors plus rien à l'autre bout : ce n'est pas une
 * émulation de coupure, c'est une coupure. On recharge, et on regarde.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { lancerChrome, fermerChrome, ouvrirOnglet } from './pilote_chrome.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT_WEB = 8143;
const ORIGINE = 'http://localhost:' + PORT_WEB + '/';

let fautes = 0;
let passees = 0;
function verifier(condition, message, detail) {
  if (condition) { passees += 1; console.log('  ok  ' + message); return true; }
  fautes += 1;
  console.log('  NON ' + message + (detail === undefined ? '' : '  → ' + JSON.stringify(detail)));
  return false;
}
function titre(t) { console.log(''); console.log(t); }

function demarrerServeur() {
  const p = spawn('python', ['-m', 'http.server', String(PORT_WEB), '--directory', RACINE],
                  { stdio: 'ignore' });
  return p;
}

async function attendreServeur(present) {
  for (let essai = 0; essai < 40; essai += 1) {
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

async function principal() {
  let serveur = demarrerServeur();
  await attendreServeur(true);
  const chrome = await lancerChrome({ port: 9411 });
  console.log('Chrome : ' + chrome.version.Browser);
  const onglet = await ouvrirOnglet(chrome, 'about:blank');

  try {
    titre('1. Installation : service worker et pré-cache du noyau');
    await onglet.naviguer(ORIGINE);
    const install = await onglet.evaluer(`
      const r = await navigator.serviceWorker.register('sw.js').catch(e => ({ erreur: e.message }));
      if (r.erreur) return { erreur: r.erreur };
      // On attend l'activation, puis la fin du pré-cache.
      for (let i = 0; i < 200; i++) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.active) break;
        await new Promise(x => setTimeout(x, 250));
      }
      let fichiers = 0;
      for (let i = 0; i < 240; i++) {
        const noms = await caches.keys();
        const coquille = noms.find(n => n.startsWith('wortschatz-coquille-'));
        if (coquille) {
          const c = await caches.open(coquille);
          fichiers = (await c.keys()).length;
          const manifeste = await fetch('data/manifeste.json').then(x => x.json());
          const attendus = manifeste.paquets.noyau.fichiers.length + 30;
          if (fichiers >= attendus) break;
        }
        await new Promise(x => setTimeout(x, 500));
      }
      const noms = await caches.keys();
      const coquille = noms.find(n => n.startsWith('wortschatz-coquille-'));
      const c = await caches.open(coquille);
      const cles = (await c.keys()).map(q => new URL(q.url).pathname);
      return { scope: r.scope, caches: noms, fichiers: cles.length,
               aIndex: cles.includes('/index.html'),
               aPerso: cles.includes('/js/perso.js'),
               aNotes: cles.includes('/js/notes.js'),
               aMesMots: cles.includes('/js/mesmots.js'),
               aSauvegarde: cles.includes('/js/sauvegarde.js'),
               fichiersNoyau: cles.filter(k => k.startsWith('/data/noyau/')).length };
    `);
    if (install.erreur) {
      console.log('  ÉCHEC d’enregistrement : ' + install.erreur);
      fautes += 1;
    } else {
      verifier(true, 'service worker enregistré (' + install.scope + ')');
      verifier(install.fichiers > 90, install.fichiers + ' fichiers en cache', install);
      verifier(install.fichiersNoyau >= 70,
        install.fichiersNoyau + ' fichiers du noyau pré-cachés');
      verifier(install.aIndex && install.aPerso && install.aNotes
               && install.aMesMots && install.aSauvegarde,
        'les quatre modules de la version 3 sont pré-cachés', install);
    }

    titre('2. On ajoute « FFI », sa note, et on l’apprend');
    const ajout = await onglet.evaluer(`
      await new Promise(x => setTimeout(x, 500));
      const mot = await Perso.creer({
        mot: 'FFI', langue: 'fr', nature: '',
        traductions: 'Widerstandsbewegung, Résistance intérieure française',
      });
      await Notes.ecrire({ perso: mot.id, langue: 'fr', mot: 'FFI' },
        'Forces françaises de l’intérieur.\\nLes maquis, 1944.');
      const cartes = await Revision.apprendre(Perso.entree(mot.id));
      return { uid: mot.id, cartes: cartes.map(c => c.type).sort(),
               parVedette: Lexique.chercher('FFI').some(r => r.perso === mot.id),
               parTraduction: Lexique.chercher('Widerstandsbewegung').some(r => r.perso === mot.id) };
    `);
    verifier(ajout.parVedette, '« FFI » se trouve par sa vedette');
    verifier(ajout.parTraduction, '« Widerstandsbewegung » retrouve « FFI »');
    verifier(JSON.stringify(ajout.cartes) === JSON.stringify(['vers-de', 'vers-fr']),
      'deux cartes, une par direction — pas de carte de genre', ajout.cartes);

    titre('3. Fermeture et réouverture, serveur toujours en ligne');
    await onglet.naviguer(ORIGINE);
    const rouvert = await onglet.evaluer(`
      await new Promise(x => setTimeout(x, 1500));
      const note = await Notes.lire({ perso: '${ajout.uid}' });
      return { compte: Perso.compte(),
               parVedette: Lexique.chercher('FFI').some(r => r.perso === '${ajout.uid}'),
               parTraduction: Lexique.chercher('Widerstandsbewegung').some(r => r.perso === '${ajout.uid}'),
               note: note && note.texte,
               cartes: (await Store.cartesDuMot(null, null, '${ajout.uid}')).length };
    `);
    verifier(rouvert.parVedette, '« FFI » est encore là après réouverture');
    verifier(rouvert.parTraduction, 'et se retrouve toujours par « Widerstandsbewegung »');
    verifier(rouvert.note && rouvert.note.includes('Forces françaises'),
      'sa note est intacte', rouvert.note);
    verifier(rouvert.cartes === 2, 'ses deux cartes sont là', rouvert.cartes);

    titre('4. Modification : la note et les échéances doivent survivre');
    const modif = await onglet.evaluer(`
      const uid = '${ajout.uid}';
      // On fait mûrir les cartes, comme trois semaines de révisions.
      const avant = await Store.cartesDuMot(null, null, uid);
      for (const c of avant) {
        c.etat = 'revision'; c.intervalle = 21; c.facilite = 2.45;
        c.echeance = 1888000000000 + (c.type === 'vers-de' ? 0 : 3600000);
        c.reussites = 6;
        await Store.ecrireCarte(c);
      }
      const empreinte = (l) => l.slice().sort((a,b)=>a.id<b.id?-1:1)
        .map(c => [c.id, c.echeance, c.intervalle, c.facilite, c.reussites, c.etat].join('|'));
      const avantEmpreinte = empreinte(await Store.cartesDuMot(null, null, uid));
      await Perso.modifier(uid, { mot: 'les FFI', langue: 'fr', nature: '',
        traductions: 'Widerstandsbewegung, Résistance intérieure française, Maquis' });
      const apres = await Store.cartesDuMot(null, null, uid);
      const note = await Notes.lire({ perso: uid });
      return { identiques: JSON.stringify(empreinte(apres)) === JSON.stringify(avantEmpreinte),
               avantEmpreinte, apresEmpreinte: empreinte(apres),
               graphie: apres.map(c => c.mot), note: note && note.texte,
               noteMot: note && note.mot,
               nouvelleTraduction: Lexique.chercher('Maquis').some(r => r.perso === uid),
               ancienneTraduction: Lexique.chercher('Widerstandsbewegung').some(r => r.perso === uid) };
    `);
    verifier(modif.identiques,
      'échéances, intervalles, facilités et réussites inchangés après modification',
      { avant: modif.avantEmpreinte, apres: modif.apresEmpreinte });
    verifier(modif.graphie.every(m => m === 'les FFI'),
      'les cartes portent la graphie corrigée', modif.graphie);
    verifier(modif.note && modif.note.includes('Forces françaises'),
      'la note est conservée', modif.note);
    verifier(modif.noteMot === 'les FFI', 'la note suit la nouvelle graphie', modif.noteMot);
    verifier(modif.nouvelleTraduction && modif.ancienneTraduction,
      'anciennes et nouvelles traductions restent cherchables');

    titre('5. HORS LIGNE : on arrête le serveur pour de bon');
    serveur.kill();
    await attendreServeur(false);
    let joignable = true;
    try { await (await fetch(ORIGINE + 'index.html', { cache: 'no-store' })).arrayBuffer(); }
    catch (e) { joignable = false; }
    verifier(!joignable, 'le serveur ne répond plus — la coupure est réelle');

    await onglet.naviguer(ORIGINE);
    const horsLigne = await onglet.evaluer(`
      await new Promise(x => setTimeout(x, 2500));
      let reseau = 'inconnu';
      try { await fetch('data/manifeste.json?sonde=' + Date.now(), { cache: 'no-store' });
            reseau = 'joignable'; }
      catch (e) { reseau = 'coupé'; }
      const note = await Notes.lire({ perso: '${ajout.uid}' });
      const cartes = await Store.cartesDuMot(null, null, '${ajout.uid}');
      return {
        titre: document.title,
        demarrageFini: document.getElementById('demarrage').hidden
                       || document.getElementById('demarrage').classList.contains('parti'),
        reseau,
        paquet: Lexique.paquet,
        entreesIndex: Lexique.etat.index.de.debuts.length,
        entreesAnnoncees: Lexique.manifeste.paquets.noyau.entrees.de,
        chercheDico: Lexique.chercher('Haus').filter(r => !r.perso).map(r => r.mot).slice(0, 3),
        chercheForme: Lexique.chercher('ging').filter(r => !r.perso).map(r => r.mot).slice(0, 2),
        persoCompte: Perso.compte(),
        ffiParVedette: Lexique.chercher('FFI').some(r => r.perso === '${ajout.uid}'),
        ffiParTraduction: Lexique.chercher('Widerstandsbewegung').some(r => r.perso === '${ajout.uid}'),
        note: note && note.texte,
        cartes: cartes.length,
        echeances: cartes.map(c => c.echeance).sort(),
      };
    `);
    verifier(horsLigne.reseau === 'coupé',
      'depuis la page, le réseau est bien coupé', horsLigne.reseau);
    verifier(horsLigne.demarrageFini, 'l’application s’ouvre sans réseau');
    verifier(horsLigne.paquet === 'noyau', 'le dictionnaire est chargé', horsLigne.paquet);
    verifier(horsLigne.entreesIndex === horsLigne.entreesAnnoncees && horsLigne.entreesIndex >= 12000,
      'l’index allemand est complet (' + horsLigne.entreesIndex + ' vedettes, '
      + 'autant que le manifeste en annonce)');
    verifier(horsLigne.chercheDico.includes('Haus'),
      'la recherche du dictionnaire marche hors ligne', horsLigne.chercheDico);
    verifier(horsLigne.chercheForme.includes('gehen'),
      '« ging » mène toujours à « gehen » hors ligne', horsLigne.chercheForme);
    verifier(horsLigne.ffiParVedette, '« FFI » se trouve hors ligne');
    verifier(horsLigne.ffiParTraduction,
      '« Widerstandsbewegung » retrouve « FFI » hors ligne');
    verifier(horsLigne.note && horsLigne.note.includes('Forces françaises'),
      'la note personnelle est lisible hors ligne', horsLigne.note);
    verifier(horsLigne.cartes === 2 && horsLigne.echeances[0] === 1888000000000,
      'les échéances sont intactes hors ligne', horsLigne.echeances);

    titre('6. Une fiche complète s’ouvre hors ligne');
    const fiche = await onglet.evaluer(`
      const trouve = Lexique.chercher('Haus').find(r => !r.perso && r.mot === 'Haus');
      await App.ouvrirFiche(trouve);
      await new Promise(x => setTimeout(x, 1200));
      const texte = document.getElementById('fiche-contenu').textContent;
      return { ouverte: !document.getElementById('fiche').hidden,
               article: texte.slice(0, 40),
               aExemple: texte.length > 400, longueur: texte.length };
    `);
    verifier(fiche.ouverte, 'la fiche s’ouvre', fiche);
    verifier(fiche.aExemple,
      'elle porte ses sens et ses exemples (' + fiche.longueur + ' signes)');

    titre('7. Les expressions usuelles, hors ligne, par l’interface');
    const expressions = await onglet.evaluer(`
      document.querySelector('.fiche-fermer').click();
      await new Promise(x => setTimeout(x, 300));
      const q = document.querySelector('#q');
      const taper = async (t) => {
        q.value = t; q.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(x => setTimeout(x, 350));
        const groupe = document.querySelector('#resultats-expressions');
        return { visible: !groupe.hidden,
                 titre: (groupe.querySelector('h3') || {}).textContent || '',
                 lignes: [...groupe.querySelectorAll('.resultat .mot')].map(e => e.textContent),
                 mots: [...document.querySelectorAll('#resultats .resultat .mot')].map(e => e.textContent) };
      };
      const feu = await taper('feu');
      const ahnung = await taper('Ahnung');
      const gluck = await taper('Gluck');
      const problem = await taper('Problem');
      const chance = await taper('chance');
      const bonjour = await taper('bonjour');
      // Un clic sur une expression ouvre sa fiche, avec sa section et sa provenance.
      await taper('Problem');
      const bouton = [...document.querySelectorAll('#resultats-expressions .resultat')]
        .find(b => b.querySelector('.mot').textContent === 'kein Problem');
      bouton.click();
      await new Promise(x => setTimeout(x, 1200));
      const fiche = document.querySelector('#fiche-contenu');
      const texteFiche = fiche.textContent;
      const boutonApprendre = fiche.querySelector('.apprendre');
      // Et la fiche d'un mot montre la section en bas.
      document.querySelector('.fiche-fermer').click();
      await taper('Ahnung');
      document.querySelector('#resultats .resultat').click();
      await new Promise(x => setTimeout(x, 1200));
      const section = document.querySelector('#fiche-contenu .expressions-usuelles');
      const dansLaSection = section
        ? [...section.querySelectorAll('.expression-ligne .mot')].map(e => e.textContent) : [];
      const titreSection = section ? section.querySelector('h3').textContent : null;
      const ordre = [...document.querySelectorAll('#fiche-contenu > section, #fiche-contenu > div')]
        .map(e => e.className.split(' ')[0]);
      return { feu, ahnung, gluck, problem, chance, bonjour,
               ficheExpression: { marque: texteFiche.includes('expression'),
                                  provenance: /éditorial|redaktionell/i.test(texteFiche),
                                  equivalents: /pas de problème/i.test(texteFiche)
                                               && /aucun problème/i.test(texteFiche),
                                  apprendre: !!boutonApprendre },
               dansLaSection, titreSection, ordre };
    `);
    verifier(expressions.feu.visible && expressions.feu.lignes.includes('à petit feu'),
      '« feu » → groupe « Expressions usuelles » avec « à petit feu »', expressions.feu);
    verifier(expressions.feu.titre === 'Expressions usuelles',
      'le groupe porte son titre', expressions.feu.titre);
    verifier(expressions.feu.mots.includes('feu'),
      'la recherche des mots n’a pas bougé : « feu » est toujours là');
    verifier(expressions.ahnung.lignes.includes('keine Ahnung'),
      '« Ahnung » → « keine Ahnung »', expressions.ahnung.lignes);
    verifier(expressions.gluck.lignes.includes('viel Glück'),
      '« Gluck » sans tréma → « viel Glück »', expressions.gluck.lignes);
    verifier(expressions.problem.lignes.includes('kein Problem'),
      '« Problem » → « kein Problem »', expressions.problem.lignes);
    verifier(expressions.chance.lignes.includes('au petit bonheur la chance')
             && expressions.chance.lignes.includes('viel Glück'),
      '« chance » → « au petit bonheur la chance » et « viel Glück » (par sa traduction)',
      expressions.chance.lignes);
    verifier(expressions.ficheExpression.marque && expressions.ficheExpression.provenance,
      'la fiche de « kein Problem » dit que c’est une expression, relue à la main');
    verifier(expressions.ficheExpression.equivalents,
      'elle montre ses équivalents vérifiés');
    verifier(expressions.ficheExpression.apprendre, 'elle propose « Apprendre »');
    verifier(expressions.titreSection === 'Expressions usuelles'
             && expressions.dansLaSection.includes('keine Ahnung'),
      'la fiche « Ahnung » propose « keine Ahnung » en bas', expressions.dansLaSection);
    const positionExpr = expressions.ordre.indexOf('expressions-usuelles');
    const positionNotes = expressions.ordre.indexOf('mes-notes');
    verifier(positionExpr !== -1 && positionNotes > positionExpr,
      'la section vient après les exemples et avant les notes', expressions.ordre);

    titre('7 bis. Le formulaire demande si plusieurs mots font une expression');
    const formulaire = await onglet.evaluer(`
      document.querySelector('.fiche-fermer').click();
      await new Promise(x => setTimeout(x, 300));
      MesMots.ouvrirFormulaire({ saisie: 'Das ist mir Wurst', langue: 'de' });
      await new Promise(x => setTimeout(x, 300));
      const ligne = [...document.querySelectorAll('.champ-perso')]
        .find(l => l.querySelector('[data-champ="expression"]'));
      const surPlusieurs = ligne && !ligne.hidden;
      const champMot = document.querySelector('.formulaire-perso input[name="mot"]');
      champMot.value = 'Wurst';
      champMot.dispatchEvent(new Event('input', { bubbles: true }));
      const surUnSeul = ligne && ligne.hidden;
      champMot.value = 'Das ist mir Wurst';
      champMot.dispatchEvent(new Event('input', { bubbles: true }));
      ligne.querySelector('[data-valeur="oui"]').click();
      document.querySelector('.formulaire-perso input[name="traductions"]').value = 'je m’en fiche';
      // On enregistre par le bouton, comme au doigt.
      const valider = [...document.querySelectorAll('#formulaire-perso button')]
        .find(b => b.className.indexOf('bouton-principal') !== -1);
      valider.click();
      await new Promise(x => setTimeout(x, 800));
      const brut = Perso.liste().find(m => m.mot === 'Das ist mir Wurst');
      const cartes = brut ? (await Revision.apprendre(Perso.entree(brut.id))).map(c => c.type).sort() : [];
      const parWurst = Lexique.chercher('Wurst').some(r => brut && r.perso === brut.id && r.expression);
      if (brut) await Perso.supprimer(brut.id);
      return { surPlusieurs, surUnSeul, declaree: !!(brut && brut.expression === true), cartes, parWurst };
    `);
    verifier(formulaire.surPlusieurs, 'la question « Expression usuelle ? » apparaît sur plusieurs mots');
    verifier(formulaire.surUnSeul, 'et disparaît sur un seul');
    verifier(formulaire.declaree, '« Oui » enregistre la déclaration', formulaire);
    verifier(JSON.stringify(formulaire.cartes) === JSON.stringify(['vers-de', 'vers-fr']),
      'deux cartes, aucune de genre, bien que « Wurst » soit un nom', formulaire.cartes);
    verifier(formulaire.parWurst, '« Wurst » la retrouve, marquée expression');

    titre('7 ter. Un ancien cache de données incomplet ne sert à rien : il part');
    const perimes = await onglet.evaluer(`
      // Un cache de l'ancien format, tel qu'un téléchargement interrompu de la
      // version 3.0 l'aurait laissé : une tranche, pas d'index.
      const ancien = await caches.open('wortschatz-donnees-2');
      await ancien.put('data/complet/de-000.json', new Response('{"e":[]}'));
      const utilisable = await Paquets.ancien(Lexique.manifeste);
      const effaces = await Paquets.oublierLesPerimes(Lexique.manifeste);
      return { version: Lexique.manifeste.version, effaces, utilisable,
               resteAncien: await caches.has('wortschatz-donnees-2'),
               nomCourant: Paquets.nomDuCache(Lexique.manifeste),
               completInstalle: await Paquets.complet(Lexique.manifeste) };
    `);
    verifier(perimes.version === 3, 'le format des données est en version 3', perimes.version);
    verifier(perimes.utilisable === null && !perimes.resteAncien && perimes.effaces >= 1,
      'sans ses index, l’ancien cache n’est pas utilisable et il est effacé');
    verifier(/^wortschatz-donnees-3-\d{4}-\d{2}-\d{2}$/.test(perimes.nomCourant) && !perimes.completInstalle,
      'le cache courant porte format et date de construction ; le complet se propose au téléchargement',
      perimes);

    titre('8. Apprendre une expression, hors ligne — et la réviser avec son sens');
    const apprise = await onglet.evaluer(`
      document.querySelector('.fiche-fermer').click();
      const v = Lexique.vedette('de', 'kein Problem');
      const e = await Lexique.ouvrir(v);
      const cartes = await Revision.apprendre(e);
      // « à petit feu », direction « comprendre », deuxième passage : la
      // question écrite, sur un sens, avec sa définition.
      const feu = await Lexique.ouvrir(Lexique.vedette('fr', 'à petit feu'));
      const cartesFeu = await Revision.apprendre(feu);
      for (const c of cartesFeu) {
        if (c.type === 'vers-de') { c.reussites = 1; c.echeance = Date.now() - 1000; await Store.ecrireCarte(c); }
        else await Store.supprimerCarte(c.id);
      }
      for (const c of cartes) await Store.supprimerCarte(c.id);
      App.basculer('reviser');
      await new Promise(x => setTimeout(x, 500));
      [...document.querySelectorAll('#vue-reviser button')]
        .find(b => /Commencer la séance|Sitzung beginnen/.test(b.textContent)).click();
      await new Promise(x => setTimeout(x, 1500));
      const consigne = document.querySelector('#seance-consigne').textContent;
      const indice = (document.querySelector('#vue-reviser .enonce-indice') || {}).textContent || '';
      const mot = (document.querySelector('#vue-reviser .enonce-mot') || {}).textContent || '';
      const saisie = document.querySelector('#vue-reviser input[type="text"], #vue-reviser input:not([type])');
      // On répond par l'équivalent de l'autre sens.
      const autreSens = /cuisson/.test(indice) ? 'langsam' : 'auf kleiner Flamme';
      saisie.value = autreSens;
      [...document.querySelectorAll('#vue-reviser button')].find(b => /Valider|Prüfen/.test(b.textContent)).click();
      await new Promise(x => setTimeout(x, 600));
      const verdict = document.querySelector('#verdict-remarque').textContent;
      const etatVerdict = document.querySelector('#vue-reviser .verdict, #seance-verdict');
      for (const c of await Store.cartesDuMot('fr', 'à petit feu')) await Store.supprimerCarte(c.id);
      return { types: cartes.map(c => c.type).sort(), consigne, indice, mot, autreSens, verdict,
               texteVerdict: etatVerdict ? etatVerdict.textContent.replace(/\s+/g, ' ').slice(0, 200) : '' };
    `);
    verifier(JSON.stringify(apprise.types) === JSON.stringify(['vers-de', 'vers-fr']),
      '« kein Problem » : deux cartes, aucune de genre', apprise.types);
    verifier(apprise.mot === 'à petit feu' && /cuisson|durer/.test(apprise.indice),
      'la question « à petit feu » affiche la définition du sens visé', apprise.indice);
    verifier(/en allemand|auf Deutsch/.test(apprise.consigne),
      'la consigne nomme la langue de la réponse — l’allemand', apprise.consigne);
    verifier(/autre sens|andere Bedeutung/.test(apprise.verdict),
      'répondre par l’équivalent de l’autre sens (' + apprise.autreSens + ') vaut « presque », et la remarque le dit',
      apprise);

    titre('9. La voix, sur ce Chrome : quelle voix est demandée, et pour quelle langue');
    const voix = await onglet.evaluer(`
      // Le moteur est réel ; on note seulement ce qui lui est demandé.
      const notees = [];
      const vrai = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = (p) => { notees.push({ texte: p.text, voix: p.voice && p.voice.name, lang: p.lang }); vrai(p); };
      for (let i = 0; i < 40 && !Voix.pret; i++) await new Promise(x => setTimeout(x, 100));
      const de = Voix.diagnostic('de');
      const fr = Voix.diagnostic('fr');
      App.basculer('reglages');
      await new Promise(x => setTimeout(x, 300));
      const blocs = [...document.querySelectorAll('#zone-voix .reglage-voix-langue')];
      const etats = blocs.map(b => b.querySelector('.discret').textContent);
      const menus = blocs.map(b => [...b.querySelector('select').options].map(o => o.value));
      const details = document.querySelector('#zone-voix .reglage-voix-details').textContent;
      // « Essayer » l'allemand : soit une voix allemande parle, soit rien ne part.
      blocs[0].querySelector('button').click();
      await new Promise(x => setTimeout(x, 300));
      const essaiDe = notees.slice();
      // Une phrase allemande depuis sa fiche : même règle.
      await App.ouvrirFiche({ conversation: 'ph-quotidien-pas-de-souci' });
      await new Promise(x => setTimeout(x, 500));
      const boutons = [...document.querySelectorAll('#fiche-contenu .conv-fiche-texte .ecouter')];
      boutons[0].click();
      await new Promise(x => setTimeout(x, 300));
      const parlees = notees.slice(essaiDe.length);
      document.querySelector('.fiche-fermer').click();
      speechSynthesis.cancel();
      return { pret: Voix.pret, de: { nombre: de.nombre, voix: de.voix }, fr: { nombre: fr.nombre, voix: fr.voix },
               etats, menus, details: details.slice(0, 300), essaiDe, parlees,
               boutonGrise: boutons[0].disabled, titreBouton: boutons[0].title };
    `);
    console.log(`  (${voix.de.nombre} voix allemandes, ${voix.fr.nombre} françaises ; allemand : ${voix.de.voix ? voix.de.voix.nom : 'aucune'})`);
    verifier(voix.pret, 'la liste des voix est arrivée');
    verifier(voix.etats.length === 2 && voix.menus[0][0] === '' && voix.menus[0].length === voix.de.nombre + 1,
      'les Réglages montrent un bloc par langue, avec « Automatique » et une entrée par voix', voix.menus);
    verifier(/Système|System/.test(voix.details) && /Navigateur|Browser/.test(voix.details),
      'les détails techniques nomment le système et le navigateur');
    if (voix.de.voix) {
      verifier(/Voix retenue|Verwendete Stimme/.test(voix.etats[0]) && voix.etats[0].includes(voix.de.voix.nom),
        'l’état dit la voix allemande retenue : ' + voix.de.voix.nom, voix.etats[0]);
      verifier(voix.essaiDe.length === 1 && voix.essaiDe[0].texte === 'Zehn Züge fahren zum Zoo.'
               && /^de/i.test(voix.essaiDe[0].lang) && voix.essaiDe[0].voix === voix.de.voix.nom,
        '« Essayer » demande « Zehn Züge fahren zum Zoo. » à cette voix, en allemand', voix.essaiDe);
      verifier(voix.parlees.length === 1 && voix.parlees[0].texte === 'Kein Problem.' && /^de/i.test(voix.parlees[0].lang),
        'le ▸ de la phrase demande « Kein Problem. » à une voix allemande', voix.parlees);
    } else {
      verifier(/Aucune voix allemande|keine deutsche Stimme/.test(voix.etats[0]),
        'sans voix allemande, l’état le dit pour cette langue', voix.etats[0]);
      verifier(voix.essaiDe.length === 0 && voix.parlees.length === 0 && voix.boutonGrise,
        'rien n’est demandé au moteur — jamais une voix française pour de l’allemand — et le ▸ est grisé');
    }
    verifier(voix.parlees.every((p) => !/^fr/i.test(p.lang)) && voix.essaiDe.every((p) => !/^fr/i.test(p.lang)),
      'aucun texte allemand n’est parti avec une balise française');

    titre('10. Les phrases de la 3.3, par l’interface : recherche, fiche, passerelle, provenance');
    const contenu = await onglet.evaluer(`
      App.basculer('conversation');
      await new Promise(x => setTimeout(x, 300));
      const q = document.querySelector('#conv-q');
      q.value = 'Daumen'; q.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(x => setTimeout(x, 300));
      const lignes = [...document.querySelectorAll('#conv-liste .conv-ligne .conv-principal')].map(e => e.textContent);
      const situations = [...document.querySelectorAll('#conv-outils .conv-theme')].map(b => b.textContent);
      document.querySelector('#conv-liste .conv-ligne').click();
      await new Promise(x => setTimeout(x, 500));
      const fiche = document.querySelector('#fiche-contenu');
      const provenancePhrase = fiche.querySelector('.conv-provenance').textContent;
      const registre = (fiche.querySelector('.conv-registre') || {}).textContent || '';
      document.querySelector('.fiche-fermer').click();
      await App.ouvrirFiche({ conversation: 'ph-quotidien-pas-de-souci' });
      await new Promise(x => setTimeout(x, 500));
      const passerelle = [...document.querySelectorAll('#fiche-contenu .expressions-usuelles .expression-ligne .mot')].map(e => e.textContent);
      document.querySelector('#fiche-contenu .expressions-usuelles .expression-ligne').click();
      await new Promise(x => setTimeout(x, 900));
      const vedette = (document.querySelector('#fiche-contenu .vedette .mot') || {}).textContent;
      document.querySelector('.fiche-fermer').click();
      Situations.ouvrirDialogue('dg-chemin-poste');
      await new Promise(x => setTimeout(x, 300));
      const provenanceValide = document.querySelector('#fiche-contenu .conv-provenance').textContent;
      document.querySelector('.fiche-fermer').click();
      return { lignes, situations: situations.length, provenancePhrase, registre, passerelle, vedette, provenanceValide };
    `);
    verifier(contenu.lignes.some((l) => /Daumen|doigts/.test(l)) && contenu.lignes.length >= 2,
      '« Daumen » dans l’onglet trouve les phrases « je croise les doigts »', contenu.lignes);
    verifier(contenu.situations === 12, 'onze situations, plus « toutes »', contenu.situations);
    verifier(/relus|durchgesehen/.test(contenu.provenancePhrase) && !/locutrice|Muttersprachlerin/.test(contenu.provenancePhrase),
      'la fiche d’une phrase neuve se dit non relue', contenu.provenancePhrase);
    verifier(/tutoiement|vouvoiement|Duzen|Siezen/.test(contenu.registre), 'et porte son registre', contenu.registre);
    verifier(contenu.passerelle.includes('kein Problem') && contenu.vedette === 'kein Problem',
      '« Kein Problem. » mène à la fiche de l’expression « kein Problem »', contenu);
    verifier(/locutrice native|Muttersprachlerin/.test(contenu.provenanceValide),
      'le dialogue de la poste se dit validé en allemand', contenu.provenanceValide);

    // Le serveur repart pour l'épreuve suivante.
    serveur = demarrerServeur();
    await attendreServeur(true);
    console.log('');
    console.log('Identifiant de FFI pour l’épreuve d’export : ' + ajout.uid);
    return { uid: ajout.uid, serveur };
  } finally {
    onglet.fermer();
    await fermerChrome(chrome);
  }
}

principal().then((r) => {
  console.log('');
  console.log(fautes ? `${passees} contrôles passés, ${fautes} ÉCHEC(S).`
                     : `${passees} contrôles passés. Le mode hors ligne fonctionne.`);
  if (r && r.serveur) r.serveur.kill();
  process.exit(fautes ? 1 : 0);
}).catch((e) => {
  console.error('\nÉchec inattendu :', e);
  process.exit(1);
});
