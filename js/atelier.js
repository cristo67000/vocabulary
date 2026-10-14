'use strict';
/*
 * Les ateliers : choisir son exercice.
 *
 * ── Pourquoi ────────────────────────────────────────────────────────────────
 *
 * L'application sait faire une douzaine d'exercices — la phrase à trou,
 * l'écoute, les verbes irréguliers, la famille de mots — mais c'est la
 * maturité de la carte qui décide lequel poser. Un exercice que personne ne
 * peut réclamer n'existe pas pour l'utilisateur : celui qui voulait une
 * demi-heure de verbes irréguliers ne pourrait que réviser sa séance du jour
 * et espérer que le hasard la lui donne. (Repris de Wortschatz.)
 *
 * Un atelier, c'est donc trois choix — quel exercice, sur quels mots, combien
 * de questions — puis la séance ordinaire, moteur compris.
 *
 * ── Ce qu'un atelier ne fait pas ────────────────────────────────────────────
 *
 * Il ne touche **jamais** à l'échéancier. Ni intervalle, ni facilité, ni date
 * de révision. C'est délibéré : la répétition espacée vaut par la mesure du
 * temps entre deux rappels, et vingt réponses d'affilée sur le même mot lui
 * feraient croire à une maîtrise qui n'est qu'un bachotage. On peut donc
 * s'entraîner autant qu'on veut sans dérégler ce qui fait tenir le vocabulaire.
 *
 * ── Ce qu'on ne cache pas ───────────────────────────────────────────────────
 *
 * Un atelier impossible reste affiché, grisé, avec sa raison : « les verbes
 * irréguliers sont anglais », « aucune voix installée ». Une vignette qui
 * disparaît laisse croire à un bogue ; une vignette qui explique enseigne.
 */
