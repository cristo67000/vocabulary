'use strict';
/*
 * Les mots suivis : les voir, et pouvoir en retirer.
 *
 * La file de révision était une boîte noire — trois compteurs, un bouton, et
 * aucun moyen de savoir ce qu'on avait mis dedans. Pour retirer un mot ajouté
 * par erreur, il fallait le retrouver dans le dictionnaire et rouvrir sa fiche,
 * donc se souvenir de son orthographe : c'est précisément ce qu'on ne sait pas
 * encore, puisqu'on l'apprend.
 *
 * ── Retirer ne demande pas confirmation, mais s'annule ─────────────────────
 *
 * Une boîte de dialogue à chaque retrait fatiguerait pour rien, et « êtes-vous
 * sûr ? » n'a jamais empêché personne de se tromper. Le mot part donc tout de
 * suite ; sa ligne se change en « retiré — Annuler », et ses cartes sont mises
 * de côté. Les remettre les rétablit telles quelles : intervalle, facilité,
 * nombre de réussites. Un mot su depuis trois mois ne redevient pas neuf pour
 * un clic de travers — alors que le retirer puis le rajouter par la fiche, lui,
 * en fait bel et bien un mot neuf.
 *
 * ── Ce qu'une ligne montre ─────────────────────────────────────────────────
 *
 * Le mot, sa langue, ses traductions, et quand il revient. L'article manque, et
 * c'est à regret : l'index ne porte pas le genre, et l'y chercher demanderait
 * d'ouvrir autant de tranches du dictionnaire que la liste a de mots. La fiche,
 * elle, est à un clic — c'est là qu'on lit « die Bohne ».
 *
 * Les derniers ajoutés en tête : on vient ici pour défaire ce qu'on vient de
 * faire, bien plus souvent que pour relire une liste alphabétique.
 */
