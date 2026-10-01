'use strict';
/*
 * Le planificateur : quoi revoir, et quand.
 *
 * ── Pourquoi une répétition espacée ────────────────────────────────────────
 *
 * On oublie vite ce qu'on vient d'apprendre, puis de plus en plus lentement à
 * chaque rappel réussi. Revoir un mot juste avant de l'oublier coûte peu et
 * rapporte beaucoup ; le revoir trop tôt ne rapporte rien, trop tard revient à
 * l'apprendre à neuf. Tout le travail de ce fichier consiste à placer chaque
 * mot au bon moment, et il n'y a pas d'autre moyen connu de faire tenir
 * quelques milliers de mots dans une tête.
 *
 * L'algorithme est un SM-2 simplifié : chaque carte porte un intervalle et une
 * « facilité » ; une réussite multiplie l'intervalle par la facilité, un échec
 * renvoie la carte en apprentissage et rabote sa facilité.
 *
 * ── Deux sortes de cartes ──────────────────────────────────────────────────
 *
 *   vers-en  produire l'anglais :   « maison » → house
 *   vers-fr  produire le français : « house »  → maison
 *
 * Les cartes portent le nom de **la langue de la réponse**, et non celui du mot.
 * C'est le seul repère qui ne s'inverse pas : pour l'entrée anglaise « house »,
 * la carte `vers-en` demande de produire « house » à partir de « maison », et
 * pour l'entrée française « maison » elle demande exactement la même chose. Le
 * réglage « sens de travail » se lit alors sans détour.
 *
 * Une seule carte pour les deux directions ne consoliderait ni l'une ni
 * l'autre : reconnaître « house » et savoir le produire s'oublient à des
 * rythmes différents, et une échéance commune suit le plus facile des deux
 * (leçon de Wortschatz, dont ce planificateur est repris).
 *
 * ── Ce que la carte ne contient pas ────────────────────────────────────────
 *
 * Ni le mot ni sa traduction : seulement de quoi les retrouver (langue, vedette,
 * numéro de tranche). Le dictionnaire peut ainsi être remplacé par une version
 * plus récente sans que les révisions en soient affectées.
 */