(function (racine) {

  const $ = (selecteur) => document.querySelector(selecteur);

  /* Les ateliers, dans l'ordre où on les propose.
   *
   *   type      l'exercice, tel que `Exercices.preparer` le connaît
   *   carte     le type de carte à fabriquer, qui porte la direction
   *   possible  ce qu'il faut pour que l'atelier ait un sens
   *
   * `carte` mérite un mot. La carte ne sert ici qu'à dire à l'exercice ce qu'il
   * doit demander : « vers-en » veut dire « la réponse est en anglais ». En
   * atelier, elle n'est jamais écrite en base — c'est une carte de papier.
   *
   *   liste     pour les verbes et les pluriels irréguliers : la liste des mots
   *             à travailler, quand « au hasard » n'en trouverait presque pas
   */
  const VERBES_IRREGULIERS = ('be have do go say get make know think take see come want '
    + 'give find tell become leave feel bring begin keep hold write stand hear let mean set '
    + 'meet run pay sit speak lie lead read grow lose fall send build understand draw break '
    + 'spend cut rise drive buy wear choose seek throw catch deal win forget sell eat drink '
    + 'sing swim sleep fly teach ride shoot steal hide bite blow bend bleed burst dig feed '
    + 'fight flee forgive freeze hang hurt kneel lay lend light quit ring shake shine shut '
    + 'sink slide spin split spread stick sting strike swear sweep swing tear wake weep wind '
    + 'put cost beat forbid bet show sew smell spell burn learn dream spill spoil').split(' ');
  const PLURIELS_IRREGULIERS = ('man woman child person foot tooth mouse goose ox sheep fish '
    + 'deer knife wife life leaf half wolf shelf thief loaf potato tomato hero cactus '
    + 'analysis crisis phenomenon criterion medium thesis').split(' ');

  const ATELIERS = [
    { nom: 'reconnaitre', type: 'qcm-comprendre', carte: 'inverse' },
    { nom: 'produire', type: 'qcm-produire', carte: 'vedette' },
    { nom: 'ecrire', type: 'saisie', carte: 'vedette' },
    { nom: 'traduire', type: 'saisie-traduction', carte: 'inverse' },
    { nom: 'famille', type: 'famille', carte: 'vedette' },
    { nom: 'irreguliers', type: 'conjugaison', carte: 'vedette', liste: VERBES_IRREGULIERS,
      possible: (etat) => etat.langue === 'en' || 'atelier.raison.anglais' },
    { nom: 'pluriel', type: 'pluriel', carte: 'vedette', liste: PLURIELS_IRREGULIERS,
      possible: (etat) => etat.langue === 'en' || 'atelier.raison.anglais' },
    { nom: 'trou', type: 'trou', carte: 'vedette' },
    { nom: 'phrase', type: 'paire-phrase', carte: 'inverse' },
    { nom: 'ecoute', type: 'ecoute', carte: 'vedette',
      possible: (etat) => Voix.possible(etat.langue) || 'atelier.raison.voix' },
    { nom: 'synonyme', type: 'synonyme', carte: 'vedette' },
  ];

  /* Où prendre les mots. « Mes mots » d'abord : c'est ce qu'on veut travailler
   * neuf fois sur dix, et c'est le seul choix qui ne demande rien à personne. */
  const SOURCES = ['suivis', 'recents', 'hasard'];
  const LONGUEURS = [10, 20, 40];

  const etat = { langue: 'en', source: 'suivis', longueur: 10 };
  let hote = null;

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined && texte !== null) noeud.textContent = texte;
    return noeud;
  }

  function melanger(liste) {
    const copie = liste.slice();
    for (let i = copie.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
  }

  // ── Fabriquer la file ─────────────────────────────────────────────────────

  /* Le type de carte à donner à l'exercice.
   *
   *   vedette   la réponse est le mot lui-même     → « vers-<langue du mot> »
   *   inverse   la réponse est sa traduction       → l'autre
   */
  function typeDeCarte(atelier, langue) {
    if (atelier.carte === 'vedette') return 'vers-' + langue;
    return 'vers-' + (langue === 'en' ? 'fr' : 'en');
  }

  /* Une carte de papier : juste de quoi retrouver le mot et dire quoi demander.
   * `reussites` est mis haut pour que rien, dans les exercices, ne dépende de
   * la maturité — l'atelier impose son type de toute façon. */
  function carteDePapier(mot, atelier) {
    return {
      langue: mot.langue, mot: mot.mot, tranche: mot.tranche,
      perso: mot.perso || null,
      conversation: mot.conversation || null,
      module: mot.module || null,
      type: typeDeCarte(atelier, mot.langue),
      reussites: 9, echecs: 0, etat: 'revision', intervalle: 1,
      facilite: Revision.FACILITE_INITIALE, palier: 0, echeance: 0, vu: 0,
    };
  }

  async function motsSuivis(langue) {
    const cartes = await Store.toutesLesCartes();
    const vus = new Map();
    for (const carte of cartes) {
      if (carte.langue !== langue) continue;
      const cle = carte.conversation ? 'conv ' + carte.conversation
        : (carte.perso ? 'perso ' + carte.perso
          : (carte.module ? 'mod ' + carte.module : carte.langue + ' ' + carte.mot));
      if (!vus.has(cle)) {
        vus.set(cle, { langue: carte.langue, mot: carte.mot,
                       tranche: carte.tranche, perso: carte.perso || null,
                       conversation: carte.conversation || null,
                       module: carte.module || null });
      }
    }
    return [...vus.values()];
  }

  async function motsRecents(langue) {
    const lus = await Store.historique().catch(() => []);
    const sortie = [];
    for (const lu of lus) {
      if (lu.langue !== langue) continue;
      const trouve = Lexique.resoudre(lu.mot, langue);
      if (trouve) sortie.push({ langue, mot: trouve.mot, tranche: trouve.tranche });
    }
    return sortie;
  }

  /* Au hasard dans le dictionnaire, en commençant par le vocabulaire courant :
   * s'entraîner sur des mots rares n'apprend rien d'utile, et le tirage brut en
   * donnerait surtout — ils sont les plus nombreux. */
  async function motsAuHasard(langue, combien) {
    const lot = await Lexique.entreesAuHasard(langue, combien * 12);
    const courants = lot.filter((e) => e.bande <= 2);
    return melanger(courants.length >= combien ? courants : lot)
      .map((e) => ({ langue, mot: e.mot, tranche: e.tranche }));
  }

  /* Les mots d'une liste imposée (verbes irréguliers…), tels que le paquet
   * installé les connaît. */
  function motsDeLaListe(liste, langue) {
    const sortie = [];
    for (const mot of liste) {
      const v = Lexique.vedette(langue, mot) || Lexique.resoudre(mot, langue);
      if (v) sortie.push({ langue, mot: v.mot, tranche: v.tranche });
    }
    return sortie;
  }

  async function motsDe(source, langue, combien, atelier) {
    /* Une liste imposée l'emporte sur « au hasard », qui ne tomberait presque
     * jamais sur un verbe irrégulier ; « mes mots » et « récents » restent ce
     * qu'ils sont — on peut vouloir ses propres verbes. */
    if (atelier && atelier.liste && source === 'hasard') {
      return motsDeLaListe(atelier.liste, langue);
    }
    if (source === 'suivis') return motsSuivis(langue);
    if (source === 'recents') return motsRecents(langue);
    return motsAuHasard(langue, combien);
  }

  /* Tous les mots ne conviennent pas à tous les exercices : on ne demande pas
   * le pluriel d'un verbe ni le genre d'un adverbe. Plutôt que de deviner sur
   * l'index, qui ne porte ni nature ni flexion, on ouvre les entrées et on
   * garde celles qui répondent — c'est quelques tranches de lues, et cela évite
   * de poser une question sans réponse.
   */
  function convient(atelier, entree) {
    if (atelier.type === 'pluriel') {
      const pluriel = Exercices.formeFlechie(entree, 'pl');
      return !!pluriel && pluriel.graphie !== entree.mot
        && (entree.langue !== 'en' || Exercices.estPlurielIrregulier(entree));
    }
    if (atelier.nom === 'irreguliers') return Exercices.estIrregulier(entree);
    if (atelier.type === 'conjugaison') {
      return ['past', 'pp', '3sg'].some((code) => Exercices.formeFlechie(entree, code));
    }
    if (atelier.type === 'famille') return (entree.voisins || []).length >= 2;
    if (atelier.type === 'synonyme') return Exercices.synonymesDe(entree).length > 0;
    if (atelier.type === 'trou' || atelier.type === 'paire-phrase') {
      return phrasesDe(entree).length > 0;
    }
    return Exercices.traductions(entree).length > 0;
  }

  function phrasesDe(entree) {
    // Un mot personnel porte sa phrase en propre, sans passer par le vivier.
    if (entree.paires) return entree.paires.filter((p) => p.en || p.fr);
    const numeros = (entree.phrases || []).slice();
    for (const lecture of entree.lectures) {
      for (const bloc of lecture[4]) {
        for (const numero of (bloc[3] || [])) numeros.push(numero);
      }
    }
    return numeros;
  }

  async function filePour(atelier) {
    const candidats = melanger(await motsDe(etat.source, etat.langue, etat.longueur, atelier));
    const file = [];
    /* On s'arrête dès qu'on a de quoi, mais on ne balaie pas tout le
     * dictionnaire pour autant : au-delà de quelques centaines d'entrées
     * ouvertes, c'est que l'atelier ne convient pas à cette sélection. */
    const plafond = Math.min(candidats.length, etat.longueur * 20 + 40);
    for (let i = 0; i < plafond && file.length < etat.longueur; i += 1) {
      const entree = await Lexique.ouvrir(candidats[i]).catch(() => null);
      if (entree && convient(atelier, entree)) {
        file.push(carteDePapier(candidats[i], atelier));
      }
    }
    return file;
  }

  // ── L'écran ───────────────────────────────────────────────────────────────

  /* Sur des mots français, un exercice dont la réponse est le mot lui-même
   * ferait écrire du français à un francophone : seuls restent ceux qui
   * attendent l'anglais — reconnaître, traduire, apparier une phrase. */
  function raisonDe(atelier) {
    if (atelier.possible) {
      const verdict = atelier.possible(etat);
      if (verdict !== true) return verdict;
    }
    if (etat.langue === 'fr' && atelier.carte === 'vedette') return 'atelier.raison.reponse-fr';
    return null;
  }

  function segments(nom, valeurs, courant, cle, surChoix) {
    const bloc = element('div', 'atelier-choix');
    bloc.appendChild(element('span', 'atelier-choix-titre', I18n.t(nom)));
    const groupe = element('div', 'segments');
    groupe.setAttribute('role', 'group');
    for (const valeur of valeurs) {
      const bouton = element('button', null, I18n.t(cle + valeur));
      bouton.type = 'button';
      bouton.setAttribute('aria-pressed', String(valeur === courant));
      bouton.addEventListener('click', () => surChoix(valeur));
      groupe.appendChild(bouton);
    }
    bloc.appendChild(groupe);
    return bloc;
  }

  async function demarrer(atelier) {
    const file = await filePour(atelier);
    if (!file.length) {
      const avis = $('#atelier-avis');
      avis.textContent = I18n.t('atelier.vide');
      avis.hidden = false;
      return;
    }
    $('#atelier-avis').hidden = true;
    await Seance.lancer(file, {
      enregistrer: false,
      type: atelier.type,
      reprendre: () => demarrer(atelier),
    });
  }

  function dessiner() {
    if (!hote) return;
    hote.textContent = '';

    hote.appendChild(segments('atelier.langue', ['en', 'fr'], etat.langue,
      'langue.', (valeur) => { etat.langue = valeur; dessiner(); }));
    hote.appendChild(segments('atelier.source', SOURCES, etat.source,
      'atelier.source.', (valeur) => { etat.source = valeur; dessiner(); }));
    hote.appendChild(segments('atelier.longueur', LONGUEURS, etat.longueur,
      'atelier.longueur.', (valeur) => { etat.longueur = valeur; dessiner(); }));

    const grille = element('div', 'ateliers');
    for (const atelier of ATELIERS) {
      const raison = raisonDe(atelier);
      const vignette = element('button', 'atelier' + (raison ? ' impossible' : ''));
      vignette.type = 'button';
      vignette.appendChild(element('span', 'atelier-nom', I18n.t('atelier.' + atelier.nom)));
      vignette.appendChild(element('span', 'atelier-detail',
        I18n.t(raison || ('atelier.' + atelier.nom + '.detail'))));
      if (raison) {
        vignette.disabled = true;
      } else {
        vignette.addEventListener('click', () => demarrer(atelier));
      }
      grille.appendChild(vignette);
    }
    hote.appendChild(grille);
  }

  function brancher() {
    hote = $('#ateliers');
    dessiner();
  }

  /* Lance un atelier sur des entrées choisies ailleurs — la famille d'un mot
   * depuis sa fiche, les mots d'un thème depuis un module. */
  async function lancerSur(nom, entrees, options) {
    const atelier = ATELIERS.find((a) => a.nom === nom)
      || { nom, type: nom, carte: 'vedette' };
    const file = [];
    for (const entree of entrees) {
      if (!entree) continue;
      if (!convient(atelier, entree)) continue;
      file.push(carteDePapier({ langue: entree.langue, mot: entree.mot, tranche: entree.tranche,
                                perso: entree.perso, conversation: entree.conversation,
                                module: entree.module }, atelier));
    }
    if (!file.length) return false;
    if (racine.App && App.allerA) App.allerA('reviser');
    await Seance.lancer(melanger(file), {
      enregistrer: false,
      type: atelier.type,
      leurres: entrees.filter(Boolean),
      reprendre: (options && options.reprendre) || (() => lancerSur(nom, entrees, options)),
    });
    return true;
  }

  racine.Atelier = { brancher, dessiner, lancerSur, ATELIERS, VERBES_IRREGULIERS,
                     PLURIELS_IRREGULIERS };

})(window);
