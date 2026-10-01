'use strict';
/*
 * Sauvegarder et restaurer ce qui n'existe qu'ici.
 *
 * ── Pourquoi c'est nécessaire ──────────────────────────────────────────────
 *
 * L'application n'a pas de compte et ne parle à aucun serveur — c'est sa raison
 * d'être, et c'est aussi son seul danger : ce qui est écrit ici n'existe nulle
 * part ailleurs. Un navigateur qui purge le stockage d'un site inactif, un
 * téléphone qu'on change, une application désinstallée par mégarde, et des mois
 * de notes et de mots ajoutés à la main disparaissent sans avertissement.
 *
 * Un fichier qu'on garde où l'on veut est la seule réponse compatible avec le
 * reste : rien ne part sur le réseau, l'utilisateur décide où il le range.
 *
 * ── Ce que le fichier contient ─────────────────────────────────────────────
 *
 *   motsPersonnels  les entrées ajoutées à la main, avec leur identifiant
 *   notes           celles des mots personnels, du dictionnaire, des phrases
 *   cartes          les cartes de révision — échéance, intervalle, facilité
 *   conversation    les phrases et dialogues écrits soi-même (format 2)
 *   reglages        langue, sens de travail, rythme
 *
 * Le format est passé de 1 à 2 avec les phrases et dialogues. Un fichier de
 * format 1 se lit toujours : ce qui manque est simplement vide. Un fichier de
 * format 2 devant une application d'avant est refusé avec la raison — elle
 * ne saurait qu'en faire des cartes orphelines.
 *
 * Le journal des réponses n'y est pas. Il ne sert qu'aux graphiques de
 * l'onglet Progrès, il pèse plus que tout le reste réuni, et le perdre ne perd
 * aucun mot ni aucune échéance. On le dit plutôt que de le laisser croire.
 *
 * ── Ce que l'import ne fait jamais ─────────────────────────────────────────
 *
 * Écraser en silence. Un fichier importé peut être plus vieux que ce qu'il y a
 * dans l'appareil ; recopier par-dessus détruirait des révisions plus récentes
 * sans que personne le sache. On lit donc le fichier, on compte ce qui est
 * nouveau et ce qui entre en conflit, on **affiche** ces nombres, et on demande
 * quoi faire des conflits avant d'écrire une seule ligne.
 *
 * ── Les textes importés restent des textes ─────────────────────────────────
 *
 * Tout champ venu d'un fichier repasse par `Perso.assainir()` ou
 * `Notes.assainir()`, et n'est affiché qu'au `textContent`. Un fichier trafiqué
 * ne peut donc rien exécuter : au pire il contient des mots bizarres.
 */
