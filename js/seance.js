'use strict';
/*
 * Le déroulé d'une séance de révision.
 *
 * Une séance est une file de cartes ; pour chacune, `Exercices.preparer()` dit
 * quoi demander, ce fichier le met à l'écran, recueille la réponse, la corrige
 * et transmet le jugement au planificateur.
 *
 * ── Qui juge ───────────────────────────────────────────────────────────────
 *
 * L'application, pas l'apprenant. Les exercices ont une réponse vérifiable :
 * demander « avez-vous trouvé ? » après coup invite à l'indulgence, et une
 * indulgence répétée ruine l'espacement — on croit savoir mille mots et on en
 * sait trois cents. Une seule chose reste à la main de l'apprenant : dire qu'un
 * mot lui était **facile**, ce que l'application ne peut pas deviner et qui
 * mérite d'espacer davantage.
 *
 * ── Ce qui se passe après une erreur ───────────────────────────────────────
 *
 * La bonne réponse est montrée, avec sa fiche en abrégé — prononciation,
 * une phrase d'exemple. Se tromper est le meilleur moment pour apprendre, à
 * condition que la correction arrive tout de suite et donne à voir autre chose
 * que le simple mot juste.
 */
(function (racine) {

  /* Les signes qu'un clavier de téléphone cache le plus loin. L'anglais n'en
   * a qu'un, l'apostrophe typographique ne comptant pas : la correction
   * l'accepte sous toutes ses formes. */
  const CLAVIERS = {
    en: ["'"],
    fr: ['é', 'è', 'ê', 'à', 'ç', 'ù', 'â', 'î', 'ô', 'û', 'ë', 'ï', 'œ'],
  };

  const $ = (selecteur) => document.querySelector(selecteur);
  const elements = {};

  let file = [];
  let position = 0;
  let question = null;
  let bilan = null;
  let quota = 10;
  let regime = { enregistrer: true, type: null };

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined && texte !== null) noeud.textContent = texte;
    return noeud;
  }

  function vider(noeud) {
    noeud.textContent = '';
    return noeud;
  }

  // ── Accueil de l'onglet ───────────────────────────────────────────────────

  async function rafraichir() {
    const comptes = await Revision.compter();
    const faites = await Revision.nouveautesDuJour();
    const reste = Math.max(0, quota - faites);
    const aFaire = comptes.dues + Math.min(reste, comptes.nouvelles);

    vider(elements.compteurs);
    for (const [cle, valeur] of [
      ['reviser.compteur.dues', comptes.dues],
      ['reviser.compteur.nouvelles', Math.min(reste, comptes.nouvelles)],
      ['reviser.compteur.total', comptes.mots],
    ]) {
      const bloc = element('div', 'compteur');
      bloc.appendChild(element('span', 'chiffre', String(valeur)));
      bloc.appendChild(element('span', 'etiquette-compteur', I18n.t(cle)));
      elements.compteurs.appendChild(bloc);
    }

    elements.vide.hidden = comptes.total > 0;
    elements.avance.hidden = !(comptes.total > 0 && aFaire === 0);
    elements.commencer.hidden = aFaire === 0;
    elements.compteurs.hidden = comptes.total === 0;

    /* La liste des mots suivis vit sous les compteurs : elle se redessine avec
     * eux, et n'a donc jamais à se demander si elle est encore juste. */
    if (racine.Suivis) await Suivis.dessiner();
  }

  // ── Cycle de vie d'une séance ─────────────────────────────────────────────

  /* Le moteur, commun aux deux régimes.
   *
   *   séance du jour  `enregistrer: true`  — les réponses notent les cartes et
   *                   déplacent les échéances. C'est la mémorisation.
   *   atelier         `enregistrer: false` — rien n'est noté, aucune échéance
   *                   ne bouge. C'est l'entraînement.
   *
   * Un seul et même code affiche, corrige et commente : dupliquer la séance
   * pour les ateliers aurait fait deux corrections à maintenir, qui auraient
   * fini par juger différemment la même faute.
   */
  async function lancer(cartes, options) {
    regime = Object.assign({ enregistrer: true, type: null }, options || {});
    if (racine.Exercices && Exercices.vivierDeLeurres) Exercices.vivierDeLeurres(regime.leurres || null);
    file = cartes;
    position = 0;
    bilan = { justes: 0, presque: 0, faux: 0, total: file.length, mots: new Set() };
    if (!file.length) { await rafraichir(); return; }
    elements.accueil.hidden = true;
    elements.bilan.hidden = true;
    elements.seance.hidden = false;
    elements.seance.classList.toggle('libre', !regime.enregistrer);
    elements.libre.hidden = regime.enregistrer;
    if (racine.Suivis) Suivis.reinitialiser();
    await poser();
  }

  async function commencer() {
    await lancer(await Revision.file(quota), { enregistrer: true });
  }

  function arreter() {
    elements.seance.hidden = true;
    elements.bilan.hidden = true;
    elements.accueil.hidden = false;
    elements.seance.classList.remove('libre');
    elements.libre.hidden = true;
    regime = { enregistrer: true, type: null };
    Voix.taire();
    rafraichir();
  }

  async function poser() {
    if (position >= file.length) { return terminer(); }
    const carte = file[position];
    elements.jauge.style.width = Math.round(100 * position / file.length) + '%';

    const entree = await Lexique.ouvrir({
      langue: carte.langue, mot: carte.mot, tranche: carte.tranche,
      perso: carte.perso || null,
      conversation: carte.conversation || null,
    });
    if (!entree) {
      /* Le mot a disparu du dictionnaire — une version des données plus
       * récente peut l'avoir retiré. On passe, sans rien casser. */
      position += 1;
      return poser();
    }

    question = await Exercices.preparer(carte, entree, { type: regime.type });
    elements.verdict.hidden = true;
    afficher(question);
  }

  // ── Affichage d'une question ──────────────────────────────────────────────

  /* La consigne nomme **la langue de la réponse**, jamais celle du mot affiché.
   * « Que veut dire ce mot ? » devant « maison » alors qu'on attend « house »
   * n'est pas une formulation maladroite : c'est une consigne fausse, et
   * l'apprenant répond dans la mauvaise langue avant de comprendre pourquoi. */
  function consignePour(q) {
    const reponse = q.langueReponse || q.carte.langue;
    const autre = reponse === 'en' ? 'fr' : 'en';
    /* Une phrase a ses consignes là où « le mot » sonnerait faux : on
     * n'écrit pas « le mot » après avoir écouté « Where's the post office? ». */
    const cle = q.phrase && I18n.existe('exercice.consigne.' + q.type + '.phrase')
      ? 'exercice.consigne.' + q.type + '.phrase'
      : 'exercice.consigne.' + q.type;
    return I18n.t(cle, {
      langue: I18n.t('langue.' + reponse),
      autre: I18n.t('langue.' + autre),
    });
  }

  function afficher(q) {
    elements.consigne.textContent = consignePour(q);
    const enonce = vider(elements.enonce);
    const zone = vider(elements.zone);

    if (q.type === 'ecoute') {
      const bouton = element('button', 'bouton-ecoute', '▸');
      bouton.type = 'button';
      bouton.setAttribute('aria-label', I18n.t('fiche.ecouter'));
      bouton.addEventListener('click', () => Voix.dire(q.aEcouter, q.carte.langue));
      enonce.appendChild(bouton);
      Voix.dire(q.aEcouter, q.carte.langue);
    } else if (q.type === 'trou' || q.type === 'paire-phrase') {
      enonce.appendChild(element('p', 'enonce-phrase', q.enonce));
      if (q.indice) enonce.appendChild(element('p', 'enonce-indice', q.indice));
    } else {
      enonce.appendChild(element('p', 'enonce-mot', q.enonce));
      // La conjugaison demande une forme précise : sans l'indice, la question
      // n'aurait pas de réponse déterminée.
      if (q.indice) enonce.appendChild(element('p', 'enonce-indice', q.indice));
    }

    if (q.type === 'famille' && q.racine) {
      enonce.appendChild(element('p', 'enonce-indice',
        I18n.t('exercice.famille.racine', { mot: q.racine })));
    }

    if (q.options) {
      for (const option of q.options) {
        const bouton = element('button', 'choix', option.texte);
        bouton.type = 'button';
        bouton.addEventListener('click', () => repondre(option.texte));
        zone.appendChild(bouton);
      }
      return;
    }

    // Exercices de saisie.
    const champ = element('input', 'saisie');
    champ.type = 'text';
    champ.autocomplete = 'off';
    champ.autocapitalize = 'off';
    champ.spellcheck = false;
    champ.setAttribute('aria-label', I18n.t('exercice.saisie.aria'));
    zone.appendChild(champ);

    const touches = element('div', 'touches');
    for (const signe of CLAVIERS[q.langueReponse || q.carte.langue] || []) {
      const touche = element('button', 'touche', signe);
      touche.type = 'button';
      touche.tabIndex = -1;
      touche.addEventListener('click', () => {
        const debut = champ.selectionStart;
        champ.value = champ.value.slice(0, debut) + signe + champ.value.slice(champ.selectionEnd);
        champ.focus();
        champ.selectionStart = champ.selectionEnd = debut + signe.length;
      });
      touches.appendChild(touche);
    }
    zone.appendChild(touches);

    const ligne = element('div', 'ligne-boutons');
    const valider = element('button', 'bouton-principal', I18n.t('exercice.valider'));
    valider.type = 'button';
    valider.addEventListener('click', () => repondre(champ.value));
    const passer = element('button', 'bouton-discret', I18n.t('exercice.je-ne-sais-pas'));
    passer.type = 'button';
    passer.addEventListener('click', () => repondre(''));
    ligne.appendChild(valider);
    ligne.appendChild(passer);
    zone.appendChild(ligne);

    champ.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); repondre(champ.value); }
    });
    champ.focus();
  }

  // ── Correction ────────────────────────────────────────────────────────────

  async function repondre(saisie) {
    const q = question;
    if (!q) return;

    let verdict;
    if (q.options) {
      verdict = { verdict: saisie === q.attendu ? 'juste' : 'faux',
                  attendu: q.attendu, remarque: null };
    } else {
      /* La langue de la réponse n'est pas toujours celle du mot : « écrivez la
       * traduction » attend du français en face d'une entrée anglaise.
       * Corriger avec les règles de l'anglais reprocherait alors une majuscule
       * que le français ne met pas (« lundi » pour « Monday »). */
      verdict = Exercices.corriger(saisie, q.attendus || [q.attendu], {
        langue: q.langueReponse || q.carte.langue, estNom: q.estNom,
        autresSens: q.autresSens, contexte: q.indice,
        phrase: !!q.phrase,
      });
    }

    const qualite = verdict.verdict === 'juste' ? Revision.CORRECT
      : (verdict.verdict === 'presque' ? Revision.DIFFICILE : Revision.RATE);

    bilan[verdict.verdict === 'juste' ? 'justes'
      : (verdict.verdict === 'presque' ? 'presque' : 'faux')] += 1;
    bilan.mots.add(q.carte.langue + ' ' + q.carte.mot);

    if (regime.enregistrer) {
      await Revision.noter(q.carte, qualite, q.type);
    } else {
      /* L'atelier ne touche pas au planificateur : ni intervalle, ni facilité,
       * ni échéance. Marteler un exercice ne doit pas faire croire au
       * planificateur qu'un mot est su, ni le rendre dû plus tôt.
       *
       * La réponse est tout de même journalisée, marquée `libre`. Rien n'est
       * perdu — l'onglet Progrès peut en rendre compte à part — et les
       * compteurs de mémorisation, eux, l'ignorent. */
      await Store.noter({
        quand: Date.now(), carte: q.carte.id || null,
        langue: q.carte.langue, mot: q.carte.mot, perso: q.carte.perso || null,
        conversation: q.carte.conversation || null,
        type: q.carte.type,
        exercice: q.type, qualite, etatAvant: q.carte.etat || null, libre: true,
      }).catch(() => {});
    }
    montrerVerdict(q, verdict, qualite);
  }

  function montrerVerdict(q, verdict, qualite) {
    vider(elements.zone);
    elements.verdict.hidden = false;
    elements.verdict.className = 'verdict ' + verdict.verdict;

    const attendu = verdict.attendu;

    elements.verdictTexte.textContent = verdict.verdict === 'juste'
      ? I18n.t('exercice.juste')
      : I18n.t(verdict.verdict === 'presque' ? 'exercice.presque' : 'exercice.faux',
               { reponse: attendu });

    elements.verdictRemarque.textContent = verdict.remarque
      ? I18n.t(verdict.remarque.cle, verdict.remarque.valeurs) : '';
    elements.verdictRemarque.hidden = !verdict.remarque;

    remplirRappel(q);

    const boutons = vider(elements.verdictBoutons);
    const suivant = element('button', 'bouton-principal', I18n.t('exercice.suivant'));
    suivant.type = 'button';
    suivant.addEventListener('click', () => avancer());
    boutons.appendChild(suivant);

    if (qualite === Revision.CORRECT && regime.enregistrer) {
      const facile = element('button', 'bouton-discret', I18n.t('exercice.facile'));
      facile.type = 'button';
      facile.addEventListener('click', async () => {
        await Revision.noter(q.carte, Revision.FACILE, q.type);
        avancer();
      });
      boutons.appendChild(facile);
    }
    suivant.focus();
  }

  /* Un rappel court de la fiche : de quoi ancrer le mot au moment où l'on vient
   * de buter dessus. */
  function remplirRappel(q) {
    const bloc = vider(elements.verdictFiche);
    // La question « même famille » porte sur un membre de la famille, pas sur
    // le mot d'où l'on est parti : c'est lui qu'on rappelle.
    const entree = q.apprendre || q.entree;
    if (entree.conversation) { remplirRappelPhrase(q, bloc); return; }
    const lecture = entree.lectures[0] || [];

    const ligne = element('p', 'rappel-mot');
    ligne.appendChild(element('b', null, entree.mot));
    if (lecture[2]) ligne.appendChild(element('span', 'api', ' [' + lecture[2] + ']'));
    bloc.appendChild(ligne);

    bloc.appendChild(element('p', 'rappel-sens',
      Exercices.traductions(entree).slice(0, 4).join(' · ')));

    const ouvrir = element('button', 'lien-discret', I18n.t('exercice.voir-fiche'));
    ouvrir.type = 'button';
    ouvrir.addEventListener('click', () => App.ouvrirFiche({
      langue: entree.langue, mot: entree.mot,
      tranche: q.apprendre ? entree.tranche : q.carte.tranche,
      perso: entree.perso || null, module: entree.module || null,
    }));
    bloc.appendChild(ouvrir);

    /* La note personnelle, si elle existe — et seulement ici.
     *
     * Une note contient souvent le moyen qu'on s'est trouvé pour retrouver le
     * mot, c'est-à-dire la réponse. L'afficher pendant la question viderait
     * l'exercice de son sens ; l'afficher après la réponse, au moment où l'on
     * relit, est exactement ce pour quoi on l'a écrite. Elle arrive après coup
     * — le verdict ne l'attend pas pour s'afficher. */
    if (racine.Notes) {
      // La question courante fait garde-fou : si l'on a déjà cliqué
      // « Suivant », la note qui arrive n'a plus rien à faire à l'écran.
      const pourQui = question;
      Notes.rappel(entree).then((rappel) => {
        if (rappel && question === pourQui) bloc.appendChild(rappel);
      }).catch(() => {});
    }
  }

  /* Le rappel d'une phrase : les deux textes, puis les variantes que la
   * correction accepte — toutes, et seulement celles-là. On ne prétend pas
   * reconnaître toute traduction possible ; on montre ce qu'on reconnaît. */
  function remplirRappelPhrase(q, bloc) {
    const entree = q.entree;
    const ligne = element('p', 'rappel-mot');
    ligne.appendChild(element('b', null, entree.mot));
    bloc.appendChild(ligne);
    bloc.appendChild(element('p', 'rappel-sens', Exercices.traductions(entree)[0] || ''));

    const langueReponse = q.langueReponse || q.carte.langue;
    const variantes = (entree.variantes && entree.variantes[langueReponse]) || [];
    if (variantes.length) {
      const detail = element('p', 'rappel-variantes discret');
      detail.appendChild(element('span', null, I18n.t('conv.variantes.acceptees') + ' '));
      detail.appendChild(document.createTextNode(variantes.join(' · ')));
      bloc.appendChild(detail);
    }

    const ouvrir = element('button', 'lien-discret', I18n.t('conv.voir-phrase'));
    ouvrir.type = 'button';
    ouvrir.addEventListener('click', () => App.ouvrirFiche({ conversation: entree.conversation }));
    bloc.appendChild(ouvrir);

    if (racine.Notes) {
      const pourQui = question;
      Notes.rappel(entree).then((rappel) => {
        if (rappel && question === pourQui) bloc.appendChild(rappel);
      }).catch(() => {});
    }
  }

  function avancer() {
    position += 1;
    poser();
  }

  // ── Fin de séance ─────────────────────────────────────────────────────────

  async function terminer() {
    elements.seance.hidden = true;
    elements.bilan.hidden = false;
    elements.jauge.style.width = '100%';

    vider(elements.bilanChiffres);
    for (const [cle, valeur, classe] of [
      ['reviser.bilan.justes', bilan.justes, 'bien'],
      ['reviser.bilan.presque', bilan.presque, 'moyen'],
      ['reviser.bilan.faux', bilan.faux, 'mal'],
    ]) {
      const bloc = element('div', 'compteur ' + classe);
      bloc.appendChild(element('span', 'chiffre', String(valeur)));
      bloc.appendChild(element('span', 'etiquette-compteur', I18n.t(cle)));
      elements.bilanChiffres.appendChild(bloc);
    }
    elements.bilanMot.textContent = I18n.n('reviser.bilan.mots', bilan.mots.size);

    if (!regime.enregistrer) {
      /* En atelier, « continuer » n'a pas de sens : il n'y a pas de file du
       * jour à reprendre. On propose de refaire le même atelier, ce que le
       * bouton de reprise sait faire. */
      elements.continuer.hidden = !regime.reprendre;
      return;
    }
    const comptes = await Revision.compter();
    const faites = await Revision.nouveautesDuJour();
    const reste = comptes.dues + Math.max(0, Math.min(quota - faites, comptes.nouvelles));
    elements.continuer.hidden = reste === 0;
  }

  // ── Mise en place ─────────────────────────────────────────────────────────

  function brancher(reglages) {
    quota = reglages.nouveautesParJour || 10;
    Object.assign(elements, {
      accueil: $('#revision-accueil'),
      libre: $('#seance-libre'),
      compteurs: $('#revision-compteurs'),
      commencer: $('#b-commencer'),
      vide: $('#revision-vide'),
      avance: $('#revision-avance'),
      seance: $('#seance'),
      jauge: $('#seance-jauge'),
      consigne: $('#seance-consigne'),
      enonce: $('#seance-enonce'),
      zone: $('#seance-zone'),
      verdict: $('#seance-verdict'),
      verdictTexte: $('#verdict-texte'),
      verdictRemarque: $('#verdict-remarque'),
      verdictFiche: $('#verdict-fiche'),
      verdictBoutons: $('#verdict-boutons'),
      bilan: $('#seance-bilan'),
      bilanChiffres: $('#bilan-chiffres'),
      bilanMot: $('#bilan-mot'),
      continuer: $('#b-continuer'),
      terminerBouton: $('#b-terminer'),
      arreter: $('#b-arreter'),
      versRecherche: $('#b-vers-recherche'),
    });

    elements.commencer.addEventListener('click', commencer);
    elements.arreter.addEventListener('click', arreter);
    elements.continuer.addEventListener('click', () => {
      if (!regime.enregistrer && regime.reprendre) regime.reprendre();
      else commencer();
    });
    elements.terminerBouton.addEventListener('click', arreter);
    elements.versRecherche.addEventListener('click', () => App.basculer('chercher'));
  }

  racine.Seance = { brancher, rafraichir, commencer, lancer, arreter,
                    get quota() { return quota; },
                    set quota(v) { quota = v; } };

})(window);
