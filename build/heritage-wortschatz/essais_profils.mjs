/*
 * Export et restauration, d'un profil de navigateur à un autre.
 *
 * Deux Chrome, deux `--user-data-dir` distincts : deux profils au sens propre,
 * chacun avec son IndexedDB et son cache. Le premier écrit « FFI » et sa note,
 * puis **télécharge** le fichier par le bouton de l'application — pas par un
 * appel interne. Le second, vierge, l'importe et doit tout retrouver.
 *
 * C'est la seule façon d'éprouver ce que la sauvegarde promet : survivre à un
 * changement d'appareil.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lancerChrome, fermerChrome, ouvrirOnglet } from './pilote_chrome.mjs';

const RACINE = 'C:\\wz\\wortschatz';
const PORT_WEB = 8145;
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

async function attendreServeur() {
  for (let essai = 0; essai < 40; essai += 1) {
    try { await (await fetch(ORIGINE + 'index.html')).arrayBuffer(); return true; }
    catch (e) { await new Promise((r) => setTimeout(r, 250)); }
  }
  return false;
}

async function principal() {
  const serveur = spawn('python',
    ['-m', 'http.server', String(PORT_WEB), '--directory', RACINE], { stdio: 'ignore' });
  await attendreServeur();

  const dossierTelechargements = mkdtempSync(path.join(tmpdir(), 'wortschatz-tel-'));
  const profilA = mkdtempSync(path.join(tmpdir(), 'wortschatz-A-'));
  const profilB = mkdtempSync(path.join(tmpdir(), 'wortschatz-B-'));

  const chromeA = await lancerChrome({ port: 9412, profil: profilA });
  const ongletA = await ouvrirOnglet(chromeA, 'about:blank');

  let fichier = null;
  try {
    titre('Profil A — on écrit « FFI », sa note, ses cartes');
    await ongletA.evaluer('return 1');
    await ongletA.envoyer('Page.setDownloadBehavior',
      { behavior: 'allow', downloadPath: dossierTelechargements });
    await ongletA.naviguer(ORIGINE);

    const ecrit = await ongletA.evaluer(`
      await new Promise(x => setTimeout(x, 1500));
      const mot = await Perso.creer({
        mot: 'FFI', langue: 'fr', nature: '',
        traductions: 'Widerstandsbewegung, Résistance intérieure française',
        exemple: 'Les FFI ont libéré la ville.',
        exempleTraduit: 'Die FFI haben die Stadt befreit.',
      });
      await Notes.ecrire({ perso: mot.id, langue: 'fr', mot: 'FFI' },
        'Forces françaises de l’intérieur.\\nLes maquis, 1944.');
      const cartes = await Revision.apprendre(Perso.entree(mot.id));
      // On leur donne une histoire, pour voir si elle traverse.
      for (const c of await Store.cartesDuMot(null, null, mot.id)) {
        c.etat = 'revision'; c.intervalle = 34; c.facilite = 2.15; c.reussites = 7;
        c.echeance = 1900000000000 + (c.type === 'vers-de' ? 0 : 7200000);
        await Store.ecrireCarte(c);
      }
      return { uid: mot.id, cartes: cartes.length };
    `);
    verifier(ecrit.cartes === 2, 'deux cartes créées dans le profil A', ecrit.cartes);

    titre('Profil A — on clique « Exporter un fichier »');
    const exporte = await ongletA.evaluer(`
      App.basculer('reglages');
      await new Promise(x => setTimeout(x, 800));
      const bouton = [...document.querySelectorAll('#zone-sauvegarde button')]
        .find(b => b.textContent.indexOf('Exporter') !== -1);
      if (!bouton) return { erreur: 'bouton absent' };
      bouton.click();
      await new Promise(x => setTimeout(x, 2500));
      return { nom: Sauvegarde.nomDeFichier(),
               avis: document.querySelector('.sauvegarde-avis').textContent.trim() };
    `);
    verifier(!exporte.erreur, 'le bouton d’export existe', exporte);
    verifier(/Fichier écrit/.test(exporte.avis || ''),
      'l’application annonce le fichier écrit', exporte.avis);

    for (let essai = 0; essai < 40 && !fichier; essai += 1) {
      const trouves = readdirSync(dossierTelechargements)
        .filter((n) => n.endsWith('.json'));
      if (trouves.length) fichier = path.join(dossierTelechargements, trouves[0]);
      else await new Promise((r) => setTimeout(r, 250));
    }
    verifier(!!fichier, 'le fichier est bien arrivé sur le disque',
      readdirSync(dossierTelechargements));
    if (!fichier) throw new Error('pas de fichier téléchargé');

    const contenu = JSON.parse(readFileSync(fichier, 'utf8'));
    verifier(contenu.format === 'wortschatz-sauvegarde' && contenu.version === 1,
      'le fichier est versionné', { format: contenu.format, version: contenu.version });
    verifier(contenu.motsPersonnels.some((m) => m.mot === 'FFI'),
      '« FFI » est dans le fichier');
    verifier(contenu.notes.some((n) => n.texte.includes('Forces françaises')),
      'sa note est dans le fichier');
    verifier(contenu.cartes.filter((c) => c.perso === ecrit.uid).length === 2,
      'ses deux cartes sont dans le fichier');
    console.log('      ' + path.basename(fichier) + ' — '
      + readFileSync(fichier, 'utf8').length + ' octets');

    await fermerChrome(chromeA);

    titre('Profil B — un navigateur vierge importe le fichier');
    const chromeB = await lancerChrome({ port: 9413, profil: profilB });
    const ongletB = await ouvrirOnglet(chromeB, 'about:blank');
    try {
      await ongletB.naviguer(ORIGINE);
      const vide = await ongletB.evaluer(`
        await new Promise(x => setTimeout(x, 1500));
        return { perso: Perso.compte(),
                 cartes: (await Store.toutesLesCartes()).length,
                 notes: (await Store.toutesLesNotes()).length,
                 ffi: Lexique.chercher('FFI').filter(r => r.perso).length };
      `);
      verifier(vide.perso === 0 && vide.cartes === 0 && vide.notes === 0
               && vide.ffi === 0,
        'le profil B est bien vierge', vide);

      const brut = readFileSync(fichier, 'utf8');
      const importe = await ongletB.evaluer(`
        const contenu = ${JSON.stringify(brut)};
        const f = new File([contenu], 'sauvegarde.json', { type: 'application/json' });
        App.basculer('reglages');
        await new Promise(x => setTimeout(x, 700));
        const entree = document.querySelector('#zone-sauvegarde input[type=file]');
        const dt = new DataTransfer(); dt.items.add(f); entree.files = dt.files;
        entree.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(x => setTimeout(x, 1500));
        const bilan = document.querySelector('.sauvegarde-avis').textContent.replace(/\\s+/g, ' ').trim();
        const valider = [...document.querySelectorAll('.sauvegarde-avis button')]
          .find(b => b.textContent === 'Importer');
        if (!valider) return { bilan, erreur: 'pas de bouton Importer' };
        valider.click();
        await new Promise(x => setTimeout(x, 2000));
        const resume = document.querySelector('.sauvegarde-avis').textContent.replace(/\\s+/g, ' ').trim();
        const uid = '${ecrit.uid}';
        const note = await Notes.lire({ perso: uid });
        const cartes = await Store.cartesDuMot(null, null, uid);
        return { bilan, resume,
                 perso: Perso.compte(),
                 parVedette: Lexique.chercher('FFI').some(r => r.perso === uid),
                 parTraduction: Lexique.chercher('Widerstandsbewegung').some(r => r.perso === uid),
                 note: note && note.texte,
                 cartes: cartes.map(c => [c.type, c.echeance, c.intervalle, c.facilite, c.reussites].join('|')).sort(),
                 exemple: (Perso.brut(uid) || {}).exemple };
      `);
      verifier(!importe.erreur, 'le fichier est reconnu par l’import', importe);
      console.log('      bilan   : ' + importe.bilan);
      console.log('      résultat: ' + importe.resume);
      verifier(importe.perso === 1, '« FFI » est entré dans le profil B', importe.perso);
      verifier(importe.parVedette, 'il se trouve par sa vedette');
      verifier(importe.parTraduction, 'il se trouve par « Widerstandsbewegung »');
      verifier(importe.note && importe.note.includes('Forces françaises'),
        'sa note est restaurée', importe.note);
      verifier(importe.exemple === 'Les FFI ont libéré la ville.',
        'sa phrase d’exemple est restaurée', importe.exemple);
      verifier(importe.cartes.length === 2,
        'ses deux cartes sont restaurées', importe.cartes);
      verifier(importe.cartes.some((c) => c.indexOf('|1900000000000|34|2.15|7') !== -1),
        'avec leur échéance, leur intervalle, leur facilité et leurs réussites',
        importe.cartes);

      titre('Profil B — réouverture : tout doit tenir');
      await ongletB.naviguer(ORIGINE);
      const apres = await ongletB.evaluer(`
        await new Promise(x => setTimeout(x, 1500));
        const note = await Notes.lire({ perso: '${ecrit.uid}' });
        return { perso: Perso.compte(),
                 parVedette: Lexique.chercher('FFI').some(r => r.perso === '${ecrit.uid}'),
                 note: !!(note && note.texte) };
      `);
      verifier(apres.perso === 1 && apres.parVedette && apres.note,
        '« FFI », sa note et ses cartes survivent au rechargement du profil B', apres);
    } finally {
      ongletB.fermer();
      await fermerChrome(chromeB);
    }
  } finally {
    serveur.kill();
    for (const d of [dossierTelechargements, profilA, profilB]) {
      try { rmSync(d, { recursive: true, force: true }); } catch (e) { /* tant pis */ }
    }
  }
}

principal().then(() => {
  console.log('');
  console.log(fautes ? `${passees} contrôles passés, ${fautes} ÉCHEC(S).`
                     : `${passees} contrôles passés. L’export traverse les profils.`);
  process.exit(fautes ? 1 : 0);
}).catch((e) => {
  console.error('\nÉchec inattendu :', e);
  process.exit(1);
});
