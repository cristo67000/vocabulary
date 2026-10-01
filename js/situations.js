'use strict';
/*
 * « Phrases et dialogues » — l'écran, les fiches, les formulaires.
 *
 * ── Ce qu'on y fait ────────────────────────────────────────────────────────
 *
 * Parcourir par situation, chercher un mot dans les deux langues, ouvrir une
 * phrase — l'écouter dans chaque langue, l'apprendre, y mettre une note —,
 * ouvrir un dialogue — l'écouter d'une traite avec une pause entre les
 * répliques, masquer les traductions, jouer l'un des deux rôles —, et écrire
 * ses propres phrases et dialogues. Le modèle est dans `conversation.js` ; ici
 * il n'y a que de l'affichage et des gestes.
 *
 * ── La langue principale ───────────────────────────────────────────────────
 *
 * Chaque phrase se lit dans une langue en grand et dans l'autre en dessous.
 * Laquelle en grand est un réglage — la langue qu'on apprend, d'ordinaire,
 * c'est-à-dire l'autre que celle de l'interface —, commutable d'un geste et
 * retenu d'une fois sur l'autre. Les traductions se masquent d'un second
 * geste : c'est le premier exercice, avant tout planificateur.
 *
 * ── Jouer un rôle ne note rien ─────────────────────────────────────────────
 *
 * Choisir A ou B masque ses propres répliques, qu'on révèle une à une. C'est
 * un entraînement libre : aucune carte n'est écrite, aucune échéance ne
 * bouge, rien n'est journalisé. Le planificateur ne doit rien croire d'une
 * réplique lue à haute voix devant son téléphone.
 *
 * ── Les fiches vivent dans le volet des fiches ─────────────────────────────
 *
 * Une phrase ou un dialogue s'ouvre dans `#fiche`, comme un mot : même volet,
 * même bouton Fermer, même touche Échap, même arrêt de la voix à la fermeture.
 * C'est `App.ouvrirFiche` et `App.ouvrirPanneau` qui prêtent le volet.
 */