(function (racine) {

  const FORMAT = 'vocabulary-sauvegarde';
  const VERSION = 1;

  /* Au-delà, ce n'est plus une sauvegarde de vocabulaire. Le plafond protège
   * surtout de l'erreur de fichier : on lit ce qu'on a choisi, pas un film. */
  const TAILLE_MAX = 12 * 1024 * 1024;

  const TYPES_DE_CARTE = ['vers-en', 'vers-fr'];

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined && texte !== null) noeud.textContent = texte;
    return noeud;
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async function rassembler() {
    const [motsPersonnels, notes, cartes, conversation, reglages] = await Promise.all([
      Store.tousLesMotsPerso().catch(() => []),
      Store.toutesLesNotes().catch(() => []),
      Store.toutesLesCartes().catch(() => []),
      Store.touteLaConversation().catch(() => []),
      Store.lireReglages().catch(() => ({})),
    ]);
    return {
      format: FORMAT,
      version: VERSION,
      exporte: new Date().toISOString(),
      application: (racine.MiseAJour && MiseAJour.version) || '',
      donnees: (Lexique.manifeste && Lexique.manifeste.construit) || '',
      motsPersonnels,
      notes,
      cartes,
      conversation,
      reglages,
    };
  }

  function nomDeFichier() {
    const d = new Date();
    const deux = (n) => String(n).padStart(2, '0');
    return 'vocabulary-' + d.getFullYear() + '-' + deux(d.getMonth() + 1)
      + '-' + deux(d.getDate()) + '.json';
  }

  /* Écrit le fichier par un lien objet.
   *
   * `showSaveFilePicker` n'existe pas sur iOS et le partage système ne prend
   * pas les fichiers partout : le lien de téléchargement est le seul geste qui
   * marche sur les trois plateformes visées. */
  async function exporter() {
    const contenu = JSON.stringify(await rassembler(), null, 1);
    const objet = URL.createObjectURL(
      new Blob([contenu], { type: 'application/json' }));
    const lien = document.createElement('a');
    lien.href = objet;
    lien.download = nomDeFichier();
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(objet), 30000);
    return contenu.length;
  }

  // ── Lecture et contrôle d'un fichier ──────────────────────────────────────

  function texte(valeur, limite) {
    return Perso.assainir(valeur, limite || 200);
  }

  function nombre(valeur, defaut) {
    const n = Number(valeur);
    return Number.isFinite(n) ? n : defaut;
  }

  /* Remet un mot personnel importé en règle.
   *
   * On refait passer chaque champ par la normalisation qui vaut pour la saisie
   * au clavier : un fichier n'a pas plus de droits qu'un formulaire. Un
   * identifiant absent ou douteux en reçoit un neuf — deux entrées ne doivent
   * jamais partager le sien. */
  function motPropre(brut) {
    if (!brut || typeof brut !== 'object') return null;
    const controle = Perso.normaliser({
      mot: brut.mot,
      langue: brut.langue,
      traductions: Array.isArray(brut.traductions) ? brut.traductions : [],
      nature: brut.nature,
      genre: brut.genre,
      expression: brut.expression === true,
      pluriel: brut.pluriel,
      formes: Array.isArray(brut.formes) ? brut.formes : [],
      exemple: brut.exemple,
      exempleTraduit: brut.exempleTraduit,
    });
    if (!controle.valide) return null;
    const id = (typeof brut.id === 'string' && /^p-[\w-]{1,40}$/.test(brut.id))
      ? brut.id : Perso.nouvelIdentifiant();
    const cree = nombre(brut.cree, Date.now());
    return Object.assign({ id, cree, modifie: nombre(brut.modifie, cree) },
                         controle.valeurs);
  }

  function notePropre(brut) {
    if (!brut || typeof brut !== 'object') return null;
    const id = typeof brut.id === 'string' ? brut.id : '';
    if (!/^(dico:(en|fr) .+|perso:p-[\w-]{1,40}|conv:[\w-]{1,60}(\/[\w-]{1,20})?|mod:[\w-]{1,20}:[\w-]{1,80})$/.test(id)) return null;
    const contenu = Notes.assainir(brut.texte);
    const exemples = Notes.exemplesPropres(brut.exemples);
    if (!contenu && !exemples.length) return null;
    const cree = nombre(brut.cree, Date.now());
    return {
      exemples,
      id,
      cible: id.startsWith('perso:') ? 'perso'
        : (id.startsWith('conv:') ? 'conv' : (id.startsWith('mod:') ? 'mod' : 'dico')),
      langue: (brut.langue === 'en' || brut.langue === 'fr') ? brut.langue : null,
      mot: brut.mot ? texte(brut.mot, 240) : null,
      texte: contenu,
      cree,
      modifie: nombre(brut.modifie, cree),
    };
  }

  function cartePropre(brut) {
    if (!brut || typeof brut !== 'object') return null;
    if (typeof brut.id !== 'string' || !brut.id) return null;
    if (TYPES_DE_CARTE.indexOf(brut.type) === -1) return null;
    if (brut.langue !== 'en' && brut.langue !== 'fr') return null;
    const mot = texte(brut.mot, Perso.MOT_MAX);
    if (!mot) return null;
    const carte = {
      id: brut.id,
      langue: brut.langue,
      mot,
      tranche: nombre(brut.tranche, -1),
      type: brut.type,
      etat: ['nouveau', 'apprentissage', 'revision'].indexOf(brut.etat) !== -1
        ? brut.etat : 'nouveau',
      palier: Math.max(0, Math.min(9, nombre(brut.palier, 0))),
      intervalle: Math.max(0, Math.min(3650, nombre(brut.intervalle, 0))),
      facilite: Math.max(1.3, Math.min(2.8, nombre(brut.facilite, 2.5))),
      echeance: nombre(brut.echeance, Date.now()),
      reussites: Math.max(0, nombre(brut.reussites, 0)),
      echecs: Math.max(0, nombre(brut.echecs, 0)),
      cree: nombre(brut.cree, Date.now()),
      vu: nombre(brut.vu, 0),
    };
    if (typeof brut.perso === 'string' && /^p-[\w-]{1,40}$/.test(brut.perso)) {
      carte.perso = brut.perso;
    }
    if (typeof brut.conversation === 'string'
        && /^[\w-]{1,60}(\/[\w-]{1,20})?$/.test(brut.conversation)) {
      carte.conversation = brut.conversation;
    }
    if (typeof brut.module === 'string' && /^[\w-]{1,20}:[\w-]{1,80}$/.test(brut.module)) {
      carte.module = brut.module;
    }
    return carte;
  }

  /* Une phrase ou un dialogue personnel importé repasse par la normalisation
   * du formulaire ; l'identifiant est gardé s'il a la forme attendue — c'est
   * lui que ses cartes et ses notes désignent. */
  function conversationPropre(brut) {
    if (!brut || typeof brut !== 'object' || !racine.Conversation) return null;
    const sorte = brut.sorte === 'dialogue' ? 'dialogue' : 'phrase';
    const controle = sorte === 'dialogue'
      ? Conversation.normaliserDialogue(brut) : Conversation.normaliserPhrase(brut);
    if (!controle.valide) return null;
    const attendu = sorte === 'dialogue' ? /^pd-[\w-]{1,40}$/ : /^pp-[\w-]{1,40}$/;
    const id = (typeof brut.id === 'string' && attendu.test(brut.id))
      ? brut.id : (sorte === 'dialogue' ? 'pd-' : 'pp-') + Date.now().toString(36)
        + '-' + Math.random().toString(36).slice(2, 8);
    const cree = nombre(brut.cree, Date.now());
    return Object.assign({ id, cree, modifie: nombre(brut.modifie, cree) }, controle.valeurs);
  }

  /* Lit un fichier et dit ce qu'il contient. N'écrit rien.
   *
   * Rend `{ erreur }` si le fichier n'est pas une sauvegarde lisible, sinon un
   * bilan : ce qui entrerait, ce qui existe déjà à l'identique, ce qui entre en
   * conflit. C'est ce bilan qu'on affiche avant de demander quoi faire. */
  async function examiner(fichier) {
    if (!fichier) return { erreur: 'sauvegarde.erreur.aucun' };
    if (fichier.size > TAILLE_MAX) return { erreur: 'sauvegarde.erreur.taille' };

    let brut;
    try {
      brut = JSON.parse(await fichier.text());
    } catch (erreur) {
      return { erreur: 'sauvegarde.erreur.illisible' };
    }
    if (!brut || typeof brut !== 'object' || brut.format !== FORMAT) {
      return { erreur: 'sauvegarde.erreur.format' };
    }
    if (nombre(brut.version, 0) > VERSION) {
      return { erreur: 'sauvegarde.erreur.version' };
    }

    const mots = (Array.isArray(brut.motsPersonnels) ? brut.motsPersonnels : [])
      .map(motPropre).filter(Boolean);
    const notes = (Array.isArray(brut.notes) ? brut.notes : [])
      .map(notePropre).filter(Boolean);
    const cartes = (Array.isArray(brut.cartes) ? brut.cartes : [])
      .map(cartePropre).filter(Boolean);
    // Un fichier de format 1 n'a pas ce tableau : il est simplement vide.
    const conversation = (Array.isArray(brut.conversation) ? brut.conversation : [])
      .map(conversationPropre).filter(Boolean);

    const motsIci = new Map((await Store.tousLesMotsPerso().catch(() => []))
      .map((m) => [m.id, m]));
    const conversationIci = new Map((await Store.touteLaConversation().catch(() => []))
      .map((c) => [c.id, c]));
    const notesIci = new Map((await Store.toutesLesNotes().catch(() => []))
      .map((n) => [n.id, n]));
    const cartesIci = new Map((await Store.toutesLesCartes().catch(() => []))
      .map((c) => [c.id, c]));

    const bilan = {
      exporte: typeof brut.exporte === 'string' ? brut.exporte.slice(0, 10) : '',
      mots: trier(mots, motsIci, memeMot),
      notes: trier(notes, notesIci, (a, b) => a.texte === b.texte),
      cartes: trier(cartes, cartesIci, memeCarte),
      conversation: trier(conversation, conversationIci, memeConversation),
      lignes: { mots, notes, cartes, conversation },
      ignorees: {
        mots: (Array.isArray(brut.motsPersonnels) ? brut.motsPersonnels.length : 0)
          - mots.length,
        notes: (Array.isArray(brut.notes) ? brut.notes.length : 0) - notes.length,
        cartes: (Array.isArray(brut.cartes) ? brut.cartes.length : 0) - cartes.length,
        conversation: (Array.isArray(brut.conversation) ? brut.conversation.length : 0)
          - conversation.length,
      },
    };
    bilan.conflits = bilan.mots.conflits.length + bilan.notes.conflits.length
      + bilan.cartes.conflits.length + bilan.conversation.conflits.length;
    bilan.neufs = bilan.mots.neufs.length + bilan.notes.neufs.length
      + bilan.cartes.neufs.length + bilan.conversation.neufs.length;
    return bilan;
  }

  function trier(venus, ici, identiques) {
    const neufs = [];
    const pareils = [];
    const conflits = [];
    for (const ligne of venus) {
      const present = ici.get(ligne.id);
      if (!present) neufs.push(ligne);
      else if (identiques(ligne, present)) pareils.push(ligne);
      else conflits.push({ venu: ligne, present });
    }
    return { neufs, pareils, conflits };
  }

  function memeMot(a, b) {
    return a.mot === b.mot && a.langue === b.langue
      && a.traductions.join('|') === b.traductions.join('|')
      && a.nature === b.nature && a.genre === b.genre
      && a.pluriel === b.pluriel && a.formes.join('|') === b.formes.join('|')
      && a.exemple === b.exemple && a.exempleTraduit === b.exempleTraduit;
  }

  function memeCarte(a, b) {
    return a.echeance === b.echeance && a.intervalle === b.intervalle
      && a.etat === b.etat && a.reussites === b.reussites;
  }

  /* Deux phrases ou dialogues personnels se valent quand leurs textes sont
   * les mêmes ; le reste — thème, registre, situation — suit. */
  function memeConversation(a, b) {
    const texteDe = (c) => JSON.stringify(c.sorte === 'dialogue'
      ? [c.titre, c.repliques.map((r) => [r.id, r.qui, r.fr, r.en])]
      : [c.fr, c.en, c.variantes]);
    return a.sorte === b.sorte && texteDe(a) === texteDe(b)
      && a.theme === b.theme && a.registre === b.registre
      && (a.situation || '') === (b.situation || '');
  }

  /* Applique ce qui a été examiné.
   *
   * `politique` vaut 'garder' — ne rien écraser, le défaut — ou 'remplacer'.
   * Il n'y a pas de troisième choix, et surtout pas de fusion automatique : une
   * fusion de deux notes différentes fabriquerait un texte que personne n'a
   * écrit. Ce qui n'est pas repris est compté et affiché, et le fichier reste
   * sur l'appareil : on peut recommencer autrement.
   */
  async function appliquer(bilan, politique) {
    const remplacer = politique === 'remplacer';
    const compte = { mots: 0, notes: 0, cartes: 0, conversation: 0, gardes: 0 };

    async function verser(groupe, ecrire, nom) {
      for (const ligne of groupe.neufs) {
        await ecrire(ligne);
        compte[nom] += 1;
      }
      for (const conflit of groupe.conflits) {
        if (!remplacer) { compte.gardes += 1; continue; }
        await ecrire(conflit.venu);
        compte[nom] += 1;
      }
    }

    await verser(bilan.mots, (m) => Store.ecrireMotPerso(m), 'mots');
    await verser(bilan.notes, (n) => Store.ecrireNote(n), 'notes');
    if (bilan.conversation) {
      await verser(bilan.conversation, (c) => Store.ecrireConversation(c), 'conversation');
      // Les phrases importées doivent être connues avant qu'on ne juge leurs cartes.
      if (racine.Conversation) await Conversation.charger();
    }

    /* Les cartes en dernier, et seulement celles dont le mot existe.
     *
     * Une carte de mot personnel dont l'entrée n'a pas été reprise — parce
     * qu'elle était en conflit et qu'on a gardé la sienne — désignerait un mot
     * absent, et la séance buterait dessus à chaque tour. Même règle pour une
     * carte de phrase : son contenu, fourni ou à soi, doit exister ici. */
    const connus = new Set((await Store.tousLesMotsPerso().catch(() => []))
      .map((m) => m.id));
    const recevable = (c) => (!c.perso || connus.has(c.perso))
      && (!c.conversation || (racine.Conversation && Conversation.existe(c.conversation)));
    const retenues = {
      neufs: bilan.cartes.neufs.filter(recevable),
      conflits: bilan.cartes.conflits.filter((c) => recevable(c.venu)),
      pareils: bilan.cartes.pareils,
    };
    compte.orphelines = (bilan.cartes.neufs.length - retenues.neufs.length)
      + (bilan.cartes.conflits.length - retenues.conflits.length);
    await verser(retenues, (c) => Store.ecrireCarte(c), 'cartes');

    if (racine.Perso) await Perso.charger();
    return compte;
  }

  racine.Sauvegarde = {
    FORMAT, VERSION, TAILLE_MAX,
    rassembler, exporter, examiner, appliquer, nomDeFichier,
    motPropre, notePropre, cartePropre, conversationPropre,
  };

})(window);
