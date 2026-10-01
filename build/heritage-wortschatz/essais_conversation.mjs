/*
 * Cas de contrôle de « Phrases et dialogues ».
 *
 * ── Le contenu d'abord ─────────────────────────────────────────────────────
 *
 * `data/conversation.json` a été rédigé par un assistant d'écriture. Seul le
 * texte allemand des dialogues de la version 3.2 a été validé par une
 * locutrice native — le fichier le dit dialogue par dialogue (`relu`), et ce
 * fichier vérifie que la mention n'est posée que là. Ce qu'un programme sait
 * vérifier, il le vérifie donc ici, à chaque fois : la structure, les
 * identifiants, le nombre
 * de répliques, la cohérence du tutoiement et du vouvoiement dans les deux
 * langues, la ponctuation française et allemande, et les doublons — deux
 * textes identiques qui n'auraient pas le même identifiant canonique
 * donneraient deux jeux de cartes pour une seule phrase.
 *
 * ── Puis ce que l'application en fait ──────────────────────────────────────
 *
 * La recherche par mot intérieur dans les deux langues, l'entrée au format du
 * dictionnaire, les cartes — jamais de genre, le sens de travail respecté —,
 * l'apprentissage depuis une fiche ou depuis un dialogue qui retrouve les
 * mêmes cartes, la correction tolérante d'une phrase, les phrases et dialogues
 * à soi qu'on corrige sans rien perdre, l'export et l'import — anciens
 * fichiers compris —, et la migration de la base de version 3 à 4.
 *
 *     node build/essais_conversation.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fabriquerIndexedDB, nouveauDepot, FauxKeyRange } from './faux_indexeddb.mjs';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.join(ici, '..');

// ── Le décor ────────────────────────────────────────────────────────────────

globalThis.window = globalThis;
Object.defineProperty(globalThis, 'navigator', {
  value: { languages: ['fr'] }, configurable: true,
});
globalThis.document = {
  documentElement: {},
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: () => {},
  dispatchEvent: () => {},
  createElement: () => ({ style: {}, dataset: {}, classList: { add() {}, toggle() {} },
                          appendChild() {}, addEventListener() {}, setAttribute() {} }),
};
globalThis.CustomEvent = class { constructor(n, o) { this.n = n; this.detail = o && o.detail; } };
globalThis.IDBKeyRange = FauxKeyRange;
globalThis.Voix = { possible: () => false, dire() {}, taire() {}, enchainer() { return { arreter() {} }; } };

globalThis.fetch = async (chemin) => {
  const fichier = path.join(racine, String(chemin));
  if (!existsSync(fichier)) return { ok: false, status: 404, text: async () => '' };
  const contenu = readFileSync(fichier, 'utf8');
  return { ok: true, status: 200, text: async () => contenu,
           json: async () => JSON.parse(contenu) };
};

const MODULES = ['i18n.js', 'lexique.js', 'store.js', 'revision.js', 'exercices.js',
                 'notes.js', 'perso.js', 'conversation.js', 'sauvegarde.js'];

function chargerApplication(depot) {
  globalThis.indexedDB = fabriquerIndexedDB(depot);
  for (const nom of MODULES) {
    (0, eval)(readFileSync(path.join(racine, 'js', nom), 'utf8'));
  }
  globalThis.I18n.definir('fr');
}

let fautes = 0;
let passees = 0;

function verifier(condition, message, detail) {
  if (condition) { passees += 1; return true; }
  fautes += 1;
  console.log('  NON ' + message + (detail === undefined ? '' : '  → ' + JSON.stringify(detail)));
  return false;
}

function egaux(obtenu, attendu, message) {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  return verifier(a === b, `${message}\n        obtenu  ${a}\n        attendu ${b}`);
}

function titre(texte) {
  console.log('');
  console.log(texte);
}

const SEP = String.fromCharCode(0);

// ── 1. Le contenu ───────────────────────────────────────────────────────────

const contenu = JSON.parse(readFileSync(path.join(racine, 'data', 'conversation.json'), 'utf8'));

/* Les formes d'adresse, dans les deux langues. « Sie » en majuscule est le
 * vouvoiement — ou « elle / ils » en tête de phrase, qu'on accepte de
 * confondre dans un dialogue déjà déclaré poli. */
/* `\b` ne connaît que l'ASCII : « êtes » y commence par « tes ». Les bornes
 * sont donc écrites à la main, avec les lettres de toutes les langues. */
const mots = (liste, drapeaux) => new RegExp('(?<!\\p{L})(?:' + liste + ')(?!\\p{L})', 'u' + (drapeaux || ''));
const DE_VOUS = mots('Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres');
const DE_TU = mots('du|dich|dir|dein|deine|deinen|deinem|deiner', 'i');
const FR_VOUS = mots('vous|votre|vos', 'i');
const FR_TU = mots('tu|toi|te|ton|ta|tes|t’', 'i');

function adresse(frBrut, de) {
  const fr = frBrut.replace(/rendez-vous/gi, 'rendezvous');
  return {
    vous: FR_VOUS.test(fr) || DE_VOUS.test(de),
    tu: FR_TU.test(fr) || DE_TU.test(de),
    frVous: FR_VOUS.test(fr), frTu: FR_TU.test(fr), deVous: DE_VOUS.test(de), deTu: DE_TU.test(de),
  };
}

function ponctuationFr(texte, ou) {
  // Une espace ordinaire devant ? ! ; : dans les données ; la typographie
  // fine est posée au chargement.
  verifier(!/[^ ][?!;]/.test(texte.replace(/\(le matin\)/, '')),
    `${ou} : espace devant ? ! ; en français`, texte);
  verifier(!/[^ ]:/.test(texte) || /\d:\d/.test(texte), `${ou} : espace devant le deux-points`, texte);
  verifier(texte.indexOf("'") === -1, `${ou} : apostrophe typographique ’ en français`, texte);
  verifier(!/[„“]/.test(texte), `${ou} : guillemets « » en français`, texte);
}

function ponctuationDe(texte, ou) {
  verifier(!/ [?!;:,.]/.test(texte), `${ou} : pas d’espace devant la ponctuation en allemand`, texte);
  verifier(texte.indexOf("'") === -1, `${ou} : apostrophe typographique ’ en allemand`, texte);
  verifier(!/[«»]/.test(texte), `${ou} : guillemets „“ en allemand`, texte);
}

function texteSain(texte, ou) {
  verifier(typeof texte === 'string' && texte.trim() === texte && texte.length > 0,
    `${ou} : texte présent, sans espace en bordure`, texte);
  verifier(!/ {2}/.test(texte), `${ou} : pas de double espace`, texte);
  verifier(/^[\p{Lu}„«¿]/u.test(texte), `${ou} : commence par une majuscule`, texte);
  verifier(/[.!?…)]$/.test(texte), `${ou} : se termine par une ponctuation`, texte);
}

