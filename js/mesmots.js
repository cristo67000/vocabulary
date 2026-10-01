'use strict';
/*
 * « Mes mots » — le formulaire d'ajout, et la liste de ce qu'on a ajouté.
 *
 * ── Où l'on ajoute un mot ──────────────────────────────────────────────────
 *
 * Là où l'on constate qu'il manque : sous une recherche restée vide. C'est le
 * seul endroit où l'on sait avec certitude que le mot n'y est pas, et le seul
 * moment où on l'a encore en tête, correctement orthographié, dans le champ.
 * Le formulaire s'ouvre donc prérempli de ce qui a été tapé, et devine la
 * langue plutôt que de la demander : un mot accentué est français, un mot en
 * « -ing », « -ght » ou porteur d'un « w » ou d'un « k » est anglais neuf fois
 * sur dix. La devinette est un point de
 * départ affiché, jamais une décision cachée — les deux boutons sont là, et
 * l'un des deux est déjà choisi.
 *
 * ── Ce qu'on demande, et ce qu'on ne demande pas ───────────────────────────
 *
 * Trois champs obligatoires : le mot, sa langue, une traduction. Tout le reste
 * est replié sous « Détails ». Un formulaire de onze champs devant quelqu'un
 * qui veut noter un mot entendu au marché est un formulaire qu'on ne remplit
 * pas ; et l'application sait s'adapter à ce qui manque — pas de genre, pas de
 * question de genre.
 *
 * ── Le doublon, et ce qu'on en fait ────────────────────────────────────────
 *
 * Si le mot existe déjà — au dictionnaire ou dans ses propres entrées — on le
 * dit, et on propose d'ouvrir la fiche existante. On ne bloque pas pour autant :
 * ajouter « release » avec sa propre traduction, celle du métier qu'on
 * exerce, est un besoin légitime. Les deux entrées coexistent, chacune avec
 * ses cartes et sa note ; le dictionnaire n'est jamais écrasé.
 *
 * ── Supprimer ──────────────────────────────────────────────────────────────
 *
 * Sans confirmation quand il n'y a rien à perdre, avec confirmation quand le
 * mot est appris ou porte une note — et dans les deux cas avec une annulation
 * qui rend tout à l'identique : l'entrée, ses cartes avec leur intervalle et
 * leur facilité, et sa note. C'est la règle que « Mes révisions » suit déjà
 * pour le retrait d'un mot, et il n'y a pas de raison d'en avoir deux.
 */
