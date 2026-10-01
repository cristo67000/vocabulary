'use strict';
/*
 * Le mot cliquable — ce qui fait d'une lecture un apprentissage.
 *
 * ── Pourquoi ────────────────────────────────────────────────────────────────
 *
 * On apprend le vocabulaire en lisant, et on bute sur un mot par phrase. En
 * version 1, ce mot était du texte mort : il fallait le retenir, fermer la
 * fiche, le retaper dans la recherche, rouvrir. Quatre gestes pour une
 * curiosité — autant dire qu'on ne le faisait pas, et que le mot était perdu.
 *
 * Ici, chaque mot d'une définition, d'une citation ou d'une phrase d'exemple
 * est cliquable, et le cartouche qui s'ouvre porte le bouton « Apprendre ».
 * Un doigt entre lire un mot et l'avoir dans ses révisions. C'est le seul
 * changement de la version 2 qui modifie ce qu'on *fait* de l'application.
 *
 * ── Jamais de bouton mort ───────────────────────────────────────────────────
 *
 * Un mot que le paquet installé ne connaît pas reste du texte ordinaire : ni
 * souligné, ni cliquable. Rien n'est plus décourageant qu'un lien qui n'ouvre
 * rien, et avec le seul noyau — 12 000 mots par langue — cela arrive souvent.
 * La résolution se fait donc à l'affichage, par `Lexique.resoudre()`, et non
 * au clic.
 *
 * ── Un seul écouteur ────────────────────────────────────────────────────────
 *
 * Une fiche bien fournie compte plusieurs centaines de mots. Poser un écouteur
 * sur chacun coûterait autant de fermetures à retenir, et il faudrait les
 * défaire à chaque fermeture de fiche. Un unique écouteur délégué sur le
 * document suffit, et survit à tous les redessins.
 */