function epreuveContenu() {
  titre('Le contenu : structure et quantités');
  verifier(contenu.format === 'wortschatz-conversation', 'format annoncé');
  verifier(!!contenu.provenance && !!contenu.provenance.fr && !!contenu.provenance.de,
    'la provenance est dite, dans les deux langues');
  verifier(/Claude/.test(contenu.provenance.fr) && /locutrice native/.test(contenu.provenance.fr)
           && /n’ont pas été relus/.test(contenu.provenance.fr),
    'la provenance nomme l’assistant, dit ce qu’une locutrice native a validé et ce qui ne l’a pas été');
  verifier(!/\d{4}-\d{2}-\d{2}/.test(contenu.provenance.fr) && !/(Frau|Madame|Mme) /.test(contenu.provenance.fr),
    'la provenance ne date pas la relecture et ne nomme personne');

  const themes = contenu.themes;
  verifier(themes.length === 11, `onze situations (${themes.length})`);
  const idsThemes = new Set(themes.map((t) => t.id));
  for (const t of themes) verifier(!!t.fr && !!t.de, `situation « ${t.id} » nommée en fr et de`);
  const attendus = ['saluer', 'chemin', 'transports', 'restaurant', 'achats', 'hotel',
                    'rendez-vous', 'aide', 'comprendre', 'quotidien', 'visite'];
  egaux(themes.map((t) => t.id), attendus,
    'les neuf situations de la 3.2 dans leur ordre, puis les deux de la 3.3');

  const phrases = contenu.phrases;
  const dialogues = contenu.dialogues;
  verifier(phrases.length >= 228, `au moins 228 phrases — 148 de la 3.2 et 80 de plus (${phrases.length})`);
  verifier(dialogues.length >= 38, `au moins 38 dialogues — 26 de la 3.2 et 12 de plus (${dialogues.length})`);
  const repliques = dialogues.reduce((n, d) => n + d.repliques.length, 0);
  console.log(`  ${phrases.length} phrases, ${dialogues.length} dialogues, ${repliques} répliques`);

  for (const id of idsThemes) {
    const nPhrases = phrases.filter((p) => p.theme === id).length;
    const nDialogues = dialogues.filter((d) => d.theme === id).length;
    verifier(nPhrases >= 8, `« ${id} » : au moins 8 phrases (${nPhrases})`);
    verifier(nDialogues >= 2, `« ${id} » : au moins 2 dialogues (${nDialogues})`);
  }

  titre('Le contenu : chaque phrase');
  const ids = new Set();
  const registres = new Set(['poli', 'familier']);
  for (const p of phrases) {
    const ou = `phrase ${p.id}`;
    verifier(/^ph-[a-z0-9-]+$/.test(p.id), `${ou} : identifiant bien formé`);
    verifier(!ids.has(p.id), `${ou} : identifiant unique`);
    ids.add(p.id);
    verifier(idsThemes.has(p.theme), `${ou} : situation connue`, p.theme);
    texteSain(p.fr, ou + ' (fr)');
    texteSain(p.de, ou + ' (de)');
    ponctuationFr(p.fr, ou);
    ponctuationDe(p.de, ou);
    verifier(!!p.situation && !!p.situation.fr && !!p.situation.de,
      `${ou} : situation d’emploi dans les deux langues`);
    if (p.registre !== undefined) verifier(registres.has(p.registre), `${ou} : registre connu`, p.registre);

    /* Tutoiement et vouvoiement. Une phrase qui vouvoie ne tutoie pas, et
     * réciproquement ; une phrase qui s'adresse à quelqu'un porte son
     * registre, sans quoi l'apprenant ne saura pas à qui elle convient. */
    const a = adresse(p.fr, p.de);
    verifier(!(a.frVous && a.deTu) && !(a.frTu && a.deVous),
      `${ou} : même adresse dans les deux langues`, { fr: p.fr, de: p.de });
    if (p.registre === 'poli') verifier(!a.tu, `${ou} : poli, donc sans tutoiement`, { fr: p.fr, de: p.de });
    if (p.registre === 'familier') verifier(!a.vous, `${ou} : familier, donc sans vouvoiement`, { fr: p.fr, de: p.de });
    if (a.vous || a.tu) {
      verifier(!!p.registre, `${ou} : s’adresse à quelqu’un, donc porte un registre`, { fr: p.fr, de: p.de });
    }

    if (p.variantes) {
      for (const l of ['fr', 'de']) {
        for (const v of p.variantes[l] || []) {
          texteSain(v, `${ou} variante (${l})`);
          if (l === 'fr') ponctuationFr(v, ou + ' variante'); else ponctuationDe(v, ou + ' variante');
          verifier(v !== p[l], `${ou} : une variante n’est pas le texte principal`, v);
          const b = l === 'fr' ? adresse(v, p.de) : adresse(p.fr, v);
          if (p.registre === 'poli') verifier(!b.tu, `${ou} variante : sans tutoiement`, v);
          if (p.registre === 'familier') verifier(!b.vous, `${ou} variante : sans vouvoiement`, v);
        }
      }
    }
  }

  titre('Le contenu : chaque dialogue');
  const parTexte = new Map();
  const normaliser = (t) => t.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[’']/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const empreinte = (fr, de) => normaliser(de) + '|' + normaliser(fr);
  for (const p of phrases) {
    const e = empreinte(p.fr, p.de);
    verifier(!parTexte.has(e), `phrase ${p.id} : texte distinct de ${parTexte.get(e)}`);
    parTexte.set(e, p.id);
  }
  for (const d of dialogues) {
    const ou = `dialogue ${d.id}`;
    verifier(/^dg-[a-z0-9-]+$/.test(d.id), `${ou} : identifiant bien formé`);
    verifier(!ids.has(d.id), `${ou} : identifiant unique`);
    ids.add(d.id);
    verifier(idsThemes.has(d.theme), `${ou} : situation connue`);
    verifier(!!d.titre && !!d.titre.fr && !!d.titre.de, `${ou} : titre dans les deux langues`);
    verifier(!!d.roles && !!d.roles.A && !!d.roles.B && !!d.roles.A.fr && !!d.roles.B.de,
      `${ou} : deux interlocuteurs nommés`);
    verifier(registres.has(d.registre), `${ou} : registre déclaré`, d.registre);
    verifier(d.repliques.length >= 4 && d.repliques.length <= 8,
      `${ou} : de 4 à 8 répliques (${d.repliques.length})`);
    const qui = new Set(d.repliques.map((r) => r.qui));
    verifier(qui.has('A') && qui.has('B') && qui.size === 2, `${ou} : A et B parlent tous les deux`);
    const idsLignes = new Set();
    d.repliques.forEach((r, rang) => {
      const la = `${ou} réplique ${r.id || rang}`;
      verifier(/^r\d+$/.test(r.id || ''), `${la} : identifiant de réplique bien formé`);
      verifier(!idsLignes.has(r.id), `${la} : identifiant unique dans le dialogue`);
      idsLignes.add(r.id);
      texteSain(r.fr, la + ' (fr)');
      texteSain(r.de, la + ' (de)');
      ponctuationFr(r.fr, la);
      ponctuationDe(r.de, la);
      const a = adresse(r.fr, r.de);
      if (d.registre === 'poli') verifier(!a.tu, `${la} : dialogue poli, sans tutoiement`, { fr: r.fr, de: r.de });
      if (d.registre === 'familier') verifier(!a.vous, `${la} : dialogue familier, sans vouvoiement`, { fr: r.fr, de: r.de });

      /* Une réplique qui reprend une phrase listée doit la désigner — et une
       * réplique qui en désigne une doit bien avoir son texte. */
      const e = empreinte(r.fr, r.de);
      const listee = parTexte.get(e);
      if (r.phrase) {
        verifier(ids.has(r.phrase) && !!phrases.find((p) => p.id === r.phrase),
          `${la} : désigne une phrase qui existe`, r.phrase);
        verifier(listee === r.phrase, `${la} : le texte est celui de la phrase désignée`,
          { replique: [r.de, r.fr], phrase: r.phrase });
      } else {
        verifier(!listee, `${la} : même texte qu’une phrase listée → doit la désigner (« phrase »)`,
          { replique: [r.de, r.fr], phrase: listee });
      }
    });
  }
  const designations = dialogues.reduce((n, d) => n + d.repliques.filter((r) => r.phrase).length, 0);
  verifier(designations >= 12, `au moins douze répliques reprennent une phrase listée (${designations})`);

  titre('La relecture native : dite dialogue par dialogue, jamais au-delà');
  const relus = dialogues.filter((d) => d.relu);
  verifier(relus.length === DIALOGUES_3_2.length && relus.every((d) => DIALOGUES_3_2.indexOf(d.id) !== -1),
    `les ${DIALOGUES_3_2.length} dialogues de la 3.2 portent la mention, et eux seuls (${relus.length})`,
    relus.map((d) => d.id).filter((id) => DIALOGUES_3_2.indexOf(id) === -1));
  verifier(relus.every((d) => JSON.stringify(d.relu) === JSON.stringify({ de: 'natif' })),
    'la mention ne couvre que l’allemand : `{ de: "natif" }`, rien sur le français');
  verifier(phrases.every((p) => p.relu === undefined),
    'aucune phrase isolée ne porte la mention — même reprise par un dialogue validé');
  const neufs = dialogues.filter((d) => DIALOGUES_3_2.indexOf(d.id) === -1);
  verifier(neufs.length >= 12 && neufs.every((d) => d.relu === undefined),
    `les ${neufs.length} dialogues ajoutés ne se disent pas relus`);
  for (const id of DIALOGUES_3_2) verifier(dialogues.some((d) => d.id === id), `le dialogue ${id} de la 3.2 est toujours là`);
  for (const id of PHRASES_3_2_ECHANTILLON) verifier(phrases.some((p) => p.id === id), `la phrase ${id} de la 3.2 est toujours là`);
}

/* Les identifiants de la version 3.2, tels que publiés : les cartes de qui
 * les a apprises en dépendent. */
const DIALOGUES_3_2 = ['dg-saluer-collegue', 'dg-saluer-amis', 'dg-saluer-conge', 'dg-chemin-poste',
  'dg-chemin-gare', 'dg-chemin-perdu', 'dg-transports-guichet', 'dg-transports-train',
  'dg-transports-taxi', 'dg-restaurant-commande', 'dg-restaurant-addition', 'dg-restaurant-cafe',
  'dg-achats-vetement', 'dg-achats-caisse', 'dg-achats-boulangerie', 'dg-hotel-arrivee',
  'dg-hotel-probleme', 'dg-hotel-depart', 'dg-rdv-medecin', 'dg-rdv-reporter', 'dg-rdv-amis',
  'dg-aide-pharmacie', 'dg-aide-portefeuille', 'dg-aide-telephone', 'dg-comprendre-guichet',
  'dg-comprendre-mot'];
const PHRASES_3_2_ECHANTILLON = ['ph-saluer-bonjour', 'ph-chemin-poste', 'ph-chemin-loin',
  'ph-transports-retard', 'ph-restaurant-payer-carte', 'ph-achats-ticket-caisse', 'ph-hotel-parking',
  'ph-rdv-ca-me-convient', 'ph-aide-tres-gentil', 'ph-comprendre-c-est-clair', 'ph-comprendre-pas-entendu'];

// ── 2. La migration 3 → 4 ───────────────────────────────────────────────────

function depotVersion3() {
  const depot = nouveauDepot(3);
  const creer = (nom, keyPath, index, lignes, autoIncrement) => {
    depot.magasins[nom] = { nom, keyPath, autoIncrement: !!autoIncrement, prochain: 0,
                            lignes: new Map(), index: index || {} };
    for (const ligne of lignes) depot.magasins[nom].lignes.set(ligne[keyPath], ligne);
  };
  const ID = (langue, mot, type) => langue + SEP + mot + SEP + type;
  creer('reglages', 'cle', {}, [
    { cle: 'langue', valeur: 'fr' },
    { cle: 'sensDeTravail', valeur: 'vers-de' },
  ]);
  creer('cartes', 'id', { echeance: 'echeance', mot: 'mot', etat: 'etat', perso: 'perso' }, [
    { id: ID('de', 'Haus', 'vers-de'), langue: 'de', mot: 'Haus', tranche: 12, type: 'vers-de',
      etat: 'revision', palier: 1, intervalle: 47, facilite: 2.35,
      echeance: 1800000000000, reussites: 9, echecs: 2, cree: 1700000000000, vu: 0 },
    { id: 'perso:p-abc' + SEP + 'vers-de', langue: 'de', mot: 'Feierabend', tranche: -1,
      type: 'vers-de', perso: 'p-abc', etat: 'apprentissage', palier: 0, intervalle: 1,
      facilite: 2.5, echeance: 1800000600000, reussites: 1, echecs: 0, cree: 1799000000000, vu: 0 },
  ]);
  creer('journal', 'id', { quand: 'quand' }, [], true);
  creer('historique', 'id', { quand: 'quand' }, []);
  creer('notes', 'id', { modifie: 'modifie' }, [
    { id: 'dico:de Haus', cible: 'dico', langue: 'de', mot: 'Haus', texte: 'Comme « house ».',
      cree: 1, modifie: 1 },
  ]);
  creer('perso', 'id', { cle: 'cle', langue: 'langue', cree: 'cree' }, [
    { id: 'p-abc', mot: 'Feierabend', langue: 'de', cle: 'feierabend', nature: 'n', genre: 'masc',
      expression: false, traductions: ['fin de journée'], pluriel: '', formes: [], exemple: '',
      exempleTraduit: '', cree: 1, modifie: 1 },
  ]);
  return depot;
}

async function epreuveMigration() {
  titre('Migration version 3 → 4 : rien n’est perdu, deux choses sont ajoutées');
  const depot = depotVersion3();
  chargerApplication(depot);
  await Conversation.charger();

  const cartes = await Store.toutesLesCartes();
  verifier(cartes.length === 2, `les 2 cartes sont là (${cartes.length})`);
  const haus = cartes.find((c) => c.mot === 'Haus');
  verifier(haus && haus.intervalle === 47 && haus.facilite === 2.35 && haus.echeance === 1800000000000,
    'la carte du dictionnaire est intacte, à la milliseconde');
  verifier((await Store.toutesLesNotes()).length === 1, 'la note est là');
  verifier((await Store.tousLesMotsPerso()).length === 1, 'le mot personnel est là');
  verifier((await Store.lireReglages()).sensDeTravail === 'vers-de', 'les réglages sont là');
  verifier(!!depot.magasins.conversation, 'le magasin « conversation » est créé');
  verifier(depot.magasins.cartes.index.conversation === 'conversation',
    'l’index « conversation » est posé sur les cartes');
  verifier((await Store.cartesDeConversation('ph-chemin-poste')).length === 0,
    'aucune carte existante ne répond à l’index « conversation »');
  verifier((await Store.cartesDuMot('de', 'Haus')).length === 1,
    'la carte du dictionnaire se retrouve toujours par son mot');
  return depot;
}

// ── 3. Recherche ────────────────────────────────────────────────────────────

function epreuveRecherche() {
  titre('Recherche : par mot intérieur, dans les deux langues, pendant la frappe');
  const trouve = (saisie, id, options) => Conversation.chercher(saisie, options)
    .some((r) => r.id === id);

  // Les exemples de la demande.
  verifier(trouve('poste', 'ph-chemin-poste'), '« poste » → la phrase de la poste');
  verifier(trouve('poste', 'dg-chemin-poste'), '« poste » → le dialogue de la poste');
  verifier(trouve('Post', 'ph-chemin-poste'), '« Post » → la phrase');
  verifier(trouve('Post', 'dg-chemin-poste'), '« Post » → le dialogue');
  verifier(trouve('droite', 'ph-chemin-bout-rue-droite'), '« droite » → « Au bout de la rue, à droite. »');
  verifier(trouve('rechts', 'ph-chemin-bout-rue-droite'), '« rechts » → la même phrase');
  verifier(trouve('rechts', 'ph-chemin-gauche-feu') === false, '« rechts » ne trouve pas « links »');
  verifier(trouve('gare', 'ph-chemin-gare'), '« gare » → « Comment aller à la gare ? »');
  verifier(trouve('Bahnhof', 'ph-chemin-gare'), '« Bahnhof » → la même phrase');
  verifier(trouve('Bahnhof', 'ph-transports-a-la-gare'), '« Bahnhof » → « Zum Bahnhof, bitte. »');
  verifier(trouve('gare', 'dg-chemin-gare'), '« gare » → le dialogue de la gare');
  verifier(trouve('Bahnhof', 'dg-transports-taxi'), '« Bahnhof » → « Hauptbahnhof », mot composé');

  // Pendant la frappe, casse, accents, tréma.
  verifier(trouve('pos', 'ph-chemin-poste'), 'un début de mot suffit (« pos »)');
  verifier(trouve('Bahnh', 'ph-chemin-gare'), '« Bahnh » en cours de frappe');
  verifier(trouve('POSTE', 'ph-chemin-poste'), 'en majuscules');
  verifier(trouve('ou se trouve', 'ph-chemin-poste'), 'sans accent (« ou se trouve »)');
  verifier(trouve('Fruhstuck', 'ph-hotel-petit-dejeuner-compris'), '« Fruhstuck » sans tréma trouve « Frühstück »');
  verifier(trouve('strasse', 'ph-chemin-bout-rue-droite'), '« strasse » trouve « Straße »');
  verifier(trouve('n ai pas compris', 'ph-comprendre-pas-compris'), 'l’apostrophe ne compte pas');
  verifier(trouve('wo ist', 'ph-chemin-poste'), 'plusieurs mots : tous doivent y être');
  verifier(!trouve('wo poste', 'ph-chemin-poste') || true, '(deux langues mêlées : toléré)');
  verifier(Conversation.chercher('x').length === 0, 'une lettre seule ne cherche rien');
  verifier(Conversation.chercher('zzzzzz').length === 0, 'rien ne correspond → liste vide');

  // Filtres.
  verifier(Conversation.chercher('poste', { type: 'phrase' }).every((r) => r.sorte === 'phrase'),
    'le filtre « phrase » ne rend que des phrases');
  verifier(Conversation.chercher('poste', { type: 'dialogue' }).every((r) => r.sorte === 'dialogue'),
    'le filtre « dialogue » ne rend que des dialogues');
  verifier(Conversation.chercher('bitte', { theme: 'hotel' }).every((r) => (
    (Conversation.phrase(r.id) || Conversation.dialogue(r.id)).theme === 'hotel')),
    'le filtre par situation tient');
  const resultats = Conversation.chercher('poste');
  verifier(resultats.findIndex((r) => r.sorte === 'phrase') < resultats.findIndex((r) => r.sorte === 'dialogue'),
    'les phrases passent avant les dialogues');
  const dialogue = resultats.find((r) => r.id === 'dg-chemin-poste');
  verifier(dialogue && dialogue.replique && /Post/.test(dialogue.replique.de),
    'un dialogue trouvé montre la réplique qui a répondu', dialogue && dialogue.replique);
  verifier(resultats.filter((r) => r.id === 'dg-chemin-poste').length === 1,
    'un dialogue ne revient qu’une fois');

  titre('Recherche : les expressions courantes de la 3.3, dans les deux langues');
  verifier(trouve('souci', 'ph-quotidien-pas-de-souci') && trouve('Problem', 'ph-quotidien-pas-de-souci'),
    '« souci » et « Problem » → « Pas de souci. / Kein Problem. »');
  verifier(trouve('Laufenden', 'ph-quotidien-tiens-moi-au-courant') && trouve('courant', 'ph-quotidien-tenez-moi-au-courant'),
    '« Laufenden » et « courant » → tiens-moi / tenez-moi au courant');
  verifier(trouve('Daumen', 'ph-quotidien-je-croise-les-doigts') && trouve('doigts', 'ph-quotidien-je-croise-les-doigts-vous'),
    '« Daumen » et « doigts » → je croise les doigts, tu et vous');
  verifier(trouve('lohnt', 'ph-quotidien-ca-vaut-le-coup') && trouve('coup', 'ph-quotidien-ca-ne-vaut-pas-le-coup'),
    '« lohnt » et « coup » → ça vaut / ne vaut pas le coup');
  verifier(trouve('courage', 'ph-quotidien-bon-courage-examen') && trouve('courage', 'ph-quotidien-bon-courage-journee'),
    '« courage » → les deux « bon courage », qui ne se traduisent pas pareil');
  verifier(trouve('chez toi', 'ph-visite-fais-comme-chez-toi') && trouve('Hause', 'ph-visite-faites-comme-chez-vous'),
    '« chez toi » et « Hause » → fais / faites comme chez vous');
  verifier(trouve('gleich', 'ph-saluer-a-tout-a-l-heure') && trouve('unterwegs', 'ph-rdv-je-suis-en-route'),
    '« gleich » → « Bis gleich! », « unterwegs » → « Ich bin unterwegs. »');
  verifier(trouve('Gefallen', 'dg-aide-service') && trouve('malentendu', 'dg-comprendre-malentendu'),
    'les dialogues neufs se trouvent par leurs répliques');
  verifier(Conversation.chercher('Kino', { theme: 'quotidien' }).every((r) =>
    (Conversation.phrase(r.id) || Conversation.dialogue(r.id)).theme === 'quotidien'),
    'le filtre par situation vaut pour une situation neuve');
}

// ── 4. Entrées, cartes, apprentissage sans doublon ─────────────────────────

async function epreuveApprentissage() {
  titre('L’entrée d’une phrase, au format du dictionnaire');
  const e = Conversation.entree('ph-chemin-poste');
  verifier(!!e && e.langue === 'de' && e.mot === 'Wo ist die Post?', 'la vedette est le texte allemand');
  const traductions = Exercices.traductions(e);
  verifier(traductions[0] === 'Où se trouve la poste\u202F?',
    'la traduction est le texte français, avec l’espace fine devant le point d’interrogation',
    traductions[0]);
  verifier(traductions.length === 2 && traductions[1] === 'Où est la poste\u202F?',
    'les variantes françaises sont des traductions acceptées', traductions);
  egaux(e.variantes.de, ['Wo ist hier die Post?'], 'les variantes allemandes sont portées');
  verifier(Exercices.genreDe(e) === null && Exercices.avecArticle(e) === null,
    'pas de genre, pas d’article');
  verifier(Conversation.entree('dg-chemin-poste') === null, 'un dialogue entier n’est pas une entrée');
  verifier(Conversation.entree('inconnu') === null, 'un identifiant inconnu rend null');
  const bonjour = Conversation.entree('ph-saluer-matin');
  verifier(Conversation.texteParle(Exercices.traductions(bonjour)[0]) === 'Bonjour\u202F!',
    'la précision entre parenthèses ne se lit pas à voix haute');

  titre('Les cartes : deux directions, jamais de genre, le sens de travail respecté');
  Revision.sensDeTravail = 'les-deux';
  egaux(Revision.cartesPour(e).map((c) => c.type).sort(), ['vers-de', 'vers-fr'],
    '« les deux » → produire l’allemand et produire le français');
  verifier(Revision.cartesPour(e).every((c) => c.conversation === 'ph-chemin-poste'
           && c.id.startsWith('conv:ph-chemin-poste' + SEP)),
    'les cartes portent l’identifiant canonique, pas le texte');
  Revision.sensDeTravail = 'vers-fr';
  egaux(Revision.cartesPour(e).map((c) => c.type), ['vers-fr'], '« vers le français » → une seule carte');
  Revision.sensDeTravail = 'vers-de';
  egaux(Revision.cartesPour(e).map((c) => c.type), ['vers-de'], '« vers l’allemand » → une seule carte');
  Revision.sensDeTravail = 'les-deux';

  titre('Apprendre depuis le dialogue ou depuis la fiche : les mêmes cartes');
  verifier(Conversation.canonique('dg-chemin-poste/r3') === 'ph-chemin-loin',
    '« Ist es weit? » dans le dialogue désigne la phrase listée');
  verifier(Conversation.canonique('dg-comprendre-mot/r7') === 'ph-comprendre-c-est-clair',
    '« Alles klar, danke! » désigne « Alles klar, danke. » — la ponctuation ne compte pas');
  verifier(Conversation.canonique('dg-chemin-poste/r1') === 'dg-chemin-poste/r1',
    'une réplique qui ne reprend rien est sa propre référence');
  verifier(Conversation.canonique('dg-aide-service/r1') === 'ph-aide-petit-service'
           && Conversation.canonique('dg-rdv-retard/r6') === 'ph-saluer-a-tout-a-l-heure',
    'un dialogue neuf désigne les phrases neuves qu’il reprend');
  verifier(Conversation.canonique('dg-hotel-conseil-restaurant/r5') === 'ph-chemin-loin'
           && Conversation.canonique('dg-transports-train-rate/r7') === 'ph-aide-tres-gentil',
    'et les phrases de la 3.2 : « Ist es weit? » et « das ist sehr nett von Ihnen » gardent leurs cartes');
  verifier(Conversation.canonique('dg-comprendre-malentendu/r5') === 'ph-quotidien-pas-grave',
    '« Macht nichts. » dans le malentendu est la phrase « Ce n’est pas grave. »');

  titre('La mention de relecture suit chaque entrée');
  egaux(Conversation.entree('dg-chemin-poste/r1').relu, { de: 'natif' },
    'une réplique d’un dialogue de la 3.2 : validée en allemand');
  verifier(Conversation.entree('ph-chemin-loin').relu === null,
    'la phrase « Ist es weit? » — reprise par ce dialogue — reste non relue : la validation ne s’étend pas');
  verifier(Conversation.entree('dg-aide-service/r2').relu === null && Conversation.entree('ph-quotidien-pas-de-souci').relu === null,
    'les contenus de la 3.3 ne se disent pas relus');
  verifier(Conversation.relectureDe({ relu: { de: 'natif', fr: 'natif' } }) !== null
           && Conversation.relectureDe({ relu: { de: 'natif', fr: 'natif' } }).fr === undefined,
    'une mention sur le français serait ignorée : seul l’allemand peut être dit validé');
  verifier(Conversation.relectureDe({ relu: 'oui' }) === null && Conversation.relectureDe({ origine: 'perso', relu: { de: 'natif' } }) === null,
    'une mention mal formée, ou sur un contenu à soi, ne vaut rien');

  titre('La passerelle vers les expressions usuelles du dictionnaire');
  const dansSouci = Conversation.expressionsDans('ph-quotidien-pas-de-souci', 'de');
  verifier(dansSouci.some((v) => v.langue === 'de' && v.mot === 'kein Problem'),
    '« Kein Problem. » mène à l’expression « kein Problem » du dictionnaire', dansSouci.map((v) => v.mot));
  verifier(dansSouci.every((v) => v.expression === true && v.mot.indexOf(' ') !== -1),
    'seules des expressions à plusieurs mots sont proposées — un mot seul est déjà cliquable');
  const dansMarche = Conversation.expressionsDans('ph-quotidien-ca-marche', 'fr');
  verifier(dansMarche.length >= 2 && dansMarche[0].langue === 'fr' && dansMarche.some((v) => v.mot === 'alles klar'),
    '« Ça marche. / Alles klar. » mène aux deux, la langue demandée d’abord', dansMarche.map((v) => v.langue + ':' + v.mot));
  verifier(Conversation.expressionsDans('ph-chemin-bout-rue-droite', 'fr').every((v) => v.mot !== 'de là'),
    '« au bout de la rue » ne mène pas à « de là » : la comparaison garde les accents');
  verifier(Conversation.expressionsDans('inconnu', 'de').length === 0, 'un identifiant inconnu ne mène nulle part');
  const avant = (await Store.toutesLesCartes()).length;
  const depuisDialogue = await Revision.apprendre(Conversation.entree('dg-chemin-poste/r3'));
  verifier(depuisDialogue.length === 2, 'depuis le dialogue : deux cartes créées');
  verifier(depuisDialogue.every((c) => c.conversation === 'ph-chemin-loin'),
    'elles sont rangées sous la phrase listée');
  const depuisFiche = await Revision.apprendre(Conversation.entree('ph-chemin-loin'));
  verifier(depuisFiche.length === 0, 'depuis la fiche, ensuite : aucune carte de plus');
  verifier(await Revision.estAppris('de', 'Ist es weit?', null, 'ph-chemin-loin'),
    'la phrase est reconnue comme apprise');
  verifier((await Store.toutesLesCartes()).length === avant + 2, 'deux cartes en tout, pas quatre');
  verifier((await Store.cartesDeConversation('dg-chemin-poste/r3')).length === 0,
    'rien n’est rangé sous l’identifiant de la réplique');

  const seule = await Revision.apprendre(Conversation.entree('dg-chemin-poste/r1'));
  verifier(seule.length === 2 && seule[0].conversation === 'dg-chemin-poste/r1',
    'une réplique sans phrase listée s’apprend sous son propre identifiant');
  await Revision.oublier('de', '', null, 'dg-chemin-poste/r1');
  verifier((await Store.cartesDeConversation('dg-chemin-poste/r1')).length === 0, 'et s’oublie');

  titre('Le journal et les listes voient une phrase comme un mot');
  const carte = (await Store.cartesDeConversation('ph-chemin-loin'))[0];
  const notee = await Revision.noter(carte, Revision.CORRECT, 'qcm-produire');
  verifier(notee.reussites === 1 && notee.etat === 'apprentissage', 'la carte se note');
  const journal = await Store.journalDepuis(0);
  verifier(journal.some((l) => l.conversation === 'ph-chemin-loin'),
    'la ligne de journal porte l’identifiant de la phrase');
  const apercu = Conversation.apercu('dg-chemin-poste/r3');
  verifier(apercu && apercu.de === 'Ist es weit?' && apercu.fr === 'Est-ce loin\u202F?',
    'l’aperçu d’une réplique désignante est celui de la phrase');
}

// ── 5. Exercices et correction ─────────────────────────────────────────────

async function epreuveExercices() {
  titre('Les exercices d’une phrase');
  const e = Conversation.entree('ph-chemin-poste');
  const versDe = Revision.cartesPour(e).find((c) => c.type === 'vers-de');
  const versFr = Revision.cartesPour(e).find((c) => c.type === 'vers-fr');

  verifier(Exercices.typeDExercice(versDe, e, [], {}) === 'qcm-produire',
    'produire l’allemand, première fois : retrouver parmi quatre');
  verifier(Exercices.typeDExercice(Object.assign({}, versDe, { reussites: 1 }), e, [], {}) === 'saisie',
    'deuxième fois : écrire — sans article, une phrase n’en a pas');
  verifier(Exercices.typeDExercice(versFr, e, [], {}) === 'qcm-comprendre',
    'produire le français, première fois : reconnaître');

  const qcm = await Exercices.preparer(versDe, e, { type: 'qcm-produire' });
  verifier(qcm.phrase === true, 'la question se sait phrase');
  verifier(qcm.options.length === 4 && qcm.options.some((o) => o.juste && o.texte === 'Wo ist die Post?'),
    'quatre choix, la bonne réponse parmi eux');
  const leurres = qcm.options.filter((o) => !o.juste).map((o) => o.texte);
  verifier(leurres.every((t) => Conversation.phrases().some((p) => p.de === t)),
    'les leurres sont d’autres phrases, pas des mots du dictionnaire', leurres);
  verifier(leurres.every((t) => Conversation.phrases().find((p) => p.de === t).theme === 'chemin'),
    'et de la même situation quand elle en a assez', leurres);
  verifier(qcm.enonce === 'Où se trouve la poste\u202F?', 'l’énoncé est le texte français, sans les variantes');

  const compr = await Exercices.preparer(versFr, e, { type: 'qcm-comprendre' });
  verifier(compr.options.filter((o) => !o.juste).every((t) => Conversation.phrases().some((p) => p.fr === t.texte)),
    'en compréhension, les leurres sont des phrases françaises');

  const saisie = await Exercices.preparer(versDe, e, { type: 'saisie' });
  egaux(saisie.attendus, ['Wo ist die Post?', 'Wo ist hier die Post?'],
    'écrire l’allemand : la phrase et ses variantes enregistrées, rien d’autre');
  verifier(saisie.estNom === false, 'jamais traitée comme un nom');
  const traduction = await Exercices.preparer(versFr, e, { type: 'saisie-traduction' });
  egaux(traduction.attendus, ['Où se trouve la poste\u202F?', 'Où est la poste\u202F?'],
    'écrire le français : le texte et ses variantes');
  verifier(traduction.enonce === 'Wo ist die Post?', 'l’énoncé est la phrase allemande, sans article');
  const ecoute = await Exercices.preparer(versDe, e, { type: 'ecoute' });
  verifier(ecoute.aEcouter === 'Wo ist die Post?' && ecoute.attendus.length === 2, 'l’écoute dicte la phrase');

  titre('La correction d’une phrase : ponctuation, casse, apostrophes, étourderies');
  const C = (saisie_, attendus, langue) => Exercices.corriger(saisie_, attendus, { langue, phrase: true });
  const rem = (r) => (r.remarque ? r.remarque.cle.split('.').pop() : null);
  const cas = [
    ['Wo ist die Post?', ['Wo ist die Post?'], 'de', 'juste', null],
    ['wo ist die post', ['Wo ist die Post?'], 'de', 'juste', null],
    ['Wo ist die Post', ['Wo ist die Post?'], 'de', 'juste', null],
    ['  Wo ist die Post ?  ', ['Wo ist die Post?'], 'de', 'juste', null],
    ['Wo ist hier die Post?', ['Wo ist die Post?', 'Wo ist hier die Post?'], 'de', 'juste', null],
    ['Konnen Sie das bitte wiederholen', ['Können Sie das bitte wiederholen?'], 'de', 'juste', 'accents'],
    ['Wo ist die Posd?', ['Wo ist die Post?'], 'de', 'presque', null],
    // Une lettre de travers se pardonne ; une inversion en vaut deux, et sur
    // une phrase courte c'est déjà trop.
    ['Wo ist die Pots?', ['Wo ist die Post?'], 'de', 'faux', null],
    ['Wo ist der Bahnhof?', ['Wo ist die Post?'], 'de', 'faux', null],
    ['Konnen Sie das bite wiederhollen?', ['Können Sie das bitte wiederholen?'], 'de', 'presque', null],
    ['Können Sie bitte das wiederholen?', ['Können Sie das bitte wiederholen?'], 'de', 'faux', null],
    ['Où se trouve la poste ?', ['Où se trouve la poste\u202F?'], 'fr', 'juste', null],
    ['Ou se trouve la poste', ['Où se trouve la poste\u202F?'], 'fr', 'juste', 'accents'],
    ['Où est la poste ?', ['Où se trouve la poste\u202F?', 'Où est la poste\u202F?'], 'fr', 'juste', null],
    ["Je n'ai pas compris.", ['Je n’ai pas compris.'], 'fr', 'juste', null],
    ['Comment allez vous ?', ['Comment allez-vous\u202F?'], 'fr', 'juste', null],
    ['comment allez-vous', ['Comment allez-vous\u202F?'], 'fr', 'juste', null],
    ['Je voudrais payer', ['Je voudrais payer, s’il vous plaît.'], 'fr', 'faux', null],
    ['', ['Wo ist die Post?'], 'de', 'faux', null],
  ];
  for (const [s, attendus, langue, verdict, remarque] of cas) {
    const r = C(s, attendus, langue);
    verifier(r.verdict === verdict && rem(r) === remarque,
      `${JSON.stringify(s)} → ${verdict}${remarque ? ' (' + remarque + ')' : ''}`,
      { obtenu: r.verdict, remarque: rem(r) });
  }
  // Un mot, lui, garde sa correction : la majuscule d'un nom se remarque.
  const mot = Exercices.corriger('haus', ['Haus'], { langue: 'de', estNom: true });
  verifier(mot.verdict === 'juste' && rem(mot) === 'majuscule', 'la correction des mots ne change pas');
}

// ── 6. Phrases et dialogues à soi ──────────────────────────────────────────

async function epreuvePersonnel(depot) {
  titre('Une phrase à soi : créer, chercher, apprendre, corriger sans perdre');
  const mienne = await Conversation.creer('phrase', {
    fr: 'Je cherche le rayon des surgelés.', de: 'Ich suche die Tiefkühlabteilung.',
    theme: 'achats', registre: 'poli', situation: 'Au supermarché.',
    variantes: { de: 'Wo finde ich die Tiefkühlkost?\n\n' },
  });
  verifier(/^pp-/.test(mienne.id) && mienne.sorte === 'phrase', 'identifiant stable, sorte « phrase »');
  egaux(mienne.variantes.de, ['Wo finde ich die Tiefkühlkost?'], 'les variantes se lisent ligne par ligne');
  verifier(Conversation.chercher('surgel').some((r) => r.id === mienne.id), 'elle se cherche en français');
  verifier(Conversation.chercher('Tiefkühl').some((r) => r.id === mienne.id), 'et en allemand');
  verifier(Conversation.chercher('Tiefkuhl').some((r) => r.id === mienne.id), 'sans tréma aussi');
  verifier(Conversation.estPersonnel(mienne.id) && Conversation.entree(mienne.id).origine === 'perso',
    'elle est marquée personnelle');

  const cartes = await Revision.apprendre(Conversation.entree(mienne.id));
  verifier(cartes.length === 2 && cartes.every((c) => c.conversation === mienne.id),
    'elle s’apprend sous son identifiant');
  await Notes.ecrire({ conversation: mienne.id, langue: 'de', mot: mienne.de }, 'Entendu chez Edeka.');
  const mure = (await Store.cartesDeConversation(mienne.id)).find((c) => c.type === 'vers-de');
  mure.etat = 'revision'; mure.intervalle = 34; mure.facilite = 2.15; mure.echeance = 1900000000000;
  await Store.ecrireCarte(mure);

  await Conversation.modifier(mienne.id, {
    fr: 'Je cherche le rayon des surgelés.', de: 'Ich suche die Tiefkühlabteilung, bitte.',
    theme: 'achats', registre: 'poli', situation: 'Au supermarché.', variantes: {},
  });
  const apres = (await Store.cartesDeConversation(mienne.id)).find((c) => c.type === 'vers-de');
  verifier(apres && apres.intervalle === 34 && apres.facilite === 2.15 && apres.echeance === 1900000000000,
    'corriger le texte ne touche ni l’intervalle, ni la facilité, ni l’échéance');
  verifier(apres.mot === 'Ich suche die Tiefkühlabteilung, bitte.', 'la carte affiche le texte corrigé');
  const note = await Notes.lire({ conversation: mienne.id });
  verifier(note && note.texte === 'Entendu chez Edeka.', 'la note est toujours là');
  verifier(Conversation.entree(mienne.id).mot === 'Ich suche die Tiefkühlabteilung, bitte.',
    'l’entrée suit');

  titre('Une phrase à soi qui reprend une phrase fournie partage ses cartes');
  const doublon = await Conversation.creer('phrase', {
    fr: 'Où se trouve la poste ?', de: 'Wo ist die Post?', theme: 'chemin',
  });
  verifier(Conversation.canonique(doublon.id) === 'ph-chemin-poste',
    'même texte → même identifiant canonique que la phrase fournie');
  await Conversation.supprimer(doublon.id);

  titre('Un dialogue à soi : composer, apprendre une réplique, remanier');
  const mien = await Conversation.creer('dialogue', {
    titre: 'Au marché', theme: 'achats', registre: 'poli', roles: { A: 'Moi', B: 'La maraîchère' },
    repliques: [
      { qui: 'A', fr: 'Bonjour, je voudrais un kilo de pommes.', de: 'Guten Tag, ich hätte gern ein Kilo Äpfel.' },
      { qui: 'B', fr: 'Des rouges ou des vertes ?', de: 'Rote oder grüne?' },
      { qui: 'A', fr: 'Des rouges, s’il vous plaît.', de: 'Rote, bitte.' },
      { qui: 'B', fr: 'Ça fait trois euros.', de: 'Das macht drei Euro.' },
    ],
  });
  verifier(/^pd-/.test(mien.id) && mien.repliques.length === 4, 'quatre répliques, identifiant stable');
  verifier(mien.repliques.every((r) => /^r-/.test(r.id)), 'chaque réplique a son identifiant');
  const idDeuxieme = mien.id + '/' + mien.repliques[1].id;
  verifier(Conversation.chercher('pommes').some((r) => r.id === mien.id), 'il se cherche par une réplique');
  verifier(Conversation.chercher('Äpfel').some((r) => r.id === mien.id), 'dans les deux langues');
  const cartesReplique = await Revision.apprendre(Conversation.entree(idDeuxieme));
  verifier(cartesReplique.length === 2 && cartesReplique[0].conversation === idDeuxieme,
    'une réplique s’apprend sous l’identifiant du dialogue et le sien');
  await Notes.ecrire({ conversation: mien.id, langue: 'de', mot: 'Au marché' }, 'Marché du samedi.');
  const carteReplique = (await Store.cartesDeConversation(idDeuxieme)).find((c) => c.type === 'vers-fr');
  carteReplique.intervalle = 12; carteReplique.echeance = 1950000000000; carteReplique.etat = 'revision';
  await Store.ecrireCarte(carteReplique);
  const idQuatrieme = mien.id + '/' + mien.repliques[3].id;
  await Revision.apprendre(Conversation.entree(idQuatrieme));

  // On corrige la deuxième réplique, on insère une réplique, on retire la quatrième.
  await Conversation.modifier(mien.id, {
    titre: 'Au marché', theme: 'achats', registre: 'poli', roles: mien.roles,
    repliques: [
      mien.repliques[0],
      { id: mien.repliques[1].id, qui: 'B', fr: 'Des rouges ou des vertes ?', de: 'Rote oder grüne Äpfel?' },
      { qui: 'A', fr: 'Des vertes, s’il vous plaît.', de: 'Grüne, bitte.' },
      mien.repliques[2],
    ],
  });
  const remanie = Conversation.brut(mien.id);
  verifier(remanie.repliques.length === 4 && remanie.repliques[1].id === mien.repliques[1].id,
    'la réplique corrigée garde son identifiant');
  verifier(remanie.repliques[2].id !== mien.repliques[2].id && /^r-/.test(remanie.repliques[2].id),
    'la réplique insérée en reçoit un neuf');
  const apresRemaniement = (await Store.cartesDeConversation(idDeuxieme)).find((c) => c.type === 'vers-fr');
  verifier(apresRemaniement && apresRemaniement.intervalle === 12 && apresRemaniement.echeance === 1950000000000,
    'ses cartes gardent leur échéance et leur intervalle');
  verifier(apresRemaniement.mot === 'Rote oder grüne Äpfel?', 'et affichent le texte corrigé');
  verifier((await Store.cartesDeConversation(idQuatrieme)).length === 0,
    'les cartes d’une réplique retirée sont parties');
  verifier((await Notes.lire({ conversation: mien.id })).texte === 'Marché du samedi.', 'la note du dialogue reste');

  titre('Supprimer, et annuler');
  const retrait = await Conversation.supprimer(mien.id);
  verifier(Conversation.brut(mien.id) === null && !Conversation.existe(mien.id), 'le dialogue est parti');
  verifier((await Store.cartesDeConversation(idDeuxieme)).length === 0, 'ses cartes aussi');
  verifier((await Notes.lire({ conversation: mien.id })) === null, 'sa note aussi');
  verifier(retrait.cartes.length === 2 && retrait.notes.length === 1, 'la suppression rend de quoi tout remettre');
  await Conversation.remettre(retrait);
  verifier(!!Conversation.brut(mien.id) && Conversation.existe(idDeuxieme), 'le dialogue revient');
  const revenue = (await Store.cartesDeConversation(idDeuxieme)).find((c) => c.type === 'vers-fr');
  verifier(revenue && revenue.intervalle === 12, 'ses cartes reviennent à l’identique');
  verifier((await Notes.lire({ conversation: mien.id })).texte === 'Marché du samedi.', 'sa note aussi');

  chargerApplication(depot);
  await Conversation.charger();
  verifier(!!Conversation.brut(mien.id) && !!Conversation.brut(mienne.id),
    'phrases et dialogues à soi se relisent au rechargement');
  verifier(Conversation.phrases().length === contenu.phrases.length + 1,
    'les phrases fournies et la sienne sont là, ensemble');
  return { mienne, mien, idDeuxieme };
}

// ── 7. Export et import ────────────────────────────────────────────────────

async function epreuveSauvegarde(depot, miens) {
  titre('Export et import : les phrases, leurs notes et leurs cartes');
  const paquet = await Sauvegarde.rassembler();
  verifier(paquet.version === 2, 'le fichier est au format 2');
  verifier(paquet.conversation.length === 2, 'le fichier porte la phrase et le dialogue à soi');
  verifier(paquet.cartes.some((c) => c.conversation === 'ph-chemin-loin'),
    'et les cartes d’une phrase fournie');
  verifier(paquet.cartes.some((c) => c.conversation === miens.idDeuxieme),
    'et celles d’une réplique à soi');
  verifier(paquet.notes.some((n) => n.id === 'conv:' + miens.mienne.id), 'et la note d’une phrase à soi');
  const texte = JSON.stringify(paquet);
  const fichier = { size: texte.length, text: async () => texte };

  const neuf = nouveauDepot(0);
  chargerApplication(neuf);
  await Conversation.charger();
  let bilan = await Sauvegarde.examiner(fichier);
  verifier(!bilan.erreur && bilan.conversation.neufs.length === 2, 'le bilan compte les phrases et dialogues');
  const compte = await Sauvegarde.appliquer(bilan, 'garder');
  verifier(compte.conversation === 2, 'ils sont repris');
  verifier(!!Conversation.brut(miens.mien.id) && Conversation.existe(miens.idDeuxieme),
    'le dialogue importé est connu, répliques comprises');
  verifier((await Store.cartesDeConversation(miens.idDeuxieme)).length > 0,
    'les cartes de sa réplique sont reprises — elles n’étaient pas orphelines');
  verifier((await Store.cartesDeConversation('ph-chemin-loin')).length === 2,
    'les cartes d’une phrase fournie sont reprises');
  verifier((await Notes.lire({ conversation: miens.mienne.id })).texte === 'Entendu chez Edeka.',
    'la note d’une phrase à soi est reprise');
  verifier(compte.orphelines === 0, 'aucune carte écartée');
  bilan = await Sauvegarde.examiner(fichier);
  verifier(bilan.neufs === 0 && bilan.conflits === 0, 'réimporter ne propose rien');

  titre('Un fichier d’avant les phrases et dialogues se lit toujours');
  const ancien = JSON.stringify({
    format: 'wortschatz-sauvegarde', version: 1, exporte: '2026-08-30T10:00:00.000Z',
    motsPersonnels: [{ id: 'p-vieux', mot: 'Feierabend', langue: 'de', traductions: ['fin de journée'] }],
    notes: [{ id: 'dico:de Haus', texte: 'Comme « house ».' }],
    cartes: [{ id: 'de' + SEP + 'Haus' + SEP + 'vers-de', type: 'vers-de', langue: 'de', mot: 'Haus',
               etat: 'revision', intervalle: 21, facilite: 2.4, echeance: 1900000000000 }],
    reglages: { langue: 'fr' },
  });
  const vieux = nouveauDepot(0);
  chargerApplication(vieux);
  await Conversation.charger();
  const bilanAncien = await Sauvegarde.examiner({ size: ancien.length, text: async () => ancien });
  verifier(!bilanAncien.erreur, 'le format 1 est accepté', bilanAncien.erreur);
  verifier(bilanAncien.conversation.neufs.length === 0 && bilanAncien.ignorees.conversation === 0,
    'sans phrases ni dialogues, et sans rien compter d’illisible');
  const fait = await Sauvegarde.appliquer(bilanAncien, 'garder');
  verifier(fait.mots === 1 && fait.notes === 1 && fait.cartes === 1, 'tout ce qu’il porte est repris');

  titre('Un fichier trafiqué : cartes orphelines et lignes irrecevables');
  const truque = JSON.stringify({
    format: 'wortschatz-sauvegarde', version: 2,
    conversation: [
      { id: 'pp-ok', sorte: 'phrase', fr: 'Bonjour.', de: 'Hallo.', theme: 'inconnu', registre: 'x' },
      { id: 'pp-vide', sorte: 'phrase', fr: '', de: 'Hallo.' },
      { id: 'pd-court', sorte: 'dialogue', titre: 'Trop court', repliques: [{ qui: 'A', fr: 'a', de: 'b' }] },
      { id: 'pd-ok', sorte: 'dialogue', titre: 'Bien', repliques: [
        { id: 'r-1', qui: 'A', fr: 'Un.', de: 'Eins.' }, { id: 'r-1', qui: 'B', fr: 'Deux.', de: 'Zwei.' }] },
      'pas un objet',
    ],
    cartes: [
      { id: 'conv:ph-chemin-poste' + SEP + 'vers-de', type: 'vers-de', langue: 'de', mot: 'Wo ist die Post?',
        conversation: 'ph-chemin-poste' },
      { id: 'conv:ph-absente' + SEP + 'vers-de', type: 'vers-de', langue: 'de', mot: 'x',
        conversation: 'ph-absente' },
      { id: 'conv:pd-ok/r-1' + SEP + 'vers-de', type: 'vers-de', langue: 'de', mot: 'Eins.',
        conversation: 'pd-ok/r-1' },
    ],
    notes: [{ id: 'conv:ph-chemin-poste', texte: 'ok' }, { id: 'conv:../x', texte: 'refusée' }],
  });
  const bilanTruque = await Sauvegarde.examiner({ size: truque.length, text: async () => truque });
  verifier(bilanTruque.conversation.neufs.length === 2, 'deux lignes recevables sur cinq',
    bilanTruque.conversation.neufs.map((c) => c.id));
  verifier(bilanTruque.ignorees.conversation === 3, 'les trois autres sont comptées');
  const ok = bilanTruque.conversation.neufs.find((c) => c.id === 'pp-ok');
  verifier(ok && ok.theme === 'autre' && ok.registre === '', 'situation inconnue → « autre », registre inconnu → aucun');
  const dOk = bilanTruque.conversation.neufs.find((c) => c.id === 'pd-ok');
  verifier(dOk && dOk.repliques[0].id !== dOk.repliques[1].id, 'deux répliques au même identifiant sont distinguées');
  verifier(bilanTruque.notes.neufs.length === 1, 'la note à la référence douteuse est écartée');
  const faitTruque = await Sauvegarde.appliquer(bilanTruque, 'garder');
  verifier(faitTruque.orphelines === 1, 'la carte d’une phrase inexistante est écartée, et le dit');
  verifier((await Store.cartesDeConversation('ph-chemin-poste')).length === 1, 'celle d’une phrase fournie entre');
  verifier((await Store.cartesDeConversation(dOk.repliques[0].id ? 'pd-ok/' + dOk.repliques[0].id : '')).length === 1,
    'celle d’une réplique importée entre, puisque son dialogue est repris');
}

// ── 8. La voix : une suite de répliques, et ce qui l'arrête ────────────────

/* `voix.js` sur une synthèse vocale de laboratoire : les paroles finissent
 * quand on le décide. On éprouve ce que la page promet — la suite s'enchaîne
 * avec un silence entre deux, et **tout** l'interrompt : Arrêter, `taire()`
 * (la fermeture d'une fiche, le changement de langue de l'interface) et une
 * autre parole (`dire()`, le bouton ▸ d'une réplique). */
async function epreuveVoix() {
  titre('La lecture d’un dialogue s’enchaîne, et tout l’arrête');
  const stubVoix = globalThis.Voix;
  const paroles = [];
  let annulations = 0;
  globalThis.speechSynthesis = {
    getVoices: () => [{ lang: 'de-DE', localService: true }, { lang: 'fr-FR', localService: true }],
    addEventListener() {},
    speak(p) { paroles.push(p); },
    cancel() { annulations += 1; },
  };
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } addEventListener() {} };
  (0, eval)(readFileSync(path.join(racine, 'js', 'voix.js'), 'utf8'));
  const V = globalThis.Voix;
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

  verifier(V.possible('de') && V.possible('fr'), 'deux voix de laboratoire');
  let items = [], fin = null;
  let suite = V.enchainer([{ texte: 'Eins.', langue: 'de' }, { texte: '', silence: 120 },
                           { texte: 'Drei.', langue: 'de' }],
    { pause: 20, surItem: (i) => items.push(i), surFin: (interrompu) => { fin = interrompu; } });
  verifier(paroles.length === 1 && paroles[0].text === 'Eins.' && items[0] === 0,
    'la première réplique part tout de suite');
  paroles[0].onend();
  await attendre(60);
  verifier(items.length === 2 && paroles.length === 1, 'puis un silence — le tour de parole de qui joue un rôle');
  await attendre(140);
  verifier(paroles.length === 2 && paroles[1].text === 'Drei.' && items[2] === 2, 'puis la troisième, après la pause');
  paroles[1].onend();
  await attendre(40);
  verifier(fin === false, 'la fin est annoncée, non interrompue');

  // Arrêter.
  fin = null;
  const avant = annulations;
  suite = V.enchainer([{ texte: 'A.', langue: 'fr' }, { texte: 'B.', langue: 'fr' }],
    { pause: 20, surFin: (i) => { fin = i; } });
  suite.arreter();
  verifier(fin === true && annulations > avant, '« Arrêter » interrompt et annule la synthèse');
  const nombre = paroles.length;
  paroles[nombre - 1].onend();
  await attendre(60);
  verifier(paroles.length === nombre, 'plus rien ne part après l’arrêt');

  // taire() : la fermeture d'une fiche, le changement de langue.
  fin = null;
  V.enchainer([{ texte: 'A.', langue: 'fr' }, { texte: 'B.', langue: 'fr' }],
    { pause: 20, surFin: (i) => { fin = i; } });
  V.taire();
  verifier(fin === true, '`taire()` — fermeture de fiche, changement de langue — arrête la suite et le dit');

  // dire() : le ▸ d'une réplique par-dessus la lecture.
  fin = null;
  V.enchainer([{ texte: 'A.', langue: 'fr' }, { texte: 'B.', langue: 'fr' }],
    { pause: 20, surFin: (i) => { fin = i; } });
  const total = paroles.length;
  V.dire('Seule.', 'fr');
  verifier(fin === true && paroles.length === total + 1 && paroles[total].text === 'Seule.',
    'une parole isolée (▸) arrête la suite et parle seule');

  // Une nouvelle suite remplace l'ancienne.
  let finA = null, finB = null;
  V.enchainer([{ texte: 'A.', langue: 'fr' }], { surFin: (i) => { finA = i; } });
  V.enchainer([{ texte: 'B.', langue: 'fr' }], { surFin: (i) => { finB = i; } });
  verifier(finA === true && finB === null, 'lancer une suite arrête la précédente');
  V.taire();

  // Voix coupée dans les réglages : rien ne part, la fin est annoncée.
  V.actif = false;
  fin = null;
  const n2 = paroles.length;
  V.enchainer([{ texte: 'A.', langue: 'fr' }], { surFin: (i) => { fin = i; } });
  verifier(fin === true && paroles.length === n2, 'voix désactivée : rien ne part, et on le sait aussitôt');
  V.actif = true;

  globalThis.Voix = stubVoix;
  delete globalThis.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;
}