(function (racine) {

  const JOUR = 24 * 60 * 60 * 1000;
  const MINUTE = 60 * 1000;

  /* Les paliers d'apprentissage, avant qu'une carte n'entre en révision
   * espacée. Le premier est court exprès : revoir dix minutes plus tard une
   * carte qu'on vient de rater est ce qui la fait tenir jusqu'au lendemain. */
  const PALIERS = [10 * MINUTE, JOUR];

  const FACILITE_INITIALE = 2.5;
  const FACILITE_MIN = 1.3;
  const FACILITE_MAX = 2.8;

  /* Les quatre jugements possibles, du pire au meilleur. */
  const RATE = 0, DIFFICILE = 1, CORRECT = 2, FACILE = 3;

  function maintenant() {
    return Date.now();
  }

  /* Une carte neuve. `perso` est l'identifiant du mot personnel, ou rien.
   *
   * Il change l'identité de la carte, et rien d'autre. Une carte de mot
   * personnel se nomme d'après cet identifiant plutôt que d'après la graphie :
   * corriger l'orthographe du mot ne doit pas fabriquer une carte neuve et
   * abandonner l'ancienne avec ses trois mois d'intervalle. Le champ `mot`
   * reste, pour l'affichage des listes, et suit les corrections. */
  function neuve(langue, mot, tranche, type, perso, conversation, module) {
    const carte = {
      id: conversation ? Store.identifiantConversation(conversation, type)
        : (perso ? Store.identifiantPerso(perso, type)
          : (module ? Store.identifiantModule(module, type)
                    : Store.identifiant(langue, mot, type))),
      langue, mot, tranche, type,
      etat: 'nouveau',
      palier: 0,
      intervalle: 0,
      facilite: FACILITE_INITIALE,
      echeance: maintenant(),
      reussites: 0,
      echecs: 0,
      cree: maintenant(),
      vu: 0,
    };
    if (perso) carte.perso = perso;
    /* Une phrase ou une réplique de « Phrases et dialogues » : l'identifiant
     * canonique du contenu, jamais son texte — voir js/conversation.js. */
    if (conversation) carte.conversation = conversation;
    /* Une fiche de module sans entrée au dictionnaire (« tbh », « prompt
     * injection ») : son identifiant de module. */
    if (module) carte.module = module;
    return carte;
  }

  /* Le sens de travail : quelles directions on veut réviser.
   *
   * Réglé depuis les Réglages, il ne vaut que pour les cartes **créées
   * ensuite**. Repasser de « les deux » à « vers l'anglais » n'efface pas les
   * cartes françaises déjà acquises : on ne détruit pas des mois de révisions
   * sur un changement de préférence, on cesse simplement d'en fabriquer. */
  let sensDeTravail = 'les-deux';

  function directionsPour(langue) {
    if (sensDeTravail === 'vers-en') return ['vers-en'];
    if (sensDeTravail === 'vers-fr') return ['vers-fr'];
    // « Les deux » : produire le mot, et produire sa traduction.
    return ['vers-' + langue, langue === 'en' ? 'vers-fr' : 'vers-en'];
  }

  /* Quelles cartes créer pour une entrée : une ou deux, selon le sens de
   * travail. */
  function cartesPour(entree) {
    const types = directionsPour(entree.langue);
    return types.map((type) => neuve(entree.langue, entree.mot, entree.tranche,
                                     type, entree.perso || null,
                                     entree.conversation || null,
                                     entree.module || null));
  }

  /* Les cartes qu'une entrée possède déjà, quelle que soit sa famille : mot
   * du dictionnaire, mot à soi, phrase ou réplique, fiche de module. */
  function cartesDe(langue, mot, perso, conversation, module) {
    if (conversation) return Store.cartesDeConversation(conversation);
    if (module) return Store.cartesDeModule(module);
    return Store.cartesDuMot(langue, mot, perso || null);
  }

  /* La carte demande-t-elle de produire la vedette elle-même, ou sa traduction ?
   *
   * C'est la question dont dépend tout le reste : quel exercice poser, quoi
   * afficher, quoi attendre. Elle se répond d'une comparaison, et vaut mieux
   * qu'un champ de plus dans la carte, qui pourrait mentir. */
  function produitLaVedette(carte) {
    return carte.type === 'vers-' + carte.langue;
  }

  async function apprendre(entree) {
    const existantes = await cartesDe(entree.langue, entree.mot,
                                      entree.perso || null, entree.conversation || null,
                                      entree.module || null);
    const deja = new Set(existantes.map((c) => c.type));
    const creees = [];
    for (const carte of cartesPour(entree)) {
      if (deja.has(carte.type)) continue;
      await Store.ecrireCarte(carte);
      creees.push(carte);
    }
    return creees;
  }

  async function oublier(langue, mot, perso, conversation, module) {
    for (const carte of await cartesDe(langue, mot, perso, conversation, module)) {
      await Store.supprimerCarte(carte.id);
    }
  }

  async function estAppris(langue, mot, perso, conversation, module) {
    return (await cartesDe(langue, mot, perso, conversation, module)).length > 0;
  }

  // ── Le calcul de la prochaine échéance ────────────────────────────────────

  function borner(valeur, bas, haut) {
    return Math.max(bas, Math.min(haut, valeur));
  }

  /* Applique un jugement à une carte et renvoie la carte mise à jour.
   * Fonction pure : elle n'écrit rien, ce qui la rend vérifiable. */
  function juger(carte, qualite, quand) {
    const t = quand || maintenant();
    const suite = Object.assign({}, carte, { vu: t });

    if (qualite === RATE) {
      suite.etat = 'apprentissage';
      suite.palier = 0;
      suite.echecs = carte.echecs + 1;
      suite.facilite = borner(carte.facilite - 0.2, FACILITE_MIN, FACILITE_MAX);
      suite.echeance = t + PALIERS[0];
      /* L'intervalle n'est pas remis à zéro mais divisé : un mot su pendant
       * trois mois puis raté une fois n'est pas revenu au premier jour. */
      suite.intervalle = Math.max(1, Math.round(carte.intervalle * 0.3));
      return suite;
    }

    suite.reussites = carte.reussites + 1;

    if (suite.etat === 'nouveau' || suite.etat === 'apprentissage') {
      /* Une carte neuve n'a franchi aucun palier : sa première réussite la
       * place au palier 0, dix minutes plus tard — et non au palier 1, le
       * lendemain. Compter `palier + 1` pour elle comme pour les autres lui
       * faisait sauter le rappel court, celui qui fait justement tenir un mot
       * neuf jusqu'au jour suivant. */
      const suivant = qualite === FACILE ? PALIERS.length
        : (suite.etat === 'nouveau' ? 0 : carte.palier + 1);
      if (suivant >= PALIERS.length) {
        suite.etat = 'revision';
        suite.intervalle = qualite === FACILE ? 4 : Math.max(1, suite.intervalle || 1);
        suite.echeance = t + suite.intervalle * JOUR;
      } else {
        suite.etat = 'apprentissage';
        suite.palier = suivant;
        suite.echeance = t + PALIERS[suivant];
      }
      return suite;
    }

    // En révision : l'intervalle grandit à la mesure de la facilité.
    const ajustement = qualite === FACILE ? 0.1 : (qualite === DIFFICILE ? -0.15 : 0);
    suite.facilite = borner(carte.facilite + ajustement, FACILITE_MIN, FACILITE_MAX);
    const coefficient = qualite === DIFFICILE ? 1.2 : suite.facilite;
    suite.intervalle = Math.max(1, Math.round(Math.max(carte.intervalle, 1) * coefficient));
    // Au-delà de deux ans, l'espacement n'apporte plus rien de mesurable.
    suite.intervalle = Math.min(suite.intervalle, 730);
    suite.echeance = t + suite.intervalle * JOUR;
    return suite;
  }

  async function noter(carte, qualite, exercice) {
    const suite = juger(carte, qualite);
    await Store.ecrireCarte(suite);
    await Store.noter({
      quand: maintenant(),
      carte: carte.id,
      langue: carte.langue,
      mot: carte.mot,
      /* L'identifiant du mot personnel voyage avec la ligne de journal : sans
       * lui, l'onglet Progrès confondrait un « flat » à soi avec celui du
       * dictionnaire, et compterait pour un ce qui fait deux. */
      perso: carte.perso || null,
      conversation: carte.conversation || null,
      module: carte.module || null,
      type: carte.type,
      exercice: exercice || null,
      qualite,
      etatAvant: carte.etat,
    });
    return suite;
  }

  // ── Composition d'une séance ──────────────────────────────────────────────

  function memeJour(a, b) {
    const x = new Date(a);
    const y = new Date(b);
    return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth()
      && x.getDate() === y.getDate();
  }

  /* Combien de cartes neuves ont déjà été entamées aujourd'hui. On le lit dans
   * le journal plutôt que de tenir un compteur : un compteur se désynchronise,
   * le journal est la trace de ce qui s'est réellement passé. */
  async function nouveautesDuJour() {
    const debut = new Date();
    debut.setHours(0, 0, 0, 0);
    const lignes = await Store.journalDepuis(debut.getTime());
    const vues = new Set();
    for (const ligne of lignes) {
      if (ligne.etatAvant === 'nouveau') vues.add(ligne.carte);
    }
    return vues.size;
  }

  /* La file d'une séance : d'abord ce qui est dû, puis quelques nouveautés.
   *
   * L'ordre n'est pas aléatoire. Deux cartes du même mot — les deux
   * directions — ne doivent pas se suivre : la première donnerait la réponse
   * de la seconde. On les écarte donc l'une de l'autre.
   */
  async function file(quota) {
    const t = maintenant();
    const dues = (await Store.cartesDues(t)).filter((c) => c.etat !== 'nouveau');
    const neuves = (await Store.toutesLesCartes()).filter((c) => c.etat === 'nouveau');

    const place = Math.max(0, (quota === undefined ? 10 : quota) - await nouveautesDuJour());
    neuves.sort((a, b) => a.cree - b.cree);

    const lot = dues.concat(neuves.slice(0, place));
    return espacer(melanger(lot));
  }

  function melanger(liste) {
    const copie = liste.slice();
    for (let i = copie.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
  }

  /* Éloigne les cartes qui portent sur le même mot.
   *
   * Un mot en compte deux — produire l'anglais, produire le français — et
   * elles se donnent mutuellement la réponse : qui vient de lire « house » en
   * face de « maison » n'a plus rien à retrouver. On regarde donc cinq cartes
   * en arrière. */
  function espacer(liste) {
    const sortie = [];
    const attente = [];
    for (const carte of liste) {
      const recents = sortie.slice(-5).map((c) => c.langue + c.mot);
      if (recents.indexOf(carte.langue + carte.mot) !== -1) attente.push(carte);
      else sortie.push(carte);
    }
    return sortie.concat(attente);
  }

  /* Deux unités, et il faut les deux. Ce qu'il reste à faire se compte en
   * cartes — c'est le nombre de questions qui viennent. Ce qu'on suit se compte
   * en mots : un mot appris dans les deux sens en occupe deux, et annoncer
   * « 24 mots suivis » à qui en a mis 12 dans sa liste serait faux. */
  async function compter() {
    const t = maintenant();
    const toutes = await Store.toutesLesCartes();
    return {
      total: toutes.length,
      mots: new Set(toutes.map((c) => c.langue + ' ' + c.mot)).size,
      nouvelles: toutes.filter((c) => c.etat === 'nouveau').length,
      apprentissage: toutes.filter((c) => c.etat === 'apprentissage').length,
      revision: toutes.filter((c) => c.etat === 'revision').length,
      dues: toutes.filter((c) => c.etat !== 'nouveau' && c.echeance <= t).length,
    };
  }

  racine.Revision = {
    RATE, DIFFICILE, CORRECT, FACILE,
    JOUR, PALIERS, FACILITE_INITIALE,
    neuve, cartesPour, cartesDe, apprendre, oublier, estAppris, produitLaVedette,
    juger, noter, file, compter, nouveautesDuJour, memeJour,
    get sensDeTravail() { return sensDeTravail; },
    set sensDeTravail(v) { sensDeTravail = v; },
  };

})(window);