(function (racine) {

  /* Un mot : des lettres, éventuellement liées par une apostrophe ou un trait
   * d'union. Même définition que `Fiche.souligner()` en version 1 et que
   * `corpus.MOT` du côté de la construction — les trois doivent découper
   * pareil, sinon un mot cliquable ici serait introuvable là-bas. */
  const MOT = /\p{L}[\p{L}'’-]*/gu;

  let cartouche = null;
  let branche = false;

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined && texte !== null) noeud.textContent = texte;
    return noeud;
  }

  // ── Tissage ───────────────────────────────────────────────────────────────

  function dansLaMarque(debut, fin, marque) {
    return !!marque && debut >= marque[0] && fin <= marque[1];
  }

  /* Un mot du texte : cliquable s'il mène quelque part, en gras s'il est celui
   * qu'on illustre, les deux à la fois le cas échéant. */
  function jeton(graphie, langue, estCible) {
    const trouve = Lexique.resoudre(graphie, langue);
    if (!trouve) {
      return estCible ? element('b', 'cible', graphie)
                      : document.createTextNode(graphie);
    }
    const noeud = element('span', 'mot-vif' + (estCible ? ' cible' : ''), graphie);
    noeud.dataset.mot = trouve.mot;
    noeud.dataset.langue = langue;
    noeud.dataset.tranche = String(trouve.tranche);
    noeud.setAttribute('role', 'button');
    noeud.setAttribute('tabindex', '0');
    return noeud;
  }

  /* Rend le texte, mot par mot.
   *
   * `options.marque` est un couple [début, fin] en nombre de signes, tel que le
   * Wiktionnaire l'a fourni : c'est la position du mot vedette dans la
   * citation, et elle vaut mieux qu'une relemmatisation — le Wiktionnaire sait
   * lequel de « Seen » il illustre, nous ne le devinerions pas.
   *
   * `options.cible` est une clé de vedette : tout mot qui y remonte est mis en
   * gras. C'est le repli pour les phrases Tatoeba, qui n'ont pas de marque.
   */
  function tisser(texte, langue, options) {
    const reglages = options || {};
    const marque = reglages.marque || null;
    const cible = reglages.cible || null;
    const fragment = document.createDocumentFragment();

    let position = 0;
    let trouve;
    MOT.lastIndex = 0;
    while ((trouve = MOT.exec(texte)) !== null) {
      const debut = trouve.index;
      const fin = debut + trouve[0].length;
      if (debut > position) {
        fragment.appendChild(document.createTextNode(texte.slice(position, debut)));
      }
      let estCible = dansLaMarque(debut, fin, marque);
      if (!estCible && cible) {
        const k = Lexique.cle(trouve[0]);
        estCible = !!k && (k === cible || Lexique.lemmes(langue, k).indexOf(cible) !== -1);
      }
      fragment.appendChild(jeton(trouve[0], langue, estCible));
      position = fin;
    }
    if (position < texte.length) {
      fragment.appendChild(document.createTextNode(texte.slice(position)));
    }
    return fragment;
  }

  // ── Le cartouche ──────────────────────────────────────────────────────────

  function fermer() {
    if (cartouche) {
      cartouche.remove();
      cartouche = null;
    }
  }

  /* Le bouton qui met le mot en révision, sans quitter la lecture.
   *
   * C'est le même geste que sur la fiche, et il dit son état : un mot déjà
   * suivi affiche qu'il l'est et se retire d'un second clic. */
  function boutonApprendre(entree) {
    const bouton = element('button', 'cartouche-apprendre', I18n.t('fiche.apprendre'));
    bouton.type = 'button';

    function peindre(suivi) {
      bouton.textContent = I18n.t(suivi ? 'fiche.appris' : 'fiche.apprendre');
      bouton.classList.toggle('suivi', suivi);
      bouton.dataset.suivi = suivi ? '1' : '0';
    }

    Revision.estAppris(entree.langue, entree.mot).then(peindre).catch(() => {});

    bouton.addEventListener('click', async () => {
      bouton.disabled = true;
      try {
        if (bouton.dataset.suivi === '1') {
          await Revision.oublier(entree.langue, entree.mot);
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

  function garnir(corps, entree, resultat) {
    corps.textContent = '';

    const tete = element('div', 'cartouche-tete');
    const lecture = entree.lectures[0] || [];
    const articles = Exercices.ARTICLES[entree.langue] || {};
    if (lecture[0] === 'n' && articles[lecture[1]]) {
      tete.appendChild(element('span', 'article ' + lecture[1], articles[lecture[1]]));
    }
    tete.appendChild(element('b', 'cartouche-mot', entree.mot));
    if (lecture[2]) tete.appendChild(element('span', 'api', '[' + lecture[2] + ']'));
    corps.appendChild(tete);

    /* La graphie cliquée n'est pas toujours la vedette : on a cliqué
     * « Häuser » et on lit la fiche de « Haus ». Le dire évite de croire à une
     * erreur. */
    if (resultat.graphie && Lexique.cle(resultat.graphie) !== Lexique.cle(entree.mot)) {
      corps.appendChild(element('p', 'cartouche-forme',
        I18n.t('motvif.forme', { forme: resultat.graphie })));
    }

    const traductions = Exercices.traductions(entree).slice(0, 4);
    corps.appendChild(element('p', 'cartouche-sens',
      traductions.join(' · ') || I18n.t('motvif.sans-traduction')));

    const boutons = element('div', 'cartouche-boutons');
    boutons.appendChild(boutonApprendre(entree));

    if (Voix.possible(entree.langue) || !Voix.pret) {
      const ecouter = element('button', 'cartouche-ecouter', '▸');
      ecouter.type = 'button';
      ecouter.setAttribute('aria-label', I18n.t('fiche.ecouter'));
      Voix.brancherBouton(ecouter, entree.langue);
      ecouter.addEventListener('click', () => Voix.dire(entree.mot, entree.langue));
      boutons.appendChild(ecouter);
    }

    const ouvrir = element('button', 'cartouche-fiche', I18n.t('motvif.ouvrir'));
    ouvrir.type = 'button';
    ouvrir.addEventListener('click', () => {
      fermer();
      App.ouvrirFiche({ langue: entree.langue, mot: entree.mot,
                        tranche: entree.tranche });
    });
    boutons.appendChild(ouvrir);
    corps.appendChild(boutons);
  }

  /* Place le cartouche sous le mot, sans le laisser déborder de l'écran. */
  function poser(noeud) {
    const cadre = noeud.getBoundingClientRect();
    const marge = 8;
    const largeur = cartouche.offsetWidth;
    const gauche = Math.min(
      Math.max(marge, cadre.left + cadre.width / 2 - largeur / 2),
      Math.max(marge, racine.innerWidth - largeur - marge));

    /* Sous le mot d'ordinaire ; au-dessus quand il n'y a plus de place en bas.
     * Un cartouche à moitié hors de l'écran est un cartouche illisible. */
    const hauteur = cartouche.offsetHeight;
    const dessous = cadre.bottom + marge;
    const enBas = dessous + hauteur > racine.innerHeight;
    const haut = enBas ? Math.max(marge, cadre.top - hauteur - marge) : dessous;

    cartouche.style.left = Math.round(gauche) + 'px';
    cartouche.style.top = Math.round(haut) + 'px';
  }

  async function ouvrirCartouche(noeud) {
    fermer();
    const resultat = {
      langue: noeud.dataset.langue,
      mot: noeud.dataset.mot,
      tranche: Number(noeud.dataset.tranche),
      graphie: noeud.textContent,
    };

    cartouche = element('div', 'cartouche');
    cartouche.setAttribute('role', 'dialog');
    const corps = element('div', 'cartouche-corps');
    corps.appendChild(element('p', 'cartouche-attente', resultat.mot));
    cartouche.appendChild(corps);

    const fermeture = element('button', 'cartouche-fermer', '✕');
    fermeture.type = 'button';
    fermeture.setAttribute('aria-label', I18n.t('fiche.fermer'));
    fermeture.addEventListener('click', fermer);
    cartouche.appendChild(fermeture);

    document.body.appendChild(cartouche);
    poser(noeud);

    const entree = await Lexique.ouvrir(resultat).catch(() => null);
    // Le cartouche a pu être refermé, ou un autre ouvert, pendant la lecture
    // de la tranche : on ne garnit que celui qu'on a créé.
    if (!cartouche || !cartouche.isConnected) return;
    if (!entree) {
      corps.textContent = '';
      corps.appendChild(element('p', 'cartouche-sens', I18n.t('motvif.absent')));
      return;
    }
    garnir(corps, entree, resultat);
    poser(noeud);
  }

  // ── Mise en place ─────────────────────────────────────────────────────────

  function brancher() {
    if (branche) return;
    branche = true;

    document.addEventListener('click', (e) => {
      const mot = e.target.closest && e.target.closest('.mot-vif');
      if (mot) {
        e.preventDefault();
        e.stopPropagation();
        ouvrirCartouche(mot);
        return;
      }
      if (cartouche && !e.target.closest('.cartouche')) fermer();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && cartouche) {
        e.stopPropagation();
        fermer();
        return;
      }
      const mot = (e.key === 'Enter' || e.key === ' ')
        && e.target.classList && e.target.classList.contains('mot-vif')
        ? e.target : null;
      if (mot) {
        e.preventDefault();
        ouvrirCartouche(mot);
      }
    });

    /* Le cartouche est posé en coordonnées d'écran : il ne suit pas la page.
     * Plutôt que de le repositionner à chaque pixel de défilement, on le
     * referme — c'est ce qu'on attend d'une bulle, et ça ne coûte rien. */
    racine.addEventListener('resize', fermer);
    document.addEventListener('scroll', fermer, true);
  }

  racine.MotsVifs = { tisser, brancher, fermer };

})(window);