(function (racine) {

  const $ = (selecteur) => document.querySelector(selecteur);

  const elements = {};
  let branche = false;
  let reglages = null;
  let retrait = null;            // { retrait, texte } en attente d'annulation
  let formulaire = null;
  let lecture = null;            // la suite de répliques en cours, s'il y en a une

  /* L'état de l'écran. La langue principale et l'affichage des traductions
   * sont des réglages ; le reste ne vaut que le temps d'une visite. */
  const etat = {
    saisie: '',
    type: 'tout',                // 'tout' | 'phrase' | 'dialogue'
    theme: null,                 // null = toutes
    langue: null,                // 'fr' | 'en' — null tant que les réglages ne sont pas lus
    traductions: true,
  };

  const PAUSE_ENTRE_REPLIQUES = 900;
  const SILENCE_DE_MON_TOUR = 2200;

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined && texte !== null) noeud.textContent = texte;
    return noeud;
  }

  function autre(langue) {
    return langue === 'en' ? 'fr' : 'en';
  }

  function langueParDefaut() {
    return I18n.langue === 'en' ? 'fr' : 'en';
  }

  function languePrincipale() {
    if (!etat.langue) {
      etat.langue = (reglages && (reglages.conversationLangue === 'fr'
                                  || reglages.conversationLangue === 'en'))
        ? reglages.conversationLangue : langueParDefaut();
    }
    return etat.langue;
  }

  function nomDuTheme(id) {
    const t = Conversation.theme(id);
    if (t) return Conversation.texte(t, I18n.langue);
    return I18n.t('conv.theme.autre');
  }

  function texteDe(objet, langue) {
    return Conversation.texte(objet, langue);
  }

  // ── Les petits blocs qu'on réemploie ──────────────────────────────────────

  function pastille(cle, classe) {
    return element('span', 'pastille' + (classe ? ' ' + classe : ''), I18n.t(cle));
  }

  function badgeRegistre(registre) {
    if (!registre) return null;
    return element('span', 'conv-registre ' + registre, I18n.t('conv.registre.' + registre));
  }

  function boutonEcouter(texte, langue, options) {
    const reglagesBouton = options || {};
    const bouton = element('button', reglagesBouton.classe || 'ecouter',
      (reglagesBouton.court ? '▸' : '▸ ' + I18n.t('conv.ecouter.' + langue)));
    bouton.type = 'button';
    bouton.setAttribute('aria-label', I18n.t('conv.ecouter.' + langue));
    /* Grisé sans voix de la langue, repeint quand la liste des voix arrive. */
    Voix.brancherBouton(bouton, langue);
    bouton.addEventListener('click', (e) => {
      e.stopPropagation();
      Voix.dire(Conversation.texteParle(texte), langue);
    });
    return bouton;
  }

  /* Le bouton qui met une phrase dans les révisions — même geste que sur la
   * fiche d'un mot, même état affiché. `entree` porte l'identifiant
   * canonique : apprendre une réplique qui reprend une phrase listée touche
   * les cartes de cette phrase, et les deux boutons disent la même chose. */
  function boutonApprendre(entree, court) {
    const bouton = element('button', court ? 'conv-apprendre-court' : 'apprendre');
    bouton.type = 'button';

    function peindre(suivi) {
      bouton.textContent = I18n.t(court
        ? (suivi ? 'conv.appris.court' : 'conv.apprendre.court')
        : (suivi ? 'fiche.appris' : 'conv.apprendre'));
      bouton.classList.toggle('suivi', suivi);
      bouton.dataset.suivi = suivi ? '1' : '0';
    }
    peindre(false);
    Revision.estAppris(entree.langue, entree.mot, null, entree.conversation)
      .then(peindre).catch(() => {});

    bouton.addEventListener('click', async (e) => {
      e.stopPropagation();
      bouton.disabled = true;
      try {
        if (bouton.dataset.suivi === '1') {
          await Revision.oublier(entree.langue, entree.mot, null, entree.conversation);
          peindre(false);
        } else {
          await Revision.apprendre(entree);
          peindre(true);
        }
        if (racine.Seance) Seance.rafraichir();
      } finally {
        bouton.disabled = false;
      }
    });
    return bouton;
  }

  /* D'où vient le texte, et qui l'a relu. Trois cas, jamais confondus : écrit
   * par soi ; fourni et validé en anglais par une personne de langue maternelle anglaise (les
   * dialogues de la version 3.2) ; fourni et non relu — le reste, phrases
   * isolées comprises. */
  function ligneProvenance(origine, relu) {
    let cle = 'conv.provenance.fourni';
    if (origine === 'perso') cle = 'conv.provenance.perso';
    else if (relu && relu.en === 'natif') cle = 'conv.provenance.fourni.relu-en';
    return element('p', 'discret conv-provenance', I18n.t(cle));
  }

  /* Les expressions usuelles du dictionnaire que la phrase contient : une
   * passerelle vers leur fiche — sens, équivalents, cartes à part. Rien
   * n'est affiché quand il n'y a rien. */
  function sectionExpressions(entree, langue) {
    const liste = Conversation.expressionsDans(entree.conversation, langue);
    if (!liste.length) return null;
    const section = element('section', 'conv-section expressions-usuelles');
    section.appendChild(element('h3', null, I18n.t('fiche.expressions')));
    const ul = element('ul');
    for (const resultat of liste) {
      const li = element('li');
      const bouton = element('button', 'expression-ligne');
      bouton.type = 'button';
      bouton.appendChild(element('span', 'pastille', I18n.t('langue.' + resultat.langue + '.court')));
      bouton.appendChild(element('span', 'mot', resultat.mot));
      if (resultat.apercu) {
        bouton.appendChild(element('span', 'traduction', resultat.apercu));
      } else {
        bouton.classList.add('sans-equivalent');
        bouton.appendChild(element('span', 'traduction discret', I18n.t('expression.sans-equivalent')));
      }
      bouton.addEventListener('click', () => App.ouvrirFiche(resultat));
      li.appendChild(bouton);
      ul.appendChild(li);
    }
    section.appendChild(ul);
    section.appendChild(element('p', 'discret', I18n.t('conv.expressions.note')));
    return section;
  }

  // ── L'écran principal ─────────────────────────────────────────────────────

  function segments(valeurs, choisie, libelle, surChoix) {
    const groupe = element('div', 'segments');
    groupe.setAttribute('role', 'group');
    for (const valeur of valeurs) {
      const bouton = element('button', null, libelle(valeur));
      bouton.type = 'button';
      bouton.setAttribute('aria-pressed', String(valeur === choisie));
      bouton.addEventListener('click', () => surChoix(valeur));
      groupe.appendChild(bouton);
    }
    return groupe;
  }

  function dessinerOutils() {
    const hote = elements.outils;
    hote.textContent = '';

    const types = element('div', 'conv-outil');
    types.appendChild(segments(['tout', 'phrase', 'dialogue'], etat.type,
      (v) => I18n.t('conv.type.' + v), (v) => { etat.type = v; dessinerListe(); }));
    hote.appendChild(types);

    const langues = element('div', 'conv-outil conv-outil-langue');
    langues.appendChild(element('span', 'conv-outil-titre', I18n.t('conv.langue')));
    langues.appendChild(segments(['fr', 'en'], languePrincipale(),
      (v) => I18n.t('langue.' + v), async (v) => {
        etat.langue = v;
        if (reglages) reglages.conversationLangue = v;
        await Store.ecrireReglage('conversationLangue', v).catch(() => {});
        dessinerOutils();
        dessinerListe();
        dessinerPerso();
      }));
    const bascule = element('label', 'bascule conv-bascule');
    const case_ = element('input');
    case_.type = 'checkbox';
    case_.checked = etat.traductions;
    case_.addEventListener('change', async () => {
      etat.traductions = case_.checked;
      if (reglages) reglages.conversationTraductions = etat.traductions;
      await Store.ecrireReglage('conversationTraductions', etat.traductions).catch(() => {});
      dessinerListe();
    });
    bascule.appendChild(case_);
    bascule.appendChild(element('span', null, I18n.t('conv.traductions')));
    langues.appendChild(bascule);
    hote.appendChild(langues);

    // Les situations, en pastilles qui passent à la ligne.
    const themes = element('div', 'conv-themes');
    const choisir = (id) => {
      etat.theme = id;
      for (const b of themes.querySelectorAll('button')) {
        b.setAttribute('aria-pressed', String((b.dataset.theme || null) === id));
      }
      dessinerListe();
    };
    const tous = element('button', 'conv-theme', I18n.t('conv.theme.tous'));
    tous.type = 'button';
    tous.setAttribute('aria-pressed', String(!etat.theme));
    tous.addEventListener('click', () => choisir(null));
    themes.appendChild(tous);
    const liste = Conversation.themes();
    if (Conversation.personnels().some((e) => e.theme === 'autre')) {
      liste.push({ id: 'autre' });
    }
    for (const t of liste) {
      const bouton = element('button', 'conv-theme', nomDuTheme(t.id));
      bouton.type = 'button';
      bouton.dataset.theme = t.id;
      bouton.setAttribute('aria-pressed', String(etat.theme === t.id));
      bouton.addEventListener('click', () => choisir(etat.theme === t.id ? null : t.id));
      themes.appendChild(bouton);
    }
    hote.appendChild(themes);
  }

  function lignePhrase(p, extrait) {
    const li = element('li');
    const bouton = element('button', 'conv-ligne');
    bouton.type = 'button';
    const langue = languePrincipale();
    const tete = element('div', 'conv-ligne-tete');
    tete.appendChild(element('span', 'conv-principal', texteDe(p, langue)));
    if (p.registre) tete.appendChild(badgeRegistre(p.registre));
    if (p.origine === 'perso') tete.appendChild(pastille('perso.marque', 'perso'));
    bouton.appendChild(tete);
    if (etat.traductions || extrait) {
      bouton.appendChild(element('span', 'conv-secondaire', texteDe(p, autre(langue))));
    }
    bouton.addEventListener('click', () => App.ouvrirFiche({ conversation: p.id }));
    li.appendChild(bouton);
    li.appendChild(boutonEcouter(texteDe(p, langue), langue, { court: true, classe: 'ecouter-phrase conv-ecoute-ligne' }));
    return li;
  }

  function ligneDialogue(d, replique) {
    const li = element('li');
    const bouton = element('button', 'conv-ligne conv-ligne-dialogue');
    bouton.type = 'button';
    const langue = languePrincipale();
    const tete = element('div', 'conv-ligne-tete');
    tete.appendChild(pastille('conv.marque.dialogue'));
    tete.appendChild(element('span', 'conv-principal', texteDe(d.titre, langue)));
    if (d.registre) tete.appendChild(badgeRegistre(d.registre));
    if (d.origine === 'perso') tete.appendChild(pastille('perso.marque', 'perso'));
    bouton.appendChild(tete);
    const detail = replique
      ? texteDe(replique, langue)
      : I18n.n('conv.repliques', d.repliques.length);
    bouton.appendChild(element('span', 'conv-secondaire', detail));
    bouton.addEventListener('click', () => ouvrirDialogue(d.id));
    li.appendChild(bouton);
    return li;
  }

  function dessinerListe() {
    const hote = elements.liste;
    hote.textContent = '';
    elements.rien.hidden = true;
    elements.indisponible.hidden = Conversation.disponible;

    if (etat.saisie) {
      const resultats = Conversation.chercher(etat.saisie, {
        type: etat.type === 'tout' ? null : etat.type, theme: etat.theme,
      });
      if (!resultats.length) { elements.rien.hidden = false; return; }
      const ul = element('ul', 'conv-liste');
      for (const r of resultats) {
        if (r.sorte === 'phrase') ul.appendChild(lignePhrase(Conversation.phrase(r.id), true));
        else ul.appendChild(ligneDialogue(Conversation.dialogue(r.id), r.replique));
      }
      hote.appendChild(ul);
      return;
    }

    const themes = Conversation.themes().map((t) => t.id).concat(['autre']);
    let rien = true;
    for (const id of themes) {
      if (etat.theme && etat.theme !== id) continue;
      const phrases = etat.type === 'dialogue' ? [] : Conversation.phrases((p) => p.theme === id);
      const dialogues = etat.type === 'phrase' ? [] : Conversation.dialogues((d) => d.theme === id);
      if (!phrases.length && !dialogues.length) continue;
      rien = false;
      const section = element('section', 'conv-theme-bloc');
      section.appendChild(element('h3', null, nomDuTheme(id)));
      const ul = element('ul', 'conv-liste');
      for (const p of phrases) ul.appendChild(lignePhrase(p));
      for (const d of dialogues) ul.appendChild(ligneDialogue(d));
      section.appendChild(ul);
      hote.appendChild(section);
    }
    elements.rien.hidden = !rien;
  }

  // ── Mes phrases et dialogues ──────────────────────────────────────────────

  function lignePersonnelle(enregistrement) {
    const li = element('li');
    const langue = languePrincipale();
    const corps = element('button', 'suivi-mot');
    corps.type = 'button';
    const estDialogue = enregistrement.sorte === 'dialogue';
    const texte = estDialogue ? enregistrement.titre : texteDe(enregistrement, langue);
    corps.appendChild(pastille(estDialogue ? 'conv.marque.dialogue' : 'conv.marque.phrase'));
    corps.appendChild(element('span', 'mot', texte));
    corps.appendChild(element('span', 'traduction', estDialogue
      ? I18n.n('conv.repliques', enregistrement.repliques.length)
      : texteDe(enregistrement, autre(langue))));
    corps.addEventListener('click', () => {
      if (estDialogue) ouvrirDialogue(enregistrement.id);
      else App.ouvrirFiche({ conversation: enregistrement.id });
    });
    li.appendChild(corps);

    const modifier = element('button', 'retirer', '✎');
    modifier.type = 'button';
    modifier.setAttribute('aria-label', I18n.t('conv.perso.modifier.aria', { texte }));
    modifier.addEventListener('click', () => (estDialogue
      ? ouvrirFormulaireDialogue({ id: enregistrement.id })
      : ouvrirFormulairePhrase({ id: enregistrement.id })));
    li.appendChild(modifier);

    const supprimer = element('button', 'retirer', '✕');
    supprimer.type = 'button';
    supprimer.setAttribute('aria-label', I18n.t('conv.perso.supprimer.aria', { texte }));
    supprimer.addEventListener('click', () => supprimerAvecEgards(enregistrement.id));
    li.appendChild(supprimer);
    return li;
  }

  function ligneRetiree() {
    const li = element('li', 'suivi-retrait');
    li.appendChild(element('span', 'suivi-retire',
      I18n.t('conv.perso.supprime', { texte: retrait.texte })));
    const annuler = element('button', 'lien-discret', I18n.t('suivis.annuler'));
    annuler.type = 'button';
    annuler.dataset.annuler = '1';
    annuler.addEventListener('click', annulerSuppression);
    li.appendChild(annuler);
    return li;
  }

  function dessinerPerso() {
    const liste = elements.persoListe;
    liste.textContent = '';
    const tous = Conversation.personnels();
    elements.persoVide.hidden = tous.length > 0 || !!retrait;
    if (retrait) liste.appendChild(ligneRetiree());
    for (const enregistrement of tous) liste.appendChild(lignePersonnelle(enregistrement));
  }

  /* Rend true si la suppression a eu lieu. Confirmation seulement s'il y a
   * quelque chose à perdre — des révisions engagées, une note —, et dans tous
   * les cas une annulation qui rend tout à l'identique. */
  async function supprimerAvecEgards(id) {
    const enregistrement = Conversation.brut(id);
    if (!enregistrement) return false;
    const cartes = (await Conversation.cartesDe(id)).filter((c) => c.conversation.startsWith(id));
    const engagees = cartes.filter((c) => c.etat !== 'nouveau').length;
    const idsNotes = enregistrement.sorte === 'dialogue'
      ? [id].concat(enregistrement.repliques.map((r) => id + '/' + r.id)) : [id];
    let notes = 0;
    for (const un of idsNotes) {
      if (await Store.lireNote('conv:' + un).catch(() => null)) notes += 1;
    }
    const texte = enregistrement.sorte === 'dialogue'
      ? enregistrement.titre : texteDe(enregistrement, languePrincipale());
    if (engagees || notes) {
      const details = [];
      if (engagees) details.push(I18n.n('perso.supprimer.cartes', engagees));
      if (notes) details.push(I18n.n('conv.perso.supprimer.notes', notes));
      const message = I18n.t('conv.perso.supprimer.confirme', {
        texte, details: details.join(I18n.t('perso.et')),
      });
      if (!racine.confirm(message)) return false;
    }
    retrait = { retrait: await Conversation.supprimer(id), texte };
    dessinerOutils();
    dessinerListe();
    dessinerPerso();
    if (racine.Seance) await Seance.rafraichir();
    if (racine.App) App.chercher();
    const annuler = elements.persoListe.querySelector('[data-annuler]');
    if (annuler) annuler.focus();
    return true;
  }

  async function annulerSuppression() {
    if (!retrait) return;
    await Conversation.remettre(retrait.retrait);
    retrait = null;
    dessinerOutils();
    dessinerListe();
    dessinerPerso();
    if (racine.Seance) await Seance.rafraichir();
    if (racine.App) App.chercher();
  }

  function dessiner() {
    brancher();
    if (!elements.vue) return;
    if (reglages && typeof reglages.conversationTraductions === 'boolean') {
      etat.traductions = reglages.conversationTraductions;
    }
    dessinerOutils();
    dessinerListe();
    dessinerPerso();
  }

  /* Les annulations ne valent que le temps qu'on reste devant la liste. */
  function reinitialiser() {
    retrait = null;
  }

  // ── La fiche d'une phrase ─────────────────────────────────────────────────

  function fiche(entree, surFermeture) {
    const bloc = document.createDocumentFragment();
    const langue = languePrincipale();
    const textes = { en: entree.mot, fr: Exercices.traductions(entree)[0] || '' };

    const tete = element('div', 'fiche-tete');
    const fermer = element('button', 'fiche-fermer', I18n.t('fiche.fermer'));
    fermer.type = 'button';
    fermer.addEventListener('click', surFermeture);
    tete.appendChild(fermer);
    bloc.appendChild(tete);

    const etiquettes = element('div', 'etiquettes');
    etiquettes.appendChild(pastille(entree.sorte === 'replique' ? 'conv.marque.replique' : 'conv.marque.phrase'));
    if (entree.theme) etiquettes.appendChild(element('span', 'etiquette', nomDuTheme(entree.theme)));
    if (entree.registre) etiquettes.appendChild(badgeRegistre(entree.registre));
    if (entree.origine === 'perso') etiquettes.appendChild(pastille('perso.marque', 'perso'));
    bloc.appendChild(etiquettes);

    /* Chaque mot de la phrase est cliquable, comme partout ailleurs : buter
     * sur « post office » dans « Where's the post office? » et ouvrir son cartouche est le
     * geste que le reste de l'application a rendu naturel. */
    for (const l of [langue, autre(langue)]) {
      const ligne = element('div', 'conv-fiche-texte ' + (l === langue ? 'principal' : 'secondaire'));
      ligne.appendChild(element('span', 'pastille', I18n.t('langue.' + l + '.court')));
      const p = element('p');
      p.appendChild(MotsVifs.tisser(textes[l], l, {}));
      ligne.appendChild(p);
      ligne.appendChild(boutonEcouter(textes[l], l, {}));
      bloc.appendChild(ligne);
    }

    bloc.appendChild(boutonApprendre(entree, false));

    const situation = entree.situation ? texteDe(entree.situation, I18n.langue) : '';
    if (situation) {
      const section = element('section', 'conv-section');
      section.appendChild(element('h3', null, I18n.t('conv.situation')));
      section.appendChild(element('p', null, situation));
      bloc.appendChild(section);
    }

    const variantes = entree.variantes || { fr: [], en: [] };
    if (variantes.fr.length || variantes.en.length) {
      const section = element('section', 'conv-section');
      section.appendChild(element('h3', null, I18n.t('conv.variantes')));
      const ul = element('ul', 'conv-variantes');
      for (const l of [langue, autre(langue)]) {
        for (const v of variantes[l] || []) {
          const li = element('li');
          li.appendChild(element('span', 'pastille', I18n.t('langue.' + l + '.court')));
          li.appendChild(element('span', null, v));
          li.appendChild(boutonEcouter(v, l, { court: true, classe: 'ecouter-phrase' }));
          ul.appendChild(li);
        }
      }
      section.appendChild(ul);
      section.appendChild(element('p', 'discret', I18n.t('conv.variantes.note')));
      bloc.appendChild(section);
    } else {
      bloc.appendChild(element('p', 'discret', I18n.t('conv.variantes.note')));
    }

    const dialogues = Conversation.dialoguesAvec(entree.conversation);
    if (dialogues.length) {
      const section = element('section', 'conv-section');
      section.appendChild(element('h3', null, I18n.t('conv.dans-dialogues')));
      const ul = element('ul', 'conv-liste');
      for (const d of dialogues) ul.appendChild(ligneDialogue(d));
      section.appendChild(ul);
      bloc.appendChild(section);
    }

    const expressions = sectionExpressions(entree, langue);
    if (expressions) bloc.appendChild(expressions);

    bloc.appendChild(ligneProvenance(entree.origine, entree.relu));
    if (racine.Notes) bloc.appendChild(Notes.construire(entree));

    if (entree.origine === 'perso' && Conversation.brut(entree.conversation)) {
      bloc.appendChild(boutonsPersonnels(entree.conversation, 'phrase', surFermeture));
    }
    return bloc;
  }

  function boutonsPersonnels(id, sorte, surFermeture) {
    const ligne = element('div', 'ligne-boutons perso-actions');
    const modifier = element('button', 'bouton-discret', I18n.t('conv.perso.modifier'));
    modifier.type = 'button';
    modifier.addEventListener('click', () => {
      const options = { id, surEnregistrement: () => { if (surFermeture) surFermeture(); } };
      if (sorte === 'dialogue') ouvrirFormulaireDialogue(options);
      else ouvrirFormulairePhrase(options);
    });
    const supprimer = element('button', 'lien-discret', I18n.t('conv.perso.supprimer'));
    supprimer.type = 'button';
    supprimer.addEventListener('click', async () => {
      const fait = await supprimerAvecEgards(id);
      if (fait && surFermeture) surFermeture();
    });
    ligne.appendChild(modifier);
    ligne.appendChild(supprimer);
    return ligne;
  }

  // ── Le dialogue ───────────────────────────────────────────────────────────

  function ouvrirDialogue(id) {
    const d = Conversation.dialogue(id);
    if (!d || !racine.App) return;
    App.ouvrirPanneau((fermer) => construireDialogue(d, fermer));
  }

  function arreterLecture() {
    if (lecture) {
      const l = lecture;
      lecture = null;
      l.arreter();
    }
  }

  function construireDialogue(d, surFermeture) {
    const bloc = document.createDocumentFragment();
    let langue = languePrincipale();
    let traductions = etat.traductions;
    let role = null;
    const revelees = new Set();
    const lignes = new Map();     // idComplet → élément

    const tete = element('div', 'fiche-tete');
    const fermer = element('button', 'fiche-fermer', I18n.t('fiche.fermer'));
    fermer.type = 'button';
    fermer.addEventListener('click', () => { arreterLecture(); surFermeture(); });
    tete.appendChild(fermer);
    bloc.appendChild(tete);

    const etiquettes = element('div', 'etiquettes');
    etiquettes.appendChild(pastille('conv.marque.dialogue'));
    etiquettes.appendChild(element('span', 'etiquette', nomDuTheme(d.theme)));
    if (d.registre) etiquettes.appendChild(badgeRegistre(d.registre));
    if (d.origine === 'perso') etiquettes.appendChild(pastille('perso.marque', 'perso'));
    bloc.appendChild(etiquettes);

    const titre = element('h2', 'conv-dialogue-titre');
    bloc.appendChild(titre);
    const sousTitre = element('p', 'discret conv-dialogue-sous-titre');
    bloc.appendChild(sousTitre);

    // ── Les commandes ──
    const commandes = element('div', 'conv-commandes');
    const ligneLangue = element('div', 'conv-outil conv-outil-langue');
    const hoteLangue = element('div');
    ligneLangue.appendChild(hoteLangue);
    const bascule = element('label', 'bascule conv-bascule');
    const case_ = element('input');
    case_.type = 'checkbox';
    case_.checked = traductions;
    case_.addEventListener('change', () => { traductions = case_.checked; redessinerLignes(); });
    bascule.appendChild(case_);
    bascule.appendChild(element('span', null, I18n.t('conv.traductions')));
    ligneLangue.appendChild(bascule);
    commandes.appendChild(ligneLangue);

    const ligneLecture = element('div', 'conv-outil');
    const ecouter = element('button', 'bouton-discret conv-ecouter-dialogue');
    ecouter.type = 'button';
    ligneLecture.appendChild(ecouter);
    const etatVoix = element('p', 'discret conv-etat-voix');
    commandes.appendChild(ligneLecture);
    commandes.appendChild(etatVoix);

    const ligneRole = element('div', 'conv-outil');
    ligneRole.appendChild(element('span', 'conv-outil-titre', I18n.t('conv.role')));
    const hoteRole = element('div');
    ligneRole.appendChild(hoteRole);
    commandes.appendChild(ligneRole);
    const noteRole = element('p', 'discret conv-note-role');
    noteRole.hidden = true;
    commandes.appendChild(noteRole);
    const toutReveler = element('button', 'lien-discret');
    toutReveler.type = 'button';
    toutReveler.hidden = true;
    commandes.appendChild(toutReveler);
    bloc.appendChild(commandes);

    const corps = element('div', 'conv-repliques');
    bloc.appendChild(corps);

    bloc.appendChild(ligneProvenance(d.origine, Conversation.relectureDe(d)));
    if (racine.Notes) {
      bloc.appendChild(Notes.construire({ conversation: d.id, langue: 'en',
                                          mot: texteDe(d.titre, 'en') || texteDe(d.titre, 'fr') }));
    }
    if (d.origine === 'perso') {
      bloc.appendChild(boutonsPersonnels(d.id, 'dialogue', () => { arreterLecture(); surFermeture(); }));
    }

    function nomDuRole(qui) {
      const nom = d.roles && d.roles[qui] ? texteDe(d.roles[qui], I18n.langue) : '';
      return qui + (nom ? ' · ' + nom : '');
    }

    function peindreEcoute(enCours) {
      ecouter.textContent = (enCours ? '■ ' : '▶ ')
        + I18n.t(enCours ? 'conv.dialogue.arreter' : 'conv.dialogue.ecouter');
      ecouter.classList.toggle('en-cours', enCours);
    }

    function dessinerVoix() {
      const possible = Voix.possible(langue);
      ecouter.disabled = !possible || !Voix.actif;
      if (!possible) {
        etatVoix.textContent = I18n.t('voix.aucune.' + langue);
      } else if (!Voix.actif) {
        etatVoix.textContent = I18n.t('conv.voix.desactivee');
      } else {
        etatVoix.textContent = role ? I18n.t('conv.dialogue.ecouter.role') : '';
      }
      etatVoix.hidden = !etatVoix.textContent;
    }

    /* La liste des voix arrive souvent après l'ouverture : l'état se redit
     * alors. Le dialogue refermé, l'écouteur se retire de lui-même. */
    const surVoix = () => {
      if (!etatVoix.isConnected) { document.removeEventListener('voix-changees', surVoix); return; }
      dessinerVoix();
    };
    document.addEventListener('voix-changees', surVoix);

    function dessinerTete() {
      titre.textContent = texteDe(d.titre, langue);
      const autreTitre = texteDe(d.titre, autre(langue));
      sousTitre.textContent = autreTitre !== titre.textContent && traductions ? autreTitre : '';
      sousTitre.hidden = !sousTitre.textContent;
      hoteLangue.textContent = '';
      hoteLangue.appendChild(segments(['fr', 'en'], langue,
        (v) => I18n.t('langue.' + v), (v) => {
          arreterLecture();
          langue = v;
          dessinerTete();
          dessinerVoix();
          redessinerLignes();
        }));
      hoteRole.textContent = '';
      hoteRole.appendChild(segments([null, 'A', 'B'], role,
        (v) => (v ? nomDuRole(v) : I18n.t('conv.role.aucun')), (v) => {
          arreterLecture();
          role = v;
          revelees.clear();
          noteRole.textContent = I18n.t('conv.role.note');
          noteRole.hidden = !role;
          toutReveler.hidden = !role;
          dessinerTete();
          dessinerVoix();
          redessinerLignes();
        }));
      peindreEcoute(false);
    }

    function dessinerLigne(replique) {
      const moi = !!role && replique.qui === role;
      const masquee = moi && !revelees.has(replique.idComplet);
      const div = element('div', 'replique ' + replique.qui + (moi ? ' moi' : '') + (masquee ? ' masquee' : ''));
      div.dataset.id = replique.idComplet;
      div.appendChild(element('span', 'replique-qui', nomDuRole(replique.qui)));

      if (masquee) {
        const reveler = element('button', 'replique-reveler', I18n.t('conv.reveler'));
        reveler.type = 'button';
        reveler.addEventListener('click', () => {
          revelees.add(replique.idComplet);
          const neuve = dessinerLigne(replique);
          div.replaceWith(neuve);
          lignes.set(replique.idComplet, neuve);
        });
        div.appendChild(reveler);
      } else {
        const p = element('p', 'replique-texte');
        p.appendChild(MotsVifs.tisser(texteDe(replique, langue), langue, {}));
        div.appendChild(p);
      }
      if (traductions) {
        const p = element('p', 'replique-traduction');
        p.appendChild(MotsVifs.tisser(texteDe(replique, autre(langue)), autre(langue), {}));
        div.appendChild(p);
      }

      const actions = element('div', 'replique-actions');
      actions.appendChild(boutonEcouter(texteDe(replique, langue), langue,
        { court: true, classe: 'ecouter-phrase' }));
      const entree = Conversation.entree(replique.idComplet);
      if (entree) actions.appendChild(boutonApprendre(entree, true));
      div.appendChild(actions);
      return div;
    }

    function redessinerLignes() {
      corps.textContent = '';
      lignes.clear();
      for (const replique of d.repliques) {
        const div = dessinerLigne(replique);
        lignes.set(replique.idComplet, div);
        corps.appendChild(div);
      }
      const toutesRevelees = d.repliques.filter((r) => r.qui === role)
        .every((r) => revelees.has(r.idComplet));
      toutReveler.textContent = I18n.t(toutesRevelees ? 'conv.masquer.tout' : 'conv.reveler.tout');
    }

    toutReveler.addEventListener('click', () => {
      const miennes = d.repliques.filter((r) => r.qui === role);
      const toutes = miennes.every((r) => revelees.has(r.idComplet));
      if (toutes) revelees.clear();
      else for (const r of miennes) revelees.add(r.idComplet);
      redessinerLignes();
    });

    /* Écouter le dialogue : chaque réplique dans la langue principale, une
     * pause entre deux ; en jouant un rôle, ses propres répliques sont un
     * silence — le temps de les dire. La réplique en cours est soulignée,
     * et le bouton se change en « Arrêter ». */
    ecouter.addEventListener('click', () => {
      if (lecture) { arreterLecture(); return; }
      const items = d.repliques.map((r) => (role && r.qui === role
        ? { texte: '', silence: SILENCE_DE_MON_TOUR }
        : { texte: Conversation.texteParle(texteDe(r, langue)), langue }));
      peindreEcoute(true);
      lecture = Voix.enchainer(items, {
        pause: PAUSE_ENTRE_REPLIQUES,
        surItem: (rang) => {
          for (const div of lignes.values()) div.classList.remove('en-cours');
          const replique = d.repliques[rang];
          const div = replique && lignes.get(replique.idComplet);
          if (div) {
            div.classList.add('en-cours');
            if (div.scrollIntoView) div.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        },
        surFin: () => {
          lecture = null;
          for (const div of lignes.values()) div.classList.remove('en-cours');
          peindreEcoute(false);
        },
      });
    });

    dessinerTete();
    dessinerVoix();
    redessinerLignes();
    return bloc;
  }

  // ── Les formulaires ───────────────────────────────────────────────────────

  function champTexte(cle, valeur, options) {
    const reglagesChamp = options || {};
    const bloc = element('label', 'champ-perso');
    bloc.appendChild(element('span', null, I18n.t(cle)));
    const saisie = element(reglagesChamp.lignes ? 'textarea' : 'input', 'saisie-perso');
    if (reglagesChamp.lignes) saisie.rows = reglagesChamp.lignes;
    else saisie.type = 'text';
    saisie.value = valeur || '';
    saisie.autocomplete = 'off';
    saisie.autocapitalize = 'sentences';
    saisie.spellcheck = false;
    saisie.maxLength = reglagesChamp.max || Conversation.TEXTE_MAX;
    if (reglagesChamp.aide) saisie.placeholder = I18n.t(reglagesChamp.aide);
    bloc.appendChild(saisie);
    if (reglagesChamp.note) bloc.appendChild(element('span', 'discret', I18n.t(reglagesChamp.note)));
    return { bloc, saisie };
  }

  function segmentsDeChamp(valeurs, choisie, libelle) {
    const groupe = element('div', 'segments segments-souples');
    groupe.setAttribute('role', 'group');
    for (const valeur of valeurs) {
      const bouton = element('button', null, libelle(valeur));
      bouton.type = 'button';
      bouton.dataset.valeur = valeur;
      bouton.setAttribute('aria-pressed', String(valeur === choisie));
      bouton.addEventListener('click', () => {
        for (const b of groupe.querySelectorAll('button')) {
          b.setAttribute('aria-pressed', String(b === bouton));
        }
      });
      groupe.appendChild(bouton);
    }
    return groupe;
  }

  function choixDe(groupe) {
    const actif = groupe.querySelector('[aria-pressed="true"]');
    return actif ? actif.dataset.valeur : '';
  }

  function ligneChoix(cle, groupe) {
    const bloc = element('div', 'champ-perso');
    bloc.appendChild(element('span', null, I18n.t(cle)));
    bloc.appendChild(groupe);
    return bloc;
  }

  function ouvrirPanneau(titreCle) {
    brancher();
    const hote = elements.formulaire;
    hote.textContent = '';
    const tete = element('div', 'fiche-tete');
    const fermer = element('button', 'fiche-fermer', I18n.t('fiche.fermer'));
    fermer.type = 'button';
    fermer.addEventListener('click', fermerFormulaire);
    tete.appendChild(fermer);
    hote.appendChild(tete);
    hote.appendChild(element('h2', null, I18n.t(titreCle)));
    const corps = element('div', 'formulaire-perso');
    hote.appendChild(corps);
    elements.panneau.hidden = false;
    elements.panneau.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    return corps;
  }

  function boutonsDuFormulaire(corps, existant, surValider) {
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
    valider.addEventListener('click', async () => {
      valider.disabled = true;
      try {
        await surValider((cle) => {
          avis.textContent = cle ? I18n.t(cle) : '';
          avis.hidden = !cle;
        });
      } finally {
        valider.disabled = false;
      }
    });
    return { valider, avis };
  }

  function themesPourFormulaire() {
    return Conversation.themes().map((t) => t.id).concat(['autre']);
  }

  async function apresEnregistrement(enregistre, rappel) {
    fermerFormulaire();
    dessiner();
    if (racine.App) App.chercher();
    if (racine.Seance) Seance.rafraichir();
    if (rappel) rappel(enregistre);
    else if (enregistre.sorte === 'dialogue') ouvrirDialogue(enregistre.id);
    else App.ouvrirFiche({ conversation: enregistre.id });
  }

  /* Le formulaire d'une phrase. `options.id` pour en modifier une,
   * `options.saisie` pour préremplir depuis une recherche, `surEnregistrement`
   * pour être rappelé après. */
  function ouvrirFormulairePhrase(options) {
    const reglagesForm = options || {};
    const existant = reglagesForm.id ? Conversation.brut(reglagesForm.id) : null;
    const depart = existant || {
      fr: '', en: '', theme: etat.theme || 'autre', registre: '', situation: '',
      variantes: { fr: [], en: [] },
    };
    if (!existant && reglagesForm.saisie) {
      const langueProbable = /[àâçéèêëîïôûùœ]/.test(reglagesForm.saisie) ? 'fr' : 'en';
      depart[langueProbable] = reglagesForm.saisie;
    }
    formulaire = { id: existant ? existant.id : null,
                   surEnregistrement: reglagesForm.surEnregistrement || null };
    const corps = ouvrirPanneau(existant ? 'conv.form.phrase.modifier' : 'conv.form.phrase.ajouter');

    const langue = languePrincipale();
    const champs = {};
    for (const l of [langue, autre(langue)]) {
      champs[l] = champTexte('conv.form.' + l, depart[l], { lignes: 2, aide: 'conv.form.' + l + '.aide' });
      corps.appendChild(champs[l].bloc);
    }
    const theme = segmentsDeChamp(themesPourFormulaire(), depart.theme, nomDuTheme);
    corps.appendChild(ligneChoix('conv.form.theme', theme));
    const registre = segmentsDeChamp(Conversation.REGISTRES, depart.registre || '',
      (v) => (v ? I18n.t('conv.registre.' + v) : I18n.t('perso.aucun')));
    corps.appendChild(ligneChoix('conv.form.registre', registre));

    const details = element('details', 'perso-details');
    details.appendChild(element('summary', null, I18n.t('perso.details')));
    const situation = champTexte('conv.form.situation', depart.situation,
      { aide: 'conv.form.situation.aide', max: Conversation.SITUATION_MAX });
    details.appendChild(situation.bloc);
    const variantes = {};
    for (const l of [langue, autre(langue)]) {
      variantes[l] = champTexte('conv.form.variantes.' + l,
        ((depart.variantes && depart.variantes[l]) || []).join('\n'),
        { lignes: 3, note: 'conv.form.variantes.note', max: 2000 });
      details.appendChild(variantes[l].bloc);
    }
    corps.appendChild(details);

    let note = null;
    if (!existant) {
      note = champTexte('notes.titre', '', { lignes: 3, max: 2000, aide: 'notes.exemple' });
      corps.appendChild(note.bloc);
    }

    boutonsDuFormulaire(corps, existant, async (dire) => {
      const donnees = {
        fr: champs.fr.saisie.value, en: champs.en.saisie.value,
        theme: choixDe(theme), registre: choixDe(registre),
        situation: situation.saisie.value,
        variantes: { fr: variantes.fr.saisie.value, en: variantes.en.saisie.value },
      };
      const controle = Conversation.normaliserPhrase(donnees);
      if (!controle.valide) {
        dire('conv.manque.' + controle.manques[0]);
        champs[controle.manques[0]].saisie.focus();
        return;
      }
      const enregistre = formulaire.id
        ? await Conversation.modifier(formulaire.id, donnees)
        : await Conversation.creer('phrase', donnees);
      if (note && note.saisie.value.trim()) {
        await Notes.ecrire({ conversation: enregistre.id, langue: 'en', mot: enregistre.en },
                           note.saisie.value);
      }
      await apresEnregistrement(enregistre, formulaire.surEnregistrement);
    });
    champs[langue].saisie.focus();
  }

  /* Le formulaire d'un dialogue : un titre, les deux interlocuteurs, et des
   * répliques qu'on ajoute et retire à volonté. Une réplique existante garde
   * son identifiant dans la ligne — c'est ce qui fait qu'une correction ne
   * perd ni ses cartes ni sa note. */
  function ouvrirFormulaireDialogue(options) {
    const reglagesForm = options || {};
    const existant = reglagesForm.id ? Conversation.brut(reglagesForm.id) : null;
    const depart = existant || {
      titre: '', theme: etat.theme || 'autre', registre: '', roles: { A: '', B: '' },
      repliques: [{ id: null, qui: 'A', fr: '', en: '' }, { id: null, qui: 'B', fr: '', en: '' }],
    };
    formulaire = { id: existant ? existant.id : null,
                   surEnregistrement: reglagesForm.surEnregistrement || null };
    const corps = ouvrirPanneau(existant ? 'conv.form.dialogue.modifier' : 'conv.form.dialogue.ajouter');
    const langue = languePrincipale();

    const titre = champTexte('conv.form.titre', depart.titre,
      { aide: 'conv.form.titre.aide', max: Conversation.TITRE_MAX });
    corps.appendChild(titre.bloc);
    const theme = segmentsDeChamp(themesPourFormulaire(), depart.theme, nomDuTheme);
    corps.appendChild(ligneChoix('conv.form.theme', theme));
    const registre = segmentsDeChamp(Conversation.REGISTRES, depart.registre || '',
      (v) => (v ? I18n.t('conv.registre.' + v) : I18n.t('perso.aucun')));
    corps.appendChild(ligneChoix('conv.form.registre', registre));

    const roles = element('div', 'champ-perso');
    roles.appendChild(element('span', null, I18n.t('conv.form.roles')));
    const ligneRoles = element('div', 'conv-form-roles');
    const champsRoles = {};
    for (const qui of ['A', 'B']) {
      const c = element('input', 'saisie-perso');
      c.type = 'text';
      c.maxLength = 40;
      c.placeholder = qui + ' — ' + I18n.t('conv.form.role.aide');
      c.value = (depart.roles && depart.roles[qui]) || '';
      c.setAttribute('aria-label', I18n.t('conv.form.role.' + qui));
      champsRoles[qui] = c;
      ligneRoles.appendChild(c);
    }
    roles.appendChild(ligneRoles);
    corps.appendChild(roles);

    const bloc = element('div', 'champ-perso');
    bloc.appendChild(element('span', null, I18n.t('conv.form.repliques')));
    const hoteRepliques = element('div', 'conv-form-repliques');
    bloc.appendChild(hoteRepliques);
    const ajouter = element('button', 'bouton-discret', I18n.t('conv.form.replique.ajouter'));
    ajouter.type = 'button';
    bloc.appendChild(ajouter);
    corps.appendChild(bloc);

    const rangees = [];
    function ajouterRangee(replique) {
      const rangee = element('div', 'conv-form-replique');
      const tete = element('div', 'conv-form-replique-tete');
      const qui = segmentsDeChamp(['A', 'B'], replique.qui || (rangees.length % 2 ? 'B' : 'A'),
        (v) => v);
      qui.classList.remove('segments-souples');
      qui.classList.add('conv-form-qui');
      tete.appendChild(qui);
      const retirer = element('button', 'retirer', '✕');
      retirer.type = 'button';
      retirer.setAttribute('aria-label', I18n.t('conv.form.replique.retirer'));
      tete.appendChild(retirer);
      rangee.appendChild(tete);
      const champs = {};
      for (const l of [langue, autre(langue)]) {
        const c = element('textarea', 'saisie-perso');
        c.rows = 2;
        c.maxLength = Conversation.TEXTE_MAX;
        c.placeholder = I18n.t('langue.' + l);
        c.setAttribute('aria-label', I18n.t('conv.form.' + l));
        c.value = replique[l] || '';
        champs[l] = c;
        rangee.appendChild(c);
      }
      const ligne = { id: replique.id || null, qui, champs, rangee };
      rangees.push(ligne);
      retirer.addEventListener('click', () => {
        rangees.splice(rangees.indexOf(ligne), 1);
        rangee.remove();
      });
      hoteRepliques.appendChild(rangee);
      return ligne;
    }
    for (const r of depart.repliques) ajouterRangee(r);
    ajouter.addEventListener('click', () => {
      if (rangees.length >= Conversation.REPLIQUES_MAX) return;
      const ligne = ajouterRangee({ id: null, qui: rangees.length % 2 ? 'B' : 'A' });
      ligne.champs[langue].focus();
    });

    let note = null;
    if (!existant) {
      note = champTexte('notes.titre', '', { lignes: 3, max: 2000, aide: 'notes.exemple' });
      corps.appendChild(note.bloc);
    }

    boutonsDuFormulaire(corps, existant, async (dire) => {
      const donnees = {
        titre: titre.saisie.value, theme: choixDe(theme), registre: choixDe(registre),
        roles: { A: champsRoles.A.value, B: champsRoles.B.value },
        repliques: rangees.map((r) => ({
          id: r.id, qui: choixDe(r.qui), fr: r.champs.fr.value, en: r.champs.en.value,
        })),
      };
      const controle = Conversation.normaliserDialogue(donnees);
      if (!controle.valide) {
        dire('conv.manque.' + controle.manques[0]);
        if (controle.manques[0] === 'titre') titre.saisie.focus();
        return;
      }
      const enregistre = formulaire.id
        ? await Conversation.modifier(formulaire.id, donnees)
        : await Conversation.creer('dialogue', donnees);
      if (note && note.saisie.value.trim()) {
        await Notes.ecrire({ conversation: enregistre.id, langue: 'en', mot: enregistre.titre },
                           note.saisie.value);
      }
      await apresEnregistrement(enregistre, formulaire.surEnregistrement);
    });
    titre.saisie.focus();
  }

  function fermerFormulaire() {
    if (!elements.panneau) return;
    elements.panneau.hidden = true;
    elements.formulaire.textContent = '';
    document.body.style.overflow = '';
    formulaire = null;
  }

  // ── Mise en place ─────────────────────────────────────────────────────────

  function brancher(reglagesApp) {
    if (reglagesApp) reglages = reglagesApp;
    if (branche) return;
    branche = true;
    Object.assign(elements, {
      vue: $('#vue-conversation'),
      q: $('#conv-q'),
      qVider: $('#conv-q-vider'),
      outils: $('#conv-outils'),
      liste: $('#conv-liste'),
      rien: $('#conv-rien'),
      indisponible: $('#conv-indisponible'),
      persoListe: $('#conv-perso-liste'),
      persoVide: $('#conv-perso-vide'),
      ajouterPhrase: $('#b-conv-ajouter-phrase'),
      ajouterDialogue: $('#b-conv-ajouter-dialogue'),
      panneau: $('#panneau-conversation'),
      formulaire: $('#formulaire-conversation'),
    });
    if (!elements.vue) return;
    elements.q.addEventListener('input', () => {
      etat.saisie = elements.q.value.trim();
      elements.qVider.hidden = !etat.saisie;
      dessinerListe();
    });
    elements.qVider.addEventListener('click', () => {
      elements.q.value = '';
      etat.saisie = '';
      elements.qVider.hidden = true;
      dessinerListe();
      elements.q.focus();
    });
    elements.ajouterPhrase.addEventListener('click', () => ouvrirFormulairePhrase({}));
    elements.ajouterDialogue.addEventListener('click', () => ouvrirFormulaireDialogue({}));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.panneau && !elements.panneau.hidden) {
        fermerFormulaire();
      }
    });
  }

  racine.Situations = {
    brancher, dessiner, reinitialiser,
    fiche, ouvrirDialogue, arreterLecture,
    ouvrirFormulairePhrase, ouvrirFormulaireDialogue, fermerFormulaire,
    supprimerAvecEgards,
    get langue() { return languePrincipale(); },
    get traductions() { return etat.traductions; },
  };

})(window);