(function (racine) {

  const $ = (selecteur) => document.querySelector(selecteur);

  const elements = {};
  let branche = false;
  let filtre = '';
  let retrait = null;          // { retrait, mot } en attente d'annulation
  let formulaire = null;

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined && texte !== null) noeud.textContent = texte;
    return noeud;
  }

  /* La langue la plus probable pour ce qui vient d'être tapé.
   *
   * Un accent désigne le français ; les graphies que le français n'a guère —
   * « w », « k », « th », « sh », les finales « -ing », « -ght », « -y » —
   * désignent l'anglais. À défaut, l'anglais : c'est la langue qu'on apprend,
   * et le mot qu'on ne trouve pas est le plus souvent un mot anglais
   * rencontré quelque part. Ce n'est qu'un préréglage : les deux boutons
   * restent là. */
  function langueProbable(saisie) {
    const texte = String(saisie || '').trim().toLowerCase();
    if (!texte) return 'en';
    if (/[àâçéèêëîïôûùœ]/.test(texte)) return 'fr';
    if (/[wk]|th|sh|ing\b|ght\b|y\b|ee|oo/.test(texte)) return 'en';
    if (/(eau|eux|oir|ette|ment|tion|que|ais|ait)\b/.test(texte)) return 'fr';
    return 'en';
  }

  // ── Le formulaire ─────────────────────────────────────────────────────────

  function champTexte(nom, cle, valeur, options) {
    const reglages = options || {};
    const bloc = element('label', 'champ-perso');
    bloc.appendChild(element('span', null, I18n.t(cle)));
    const saisie = element(reglages.lignes ? 'textarea' : 'input', 'saisie-perso');
    if (reglages.lignes) saisie.rows = reglages.lignes;
    else saisie.type = 'text';
    saisie.name = nom;
    saisie.value = valeur || '';
    saisie.autocomplete = 'off';
    saisie.autocapitalize = reglages.majuscules ? 'sentences' : 'off';
    saisie.spellcheck = false;
    saisie.maxLength = reglages.max || Perso.MOT_MAX;
    if (reglages.aide) saisie.placeholder = I18n.t(reglages.aide);
    bloc.appendChild(saisie);
    if (reglages.note) bloc.appendChild(element('span', 'discret', I18n.t(reglages.note)));
    return { bloc, saisie };
  }

  function segments(nom, valeurs, choisi, etiquette) {
    const groupe = element('div', 'segments');
    groupe.setAttribute('role', 'group');
    groupe.dataset.champ = nom;
    for (const valeur of valeurs) {
      const bouton = element('button', null, etiquette(valeur));
      bouton.type = 'button';
      bouton.dataset.valeur = valeur;
      bouton.setAttribute('aria-pressed', String(valeur === choisi));
      bouton.addEventListener('click', () => {
        for (const autre of groupe.querySelectorAll('button')) {
          autre.setAttribute('aria-pressed', String(autre === bouton));
        }
        groupe.dispatchEvent(new CustomEvent('choix', { detail: valeur, bubbles: true }));
      });
      groupe.appendChild(bouton);
    }
    return groupe;
  }

  function choixDe(groupe) {
    const actif = groupe.querySelector('[aria-pressed="true"]');
    return actif ? actif.dataset.valeur : '';
  }

  /* Ouvre le formulaire. `options` accepte :
   *   uid                 modifier une entrée existante
   *   saisie              préremplir le mot (une recherche restée vide)
   *   langue              préremplir la langue
   *   surEnregistrement   rappel après un enregistrement réussi
   */
  function ouvrirFormulaire(options) {
    brancher();
    const reglages = options || {};
    const existant = reglages.uid ? Perso.brut(reglages.uid) : null;
    const depart = existant || {
      mot: Perso.assainir(reglages.saisie || '', Perso.MOT_MAX),
      langue: reglages.langue || langueProbable(reglages.saisie),
      nature: '', genre: '', traductions: [], formes: [],
      pluriel: '', exemple: '', exempleTraduit: '',
    };

    const hote = elements.formulaire;
    hote.textContent = '';
    formulaire = { uid: existant ? existant.id : null,
                   surEnregistrement: reglages.surEnregistrement || null };

    const tete = element('div', 'fiche-tete');
    const fermer = element('button', 'fiche-fermer', I18n.t('fiche.fermer'));
    fermer.type = 'button';
    fermer.addEventListener('click', fermerFormulaire);
    tete.appendChild(fermer);
    hote.appendChild(tete);

    hote.appendChild(element('h2', null,
      I18n.t(existant ? 'perso.titre.modifier' : 'perso.titre.ajouter')));

    const corps = element('div', 'formulaire-perso');
    hote.appendChild(corps);

    const mot = champTexte('mot', 'perso.champ.mot', depart.mot,
      { aide: 'perso.champ.mot.aide', majuscules: true });
    corps.appendChild(mot.bloc);

    const ligneLangue = element('div', 'champ-perso');
    ligneLangue.appendChild(element('span', null, I18n.t('perso.champ.langue')));
    const boutonsLangue = segments('langue', ['en', 'fr'], depart.langue,
      (v) => I18n.t('langue.' + v));
    ligneLangue.appendChild(boutonsLangue);
    corps.appendChild(ligneLangue);

    const traductions = champTexte('traductions', 'perso.champ.traductions',
      (depart.traductions || []).join(', '),
      { aide: 'perso.champ.traductions.aide', note: 'perso.champ.traductions.note',
        max: 400 });
    corps.appendChild(traductions.bloc);

    /* Plusieurs mots : expression usuelle, ou nom composé ? On le demande, on
     * ne le devine pas — « base de données » a trois mots et reste un nom,
     * « I can't be bothered » en a quatre et se cherche par « bothered ». La
     * question n'apparaît que quand le mot a plusieurs morceaux, et ne change
     * rien aux cartes déjà créées : elle vaut pour la suite. */
    const ligneExpression = element('div', 'champ-perso');
    ligneExpression.appendChild(element('span', null, I18n.t('perso.champ.expression')));
    const boutonsExpression = segments('expression', ['non', 'oui'],
      Perso.estExpression(depart) ? 'oui' : 'non',
      (v) => I18n.t(v === 'oui' ? 'commun.oui' : 'commun.non'));
    ligneExpression.appendChild(boutonsExpression);
    ligneExpression.appendChild(element('span', 'discret',
      I18n.t('perso.champ.expression.note')));
    corps.appendChild(ligneExpression);
    function montrerExpression() {
      ligneExpression.hidden = !/\s/.test(mot.saisie.value.trim());
    }
    mot.saisie.addEventListener('input', montrerExpression);
    montrerExpression();

    // ── Ce qui est facultatif se replie ────────────────────────────────────
    const details = element('details', 'perso-details');
    details.appendChild(element('summary', null, I18n.t('perso.details')));

    const ligneNature = element('div', 'champ-perso');
    ligneNature.appendChild(element('span', null, I18n.t('perso.champ.nature')));
    const boutonsNature = segments('nature', Perso.NATURES, depart.nature || '',
      (v) => (v ? nomDeNature(v) : I18n.t('perso.aucun')));
    boutonsNature.classList.add('segments-souples');
    ligneNature.appendChild(boutonsNature);
    details.appendChild(ligneNature);

    const ligneGenre = element('div', 'champ-perso');
    ligneGenre.appendChild(element('span', null, I18n.t('perso.champ.genre')));
    const hoteGenre = element('div');
    ligneGenre.appendChild(hoteGenre);
    const aideGenre = element('span', 'discret', I18n.t('perso.champ.genre.note'));
    ligneGenre.appendChild(aideGenre);
    details.appendChild(ligneGenre);

    let boutonsGenre = null;
    function redessinerGenre() {
      const langue = choixDe(boutonsLangue);
      const nature = choixDe(boutonsNature);
      hoteGenre.textContent = '';
      // Le genre ne se demande que pour un nom français : l'anglais n'en a pas.
      if (nature !== 'n' || langue !== 'fr') {
        ligneGenre.hidden = true;
        boutonsGenre = null;
        return;
      }
      ligneGenre.hidden = false;
      const choisi = boutonsGenre ? choixDe(boutonsGenre) : (depart.genre || '');
      const possibles = Perso.GENRES[langue] || [''];
      boutonsGenre = segments('genre', possibles,
        possibles.indexOf(choisi) !== -1 ? choisi : '',
        (v) => (v ? (Exercices.ARTICLES[langue] && Exercices.ARTICLES[langue][v])
                    || I18n.t('genre.' + v) : I18n.t('perso.aucun')));
      hoteGenre.appendChild(boutonsGenre);
    }
    boutonsNature.addEventListener('choix', redessinerGenre);
    boutonsLangue.addEventListener('choix', redessinerGenre);
    redessinerGenre();

    const pluriel = champTexte('pluriel', 'perso.champ.pluriel', depart.pluriel,
      { note: 'perso.champ.pluriel.note' });
    details.appendChild(pluriel.bloc);

    const formes = champTexte('formes', 'perso.champ.formes',
      (depart.formes || []).join(', '), { note: 'perso.champ.formes.note', max: 300 });
    details.appendChild(formes.bloc);

    const exemple = champTexte('exemple', 'perso.champ.exemple', depart.exemple,
      { lignes: 2, max: Perso.EXEMPLE_MAX, majuscules: true,
        note: 'perso.champ.exemple.note' });
    details.appendChild(exemple.bloc);

    const exempleTraduit = champTexte('exempleTraduit', 'perso.champ.exemple-traduit',
      depart.exempleTraduit, { lignes: 2, max: Perso.EXEMPLE_MAX, majuscules: true });
    details.appendChild(exempleTraduit.bloc);

    corps.appendChild(details);

    /* La note se saisit ici pour une entrée neuve — l'écrire au moment où l'on
     * ajoute le mot est le seul moment où l'on s'en souvient. Sur une entrée
     * existante, elle se modifie depuis sa fiche, qui est faite pour ça. */
    let note = null;
    if (!existant) {
      note = champTexte('note', 'notes.titre', '',
        { lignes: 3, max: 2000, majuscules: true, aide: 'notes.exemple' });
      corps.appendChild(note.bloc);
    }

    const avis = element('div', 'perso-avis discret');
    avis.hidden = true;
    corps.appendChild(avis);

    const boutons = element('div', 'ligne-boutons');
    const valider = element('button', 'bouton-principal',
      I18n.t(existant ? 'perso.enregistrer' : 'perso.ajouter'));
    valider.type = 'button';
    const annuler = element('button', 'bouton-discret', I18n.t('notes.annuler'));
    annuler.type = 'button';
    annuler.addEventListener('click', fermerFormulaire);
    boutons.appendChild(valider);
    boutons.appendChild(annuler);
    corps.appendChild(boutons);

    /* L'avis, et le geste qu'il propose.
     *
     * Signaler un doublon sans donner de quoi aller voir l'entrée existante
     * oblige à fermer le formulaire, chercher le mot, revenir : trois gestes
     * pour une vérification. Le bouton est donc là, à côté du message, et il
     * n'interdit rien — on peut le lire et continuer d'ajouter son entrée.
     * `ouvrir` est une fonction qui rend le résultat à afficher, ou rien. */
    function dire(cle, valeurs, ouvrir) {
      avis.textContent = '';
      avis.hidden = !cle;
      if (!cle) return;
      avis.appendChild(element('span', null, I18n.t(cle, valeurs)));
      if (!ouvrir) return;
      const voir = element('button', 'lien-discret', I18n.t('perso.doublon.voir'));
      voir.type = 'button';
      voir.addEventListener('click', () => {
        const trouve = ouvrir();
        if (!trouve) return;
        fermerFormulaire();
        App.ouvrirFiche(trouve);
      });
      avis.appendChild(voir);
    }

    /* Prévenir d'un doublon, sans interdire. On regarde à la frappe : arriver
     * au bout du formulaire pour apprendre que le mot existait déjà serait une
     * perte de temps, et personne ne recommence. */
    function verifierDoublon() {
      const graphie = Perso.assainir(mot.saisie.value, Perso.MOT_MAX);
      const langue = choixDe(boutonsLangue);
      if (!graphie) { dire(null); return; }
      const miens = Perso.memeCle(langue, graphie, formulaire.uid);
      if (miens.length) {
        dire('perso.doublon.perso', { mot: miens[0].mot },
             () => Perso.resultat(miens[0], true, null));
        return;
      }
      const trouve = Lexique.resoudre(graphie, langue);
      if (trouve && Lexique.cle(trouve.mot) === Lexique.cle(graphie)) {
        dire('perso.doublon.dico', { mot: trouve.mot }, () => trouve);
        return;
      }
      dire(null);
    }
    mot.saisie.addEventListener('input', verifierDoublon);
    boutonsLangue.addEventListener('choix', verifierDoublon);
    verifierDoublon();

    valider.addEventListener('click', async () => {
      const donnees = {
        mot: mot.saisie.value,
        langue: choixDe(boutonsLangue),
        traductions: traductions.saisie.value,
        nature: choixDe(boutonsNature),
        genre: boutonsGenre ? choixDe(boutonsGenre) : '',
        expression: choixDe(boutonsExpression) === 'oui',
        pluriel: pluriel.saisie.value,
        formes: formes.saisie.value,
        exemple: exemple.saisie.value,
        exempleTraduit: exempleTraduit.saisie.value,
      };
      const controle = Perso.normaliser(donnees);
      if (!controle.valide) {
        dire('perso.manque.' + controle.manques[0]);
        (controle.manques[0] === 'traductions' ? traductions : mot).saisie.focus();
        return;
      }
      valider.disabled = true;
      try {
        const enregistre = formulaire.uid
          ? await Perso.modifier(formulaire.uid, donnees)
          : await Perso.creer(donnees);
        if (note && note.saisie.value.trim()) {
          await Notes.ecrire({ perso: enregistre.id, langue: enregistre.langue,
                               mot: enregistre.mot }, note.saisie.value);
        }
        const rappel = formulaire.surEnregistrement;
        fermerFormulaire();
        await dessiner();
        if (racine.App) App.chercher();
        if (rappel) rappel(enregistre);
        else App.ouvrirFiche(Perso.resultat(enregistre, true, null));
      } finally {
        valider.disabled = false;
      }
    });

    elements.panneau.hidden = false;
    elements.panneau.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    mot.saisie.focus();
    if (mot.saisie.value) mot.saisie.setSelectionRange(0, mot.saisie.value.length);
  }

  function fermerFormulaire() {
    if (!elements.panneau) return;
    elements.panneau.hidden = true;
    elements.formulaire.textContent = '';
    document.body.style.overflow = '';
    formulaire = null;
  }

  function nomDeNature(code) {
    const texte = I18n.t('nature.' + code);
    return texte.startsWith('‹') ? code : texte;
  }

  // ── Supprimer, avec les égards qui conviennent ────────────────────────────

  /* Rend true si la suppression a bien eu lieu.
   *
   * On ne demande confirmation que lorsqu'il y a quelque chose à perdre : des
   * révisions engagées, ou une note. Demander « êtes-vous sûr ? » pour une
   * entrée créée il y a dix secondes et jamais révisée n'apprend rien à
   * personne et use la question au point qu'on ne la lit plus. */
  async function supprimerAvecEgards(uid) {
    const enregistrement = Perso.brut(uid);
    if (!enregistrement) return false;
    const cartes = await Store.cartesDuMot(null, null, uid).catch(() => []);
    const note = await Store.lireNote('perso:' + uid).catch(() => null);
    const engagees = cartes.filter((c) => c.etat !== 'nouveau').length;

    if (engagees || note) {
      const details = [];
      if (engagees) details.push(I18n.n('perso.supprimer.cartes', engagees));
      if (note) details.push(I18n.t('perso.supprimer.note'));
      const message = I18n.t('perso.supprimer.confirme', {
        mot: enregistrement.mot, details: details.join(I18n.t('perso.et')),
      });
      if (!racine.confirm(message)) return false;
    }

    retrait = { retrait: await Perso.supprimer(uid), mot: enregistrement.mot };
    await dessiner();
    if (racine.Seance) await Seance.rafraichir();
    if (racine.App) App.chercher();
    const annuler = elements.liste && elements.liste.querySelector('[data-annuler]');
    if (annuler) annuler.focus();
    return true;
  }

  async function annulerSuppression() {
    if (!retrait) return;
    await Perso.remettre(retrait.retrait);
    retrait = null;
    await dessiner();
    if (racine.Seance) await Seance.rafraichir();
    if (racine.App) App.chercher();
  }

  // ── La liste ──────────────────────────────────────────────────────────────

  function ligne(enregistrement, appris) {
    const li = element('li');
    const corps = element('button', 'suivi-mot');
    corps.type = 'button';
    corps.addEventListener('click', () =>
      App.ouvrirFiche(Perso.resultat(enregistrement, true, null)));
    corps.appendChild(element('span', 'pastille',
      I18n.t('langue.' + enregistrement.langue + '.court')));
    corps.appendChild(element('span', 'mot', enregistrement.mot));
    corps.appendChild(element('span', 'traduction',
      enregistrement.traductions.slice(0, 3).join(', ')));
    li.appendChild(corps);

    if (appris) {
      li.appendChild(element('span', 'suivi-quand', I18n.t('perso.appris')));
    }

    const modifier = element('button', 'retirer', '✎');
    modifier.type = 'button';
    modifier.setAttribute('aria-label',
      I18n.t('perso.modifier.aria', { mot: enregistrement.mot }));
    modifier.addEventListener('click', () => ouvrirFormulaire({ uid: enregistrement.id }));
    li.appendChild(modifier);

    const supprimer = element('button', 'retirer', '✕');
    supprimer.type = 'button';
    supprimer.setAttribute('aria-label',
      I18n.t('perso.supprimer.aria', { mot: enregistrement.mot }));
    supprimer.addEventListener('click', () => supprimerAvecEgards(enregistrement.id));
    li.appendChild(supprimer);
    return li;
  }

  function ligneRetiree() {
    const li = element('li', 'suivi-retrait');
    li.appendChild(element('span', 'suivi-retire',
      I18n.t('perso.supprime', { mot: retrait.mot })));
    const annuler = element('button', 'lien-discret', I18n.t('suivis.annuler'));
    annuler.type = 'button';
    annuler.dataset.annuler = '1';
    annuler.addEventListener('click', annulerSuppression);
    li.appendChild(annuler);
    return li;
  }

  async function dessiner() {
    brancher();
    if (!elements.liste) return;

    const tous = Perso.liste();
    const cartes = await Store.toutesLesCartes().catch(() => []);
    const apprises = new Set(cartes.filter((c) => c.perso).map((c) => c.perso));

    elements.compte.textContent = I18n.n('perso.compte', tous.length);
    elements.vide.hidden = tous.length > 0 || !!retrait;
    elements.champ.hidden = tous.length < 8;

    const retenus = filtre
      ? tous.filter((m) => Lexique.cle(m.mot).indexOf(filtre) !== -1
          || m.traductions.some((t) => Lexique.cle(t).indexOf(filtre) !== -1))
      : tous;

    elements.liste.textContent = '';
    if (retrait) elements.liste.appendChild(ligneRetiree());
    for (const enregistrement of retenus) {
      elements.liste.appendChild(ligne(enregistrement, apprises.has(enregistrement.id)));
    }
    elements.rien.hidden = retenus.length > 0 || tous.length === 0;
  }

  /* Les annulations ne valent que le temps qu'on reste devant la liste — comme
   * pour le retrait d'un mot suivi. Quitter la vue vaut acceptation. */
  function reinitialiser() {
    retrait = null;
    filtre = '';
    if (elements.champ) elements.champ.value = '';
  }

  function brancher() {
    if (branche) return;
    branche = true;
    Object.assign(elements, {
      panneau: $('#panneau-perso'),
      formulaire: $('#formulaire-perso'),
      liste: $('#perso-liste'),
      compte: $('#perso-compte'),
      champ: $('#perso-filtre'),
      vide: $('#perso-vide'),
      rien: $('#perso-rien'),
      ajouter: $('#b-ajouter-mot'),
    });
    if (elements.champ) {
      elements.champ.addEventListener('input', () => {
        filtre = Lexique.cle(elements.champ.value);
        dessiner();
      });
    }
    if (elements.ajouter) {
      elements.ajouter.addEventListener('click', () => ouvrirFormulaire({}));
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.panneau && !elements.panneau.hidden) {
        fermerFormulaire();
      }
    });
  }

  racine.MesMots = {
    brancher, dessiner, reinitialiser,
    ouvrirFormulaire, fermerFormulaire,
    supprimerAvecEgards, langueProbable,
  };

})(window);
