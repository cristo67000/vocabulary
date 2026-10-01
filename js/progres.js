'use strict';
/*
 * Ce qu'on a appris, et ce qu'on croit avoir appris.
 *
 * La mesure qui compte est **produire**, pas reconnaître. Retrouver « maison »
 * en face de « Haus » dans une liste de quatre est facile et donne le sentiment
 * de savoir ; écrire « Haus » quand on ne voit que « maison » est ce qu'il
 * faudra faire pour parler. Un compteur qui mélange les deux flatte, et
 * flatter un apprenant lui coûte des mois.
 *
 * Cet onglet distingue donc :
 *   sus par cœur   les mots écrits correctement au moins une fois, de mémoire
 *   en cours       les mots seulement reconnus, ou encore en apprentissage
 *   pas encore vus les mots ajoutés mais jamais travaillés
 *
 * La série de jours d'affilée est là parce qu'elle est vraie et qu'elle motive.
 * Elle n'est pas mise en avant : réviser dix minutes chaque jour vaut mieux que
 * de tenir une série, et une série rompue ne doit pas décourager.
 */
(function (racine) {

  /* Les exercices où l'on produit **la vedette** de mémoire, par opposition à
   * ceux où on la reconnaît parmi d'autres.
   *
   * `saisie-traduction` n'y figure pas, et ce n'est pas un oubli : écrire
   * « maison » en voyant « das Haus » est de la compréhension mise au clavier,
   * pas de la production. La ranger ici gonflerait le compteur qui se veut
   * précisément celui qui ne flatte pas. Le pluriel et la conjugaison, eux,
   * demandent bien une forme qu'il a fallu retenir. */
  const PRODUCTION = ['saisie', 'saisie-article', 'trou', 'ecoute',
                      'pluriel', 'conjugaison'];

  const JOUR = 24 * 60 * 60 * 1000;

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined && texte !== null) noeud.textContent = texte;
    return noeud;
  }

  /* Ce qui identifie un mot dans les statistiques.
   *
   * Un mot personnel se compte sous son identifiant, jamais sous sa graphie :
   * on peut avoir ajouté « Zug » avec sa propre traduction alors que le
   * dictionnaire le connaît déjà, et les deux s'apprennent séparément. Les
   * confondre ferait passer pour su un mot qu'on n'a jamais révisé. */
  function cleDuMot(ligne) {
    if (ligne.conversation) return 'conv ' + ligne.conversation;
    return ligne.perso ? 'perso ' + ligne.perso : ligne.langue + ' ' + ligne.mot;
  }

  function jourDe(instant) {
    const d = new Date(instant);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  async function calculer() {
    const cartes = await Store.toutesLesCartes();
    // Trois mois de journal suffisent aux histogrammes ; les totaux, eux,
    // se lisent sur les cartes, qui gardent la mémoire longue.
    const journal = await Store.journalDepuis(Date.now() - 120 * JOUR);

    const produits = new Set();
    const reconnus = new Set();
    const echecs = new Map();
    const parJour = new Map();
    let libres = 0;

    for (const ligne of journal) {
      /* Les réponses données en atelier sont marquées `libre`. Elles ne
       * comptent pas dans la mémorisation, et c'est voulu : un atelier se
       * refait dix fois de suite, et dix réussites d'affilée sur le même mot ne
       * disent rien de ce qu'on en saura demain. La seule mesure honnête est
       * celle des rappels espacés. Elles sont comptées à part, parce que ce
       * travail a bien eu lieu et qu'il mérite d'être vu. */
      if (ligne.libre) {
        libres += 1;
        const jourLibre = jourDe(ligne.quand);
        parJour.set(jourLibre, (parJour.get(jourLibre) || 0) + 1);
        continue;
      }
      const mot = cleDuMot(ligne);
      if (ligne.qualite >= 2) {
        (PRODUCTION.indexOf(ligne.exercice) !== -1 ? produits : reconnus).add(mot);
      } else if (ligne.qualite === 0) {
        echecs.set(mot, (echecs.get(mot) || 0) + 1);
      }
      const jour = jourDe(ligne.quand);
      parJour.set(jour, (parJour.get(jour) || 0) + 1);
    }
    for (const mot of produits) reconnus.delete(mot);

    const suivis = new Set(cartes.map(cleDuMot));
    const jamais = new Set(suivis);
    for (const mot of produits) jamais.delete(mot);
    for (const mot of reconnus) jamais.delete(mot);

    // Série : jours consécutifs avec au moins une réponse, en remontant depuis
    // aujourd'hui. Une journée entamée mais pas encore travaillée ne rompt pas
    // la série — on ne la compte qu'à partir d'hier.
    let serie = 0;
    let curseur = jourDe(Date.now());
    if (!parJour.has(curseur)) curseur -= JOUR;
    while (parJour.has(curseur)) { serie += 1; curseur -= JOUR; }

    const semaine = [];
    for (let i = 6; i >= 0; i -= 1) {
      const jour = jourDe(Date.now() - i * JOUR);
      semaine.push({ jour, nombre: parJour.get(jour) || 0 });
    }

    const difficiles = Array.from(echecs.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 8);

    return {
      suivis: suivis.size,
      libres,
      produits: produits.size,
      reconnus: reconnus.size,
      jamais: jamais.size,
      serie,
      semaine,
      difficiles,
      reponses: journal.length,
      vide: journal.length === 0 && cartes.length === 0,
    };
  }

  function bloc(titre) {
    const section = element('section', 'progres-bloc');
    if (titre) section.appendChild(element('h3', null, titre));
    return section;
  }

  function compteur(valeur, libelle, classe) {
    const bloc = element('div', 'compteur ' + (classe || ''));
    bloc.appendChild(element('span', 'chiffre', String(valeur)));
    bloc.appendChild(element('span', 'etiquette-compteur', libelle));
    return bloc;
  }

  async function dessiner(conteneur) {
    const etat = await calculer();
    conteneur.textContent = '';

    if (etat.vide) {
      conteneur.appendChild(element('p', 'discret', I18n.t('progres.vide')));
      return;
    }

    const chiffres = element('div', 'compteurs');
    chiffres.appendChild(compteur(etat.produits, I18n.t('progres.produits'), 'bien'));
    chiffres.appendChild(compteur(etat.reconnus, I18n.t('progres.reconnus')));
    chiffres.appendChild(compteur(etat.jamais, I18n.t('progres.nouveaux')));
    conteneur.appendChild(chiffres);
    conteneur.appendChild(element('p', 'discret', I18n.t('progres.explication')));

    const activite = bloc(I18n.t('progres.semaine'));
    const barres = element('div', 'barres');
    const maximum = Math.max(1, ...etat.semaine.map((j) => j.nombre));
    const jours = I18n.langue === 'en'
      ? ['S', 'M', 'T', 'W', 'T', 'F', 'S']
      : ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    for (const jour of etat.semaine) {
      const colonne = element('div', 'barre');
      const barre = element('div');
      barre.style.height = Math.round(100 * jour.nombre / maximum) + '%';
      barre.title = String(jour.nombre);
      colonne.appendChild(barre);
      colonne.appendChild(element('span', null, jours[new Date(jour.jour).getDay()]));
      barres.appendChild(colonne);
    }
    activite.appendChild(barres);
    const detail = I18n.n('progres.reponses', etat.reponses)
      + ' · ' + I18n.n('progres.serie', etat.serie)
      + (etat.libres ? ' · ' + I18n.n('progres.libres', etat.libres) : '');
    activite.appendChild(element('p', 'discret', detail));
    conteneur.appendChild(activite);

    if (etat.difficiles.length) {
      const rebelles = bloc(I18n.t('progres.difficiles'));
      const liste = element('ul', 'liste-mots');
      for (const [identifiant, nombre] of etat.difficiles) {
        const espace = identifiant.indexOf(' ');
        const langue = identifiant.slice(0, espace);
        const mot = identifiant.slice(espace + 1);
        const ligne = element('li');
        /* Une phrase se nomme par son identifiant : on affiche son texte,
         * et on ouvre sa fiche par le module. */
        const phrase = langue === 'conv' && racine.Conversation
          ? Conversation.apercu(mot) : null;
        const bouton = element('button', 'lien-discret', phrase ? phrase.en : mot);
        bouton.type = 'button';
        bouton.addEventListener('click', () => {
          if (langue === 'conv') {
            if (phrase) App.ouvrirFiche({ conversation: mot });
            return;
          }
          const trouves = Lexique.chercher(mot, 8)
            .filter((r) => r.langue === langue && r.mot === mot);
          if (trouves.length) App.ouvrirFiche(trouves[0]);
        });
        ligne.appendChild(bouton);
        ligne.appendChild(element('span', 'compte', String(nombre)));
        liste.appendChild(ligne);
      }
      rebelles.appendChild(liste);
      conteneur.appendChild(rebelles);
    }
  }

  racine.Progres = { calculer, dessiner, PRODUCTION };

})(window);
