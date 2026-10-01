/*
 * Le site publié, pris par l'interface.
 *
 * Pas d'appels internes ici, ou le moins possible : on tape dans le champ de
 * recherche, on clique les boutons, on remplit le formulaire. Ce qui est éprouvé
 * est ce qu'un doigt ferait — sur les fichiers réellement servis par GitHub
 * Pages, pas sur ceux du disque.
 *
 *     node build/essais_en_ligne.mjs
 *
 * Le profil de navigateur est créé pour l'occasion et détruit ensuite : aucune
 * donnée personnelle réelle n'est touchée.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lancerChrome, fermerChrome, ouvrirOnglet } from './pilote_chrome.mjs';

/* `WORTSCHATZ_SITE` permet d'éprouver un autre déploiement — une bifurcation,
 * une pré-production — sans toucher au fichier. */
const SITE = process.env.WORTSCHATZ_SITE
  || 'https://cristo67000.github.io/wortschatz/';

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
  for (let i = 0; i < 240; i++) {
    if (window.App && window.Lexique && Lexique.paquet && window.Perso && Perso.chargee) break;
    await new Promise(x => setTimeout(x, 500));
  }
  await new Promise(x => setTimeout(x, 600));
`;

async function principal() {
  const telechargements = mkdtempSync(path.join(tmpdir(), 'wortschatz-tel-'));
  const chrome = await lancerChrome({ port: 9431 });
  const onglet = await ouvrirOnglet(chrome, 'about:blank');
  try {
    await onglet.evaluer('return 1');
    await onglet.envoyer('Page.setDownloadBehavior',
      { behavior: 'allow', downloadPath: telechargements });
    await onglet.naviguer(SITE);

    titre('1. Ce que le site sert');
    const identite = await onglet.evaluer(`
      ${PRET}
      return { titre: document.title, paquet: Lexique.paquet,
               construit: Lexique.manifeste.construit,
               entrees: Lexique.manifeste.paquets.complet.entrees,
               onglets: [...document.querySelectorAll('#onglets button')]
                 .map(b => b.textContent.replace(/[^\\p{L} ]/gu, '').trim()) };
    `);
    verifier(identite.construit === '2026-09-13',
      'les données servies sont celles de la version 3.1', identite.construit);
    verifier(identite.entrees.de === 65240 && identite.entrees.fr === 55957,
      'le dictionnaire élargi, avec ses expressions, est annoncé', identite.entrees);
    verifier(identite.onglets.length === 5 && identite.onglets.includes('Mes mots'),
      'les cinq onglets sont là', identite.onglets);

    titre('2. La recherche, au clavier');
    const recherche = await onglet.evaluer(`
      ${PRET}
      const q = document.querySelector('#q');
      const taper = async (texte) => {
        q.value = texte;
        q.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(x => setTimeout(x, 350));
        return [...document.querySelectorAll('#resultats .resultat')]
          .map(b => b.querySelector('.mot').textContent);
      };
      return {
        allemand: await taper('Haus'),
        francais: await taper('maison'),
        sansUmlaut: await taper('strasse'),
        flechie: await taper('ging'),
        expression: await taper('de même'),
        vide: await taper('Baustellenlaermxyz'),
        boutonAjout: !document.querySelector('#b-ajouter-rien').hidden,
      };
    `);
    verifier(recherche.allemand.includes('Haus'), '« Haus » se trouve', recherche.allemand.slice(0, 3));
    verifier(recherche.francais.includes('maison'), '« maison » se trouve', recherche.francais.slice(0, 3));
    verifier(recherche.sansUmlaut.includes('Straße'),
      '« strasse » trouve « Straße »', recherche.sansUmlaut.slice(0, 3));
    verifier(recherche.flechie.includes('gehen'),
      '« ging » mène à « gehen »', recherche.flechie.slice(0, 3));
    verifier(recherche.expression.includes('de même'),
      'une expression se trouve', recherche.expression.slice(0, 3));
    verifier(recherche.vide.length === 0 && recherche.boutonAjout,
      'une recherche sans résultat propose d’ajouter le mot');

    titre('3. Ajouter un mot, par le formulaire');
    const ajout = await onglet.evaluer(`
      document.querySelector('#b-ajouter-rien').click();
      await new Promise(x => setTimeout(x, 500));
      const f = document.querySelector('#formulaire-perso');
      const prerempli = f.querySelector('[name=mot]').value;
      const langueDevinee = f.querySelector('[data-champ=langue] [aria-pressed=true]').textContent;
      const poser = (n, v) => { const e = f.querySelector('[name=' + n + ']');
        e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
      poser('mot', 'FFI');
      [...f.querySelector('[data-champ=langue]').querySelectorAll('button')]
        .find(b => b.textContent === 'français').click();
      poser('traductions', 'Widerstandsbewegung, Résistance intérieure française');
      poser('exemple', 'Les FFI ont libéré la ville.');
      poser('exempleTraduit', 'Die FFI haben die Stadt befreit.');
      poser('note', 'Forces françaises de l’intérieur, 1944.');
      [...f.querySelectorAll('button')].find(b => b.textContent === 'Ajouter un mot').click();
      await new Promise(x => setTimeout(x, 1500));
      const fiche = document.querySelector('#fiche-contenu').textContent;
      return { prerempli, langueDevinee, compte: Perso.compte(),
               ficheOuverte: !document.querySelector('#fiche').hidden,
               marquePersonnel: fiche.includes('Personnel'),
               traductionsAffichees: fiche.includes('Widerstandsbewegung'),
               exempleAffiche: fiche.includes('libéré la ville'),
               noteAffichee: fiche.includes('Forces françaises'),
               boutons: [...document.querySelectorAll('#fiche-contenu button')]
                 .map(b => b.textContent.trim()).filter(t => t.length < 25) };
    `);
    verifier(ajout.prerempli === 'Baustellenlaermxyz',
      'le formulaire est prérempli de la recherche', ajout.prerempli);
    verifier(ajout.compte === 1, 'le mot est enregistré');
    verifier(ajout.ficheOuverte && ajout.marquePersonnel,
      'sa fiche s’ouvre et porte la mention « Personnel »');
    verifier(ajout.traductionsAffichees && ajout.exempleAffiche && ajout.noteAffichee,
      'traductions, exemple et note s’affichent', ajout);
    verifier(ajout.boutons.includes('Modifier la note')
             && ajout.boutons.includes('Supprimer la note')
             && ajout.boutons.includes('Modifier le mot')
             && ajout.boutons.includes('Supprimer le mot'),
      'les quatre boutons nomment ce qu’ils touchent', ajout.boutons);

    titre('4. Le mot se cherche dans les deux sens');
    const cherche = await onglet.evaluer(`
      document.querySelector('.fiche-fermer').click();
      await new Promise(x => setTimeout(x, 300));
      const q = document.querySelector('#q');
      const taper = async (t) => { q.value = t;
        q.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(x => setTimeout(x, 350));
        return [...document.querySelectorAll('#resultats .resultat')]
          .map(b => b.textContent); };
      return { parVedette: await taper('FFI'),
               parTraduction: await taper('Widerstandsbewegung'),
               parDebutTraduction: await taper('Widerstand') };
    `);
    verifier(cherche.parVedette.some(t => t.includes('FFI')),
      '« FFI » se trouve par sa vedette', cherche.parVedette);
    verifier(cherche.parTraduction.some(t => t.includes('FFI')),
      '« Widerstandsbewegung » retrouve « FFI »', cherche.parTraduction);
    verifier(cherche.parDebutTraduction.some(t => t.includes('FFI')),
      'un début de traduction suffit', cherche.parDebutTraduction);

    titre('5. Une note sur une entrée du dictionnaire, par l’interface');
    const note = await onglet.evaluer(`
      const q = document.querySelector('#q');
      q.value = 'Haus'; q.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(x => setTimeout(x, 400));
      document.querySelector('#resultats .resultat').click();
      await new Promise(x => setTimeout(x, 1200));
      const bloc = document.querySelector('.mes-notes');
      [...bloc.querySelectorAll('button')].find(b => b.textContent === 'Ajouter une note').click();
      await new Promise(x => setTimeout(x, 300));
      const zone = bloc.querySelector('textarea');
      zone.value = 'das Haus, die Häuser.\\nComme « house ».';
      zone.dispatchEvent(new Event('input', { bubbles: true }));
      [...bloc.querySelectorAll('button')].find(b => b.textContent === 'Enregistrer').click();
      await new Promise(x => setTimeout(x, 800));
      const affiche = bloc.querySelector('.note-texte');
      document.querySelector('.fiche-fermer').click();
      await new Promise(x => setTimeout(x, 300));
      // On rouvre la fiche : la note doit être là.
      q.value = 'Haus'; q.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(x => setTimeout(x, 400));
      document.querySelector('#resultats .resultat').click();
      await new Promise(x => setTimeout(x, 1200));
      const relue = document.querySelector('.mes-notes .note-texte');
      return { ecrite: affiche && affiche.textContent,
               relue: relue && relue.textContent,
               sautDeLigne: !!(relue && relue.textContent.includes(String.fromCharCode(10))) };
    `);
    verifier(note.ecrite && note.ecrite.startsWith('das Haus'),
      'la note s’écrit sur une entrée du dictionnaire', note.ecrite);
    verifier(note.relue === note.ecrite,
      'elle se relit à la réouverture de la fiche');
    verifier(note.sautDeLigne, 'ses sauts de ligne sont conservés');

    titre('6. Export, par le bouton');
    const exporte = await onglet.evaluer(`
      document.querySelector('.fiche-fermer').click();
      App.basculer('reglages');
      await new Promise(x => setTimeout(x, 900));
      const etat = document.querySelector('.dictionnaire-detail').textContent;
      [...document.querySelectorAll('#zone-sauvegarde button')]
        .find(b => b.textContent.indexOf('Exporter') !== -1).click();
      await new Promise(x => setTimeout(x, 2500));
      return { etat, avis: document.querySelector('.sauvegarde-avis').textContent.trim() };
    `);
    verifier(/Installé, utilisable hors ligne/.test(exporte.etat),
      'les Réglages disent le paquet actif, son poids et son état', exporte.etat);
    verifier(/Fichier écrit/.test(exporte.avis), 'l’export s’annonce', exporte.avis);

    let fichier = null;
    for (let essai = 0; essai < 40 && !fichier; essai += 1) {
      const trouves = readdirSync(telechargements).filter((n) => n.endsWith('.json'));
      if (trouves.length) fichier = path.join(telechargements, trouves[0]);
      else await new Promise((r) => setTimeout(r, 250));
    }
    verifier(!!fichier, 'le fichier arrive sur le disque', readdirSync(telechargements));
    if (fichier) {
      const contenu = JSON.parse(readFileSync(fichier, 'utf8'));
      verifier(contenu.format === 'wortschatz-sauvegarde' && contenu.version === 1,
        'il est versionné');
      verifier(contenu.motsPersonnels.some((m) => m.mot === 'FFI'),
        '« FFI » y est');
      verifier(contenu.notes.length === 2,
        'les deux notes y sont — celle du dictionnaire et celle du mot personnel',
        contenu.notes.map((n) => n.id));
      console.log('      ' + path.basename(fichier) + ' — '
        + readFileSync(fichier, 'utf8').length + ' octets');
    }

    titre('7. Les expressions usuelles, par l’interface');
    const expressions = await onglet.evaluer(`
      const q = document.querySelector('#q');
      const taper = async (t) => {
        q.value = t; q.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(x => setTimeout(x, 500));
        const groupe = document.querySelector('#resultats-expressions');
        return { visible: !groupe.hidden,
                 lignes: [...groupe.querySelectorAll('.resultat .mot')].map(e => e.textContent) };
      };
      const bonheur = await taper('bonheur');
      const ahnung = await taper('Ahnung');
      const gluck = await taper('Gluck');
      // La fiche du mot « Glück » se termine par ses expressions.
      document.querySelector('#resultats .resultat').click();
      await new Promise(x => setTimeout(x, 1500));
      const section = document.querySelector('#fiche-contenu .expressions-usuelles');
      const dansLaFiche = section
        ? [...section.querySelectorAll('.expression-ligne .mot')].map(e => e.textContent) : [];
      const ordre = [...document.querySelectorAll('#fiche-contenu > section, #fiche-contenu > div')]
        .map(e => e.className.split(' ')[0]);
      // On ouvre « viel Glück » depuis la fiche, et on l'apprend.
      const ligne = section && [...section.querySelectorAll('.expression-ligne')]
        .find(b => b.querySelector('.mot').textContent === 'viel Glück');
      if (ligne) ligne.click();
      await new Promise(x => setTimeout(x, 1500));
      const texteFiche = document.querySelector('#fiche-contenu').textContent;
      const apprendre = document.querySelector('#fiche-contenu .apprendre');
      if (apprendre) apprendre.click();
      await new Promise(x => setTimeout(x, 800));
      const cartes = (await Store.cartesDuMot('de', 'viel Glück')).map(c => c.type).sort();
      document.querySelector('.fiche-fermer').click();
      return { bonheur, ahnung, gluck, dansLaFiche, ordre, ouverte: !!ligne,
               provenance: /éditorial|redaktionell/i.test(texteFiche),
               equivalent: /bonne chance/i.test(texteFiche), cartes };
    `);
    verifier(expressions.bonheur.visible && expressions.bonheur.lignes.includes('au petit bonheur la chance'),
      '« bonheur » → groupe « Expressions usuelles » avec « au petit bonheur la chance »', expressions.bonheur);
    verifier(expressions.ahnung.lignes.includes('keine Ahnung'), '« Ahnung » → « keine Ahnung »', expressions.ahnung);
    verifier(expressions.gluck.lignes.includes('viel Glück'), '« Gluck » sans tréma → « viel Glück »', expressions.gluck);
    verifier(expressions.dansLaFiche.includes('viel Glück'),
      'la fiche « Glück » se termine par ses expressions, dont « viel Glück »', expressions.dansLaFiche);
    verifier(expressions.ordre.indexOf('expressions-usuelles') !== -1
             && expressions.ordre.indexOf('mes-notes') > expressions.ordre.indexOf('expressions-usuelles'),
      'la section vient après les exemples et avant les notes', expressions.ordre);
    verifier(expressions.ouverte && expressions.provenance && expressions.equivalent,
      'la fiche « viel Glück » s’ouvre depuis là, avec sa provenance et « bonne chance »');
    verifier(JSON.stringify(expressions.cartes) === JSON.stringify(['vers-de', 'vers-fr']),
      '« viel Glück » ajoutée aux révisions : deux cartes, aucune de genre', expressions.cartes);

    titre('8. Après fermeture et réouverture du navigateur');
    await onglet.naviguer(SITE);
    const apres = await onglet.evaluer(`
      ${PRET}
      const q = document.querySelector('#q');
      q.value = 'FFI'; q.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(x => setTimeout(x, 400));
      return { perso: Perso.compte(),
               notes: (await Store.toutesLesNotes()).length,
               trouve: [...document.querySelectorAll('#resultats .resultat')]
                 .some(b => b.textContent.includes('FFI')),
               note: (await Notes.lire({ langue: 'de', mot: 'Haus' })).texte };
    `);
    verifier(apres.perso === 1 && apres.trouve, '« FFI » est toujours là');
    verifier(apres.notes === 2 && apres.note.startsWith('das Haus'),
      'les deux notes aussi', apres.notes);
  } finally {
    onglet.fermer();
    await fermerChrome(chrome);
    try { rmSync(telechargements, { recursive: true, force: true }); } catch (e) { /* tant pis */ }
  }
}

principal().then(() => {
  console.log('');
  console.log(fautes ? `${passees} contrôles passés, ${fautes} ÉCHEC(S).`
                     : `${passees} contrôles passés sur le site publié.`);
  process.exit(fautes ? 1 : 0);
}).catch((e) => { console.error('\nÉchec inattendu :', e); process.exit(1); });