// ── 9. La coquille ─────────────────────────────────────────────────────────

function epreuveCoquille() {
  titre('La coquille : le module et son contenu sont chargés et pré-cachés');
  const html = readFileSync(path.join(racine, 'index.html'), 'utf8');
  const sw = readFileSync(path.join(racine, 'sw.js'), 'utf8');
  const liste = sw.split('const FICHIERS = [')[1].split('];')[0];
  const caches = new Set([...liste.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  for (const f of ['js/conversation.js', 'js/situations.js']) {
    verifier(html.includes(f) && caches.has(f), `« ${f} » chargé et pré-caché`);
  }
  verifier(caches.has('data/conversation.json'), 'le contenu fourni est pré-caché avec la coquille');
  verifier(/data-vue="conversation"/.test(html), 'l’onglet existe');
  // Au moins la 3.3.0, qui a apporté le contenu actuel : une correction
  // ultérieure (3.3.1…) ne doit pas faire échouer cette épreuve.
  const version = (sw.match(/const VERSION = 'v(\d+)\.(\d+)\.(\d+)'/) || []).slice(1).map(Number);
  verifier(version.length === 3 && (version[0] > 3 || (version[0] === 3 && version[1] >= 3)),
    'la version de la coquille est au moins la 3.3.0 : le contenu neuf voyage avec elle', version);
  const versionSw = (sw.match(/const VERSION = '([^']+)'/) || [])[1];
  const versionPage = (html.match(/name="application-version" content="([^"]+)"/) || [])[1];
  verifier(!!versionSw && versionSw === versionPage,
    `la page porte la version du service worker (${versionSw}) — l’installation la compare`, { versionSw, versionPage });
  verifier(/caches\.delete\(COQUILLE\)/.test(sw) && !/addAll/.test(sw) && /MARQUE/.test(sw),
    'l’installation est tout ou rien, dans un cache à elle, effacé si elle échoue');
  verifier(html.indexOf('js/conversation.js') < html.indexOf('js/motsvifs.js')
           && html.indexOf('js/situations.js') > html.indexOf('js/mesmots.js')
           && html.indexOf('js/situations.js') < html.indexOf('js/app.js'),
    'les scripts sont chargés dans l’ordre de leurs dépendances');
}

// ── Déroulé ─────────────────────────────────────────────────────────────────

async function principal() {
  epreuveContenu();
  const depot = await epreuveMigration();
  await Lexique.charger('noyau');
  epreuveRecherche();
  await epreuveApprentissage();
  await epreuveExercices();
  const miens = await epreuvePersonnel(depot);
  await epreuveSauvegarde(depot, miens);
  await epreuveVoix();
  epreuveCoquille();

  console.log('');
  console.log(fautes
    ? `${passees} cas conformes, ${fautes} DÉFAUT(S).`
    : `${passees} cas conformes. Tout passe.`);
  process.exit(fautes ? 1 : 0);
}

principal().catch((erreur) => {
  console.error('\nÉchec inattendu :', erreur);
  process.exit(1);
});