(function (racine) {

  const JOUR = 24 * 60 * 60 * 1000;

  /* Au-delà, on s'arrête et on invite à filtrer. Dessiner trois mille lignes
   * coûte une seconde d'attente pour une liste que personne ne lira jusqu'au
   * bout ; le filtre, lui, va droit au mot cherché. */
  const PLAFOND = 150;

  /* En dessous, le champ de filtre est un meuble inutile. */
  const FILTRE_A_PARTIR_DE = 12;

  let elements = null;
  let filtre = '';
  const retires = new Map();   // identifiant → { groupe, cartes } en attente

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined && texte !== null) noeud.textContent = texte;
    return noeud;
  }

  function brancher() {
    if (elements) return;
    elements = {
      section: document.getElementById('mots-suivis'),
      compte: document.getElementById('suivis-compte'),
      champ: document.getElementById('suivis-filtre'),
      liste: document.getElementById('suivis-liste'),
      reste: document.getElementById('suivis-reste'),
      rien: document.getElementById('suivis-rien'),
    };
    if (!elements.section) return;
    elements.champ.addEventListener('input', () => {
      filtre = Lexique.cle(elements.champ.value);
      dessiner();
    });
  }

  // ── Ce qu'on sait de chaque mot ───────────────────────────────────────────

  /* Une carte par sens et par genre ; ici on raisonne par mot. */
  function grouper(cartes) {
    const groupes = new Map();
    for (const carte of cartes) {
      /* Un mot personnel se groupe sous son identifiant, jamais sous sa
       * graphie : deux entrées peuvent s'écrire pareil — celle du dictionnaire
       * et la sienne — et les confondre mêlerait leurs échéances. */
      const id = carte.conversation ? 'conv ' + carte.conversation
        : (carte.perso ? 'perso ' + carte.perso : carte.langue + ' ' + carte.mot);
      const groupe = groupes.get(id);
      if (groupe) {
        groupe.cartes.push(carte);
        groupe.cree = Math.min(groupe.cree, carte.cree);
      } else {
        groupes.set(id, { id, langue: carte.langue, mot: carte.mot,
                          perso: carte.perso || null,
                          conversation: carte.conversation || null,
                          cree: carte.cree, cartes: [carte] });
      }
    }
    return groupes;
  }

  function minuit(instant) {
    const d = new Date(instant);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  /* Quand ce mot revient, en trois mots. On compte en jours de calendrier et
   * non en tranches de vingt-quatre heures : une échéance à ce soir n'est pas
   * « demain », et une échéance dans vingt-cinq heures ne l'est pas non plus. */
  function quand(groupe, t) {
    const engagees = groupe.cartes.filter((c) => c.etat !== 'nouveau');
    if (!engagees.length) return { cle: 'suivis.neuf' };
    const echeance = Math.min.apply(null, engagees.map((c) => c.echeance));
    if (echeance <= t) return { cle: 'suivis.du', du: true };
    const jours = Math.round((minuit(echeance) - minuit(t)) / JOUR);
    if (jours <= 0) return { cle: 'suivis.aujourdhui' };
    return { cle: 'suivis.dans', nombre: jours };
  }

  // ── Retirer, et remettre ──────────────────────────────────────────────────

  async function retirer(groupe) {
    retires.set(groupe.id, { groupe, cartes: groupe.cartes });
    await Revision.oublier(groupe.langue, groupe.mot, groupe.perso, groupe.conversation);
    await Seance.rafraichir();
    /* La main passe au bouton qui annule : c'est le seul geste qui ait un sens
     * juste après, et il doit être atteignable sans souris. */
    const annuler = elements.liste.querySelector('[data-annuler]');
    if (annuler) annuler.focus();
  }

  async function remettre(id) {
    const retrait = retires.get(id);
    if (!retrait) return;
    retires.delete(id);
    for (const carte of retrait.cartes) await Store.ecrireCarte(carte);
    await Seance.rafraichir();
  }

  /* Les annulations ne valent que le temps qu'on reste devant la liste. */
  function reinitialiser() {
    if (!retires.size && !filtre) return;
    retires.clear();
    filtre = '';
    if (elements && elements.champ) elements.champ.value = '';
  }

  // ── Dessin ────────────────────────────────────────────────────────────────

  function ligneRetiree(groupe) {
    const li = element('li', 'suivi-retrait');
    li.appendChild(element('span', 'suivi-retire',
      I18n.t('suivis.retire', { mot: groupe.mot })));
    const annuler = element('button', 'lien-discret', I18n.t('suivis.annuler'));
    annuler.type = 'button';
    annuler.dataset.annuler = groupe.id;
    annuler.addEventListener('click', () => remettre(groupe.id));
    li.appendChild(annuler);
    return li;
  }

  function ligne(groupe, t) {
    if (retires.has(groupe.id)) return ligneRetiree(groupe);

    const li = element('li');
    /* La tranche vient de l'index, pas de la carte : le paquet complet a pu
     * être supprimé depuis, et le numéro qu'elle garde désignerait alors un
     * fichier qui n'existe plus. Sans vedette, le mot s'affiche sans être
     * cliquable — il reste retirable, ce pour quoi on est venu. */
    /* Un mot personnel s'ouvre par son identifiant, et il est toujours là :
     * il ne dépend d'aucun paquet téléchargé. */
    /* Une phrase de « Phrases et dialogues » s'ouvre par son identifiant ;
     * elle porte une pastille à elle, et sa traduction vient du module. */
    const perso = groupe.perso && racine.Perso ? Perso.brut(groupe.perso) : null;
    const phrase = groupe.conversation && racine.Conversation
      ? Conversation.apercu(groupe.conversation) : null;
    const vedette = phrase ? { conversation: groupe.conversation }
      : (perso ? Perso.resultat(perso, true, null)
               : (groupe.conversation ? null : Lexique.vedette(groupe.langue, groupe.mot)));
    const corps = element(vedette ? 'button' : 'div', 'suivi-mot');
    if (vedette) {
      corps.type = 'button';
      corps.addEventListener('click', () => App.ouvrirFiche(vedette));
    }
    corps.appendChild(element('span', 'pastille',
      I18n.t(groupe.conversation ? 'conv.marque.phrase' : 'langue.' + groupe.langue + '.court')));
    corps.appendChild(element('span', 'mot', groupe.mot));
    if (groupe.perso || (groupe.conversation && racine.Conversation
                         && Conversation.estPersonnel(groupe.conversation))) {
      corps.appendChild(element('span', 'pastille perso', I18n.t('perso.marque')));
    }
    if (phrase && phrase.fr) {
      corps.appendChild(element('span', 'traduction', phrase.fr));
    } else if (vedette && vedette.apercu) {
      corps.appendChild(element('span', 'traduction', vedette.apercu));
    }
    li.appendChild(corps);

    const echeance = quand(groupe, t);
    const etiquette = element('span', 'suivi-quand' + (echeance.du ? ' du' : ''),
      echeance.nombre === undefined
        ? I18n.t(echeance.cle)
        : I18n.n(echeance.cle, echeance.nombre));
    li.appendChild(etiquette);

    const retirer_ = element('button', 'retirer', '✕');
    retirer_.type = 'button';
    retirer_.setAttribute('aria-label', I18n.t('suivis.retirer', { mot: groupe.mot }));
    retirer_.addEventListener('click', () => retirer(groupe));
    li.appendChild(retirer_);
    return li;
  }

  async function dessiner() {
    brancher();
    if (!elements.section) return;

    const groupes = grouper(await Store.toutesLesCartes());
    // Un mot retiré garde sa place tant qu'on peut encore le remettre.
    for (const [id, retrait] of retires) {
      if (!groupes.has(id)) groupes.set(id, retrait.groupe);
    }

    const tous = Array.from(groupes.values()).sort((a, b) => b.cree - a.cree);
    elements.section.hidden = tous.length === 0;
    if (!tous.length) return;

    elements.compte.textContent = I18n.n('suivis.compte', tous.length);
    elements.champ.hidden = tous.length < FILTRE_A_PARTIR_DE;

    const retenus = filtre
      ? tous.filter((g) => Lexique.cle(g.mot).indexOf(filtre) !== -1)
      : tous;

    const t = Date.now();
    const liste = elements.liste;
    liste.textContent = '';
    for (const groupe of retenus.slice(0, PLAFOND)) liste.appendChild(ligne(groupe, t));

    const reste = retenus.length - PLAFOND;
    elements.reste.hidden = reste <= 0;
    if (reste > 0) elements.reste.textContent = I18n.n('suivis.reste', reste);
    elements.rien.hidden = retenus.length > 0;
  }

  racine.Suivis = { dessiner, reinitialiser };

})(window);
