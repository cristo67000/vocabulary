'use strict';
/*
 * L'interface : onglets, recherche, ouverture des fiches, réglages.
 *
 * La recherche est synchrone. Chercher un préfixe dans 200 000 entrées est une
 * dichotomie — une quinzaine de comparaisons — et coûte moins qu'un battement
 * de cil ; ce qui coûte, c'est de dessiner la liste. Il n'y a donc pas de
 * temporisation à la frappe : les résultats suivent la touche, ce qui est
 * exactement ce qu'on attend d'un dictionnaire posé sur l'appareil.
 */
(function (racine) {

  const $ = (selecteur) => document.querySelector(selecteur);

  const elements = {};
  let reglages = null;
  let manifeste = null;
  let annulationTelechargement = null;

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined && texte !== null) noeud.textContent = texte;
    return noeud;
  }

  // ── Onglets ───────────────────────────────────────────────────────────────

  /* « Phrases et dialogues » n'a pas d'onglet à lui : c'est une section du
   * module « Expressions & phrases ». Son écran allume l'onglet des modules. */
  const ONGLET_DE = { conversation: 'modules' };

  function basculer(nom, options) {
    const reglagesVue = options || {};
    for (const vue of document.querySelectorAll('.vue')) {
      vue.hidden = vue.id !== 'vue-' + nom;
    }
    const onglet = ONGLET_DE[nom] || nom;
    for (const bouton of elements.onglets.querySelectorAll('button')) {
      const actif = bouton.dataset.vue === onglet;
      if (actif) bouton.setAttribute('aria-current', 'true');
      else bouton.removeAttribute('aria-current');
    }
    if (nom !== 'reviser' && racine.Suivis) Suivis.reinitialiser();
    if (nom !== 'mesmots' && racine.MesMots) MesMots.reinitialiser();
    if (nom !== 'conversation' && racine.Situations) Situations.reinitialiser();
    if (nom === 'reglages') dessinerReglages();
    if (nom === 'reviser') Seance.rafraichir();
    if (nom === 'mesmots') { MesMots.dessiner(); dessinerNotesEtHistorique(); }
    if (nom === 'conversation') Situations.dessiner();
    /* Revenir à l'onglet des modules rouvre l'écran où l'on était ; toucher
     * l'onglet quand on y est déjà ramène à l'accueil des modules. */
    if (nom === 'modules' && racine.Modules && !reglagesVue.garder) {
      if (reglagesVue.accueil) Modules.dessinerAccueil(); else Modules.dessiner();
    }
    if (nom === 'progres') Progres.dessiner(elements.progresContenu);
    if (nom === 'chercher') {
      dessinerAccueil();
      elements.q.focus({ preventScroll: true });
    }
    racine.scrollTo(0, 0);
    vueCourante = nom;
  }

  let vueCourante = 'chercher';

  // ── Recherche ─────────────────────────────────────────────────────────────

  function ligneDeResultat(resultat) {
    const bouton = element('button', 'resultat');
    bouton.type = 'button';
    bouton.appendChild(element('span', 'pastille', I18n.t('langue.' + resultat.langue + '.court')));
    bouton.appendChild(element('span', 'mot', resultat.mot));
    if (resultat.via) {
      /* La flèche se lit dans le sens de la recherche : on a tapé « Häuser »,
       * on arrive à « Haus ». Écrire « forme de Häuser » à côté de « Haus »
       * se lisait à l'envers. */
      const note = element('span', 'via', '← ' + resultat.via);
      note.title = resultat.via + ' : ' + I18n.t('chercher.via') + ' ' + resultat.mot;
      bouton.appendChild(note);
    }
    if (resultat.perso) {
      bouton.appendChild(element('span', 'pastille perso', I18n.t('perso.marque')));
    }
    /* Le mot a une fiche dans un module — argot, technique, expressions : la
     * pastille le dit, la fiche l'ouvrira en tête. */
    const idModule = resultat.moduleItem || (racine.Modules && !resultat.perso
      && (Modules.itemsPour(resultat)[0] || {}).id);
    if (idModule && racine.Modules) {
      bouton.appendChild(element('span', 'pastille module', Modules.nomCourt(idModule)));
    }
    /* Une expression sans équivalent se lit, mais ne s'apprend pas : elle le
     * dit à la place de la traduction qu'elle n'a pas, et la ligne pâlit. */
    if (resultat.expression && !resultat.apercu) {
      bouton.classList.add('sans-equivalent');
      bouton.appendChild(element('span', 'traduction discret',
        I18n.t('expression.sans-equivalent')));
    } else {
      bouton.appendChild(element('span', 'traduction', resultat.apercu));
    }
    bouton.addEventListener('click', () => ouvrirFiche(resultat));
    const ligne = element('li');
    ligne.appendChild(bouton);
    return ligne;
  }

  /* Combien d'expressions on montre d'abord, et combien chaque « Voir plus »
   * en ajoute. Sur « de » ou « faire », le paquet complet en compte des
   * centaines ; six suffisent à voir si l'on est sur la bonne piste, et
   * chaque clic en déplie deux douzaines de plus — jusqu'à la dernière, car
   * rien de ce que l'index sait n'est hors de portée. */
  const EXPRESSIONS_VISIBLES = 6;
  const EXPRESSIONS_PAR_PAGE = 24;

  /* Déplie une liste par pages : `ajouter(lot)` reçoit ce qu'il faut afficher,
   * le bouton dit combien il reste et disparaît quand il n'y a plus rien. */
  function boutonVoirPlus(reste, cleLibelle, ajouter) {
    if (!reste.length) return null;
    const plus = element('button', 'lien-discret');
    plus.type = 'button';
    let position = 0;
    const libeller = () => {
      plus.textContent = I18n.n(cleLibelle, reste.length - position);
    };
    libeller();
    plus.addEventListener('click', () => {
      ajouter(reste.slice(position, position + EXPRESSIONS_PAR_PAGE));
      position += EXPRESSIONS_PAR_PAGE;
      if (position >= reste.length) plus.remove();
      else libeller();
    });
    return plus;
  }

  /* Les expressions usuelles, en groupe à part sous les mots.
   *
   * Elles viennent de deux endroits : l'index des expressions par mot (« feu »
   * → « à petit feu ») et ses propres entrées à plusieurs mots, qui se
   * cherchent déjà par leurs mots intérieurs. Ce qui figure déjà parmi les
   * résultats de mots — parce qu'on a tapé le début de l'expression — n'est
   * pas répété. */
  function dessinerExpressions(expressions, dejaVus) {
    const bloc = elements.expressions;
    bloc.textContent = '';
    const retenues = expressions.filter((r) => !dejaVus.has(r.langue + ' ' + r.mot
                                                              + (r.perso || '')));
    bloc.hidden = retenues.length === 0;
    if (!retenues.length) return;

    bloc.appendChild(element('h3', null, I18n.t('chercher.expressions')));
    const liste = element('ul');
    liste.className = 'resultats-expressions';
    const visibles = retenues.slice(0, EXPRESSIONS_VISIBLES);
    for (const resultat of visibles) liste.appendChild(ligneDeResultat(resultat));
    bloc.appendChild(liste);

    const plus = boutonVoirPlus(retenues.slice(EXPRESSIONS_VISIBLES),
      'chercher.expressions.plus',
      (lot) => { for (const resultat of lot) liste.appendChild(ligneDeResultat(resultat)); });
    if (plus) bloc.appendChild(plus);
  }

  /* Combien de phrases et dialogues on montre d'abord sous une recherche.
   * C'est un groupe à part, sous les mots et les expressions, et il ne doit
   * pas les noyer : quatre lignes, puis « Voir plus ». */
  const CONVERSATION_VISIBLES = 4;

  /* Les phrases et dialogues atteints par la saisie, en groupe à part. Une
   * ligne montre le texte dans la langue principale du module et sa
   * traduction ; un dialogue montre la réplique qui a répondu. */
  function ligneDeConversation(resultat) {
    const langue = racine.Situations ? Situations.langue : 'en';
    const autre = langue === 'en' ? 'fr' : 'en';
    const bouton = element('button', 'resultat resultat-conversation');
    bouton.type = 'button';
    if (resultat.sorte === 'phrase') {
      const p = Conversation.phrase(resultat.id);
      bouton.appendChild(element('span', 'pastille', I18n.t('conv.marque.phrase')));
      bouton.appendChild(element('span', 'mot', Conversation.texte(p, langue)));
      if (p.origine === 'perso') {
        bouton.appendChild(element('span', 'pastille perso', I18n.t('perso.marque')));
      }
      bouton.appendChild(element('span', 'traduction', Conversation.texte(p, autre)));
      bouton.addEventListener('click', () => ouvrirFiche({ conversation: p.id }));
    } else {
      const d = Conversation.dialogue(resultat.id);
      bouton.appendChild(element('span', 'pastille', I18n.t('conv.marque.dialogue')));
      bouton.appendChild(element('span', 'mot', Conversation.texte(d.titre, langue)));
      if (d.origine === 'perso') {
        bouton.appendChild(element('span', 'pastille perso', I18n.t('perso.marque')));
      }
      bouton.appendChild(element('span', 'traduction', resultat.replique
        ? Conversation.texte(resultat.replique, langue)
        : I18n.n('conv.repliques', d.repliques.length)));
      bouton.addEventListener('click', () => Situations.ouvrirDialogue(d.id));
    }
    const ligne = element('li');
    ligne.appendChild(bouton);
    return ligne;
  }

  function dessinerConversation(saisie) {
    const bloc = elements.conversation;
    if (!bloc) return false;
    bloc.textContent = '';
    const resultats = saisie && racine.Conversation ? Conversation.chercher(saisie) : [];
    bloc.hidden = resultats.length === 0;
    if (!resultats.length) return false;

    bloc.appendChild(element('h3', null, I18n.t('chercher.conversation')));
    const liste = element('ul');
    liste.className = 'resultats-expressions';
    for (const resultat of resultats.slice(0, CONVERSATION_VISIBLES)) {
      liste.appendChild(ligneDeConversation(resultat));
    }
    bloc.appendChild(liste);
    const plus = boutonVoirPlus(resultats.slice(CONVERSATION_VISIBLES),
      'chercher.conversation.plus',
      (lot) => { for (const resultat of lot) liste.appendChild(ligneDeConversation(resultat)); });
    if (plus) bloc.appendChild(plus);
    return true;
  }

  function dessinerResultats(resultats, saisie) {
    const liste = elements.resultats;
    const suite = elements.resultatsSuite;
    liste.textContent = '';
    suite.textContent = '';

    /* Les expressions usuelles atteintes par un mot de la saisie — depuis
     * l'index du dictionnaire, et depuis ses propres entrées. Celles-ci
     * arrivent dans la recherche des mots, où « Lust » atteint « Ich habe
     * keine Lust » par un mot intérieur ; si on les a déclarées expressions,
     * elles passent au groupe des expressions, en tête — on les a écrites
     * soi-même. Tapée en entier, l'expression reste un résultat exact. */
    const siennes = resultats.filter((r) => r.perso && r.expression && !r.exact);
    resultats = resultats.filter((r) => siennes.indexOf(r) === -1);
    const vus = new Set(resultats.map((r) => r.langue + ' ' + r.mot + (r.perso || '')));
    const expressions = saisie ? Lexique.chercherExpressions(saisie) : [];
    expressions.unshift(...siennes);
    dessinerExpressions(expressions, vus);

    /* Où placer le groupe des expressions.
     *
     * Sur « feu », le dictionnaire répond par quarante mots qui commencent
     * ainsi, et « à petit feu » arriverait en bas de tout cela, hors de l'écran
     * d'un téléphone. Quand il y a des expressions, elles se glissent donc
     * après les mots exacts et les formes fléchies — ce qu'on cherchait — et
     * les mots qui ne font que commencer pareil suivent, sous un titre à eux.
     * Sans expression, rien ne change : une seule liste, comme avant. */
    /* Les phrases et dialogues forment un troisième groupe, après les
     * expressions : ce qu'on cherche est peut-être « Où est la poste ? »
     * entière, pas seulement « poste ». Ils coupent la liste des mots au
     * même endroit que les expressions. */
    const aDesPhrases = dessinerConversation(saisie);
    const aDesExpressions = !elements.expressions.hidden || aDesPhrases;
    const exacts = aDesExpressions ? resultats.filter((r) => r.rang <= 1) : resultats;
    const autres = aDesExpressions ? resultats.filter((r) => r.rang > 1) : [];
    for (const resultat of exacts) liste.appendChild(ligneDeResultat(resultat));
    if (autres.length) {
      const titre = element('li', 'titre-suite');
      titre.appendChild(element('h3', null, I18n.t('chercher.autres-mots')));
      suite.appendChild(titre);
      for (const resultat of autres) suite.appendChild(ligneDeResultat(resultat));
    }
    suite.hidden = autres.length === 0;

    const aQuelqueChose = resultats.length > 0 || aDesExpressions || aDesPhrases;
    liste.hidden = exacts.length === 0;
    elements.accueil.hidden = !!saisie;
    elements.rien.hidden = !saisie || aQuelqueChose;
    elements.rienConseil.textContent = I18n.t(
      Lexique.paquet === 'complet' ? 'chercher.rien.complet' : 'chercher.rien.conseil');

    /* « Ajouter ce mot », sous une recherche restée vide.
     *
     * C'est le seul endroit où l'on sait à coup sûr que le mot manque, et le
     * seul moment où on l'a encore sous les yeux, bien orthographié. Le bouton
     * reste aussi accessible sous une liste de résultats — on cherche parfois
     * un mot dont un homographe existe — mais discrètement. */
    elements.ajouterSousRien.hidden = !saisie || aQuelqueChose;
    elements.ajouterSousListe.hidden = !saisie || !aQuelqueChose;
    if (saisie) {
      elements.ajouterSousRien.textContent =
        I18n.t('perso.ajouter.ce-mot', { mot: saisie });
    }
  }

  function ajouterLeMotCherche() {
    const saisie = elements.q.value.trim();
    MesMots.ouvrirFormulaire({ saisie });
  }

  /* Les fiches de module que le dictionnaire ne connaît pas (« tbh », « prompt
   * injection ») rejoignent la liste des mots ; celles qu'il connaît y sont
   * déjà, sous leur vedette du dictionnaire. */
  function avecLesModules(resultats, saisie) {
    if (!saisie || !racine.Modules) return resultats;
    /* Un mot que les modules ont rédigé montre leurs équivalents : ils ont été
     * choisis pour l'usage courant, là où l'aperçu du dictionnaire suit
     * l'ordre de sa source (« knackered » : « crevé, naze », et non « foutu,
     * fichu »). */
    for (const r of resultats) {
      if (r.perso) continue;
      const redige = Modules.itemsPour({ langue: r.langue, mot: r.mot })
        .find((it) => it.src === 'claude' && it.tr && it.tr.length);
      if (redige) r.apercu = redige.tr.slice(0, 3).join(', ');
    }
    const vus = new Set(resultats.map((r) => r.langue + ' ' + r.mot));
    const siens = Modules.chercher(saisie, 12).filter((r) => {
      const empreinte = r.langue + ' ' + r.mot;
      if (vus.has(empreinte)) return false;
      vus.add(empreinte);
      return true;
    });
    for (const r of siens) r.rang = r.exact ? 0 : (r.via ? 1 : 2);
    return resultats.concat(siens).sort((a, b) => (a.rang || 0) - (b.rang || 0));
  }

  function chercher() {
    const saisie = elements.q.value.trim();
    elements.qVider.hidden = !saisie;
    dessinerResultats(saisie ? avecLesModules(Lexique.chercher(saisie), saisie) : [], saisie);
  }

  // ── Fiche ─────────────────────────────────────────────────────────────────

  /* Prête le volet des fiches à qui a quelque chose à y mettre : un mot, une
   * phrase, un dialogue. `construire(fermer)` rend ce qu'il faut afficher. */
  function ouvrirPanneau(construire) {
    /* Ce qui se lisait à voix haute se tait : un dialogue en cours de lecture
     * ne doit pas continuer sous la fiche du mot qu'on vient d'ouvrir. */
    Voix.taire();
    elements.ficheContenu.textContent = '';
    elements.ficheContenu.appendChild(construire(fermerFiche));
    elements.fiche.hidden = false;
    elements.fiche.scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }

  async function ouvrirFiche(resultat) {
    const entree = await Lexique.ouvrir(resultat);
    if (!entree) return;
    /* Une phrase de « Phrases et dialogues » a sa fiche à elle — deux
     * langues, deux voix, ses variantes — dans le même volet. */
    if (entree.conversation && racine.Situations) {
      ouvrirPanneau((fermer) => Situations.fiche(entree, fermer));
      return;
    }
    ouvrirPanneau((fermer) => Fiche.construire(entree, fermer));
    /* L'historique de consultation retient le dictionnaire et les fiches de
     * module ; un mot personnel se retrouve dans « Mes mots », qui ne
     * l'oublie jamais. */
    if (!entree.perso) {
      Store.consulter(entree.langue, entree.mot, entree.module || null).catch(() => {});
    }
  }

  function fermerFiche() {
    elements.fiche.hidden = true;
    document.body.style.overflow = '';
    Voix.taire();
  }

  // ── Accueil : suggestions et mots récents ─────────────────────────────────

  function dessinerSuggestions() {
    elements.suggestions.textContent = '';
    for (const mot of I18n.SUGGESTIONS) {
      const bouton = element('button', null, mot);
      bouton.type = 'button';
      bouton.addEventListener('click', () => {
        elements.q.value = mot;
        chercher();
      });
      elements.suggestions.appendChild(bouton);
    }
  }

  /* Une ligne d'historique : elle rouvre la fiche, pas une recherche. */
  function ligneDHistorique(recent) {
    const bouton = element('button', 'resultat');
    bouton.type = 'button';
    bouton.appendChild(element('span', 'pastille', I18n.t('langue.' + recent.langue + '.court')));
    bouton.appendChild(element('span', 'mot', recent.mot));
    bouton.addEventListener('click', () => {
      if (recent.module && racine.Modules) { Modules.ouvrirItem(recent.module); return; }
      const v = Lexique.vedette(recent.langue, recent.mot);
      if (v) { ouvrirFiche(v); return; }
      elements.q.value = recent.mot;
      basculer('chercher');
      chercher();
    });
    const ligne = element('li');
    ligne.appendChild(bouton);
    return ligne;
  }

  async function dessinerRecents() {
    const recents = await Store.historique().catch(() => []);
    elements.recents.textContent = '';
    if (!recents.length) return;
    elements.recents.appendChild(element('h3', null, I18n.t('chercher.resultats')));
    const liste = element('ul', 'liste-simple');
    for (const recent of recents.slice(0, 8)) liste.appendChild(ligneDHistorique(recent));
    elements.recents.appendChild(liste);
  }

  /* L'accueil : les modules en tuiles, et quelques fiches à découvrir. C'est
   * la porte d'entrée pour qui ne sait pas encore quoi chercher. */
  function dessinerAccueil() {
    const hote = elements.accueilModules;
    if (!hote || !racine.Modules) return;
    hote.textContent = '';
    for (const m of Modules.modules()) {
      const bouton = element('button', 'tuile tuile-petite');
      bouton.type = 'button';
      bouton.appendChild(element('span', 'tuile-icone', m.icone || '•'));
      bouton.appendChild(element('span', 'tuile-titre', Modules.texte(m.nom)));
      bouton.addEventListener('click', () => Modules.ouvrirModule(m.id));
      hote.appendChild(bouton);
    }
    const decouvrir = elements.decouvrir;
    const section = elements.accueilDecouvrir;
    if (decouvrir && section) {
      decouvrir.textContent = '';
      const lot = Modules.suggestions(6);
      section.hidden = !lot.length;
      for (const it of lot) {
        const bouton = element('button', 'decouverte');
        bouton.type = 'button';
        bouton.appendChild(element('span', 'decouverte-mot', it.w));
        bouton.appendChild(element('span', 'decouverte-sens', (it.tr || [])[0] || ''));
        bouton.addEventListener('click', () => Modules.ouvrirItem(it.id));
        decouvrir.appendChild(bouton);
      }
    }
  }

  /* « Mes mots » rassemble aussi ses notes et son historique : ce qu'on a
   * écrit, et ce qu'on a consulté. */
  async function dessinerNotesEtHistorique() {
    const listeNotes = $('#notes-liste');
    if (listeNotes) {
      const notes = (await Store.toutesLesNotes().catch(() => []))
        .filter((n) => n.texte && n.texte.trim())
        .sort((a, b) => (b.modifie || 0) - (a.modifie || 0));
      listeNotes.textContent = '';
      $('#notes-vide').hidden = notes.length > 0;
      for (const note of notes.slice(0, 100)) {
        const li = element('li');
        const bouton = element('button', 'resultat note-ligne');
        bouton.type = 'button';
        if (note.langue) {
          bouton.appendChild(element('span', 'pastille', I18n.t('langue.' + note.langue + '.court')));
        }
        bouton.appendChild(element('span', 'mot', note.mot || '—'));
        bouton.appendChild(element('span', 'traduction', note.texte.split('\n')[0].slice(0, 80)));
        bouton.addEventListener('click', () => {
          const id = note.id || '';
          if (id.startsWith('perso:')) { ouvrirFiche({ perso: id.slice(6), langue: note.langue, mot: note.mot }); return; }
          if (id.startsWith('conv:')) { ouvrirFiche({ conversation: id.slice(5) }); return; }
          if (id.startsWith('mod:') && racine.Modules) { Modules.ouvrirItem(id.slice(4)); return; }
          const v = Lexique.vedette(note.langue, note.mot);
          if (v) ouvrirFiche(v);
        });
        li.appendChild(bouton);
        listeNotes.appendChild(li);
      }
    }
    const listeHistorique = $('#historique-liste');
    if (listeHistorique) {
      const recents = await Store.historique().catch(() => []);
      listeHistorique.textContent = '';
      $('#historique-vide').hidden = recents.length > 0;
      $('#b-effacer-historique').hidden = !recents.length;
      for (const recent of recents.slice(0, 60)) listeHistorique.appendChild(ligneDHistorique(recent));
    }
  }

  // ── Réglages ──────────────────────────────────────────────────────────────

  /* Le bloc « Prononciation » : par langue, la voix retenue, un menu pour en
   * préférer une autre, et un bouton qui la fait lire une phrase à sons
   * pièges. Il dit clairement quand une langue n'a aucune voix — et qu'alors
   * rien n'est lu, plutôt qu'une voix d'une autre langue —, et donne, sous
   * « Détails techniques », ce qu'il faut pour signaler un défaut : le
   * système, le navigateur, le nom de la voix. Redessiné quand la liste des
   * voix arrive (`voix-changees`), puisqu'elle arrive souvent en retard. */
  function dessinerVoix() {
    const zone = elements.zoneVoix;
    if (!zone) return;
    zone.textContent = '';
    elements.etatVoix.textContent = '';
    if (!Voix.disponible) {
      elements.etatVoix.textContent = I18n.t('reglages.voix.indisponible');
      return;
    }
    const cle = (langue) => (langue === 'en' ? 'voixEn' : 'voixFr');

    for (const langue of Voix.LANGUES) {
      const d = Voix.diagnostic(langue);
      const bloc = element('div', 'reglage-voix-langue');
      const ligne = element('div', 'reglage-voix-ligne');
      const etiquette = element('label', 'reglage-voix-titre', I18n.t('reglages.voix.pour.' + langue));
      etiquette.htmlFor = 'reglage-voix-' + langue;
      ligne.appendChild(etiquette);

      const menu = element('select', 'reglage-voix-menu');
      menu.id = 'reglage-voix-' + langue;
      const auto = element('option', null, I18n.t('reglages.voix.automatique'));
      auto.value = '';
      menu.appendChild(auto);
      for (const v of Voix.lister(langue)) {
        const option = element('option', null, v.nom + ' (' + v.lang + ')');
        option.value = v.uri;
        menu.appendChild(option);
      }
      menu.value = d.choix && !d.choixIntrouvable ? d.choix.uri : '';
      menu.disabled = !d.nombre;
      menu.addEventListener('change', async () => {
        const choix = Voix.choisir(langue, menu.value || null);
        reglages[cle(langue)] = choix;
        await Store.ecrireReglage(cle(langue), choix).catch(() => {});
        dessinerVoix();
      });
      ligne.appendChild(menu);

      const essayer = element('button', 'bouton-discret', I18n.t('reglages.voix.essayer'));
      essayer.type = 'button';
      essayer.disabled = !d.voix || !Voix.actif;
      essayer.addEventListener('click', () => Voix.essayer(langue));
      ligne.appendChild(essayer);
      bloc.appendChild(ligne);

      let etat;
      if (d.voix) {
        etat = I18n.t('reglages.voix.retenue', {
          nom: d.voix.nom, lang: d.voix.lang,
          ou: I18n.t(d.voix.locale ? 'reglages.voix.locale' : 'reglages.voix.reseau'),
        });
        if (d.choixIntrouvable) {
          etat = I18n.t('reglages.voix.introuvable', { nom: d.choix.nom || d.choix.uri }) + ' ' + etat;
        }
      } else if (!d.pret && !d.total) {
        etat = I18n.t('reglages.voix.attente');
      } else {
        etat = I18n.t('voix.aucune.' + langue) + ' ' + I18n.t('voix.installer');
      }
      bloc.appendChild(element('p', 'discret', etat));
      /* Une voix canadienne lit le français, une voix américaine l'anglais :
       * on dit pourquoi, et comment avoir la voix de France ou de
       * Grande-Bretagne — l'application la choisit d'office, mais ne peut pas
       * l'installer sur le téléphone. */
      if (d.avis) {
        const avis = element('div', 'avis-voix');
        avis.appendChild(element('p', null, I18n.t('reglages.voix.avis.' + d.avis)));
        if (d.avis === 'choix-canadien' || d.avis === 'choix-americain') {
          const revenir = element('button', 'bouton-discret', I18n.t('reglages.voix.avis.revenir'));
          revenir.type = 'button';
          revenir.addEventListener('click', async () => {
            const choix = Voix.choisir(langue, null);
            reglages[cle(langue)] = choix;
            await Store.ecrireReglage(cle(langue), choix).catch(() => {});
            dessinerVoix();
          });
          avis.appendChild(revenir);
        } else {
          avis.appendChild(element('p', 'discret', I18n.t('reglages.voix.avis.installer.' + langue)));
        }
        bloc.appendChild(avis);
      }
      bloc.appendChild(element('p', 'discret', I18n.t('reglages.voix.essai.' + langue)));
      zone.appendChild(bloc);
    }

    zone.appendChild(element('p', 'discret', I18n.t('reglages.voix.z')));

    /* Les détails techniques, repliés : ce qu'on demande à qui signale un
     * défaut. Rien n'est envoyé — c'est à lire, ou à recopier. */
    const details = element('details', 'reglage-voix-details');
    details.appendChild(element('summary', null, I18n.t('reglages.voix.details')));
    details.appendChild(element('p', 'discret', I18n.t('reglages.voix.details.note')));
    const appareil = Voix.appareil();
    const liste = element('ul', 'reglage-voix-liste');
    liste.appendChild(element('li', null, I18n.t('reglages.voix.details.appareil', {
      plateforme: appareil.plateforme || '?' })));
    liste.appendChild(element('li', null, I18n.t('reglages.voix.details.navigateur', {
      navigateur: appareil.navigateur || '?' })));
    const en = Voix.diagnostic('en');
    const fr = Voix.diagnostic('fr');
    liste.appendChild(element('li', null, en.total
      ? I18n.t('reglages.voix.details.nombre', { n: en.total, en: en.nombre, fr: fr.nombre })
      : I18n.t('reglages.voix.details.aucune-liste')));
    /* La pièce à conviction : le dernier énoncé confié au moteur, et à quelle
     * voix. Après « Essayer », ou après la phrase qui sonnait faux. */
    const dernier = Voix.dernier();
    liste.appendChild(element('li', 'reglage-voix-dernier', dernier
      ? I18n.t('reglages.voix.details.dernier', { texte: dernier.texte, nom: dernier.voix || '?', lang: dernier.lang || '?' })
      : I18n.t('reglages.voix.details.dernier.aucun')));
    /* Ce que cette ligne prouve, et ce qu'elle ne prouve pas : la voix
     * demandée, pas la voix employée — le moteur ne le dit pas. */
    liste.appendChild(element('li', 'reglage-voix-detail', I18n.t('reglages.voix.details.dernier.note')));
    for (const langue of Voix.LANGUES) {
      for (const v of Voix.lister(langue)) {
        liste.appendChild(element('li', 'reglage-voix-detail',
          v.nom + ' — ' + v.lang + ' — ' + I18n.t(v.locale ? 'reglages.voix.locale' : 'reglages.voix.reseau')));
      }
    }
    details.appendChild(liste);
    zone.appendChild(details);
  }

  function dessinerReglages() {
    for (const bouton of document.querySelectorAll('[data-langue]')) {
      bouton.setAttribute('aria-pressed', String(bouton.dataset.langue === I18n.langue));
    }

    for (const bouton of document.querySelectorAll('[data-sens]')) {
      bouton.setAttribute('aria-pressed',
        String(bouton.dataset.sens === (reglages.sensDeTravail || 'les-deux')));
    }

    elements.reglageVoix.checked = !!reglages.voix;
    elements.reglageArticle.checked = reglages.exigerArticle === true;
    elements.reglageCrus.checked = !!reglages.montrerCrus;
    elements.reglageUs.checked = reglages.montrerUs !== false;
    elements.reglageHorsLigne.checked = reglages.toutHorsLigne !== false;
    elements.reglageNouveautes.value = String(reglages.nouveautesParJour);
    dessinerVoix();

    /* La version de l'application vient du service worker, seul à la connaître ;
     * elle manque au tout premier lancement, avant qu'il ne contrôle la page. */
    const application = 'Vocabulary' + (MiseAJour.version ? ' ' + MiseAJour.version : '');
    const versions = manifeste
      ? I18n.t('reglages.apropos.versions', { application, date: manifeste.construit })
      : '';
    elements.aproposVersions.textContent = versions
      + (racine.Conversation && Conversation.disponible
        ? ' · ' + I18n.t('reglages.apropos.conversation') : '');
    elements.etatMaj.textContent = '';

    dessinerDictionnaire();
    dessinerSauvegarde();
    Installer.dessiner();
  }

  async function dessinerDictionnaire() {
    const zone = elements.zoneTelechargement;
    zone.textContent = '';
    if (!manifeste) return;

    const installeComplet = Lexique.paquet === 'complet';
    const ancien = Lexique.ancien;
    /* Le paquet complet d'une mouture antérieure : on en lit les nombres
     * dans son propre manifeste s'il l'a, et sinon on ne prétend rien. */
    const actif = ancien
      ? (ancien.manifeste ? ancien.manifeste.paquets.complet : null)
      : manifeste.paquets[installeComplet ? 'complet' : 'noyau'];
    const nombre = actif ? actif.entrees.en + actif.entrees.fr : 0;
    elements.etatDictionnaire.textContent = ancien
      ? I18n.t(actif ? 'reglages.dictionnaire.ancien' : 'reglages.dictionnaire.ancien.sans-nombre',
               { n: nombre.toLocaleString(I18n.langue) })
      : I18n.t(installeComplet ? 'reglages.dictionnaire.complet' : 'reglages.dictionnaire.noyau',
               { n: nombre.toLocaleString(I18n.langue) });

    if (ancien) {
      /* Le message qui compte : ce qui marche encore, ce qui manque, ce que
       * ça coûte, et que rien ne sera perdu en route. */
      zone.appendChild(element('p', 'avis-donnees', I18n.t('donnees.anciennes.detail', {
        taille: Paquets.humain(Paquets.poids(manifeste), I18n.langue),
      })));
      const bouton = element('button', 'bouton-principal', I18n.t('reglages.mettre-a-jour', {
        taille: Paquets.humain(Paquets.poids(manifeste), I18n.langue),
      }));
      bouton.type = 'button';
      bouton.addEventListener('click', () => lancerTelechargement(zone, bouton));
      zone.appendChild(bouton);
      zone.appendChild(element('p', 'discret', I18n.t('reglages.mettre-a-jour.detail')));
      return;
    }
    if (!actif) return;

    /* Ce que le paquet actif pèse, ce qu'il sait faire, et d'où il vient.
     *
     * Trois choses qu'il fallait deviner jusqu'ici. « Installé » se dit
     * explicitement : sur un téléphone, la différence entre « téléchargé et
     * utilisable hors ligne » et « il faut du réseau » est la seule qui
     * compte, et elle ne se lisait nulle part. */
    const traduites = actif.traduites
      ? actif.traduites.en + actif.traduites.fr : nombre;
    const fiche = element('p', 'discret dictionnaire-detail');
    fiche.appendChild(element('span', 'etat-installe',
      I18n.t('reglages.dictionnaire.installe')));
    fiche.appendChild(document.createTextNode(' · ' + I18n.t(
      'reglages.dictionnaire.poids',
      { taille: Paquets.humain(actif.octets, I18n.langue) })));
    fiche.appendChild(document.createTextNode(' · ' + I18n.t(
      'reglages.dictionnaire.traduites',
      { n: traduites.toLocaleString(I18n.langue) })));
    fiche.appendChild(document.createTextNode(' · ' + I18n.t(
      'reglages.dictionnaire.phrases',
      { n: actif.phrases.toLocaleString(I18n.langue) })));
    /* Les expressions usuelles : celles qui ont un équivalent s'apprennent,
     * les autres se consultent seulement — deux nombres, pas un. */
    if (actif.expressions_traduites) {
      const traduitesExpr = actif.expressions_traduites.en + actif.expressions_traduites.fr;
      const lecture = actif.expressions_sans_equivalent
        ? actif.expressions_sans_equivalent.en + actif.expressions_sans_equivalent.fr : 0;
      fiche.appendChild(document.createTextNode(' · ' + I18n.t(
        'reglages.dictionnaire.expressions',
        { n: traduitesExpr.toLocaleString(I18n.langue) })));
      if (lecture) {
        fiche.appendChild(document.createTextNode(' · ' + I18n.t(
          'reglages.dictionnaire.expressions.lecture',
          { n: lecture.toLocaleString(I18n.langue) })));
      }
    }
    zone.appendChild(fiche);

    if (installeComplet) {
      const bouton = element('button', 'bouton-discret', I18n.t('reglages.supprimer'));
      bouton.type = 'button';
      bouton.addEventListener('click', async () => {
        const taille = Paquets.humain(Paquets.poids(manifeste), I18n.langue);
        if (!racine.confirm(I18n.t('reglages.supprimer.confirme', { taille }))) return;
        await Paquets.supprimer();
        await Lexique.charger('noyau');
        await Store.ecrireReglage('paquet', 'noyau');
        reglages.paquet = 'noyau';
        dessinerReglages();
        chercher();
      });
      zone.appendChild(bouton);
      return;
    }

    const complets = manifeste.paquets.complet.entrees;
    const noyaux = manifeste.paquets.noyau.entrees;
    const detail = element('p', 'discret', I18n.t('reglages.telecharger.detail', {
      n: (complets.en + complets.fr - noyaux.en - noyaux.fr).toLocaleString(I18n.langue),
    }));
    const bouton = element('button', 'bouton-principal', I18n.t('reglages.telecharger', {
      taille: Paquets.humain(Paquets.poids(manifeste), I18n.langue),
    }));
    bouton.type = 'button';
    bouton.addEventListener('click', () => lancerTelechargement(zone, bouton));
    zone.appendChild(bouton);
    zone.appendChild(detail);
  }

  // ── Sauvegarde et restauration ────────────────────────────────────────────

  /* Exporter, puis importer en deux temps : examiner, puis appliquer.
   *
   * Le temps intermédiaire n'est pas une politesse, c'est le cœur du sujet. Un
   * fichier peut être plus ancien que ce qu'il y a dans l'appareil ; l'écrire
   * par-dessus sans rien dire détruirait des révisions plus récentes, et
   * personne ne s'en apercevrait avant des semaines. On montre donc d'abord ce
   * qui entrerait, ce qui existe déjà, et ce qui se contredit — puis on demande.
   */
  function dessinerSauvegarde() {
    const zone = elements.zoneSauvegarde;
    if (!zone) return;
    zone.textContent = '';

    const ligne = element('div', 'ligne-boutons');
    const exporter = element('button', 'bouton-discret', I18n.t('sauvegarde.exporter'));
    exporter.type = 'button';
    const importer = element('button', 'bouton-discret', I18n.t('sauvegarde.importer'));
    importer.type = 'button';
    ligne.appendChild(exporter);
    ligne.appendChild(importer);
    zone.appendChild(ligne);

    const fichier = element('input');
    fichier.type = 'file';
    fichier.accept = 'application/json,.json';
    fichier.hidden = true;
    zone.appendChild(fichier);

    const avis = element('div', 'sauvegarde-avis');
    zone.appendChild(avis);

    exporter.addEventListener('click', async () => {
      exporter.disabled = true;
      try {
        await Sauvegarde.exporter();
        avis.textContent = '';
        avis.appendChild(element('p', 'discret',
          I18n.t('sauvegarde.exporte', { fichier: Sauvegarde.nomDeFichier() })));
      } catch (erreur) {
        avis.textContent = I18n.t('sauvegarde.erreur.export');
      } finally {
        exporter.disabled = false;
      }
    });

    importer.addEventListener('click', () => fichier.click());
    fichier.addEventListener('change', async () => {
      const choisi = fichier.files && fichier.files[0];
      fichier.value = '';
      if (!choisi) return;
      avis.textContent = '';
      avis.appendChild(element('p', 'discret', I18n.t('sauvegarde.lecture')));
      const bilan = await Sauvegarde.examiner(choisi);
      avis.textContent = '';
      if (bilan.erreur) {
        avis.appendChild(element('p', 'sauvegarde-echec', I18n.t(bilan.erreur)));
        return;
      }
      dessinerBilanImport(avis, bilan);
    });
  }

  function compteur(hote, cle, valeur) {
    if (!valeur) return;
    hote.appendChild(element('li', null, I18n.n(cle, valeur)));
  }

  function dessinerBilanImport(avis, bilan) {
    avis.appendChild(element('p', null,
      I18n.t('sauvegarde.trouve', { date: bilan.exporte || '?' })));

    const details = element('ul', 'sauvegarde-bilan');
    compteur(details, 'sauvegarde.bilan.mots', bilan.mots.neufs.length);
    compteur(details, 'sauvegarde.bilan.notes', bilan.notes.neufs.length);
    compteur(details, 'sauvegarde.bilan.cartes', bilan.cartes.neufs.length);
    if (bilan.conversation) {
      compteur(details, 'sauvegarde.bilan.conversation', bilan.conversation.neufs.length);
    }
    const pareils = bilan.mots.pareils.length + bilan.notes.pareils.length
      + bilan.cartes.pareils.length
      + (bilan.conversation ? bilan.conversation.pareils.length : 0);
    compteur(details, 'sauvegarde.bilan.identiques', pareils);
    compteur(details, 'sauvegarde.bilan.conflits', bilan.conflits);
    const ignorees = bilan.ignorees.mots + bilan.ignorees.notes + bilan.ignorees.cartes
      + (bilan.ignorees.conversation || 0);
    compteur(details, 'sauvegarde.bilan.ignorees', ignorees);
    if (!details.childNodes.length) {
      details.appendChild(element('li', null, I18n.t('sauvegarde.bilan.rien')));
    }
    avis.appendChild(details);

    let politique = 'garder';
    if (bilan.conflits) {
      avis.appendChild(element('p', 'discret', I18n.t('sauvegarde.conflits.question')));
      const choix = element('div', 'segments');
      choix.setAttribute('role', 'group');
      for (const valeur of ['garder', 'remplacer']) {
        const bouton = element('button', null, I18n.t('sauvegarde.conflits.' + valeur));
        bouton.type = 'button';
        bouton.setAttribute('aria-pressed', String(valeur === politique));
        bouton.addEventListener('click', () => {
          politique = valeur;
          for (const autre of choix.querySelectorAll('button')) {
            autre.setAttribute('aria-pressed', String(autre === bouton));
          }
        });
        choix.appendChild(bouton);
      }
      avis.appendChild(choix);
    }

    if (!bilan.neufs && !bilan.conflits) return;

    const boutons = element('div', 'ligne-boutons');
    const valider = element('button', 'bouton-principal', I18n.t('sauvegarde.appliquer'));
    valider.type = 'button';
    valider.addEventListener('click', async () => {
      valider.disabled = true;
      const compte = await Sauvegarde.appliquer(bilan, politique);
      avis.textContent = '';
      const resume = element('ul', 'sauvegarde-bilan');
      compteur(resume, 'sauvegarde.fait.mots', compte.mots);
      compteur(resume, 'sauvegarde.fait.notes', compte.notes);
      compteur(resume, 'sauvegarde.fait.cartes', compte.cartes);
      compteur(resume, 'sauvegarde.fait.conversation', compte.conversation);
      compteur(resume, 'sauvegarde.fait.gardes', compte.gardes);
      compteur(resume, 'sauvegarde.fait.orphelines', compte.orphelines);
      if (!resume.childNodes.length) {
        resume.appendChild(element('li', null, I18n.t('sauvegarde.fait.rien')));
      }
      avis.appendChild(element('p', null, I18n.t('sauvegarde.fait')));
      avis.appendChild(resume);
      if (racine.MesMots) MesMots.dessiner();
      if (racine.Situations && !$('#vue-conversation').hidden) Situations.dessiner();
      if (racine.Seance) Seance.rafraichir();
      chercher();
    });
    boutons.appendChild(valider);
    avis.appendChild(boutons);
  }

  /* « Tout garder hors ligne » : le dictionnaire complet se télécharge de
   * lui-même, après l'ouverture, quand le réseau est là. L'accueil dit où il
   * en est ; l'application reste utilisable avec le noyau pendant ce temps.
   * Couper le réglage n'efface rien : il cesse seulement de télécharger. */
  let enArrierePlan = null;

  async function telechargerEnArrierePlan() {
    if (!manifeste || !reglages || reglages.toutHorsLigne === false) return;
    if (enArrierePlan || annulationTelechargement) return;
    if (Lexique.paquet === 'complet' && !Lexique.ancien) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const etat = elements.etatHorsLigne;
    enArrierePlan = new AbortController();
    try {
      if (etat) {
        etat.hidden = false;
        etat.textContent = I18n.t('horsligne.en-cours', { pourcent: 0 });
      }
      const fini = await Paquets.telecharger(manifeste, ({ faits, total }) => {
        if (etat) {
          etat.textContent = I18n.t('horsligne.en-cours',
            { pourcent: Math.round(100 * faits / Math.max(total, 1)) });
        }
      }, enArrierePlan.signal);
      if (!fini) { if (etat) etat.hidden = true; return; }
      await Lexique.charger('complet');
      await Store.ecrireReglage('paquet', 'complet');
      reglages.paquet = 'complet';
      cacherAvisDonnees();
      if (etat) etat.textContent = I18n.t('horsligne.fini');
      setTimeout(() => { if (etat) etat.hidden = true; }, 6000);
      if (!$('#vue-reglages').hidden) dessinerReglages();
    } catch (erreur) {
      if (etat) etat.textContent = I18n.t('horsligne.interrompu');
    } finally {
      enArrierePlan = null;
    }
  }

  async function lancerTelechargement(zone, bouton) {
    if (enArrierePlan) enArrierePlan.abort();
    bouton.disabled = true;
    bouton.textContent = I18n.t('reglages.telechargement');

    const jauge = element('div', 'jauge');
    const barre = element('div');
    jauge.appendChild(barre);
    const compteur = element('p', 'discret', '');
    const arreter = element('button', 'bouton-discret', I18n.t('reglages.telechargement.arreter'));
    arreter.type = 'button';
    zone.appendChild(jauge);
    zone.appendChild(compteur);
    zone.appendChild(arreter);

    annulationTelechargement = new AbortController();
    arreter.addEventListener('click', () => annulationTelechargement.abort());

    try {
      const fini = await Paquets.telecharger(manifeste, ({ faits, total, octets }) => {
        barre.style.width = Math.round(100 * faits / total) + '%';
        compteur.textContent = `${faits} / ${total} — ${Paquets.humain(octets, I18n.langue)}`;
      }, annulationTelechargement.signal);

      if (!fini) { dessinerDictionnaire(); return; }

      /* Le nouveau paquet est entier, l'ancien vient d'être effacé par
       * `telecharger` : on bascule d'un bloc sur la mouture courante. */
      await Lexique.charger('complet');
      await Store.ecrireReglage('paquet', 'complet');
      reglages.paquet = 'complet';
      cacherAvisDonnees();
      dessinerReglages();
      chercher();
    } catch (erreur) {
      if (erreur && erreur.name === 'AbortError') { dessinerDictionnaire(); return; }
      zone.textContent = '';
      zone.appendChild(element('p', 'discret', I18n.t('reglages.telechargement.echec')));
      const reessayer = element('button', 'bouton-principal', I18n.t('reglages.telecharger', {
        taille: Paquets.humain(Paquets.poids(manifeste), I18n.langue),
      }));
      reessayer.type = 'button';
      reessayer.addEventListener('click', () => lancerTelechargement(zone, reessayer));
      zone.appendChild(reessayer);
    } finally {
      annulationTelechargement = null;
    }
  }

  // ── Mise en place ─────────────────────────────────────────────────────────

  // ── Un nouveau téléchargement est nécessaire ──────────────────────────────

  /* Le bandeau qui le dit, au premier écran : le dictionnaire complet d'avant
   * sert encore, mais les nouveautés attendent un téléchargement. « Mettre à
   * jour » mène aux réglages, où le téléchargement se lance ; « Plus tard »
   * replie le bandeau pour cette fois — les réglages le rediront. */
  function montrerAvisDonnees() {
    const bandeau = $('#donnees-anciennes');
    if (!bandeau || !Lexique.ancien) return;
    $('#donnees-anciennes-texte').textContent = I18n.t('donnees.anciennes', {
      taille: Paquets.humain(Paquets.poids(manifeste), I18n.langue),
    });
    bandeau.hidden = false;
    requestAnimationFrame(() => bandeau.classList.add('visible'));
  }

  function cacherAvisDonnees() {
    const bandeau = $('#donnees-anciennes');
    if (!bandeau) return;
    bandeau.classList.remove('visible');
    bandeau.hidden = true;
  }

  function brancher(etatInitial) {
    reglages = etatInitial.reglages;
    manifeste = etatInitial.manifeste;

    Object.assign(elements, {
      q: $('#q'),
      qVider: $('#q-vider'),
      resultats: $('#resultats'),
      accueilModules: $('#accueil-modules'),
      accueilDecouvrir: $('#accueil-decouvrir'),
      decouvrir: $('#decouvrir'),
      etatHorsLigne: $('#etat-hors-ligne'),
      expressions: $('#resultats-expressions'),
      conversation: $('#resultats-conversation'),
      resultatsSuite: $('#resultats-suite'),
      versConversation: $('#b-vers-conversation'),
      accueil: $('#accueil'),
      rien: $('#rien'),
      rienConseil: $('#rien-conseil'),
      suggestions: $('#suggestions'),
      recents: $('#recents'),
      onglets: $('#onglets'),
      fiche: $('#fiche'),
      ficheContenu: $('#fiche-contenu'),
      zoneTelechargement: $('#zone-telechargement'),
      etatDictionnaire: $('#etat-dictionnaire'),
      reglageVoix: $('#reglage-voix'),
      reglageArticle: $('#reglage-article'),
      reglageCrus: $('#reglage-crus'),
      reglageUs: $('#reglage-us'),
      reglageHorsLigne: $('#reglage-hors-ligne'),
      reglageNouveautes: $('#reglage-nouveautes'),
      etatVoix: $('#etat-voix'),
      zoneVoix: $('#zone-voix'),
      ajouterSousRien: $('#b-ajouter-rien'),
      ajouterSousListe: $('#b-ajouter-liste'),
      zoneSauvegarde: $('#zone-sauvegarde'),
      aproposVersions: $('#apropos-versions'),
      verifierMaj: $('#b-verifier-maj'),
      etatMaj: $('#etat-maj'),
      progresContenu: $('#progres-contenu'),
    });

    Seance.brancher(reglages);
    Installer.brancher();

    /* Un seul écouteur pour tous les mots cliquables de l'application, posé une
     * fois pour toutes : les fiches se redessinent sans avoir à le refaire.
     *
     * Il est branché **avant** la touche Échap ci-dessous, et l'ordre compte :
     * les deux écoutent le document, et Échap doit d'abord refermer le
     * cartouche ouvert par-dessus la fiche, pas la fiche elle-même. */
    MotsVifs.brancher();
    Atelier.brancher();
    MesMots.brancher();
    if (racine.Situations) Situations.brancher(reglages);
    if (elements.versConversation) {
      elements.versConversation.addEventListener('click', () => basculer('conversation'));
    }
    const retourConversation = $('#b-conv-retour');
    if (retourConversation) {
      retourConversation.addEventListener('click', () => basculer('modules', { accueil: true }));
    }
    const effacerHistorique = $('#b-effacer-historique');
    if (effacerHistorique) {
      effacerHistorique.addEventListener('click', async () => {
        await Store.effacerHistorique().catch(() => {});
        dessinerNotesEtHistorique();
        dessinerRecents();
      });
    }

    elements.ajouterSousRien.addEventListener('click', ajouterLeMotCherche);
    elements.ajouterSousListe.addEventListener('click', ajouterLeMotCherche);

    elements.q.addEventListener('input', chercher);
    elements.qVider.addEventListener('click', () => {
      elements.q.value = '';
      chercher();
      elements.q.focus();
    });

    elements.onglets.addEventListener('click', (e) => {
      const bouton = e.target.closest('button[data-vue]');
      if (!bouton) return;
      // Toucher l'onglet des modules quand on y est déjà ramène à son accueil.
      const dejaLa = bouton.dataset.vue === 'modules'
        && (vueCourante === 'modules' || vueCourante === 'conversation');
      basculer(bouton.dataset.vue, dejaLa ? { accueil: true } : {});
    });

    for (const bouton of document.querySelectorAll('[data-langue]')) {
      bouton.addEventListener('click', async () => {
        I18n.definir(bouton.dataset.langue);
        await Store.ecrireReglage('langue', bouton.dataset.langue);
      });
    }

    elements.reglageNouveautes.addEventListener('change', async () => {
      const valeur = Math.max(0, Math.min(60, Number(elements.reglageNouveautes.value) || 0));
      elements.reglageNouveautes.value = String(valeur);
      reglages.nouveautesParJour = valeur;
      Seance.quota = valeur;
      await Store.ecrireReglage('nouveautesParJour', valeur);
      Seance.rafraichir();
    });

    for (const bouton of document.querySelectorAll('[data-sens]')) {
      bouton.addEventListener('click', async () => {
        reglages.sensDeTravail = bouton.dataset.sens;
        Revision.sensDeTravail = reglages.sensDeTravail;
        await Store.ecrireReglage('sensDeTravail', reglages.sensDeTravail);
        dessinerReglages();
      });
    }

    elements.reglageArticle.addEventListener('change', async () => {
      reglages.exigerArticle = elements.reglageArticle.checked;
      Seance.exigerArticle = reglages.exigerArticle;
      await Store.ecrireReglage('exigerArticle', reglages.exigerArticle);
    });

    /* Les mots crus : masqués d'office. Les montrer change la recherche, les
     * fiches, les listes de l'argot et les exercices — on redessine ce qui
     * est à l'écran. */
    elements.reglageCrus.addEventListener('change', async () => {
      reglages.montrerCrus = elements.reglageCrus.checked;
      Lexique.montrerCrus = reglages.montrerCrus;
      await Store.ecrireReglage('montrerCrus', reglages.montrerCrus);
      chercher();
    });

    elements.reglageUs.addEventListener('change', async () => {
      reglages.montrerUs = elements.reglageUs.checked;
      await Store.ecrireReglage('montrerUs', reglages.montrerUs);
    });

    elements.reglageHorsLigne.addEventListener('change', async () => {
      reglages.toutHorsLigne = elements.reglageHorsLigne.checked;
      await Store.ecrireReglage('toutHorsLigne', reglages.toutHorsLigne);
      if (reglages.toutHorsLigne) telechargerEnArrierePlan();
      else if (enArrierePlan) enArrierePlan.abort();
    });

    /* Chercher une mise à jour à la main. Le bandeau s'affiche de lui-même si
     * une version arrive ; ce bouton sert à celui qui veut en avoir le cœur net
     * — et à savoir, quand tout va bien, qu'il n'y a rien à faire. */
    elements.verifierMaj.addEventListener('click', async () => {
      elements.verifierMaj.disabled = true;
      elements.etatMaj.textContent = I18n.t('maj.recherche');
      const etat = await MiseAJour.verifier(true);
      elements.verifierMaj.disabled = false;
      elements.etatMaj.textContent = I18n.t('maj.etat.' + etat);
    });

    elements.reglageVoix.addEventListener('change', async () => {
      Voix.actif = elements.reglageVoix.checked;
      reglages.voix = elements.reglageVoix.checked;
      await Store.ecrireReglage('voix', reglages.voix);
      dessinerVoix();
    });

    /* La liste des voix arrive souvent après l'écran : le bloc des Réglages
     * se redessine pour dire ce qui est vraiment là. Les boutons ▸ des
     * fiches, eux, se repeignent d'eux-mêmes (`Voix.brancherBouton`). */
    document.addEventListener('voix-changees', () => {
      if (!$('#vue-reglages').hidden) dessinerVoix();
    });
    /* Après « Essayer », les détails disent aussitôt à quelle voix la phrase
     * est partie — les détails restent dépliés, seul leur texte change. */
    document.addEventListener('voix-parle', () => {
      const ligne = $('#zone-voix .reglage-voix-dernier');
      const dernier = Voix.dernier();
      if (ligne && dernier) {
        ligne.textContent = I18n.t('reglages.voix.details.dernier',
          { texte: dernier.texte, nom: dernier.voix || '?', lang: dernier.lang || '?' });
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !elements.fiche.hidden) fermerFiche();
    });

    // Un changement de langue redessine ce qui est déjà affiché : les résultats
    // et la fiche portent des textes traduits qu'`I18n.appliquer` ne voit pas,
    // puisqu'ils ont été fabriqués en JavaScript.
    document.addEventListener('langue-changee', () => {
      dessinerSuggestions();
      dessinerRecents();
      dessinerAccueil();
      if (racine.Modules && !$('#vue-modules').hidden) Modules.dessiner();
      chercher();
      if (!elements.fiche.hidden) fermerFiche();
      if (racine.MesMots) MesMots.fermerFormulaire();
      if (racine.Situations) Situations.fermerFormulaire();
      if (racine.Situations && !$('#vue-conversation').hidden) Situations.dessiner();
      if (!$('#vue-reglages').hidden) dessinerReglages();
      if (racine.Atelier) Atelier.dessiner();
      if (!$('#vue-reviser').hidden) Seance.rafraichir();
      if (!$('#vue-mesmots').hidden) MesMots.dessiner();
      if (!$('#vue-progres').hidden) Progres.dessiner(elements.progresContenu);
    });

    Revision.sensDeTravail = reglages.sensDeTravail || 'les-deux';
    Lexique.montrerCrus = !!reglages.montrerCrus;
    Seance.exigerArticle = reglages.exigerArticle === true;
    Voix.configurer(reglages);
    Voix.actif = !!reglages.voix;
    $('#b-donnees-mettre-a-jour').addEventListener('click', () => {
      cacherAvisDonnees();
      basculer('reglages');
    });
    $('#b-donnees-plus-tard').addEventListener('click', cacherAvisDonnees);
    if (Lexique.ancien) montrerAvisDonnees();
    dessinerSuggestions();
    dessinerRecents();
    basculer('chercher');
  }

  racine.App = {
    brancher, basculer, ouvrirFiche, ouvrirPanneau, fermerFiche, chercher,
    telechargerEnArrierePlan,
    allerA: (nom) => basculer(nom),
    get reglages() { return reglages; },
  };

})(window);
