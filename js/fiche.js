'use strict';
/*
 * La fiche d'un mot : ce qu'on voit quand on a trouvé ce qu'on cherchait.
 *
 * Quatre partis pris.
 *
 * L'article avant le nom français. Un anglophone qui apprend « maison » sans
 * « une » apprend un mot à moitié : le genre français ne se devine pas. On
 * affiche « un » / « une » plutôt que « le » / « la », qui obligerait à
 * trancher l'élision (« l'arbre ») et masquerait justement le genre.
 *
 * Le registre avant tout. « knackered » et « éreinté » se traduisent, mais
 * l'un se dit au pub et l'autre dans un roman : chaque sens porte ses marques
 * d'usage — familier, argot, vulgaire, britannique, vieilli — en pastilles.
 * Les mots crus (vulgaires, injurieux) restent masqués tant qu'on ne demande
 * pas à les voir, et la fiche dit combien elle en tait.
 *
 * L'anglais britannique d'abord. « colour » est en vedette, « US : color » en
 * pastille ; la prononciation affichée est celle de Grande-Bretagne.
 *
 * Les lectures les unes sous les autres. « livre » est masculin quand c'est un
 * ouvrage, féminin quand c'est un poids. Les mettre côte à côte fait de
 * l'homographe une leçon.
 *
 * **Chaque signification porte ses propres exemples**, dans les deux formes
 * que les données permettent :
 *
 *   citations  du Wiktionnaire, dans la langue du mot — le mot vedette y est
 *              marqué, chaque mot est cliquable, et celles des mots anglais
 *              les plus courants sont traduites ;
 *   phrases    de Tatoeba, avec leur traduction en regard.
 *
 * **Tout mot est cliquable** (`motsvifs.js`) : dans les définitions, dans les
 * citations, dans les phrases. Un mot inconnu rencontré en lisant se met dans
 * les révisions sans quitter la fiche. C'est le geste que la version 1 rendait
 * si coûteux que personne ne le faisait.
 */
(function (racine) {

  /* Les articles viennent d'`Exercices`, qui en a besoin pour corriger : deux
   * tables finiraient par différer, et la fiche enseignerait alors un article
   * que l'exercice compterait faux. */
  const ARTICLES = Exercices.ARTICLES;

  function element(balise, classe, texte) {
    const noeud = document.createElement(balise);
    if (classe) noeud.className = classe;
    if (texte !== undefined && texte !== null) noeud.textContent = texte;
    return noeud;
  }

  function nomDeNature(code) {
    if (!code) return '';
    // Le TEI écrit tantôt « adv », tantôt « Adverb » : même chose.
    const normalise = code === 'Adverb' ? 'adv' : code;
    const texte = I18n.t('nature.' + normalise);
    return texte.startsWith('‹') ? normalise : texte;
  }

  /* Le mot tel qu'on le prononce. La voix lit la vedette seule : « une
   * maison » ferait entendre l'article comme une partie du mot. */
  function formeParlee(entree) {
    return entree.mot;
  }

  /* Les marques d'usage qu'on sait nommer, dans l'ordre où la construction
   * les range (voir build/marques.py). */
  const MARQUES = ['inj', 'vulg', 'pej', 'tfam', 'arg', 'fam', 'web', 'abr', 'neo',
    'angl', 'hum', 'iron', 'euph', 'enf', 'fig', 'sout', 'vieilli', 'vx', 'rare', 'dial',
    'gb', 'us', 'ie', 'sc', 'au', 'nz', 'ca', 'za', 'in', 'qc', 'be', 'ch', 'af'];
  const CRUES = ['vulg', 'inj'];

  function estCru(bloc) {
    const marques = bloc[4] || [];
    return marques.some((m) => CRUES.indexOf(m) !== -1);
  }

  function pastillesDeMarques(marques) {
    const bloc = element('span', 'marques');
    for (const code of marques || []) {
      if (MARQUES.indexOf(code) === -1) continue;
      const pastille = element('span', 'marque marque-' + code, I18n.t('marque.' + code));
      pastille.title = I18n.t('marque.' + code + '.long');
      bloc.appendChild(pastille);
    }
    return bloc.childNodes.length ? bloc : null;
  }

  function enteteFiche(entree, surFermeture) {
    const tete = element('div', 'fiche-tete');
    const fermer = element('button', 'fiche-fermer', I18n.t('fiche.fermer'));
    fermer.type = 'button';
    fermer.addEventListener('click', surFermeture);
    tete.appendChild(fermer);
    return tete;
  }

  /* Le bouton qui fait entrer le mot dans les révisions.
   *
   * C'est le geste central de l'application : sans lui, on a un dictionnaire de
   * plus. Il est donc large, en bas de la vedette, et dit son état — un mot déjà
   * suivi affiche qu'il l'est, et permet de le retirer. */
  function boutonApprendre(entree) {
    /* Rien à produire, rien à apprendre : une expression attestée mais sans
     * équivalent connu n'a pas de réponse à demander. On le dit à la place du
     * bouton, plutôt que d'offrir un exercice sans solution. */
    if (!Exercices.traductions(entree).length) {
      return element('p', 'discret sans-equivalent', I18n.t('fiche.sans-equivalent'));
    }
    const bouton = element('button', 'apprendre', I18n.t('fiche.apprendre'));
    bouton.type = 'button';

    function peindre(suivi) {
      bouton.textContent = I18n.t(suivi ? 'fiche.appris' : 'fiche.apprendre');
      bouton.classList.toggle('suivi', suivi);
      bouton.dataset.suivi = suivi ? '1' : '0';
    }

    Revision.estAppris(entree.langue, entree.mot, entree.perso, null, entree.module || null)
      .then(peindre).catch(() => {});

    bouton.addEventListener('click', async () => {
      bouton.disabled = true;
      try {
        if (bouton.dataset.suivi === '1') {
          await Revision.oublier(entree.langue, entree.mot, entree.perso, null,
                                 entree.module || null);
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

  function vedette(entree) {
    const bloc = element('div', 'vedette');
    const table = ARTICLES[entree.langue] || {};
    /* Tous les articles, pas seulement le premier. « livre » est masculin
     * quand c'est un ouvrage et féminin quand c'est un poids ; n'afficher que
     * « un » apprend une moitié fausse. (L'anglais n'a pas de genre : la
     * table des articles n'a que le français.) */
    for (const genre of Exercices.genresDe(entree)) {
      if (table[genre]) bloc.appendChild(element('span', 'article ' + genre, table[genre]));
    }
    bloc.appendChild(element('span', 'mot', entree.mot));
    bloc.appendChild(element('span', 'pastille', I18n.t('langue.' + entree.langue + '.court')));
    /* « Personnel », sur la vedette et non en bas de fiche : on doit savoir
     * d'un coup d'œil qu'on lit sa propre entrée et non le dictionnaire, sans
     * quoi on croirait que le Wiktionnaire a écrit ce qu'on a écrit soi-même. */
    if (entree.perso) {
      bloc.appendChild(element('span', 'pastille perso', I18n.t('perso.marque')));
    }
    if (entree.module && racine.Modules) {
      bloc.appendChild(element('span', 'pastille module', Modules.nomCourt(entree.module)));
    }
    return bloc;
  }

  /* « US : color » sous « colour ». L'application enseigne l'anglais
   * britannique, mais l'américain se lit partout — sur les écrans surtout —,
   * et il faut savoir reconnaître les deux graphies. */
  function varianteAmericaine(entree) {
    if (!entree.us || !App.reglages || App.reglages.montrerUs === false) return null;
    const ligne = element('p', 'variante-us');
    ligne.appendChild(element('span', 'marque marque-us', I18n.t('marque.us')));
    ligne.appendChild(document.createTextNode(' ' + entree.us));
    ligne.title = I18n.t('fiche.variante-us');
    return ligne;
  }

  function ligneSon(entree) {
    const ligne = element('div', 'ligne-son');
    const prononciation = (entree.lectures.find((l) => l[2]) || [])[2];
    if (prononciation) {
      /* La source écrit tantôt « /haʊs/ », tantôt « a ku də » : on retire
       * ses délimiteurs et l'on met ceux de l'usage — barres obliques pour
       * l'anglais, comme les dictionnaires britanniques, crochets pour le
       * français, comme les dictionnaires français. */
      const nue = prononciation.replace(/^[\/\[\\]+|[\/\]\\]+$/g, '').trim();
      const affichee = entree.langue === 'en' ? '/' + nue + '/' : '[' + nue + ']';
      ligne.appendChild(element('span', 'api', affichee));
    }
    const bouton = element('button', 'ecouter', '▸ ' + I18n.t('fiche.ecouter'));
    bouton.type = 'button';
    /* Grisé tant qu'aucune voix de la langue n'est là — et repeint quand la
     * liste des voix arrive, ce qu'elle fait souvent après la fiche. */
    Voix.brancherBouton(bouton, entree.langue);
    bouton.addEventListener('click', () => Voix.dire(formeParlee(entree), entree.langue));
    ligne.appendChild(bouton);
    return ligne;
  }

  /* D'où vient une expression. Le dictionnaire et le Wiktionnaire sont cités
   * dans les Réglages pour l'ensemble ; une formule dont l'équivalent vient de
   * Tatoeba, ou une glose de l'édition d'en face, le dit sur sa fiche — c'est
   * une autre sorte d'attestation, et le lecteur a le droit de le savoir. */
  const PROVENANCES = {
    dico: 'fiche.provenance.dico',
    tatoeba: 'fiche.provenance.tatoeba',
    croisee: 'fiche.provenance.croisee',
    attestee: 'fiche.provenance.attestee',
    editorial: 'fiche.provenance.editorial',
    perso: 'fiche.provenance.perso',
  };

  function etiquettes(entree, lecture) {
    const bloc = element('div', 'etiquettes');
    const nature = nomDeNature(lecture[0]);
    if (nature) bloc.appendChild(element('span', 'etiquette', nature));
    if (entree.expression && !entree.perso) {
      const marque = element('span', 'etiquette expression', I18n.t('fiche.expression'));
      marque.title = I18n.t(PROVENANCES[entree.expression] || 'fiche.provenance.dico');
      bloc.appendChild(marque);
    }
    if (lecture[1]) {
      const table = ARTICLES[entree.langue] || {};
      const article = lecture[0] === 'n' && table[lecture[1]];
      if (article) {
        const marque = element('span', 'etiquette article ' + lecture[1], article);
        marque.title = I18n.t('genre.' + lecture[1]);
        bloc.appendChild(marque);
      } else {
        bloc.appendChild(element('span', 'etiquette', I18n.t('genre.' + lecture[1])));
      }
    }
    /* La bande de fréquence est un rang d'usage mesuré dans un corpus. Un mot
     * personnel n'en a pas — il n'a jamais été compté nulle part — et lui en
     * afficher une (« Premiers pas ») annoncerait une mesure qui n'existe pas. */
    if (!entree.perso && !entree.module) {
      const bande = element('span', 'etiquette bande-' + entree.bande,
        I18n.t('bande.' + entree.bande));
      bande.title = I18n.t('bande.explication');
      bloc.appendChild(bande);
    }
    /* « go, went, gone » : un verbe irrégulier le dit d'emblée — c'est ce
     * qu'un francophone doit apprendre par cœur. */
    if (lecture[0] === 'v' && entree.langue === 'en' && Exercices.estIrregulier(
      { langue: 'en', mot: entree.mot, lectures: [lecture] })) {
      bloc.appendChild(element('span', 'etiquette irregulier', I18n.t('fiche.irregulier')));
    }
    return bloc;
  }

  function formes(entree, lecture) {
    // Le TEI répète volontiers la vedette parmi ses formes : « Formes : house,
    // houses » n'apprend rien de plus que « houses ».
    const liste = (lecture[3] || []).filter((f) => f !== entree.mot);
    if (!liste.length) return null;
    const ligne = element('p', 'formes');
    ligne.appendChild(element('b', null, I18n.t('fiche.formes') + ' '));
    ligne.appendChild(document.createTextNode(liste.join(', ')));
    return ligne;
  }

  // ── Flexion ───────────────────────────────────────────────────────────────

  /* Les codes de flexion, regroupés à l'affichage. Un verbe français en porte
   * quatorze : les aligner d'un bloc noierait le reste de la fiche. On les
   * range donc par temps, et le tout se replie.
   *
   * Le regroupement se lit dans le code lui-même — « pres3 » est au présent —
   * plutôt que dans une table par langue : les deux langues n'ont pas les mêmes
   * temps, et une table de plus finirait par diverger de celle du build. */
  function groupeDe(code) {
    if (code.indexOf('pres') === 0) return 'present';
    if (code.indexOf('imp') === 0) return 'imparfait';
    return 'formes';
  }

  /* Une forme anglaise régulière (houses, walked) n'apprend rien : la table
   * ne montre que ce qui ne se devine pas. Les formes françaises, elles, se
   * montrent toutes — la conjugaison française est ce qui se devine le moins. */
  function formeUtile(entree, code, graphie) {
    if (entree.langue !== 'en') return true;
    const mot = entree.mot;
    if (code === 'pl') return !(graphie === mot + 's' || graphie === mot + 'es'
      || (/y$/.test(mot) && graphie === mot.slice(0, -1) + 'ies'));
    if (code === '3sg' || code === 'ing') return false;
    if (code === 'past' || code === 'pp') return !/ed$/.test(graphie);
    return true;
  }

  function flexion(entree, lecture) {
    const liste = (lecture[5] || []).filter(([code, graphie]) => formeUtile(entree, code, graphie));
    if (!liste.length) return null;

    const bloc = element('details', 'flexion');
    bloc.appendChild(element('summary', null, I18n.t('fiche.flexion')));

    const groupes = new Map();
    for (const [code, graphie, article] of liste) {
      const nom = groupeDe(code);
      if (!groupes.has(nom)) groupes.set(nom, []);
      groupes.get(nom).push([code, graphie, article]);
    }

    for (const [nom, entrees] of groupes) {
      if (groupes.size > 1) {
        bloc.appendChild(element('h4', 'flexion-groupe', I18n.t('flexion.groupe.' + nom)));
      }
      const table = element('dl', 'flexion-table');
      for (const [code, graphie, article] of entrees) {
        const etiquette = I18n.t('flexion.' + code);
        table.appendChild(element('dt', null,
          etiquette.startsWith('‹') ? code : etiquette));
        const valeur = element('dd', null, article ? article + ' ' + graphie : graphie);
        table.appendChild(valeur);
      }
      bloc.appendChild(table);
    }
    return bloc;
  }

  // ── Les sens, et leurs exemples ───────────────────────────────────────────

  /* Une citation du Wiktionnaire : la phrase, le mot marqué, la référence, et
   * sa traduction quand elle en a une.
   *
   * Le Wiktionary anglais cite en anglais. Les citations des cinq mille mots
   * anglais les plus courants ont été traduites pour l'application (voir
   * build/citations/) : la traduction vient dessous, comme pour une phrase
   * de Tatoeba. Les autres restent en anglais seul — les mots y sont
   * cliquables, et un exemple qu'on déchiffre mot à mot vaut mieux qu'un sens
   * laissé sans exemple. */
  function citation(texte, marque, reference, langue, traduction) {
    const bloc = element('div', 'citation');
    const phrase = element('p', 'citation-texte');
    phrase.appendChild(MotsVifs.tisser(texte, langue, { marque }));
    bloc.appendChild(phrase);
    if (traduction) {
      const traduite = element('p', 'citation-traduction');
      traduite.appendChild(MotsVifs.tisser(traduction, langue === 'en' ? 'fr' : 'en', {}));
      bloc.appendChild(traduite);
    }
    if (reference) {
      bloc.appendChild(element('p', 'citation-source', reference));
    }
    if (Voix.possible(langue) || !Voix.pret) {
      const ecouter = element('button', 'ecouter-phrase', '▸');
      ecouter.type = 'button';
      ecouter.setAttribute('aria-label', I18n.t('fiche.ecouter'));
      Voix.brancherBouton(ecouter, langue);
      ecouter.addEventListener('click', () => Voix.dire(texte, langue));
      phrase.appendChild(ecouter);
    }
    return bloc;
  }

  /* Une paire alignée : la phrase dans la langue du mot, sa traduction dessous.
   * Les deux côtés sont cliquables — on apprend aussi en butant sur un mot de
   * la traduction. */
  function paireTraduite(paire, entree, cleVedette) {
    const bloc = element('div', 'exemple');
    const source = element('p', 'exemple-source');
    const autre = entree.langue === 'en' ? 'fr' : 'en';
    source.appendChild(MotsVifs.tisser(
      entree.langue === 'en' ? paire.en : paire.fr, entree.langue,
      { cible: cleVedette }));
    bloc.appendChild(source);

    const cible = element('p', 'exemple-cible');
    cible.appendChild(MotsVifs.tisser(
      entree.langue === 'en' ? paire.fr : paire.en, autre, {}));
    bloc.appendChild(cible);

    if (Voix.possible(entree.langue) || !Voix.pret) {
      const ecouter = element('button', 'ecouter-phrase', '▸');
      ecouter.type = 'button';
      ecouter.setAttribute('aria-label', I18n.t('fiche.ecouter'));
      Voix.brancherBouton(ecouter, entree.langue);
      ecouter.addEventListener('click', () => Voix.dire(
        entree.langue === 'en' ? paire.en : paire.fr, entree.langue));
      source.appendChild(ecouter);
    }
    return bloc;
  }

  /* Les phrases arrivent après coup : elles vivent dans un vivier partagé qu'il
   * faut aller chercher. Le sens s'affiche sans les attendre — sa traduction et
   * sa définition sont ce qu'on est venu voir. */
  async function remplirPaires(numeros, hote, entree, cleVedette) {
    const paires = await Lexique.phrases(numeros);
    if (!paires.length) { hote.remove(); return; }
    for (const paire of paires) {
      hote.appendChild(paireTraduite(paire, entree, cleVedette));
    }
  }

  function sens(entree, lecture, cleVedette) {
    const bloc = document.createDocumentFragment();
    const autre = entree.langue === 'en' ? 'fr' : 'en';
    /* Les sens crus sont tus tant qu'on ne demande pas à les voir ; on dit
     * combien, sans les montrer. */
    const visibles = lecture[4].filter((donnees) => Lexique.montrerCrus || !estCru(donnees));
    const tus = lecture[4].length - visibles.length;
    const plusieurs = visibles.length > 1;

    visibles.forEach((donnees, rang) => {
      const [definition] = donnees;
      const traductions = Exercices.montrables(donnees);
      const citations = donnees[2] || [];
      const numeros = donnees[3] || [];

      const paragraphe = element('div', 'sens');
      const ligne = element('p', 'traductions');
      if (plusieurs) {
        ligne.appendChild(element('span', 'numero-sens', (rang + 1) + '.'));
      }
      const pastilles = pastillesDeMarques(donnees[4]);
      if (pastilles) ligne.appendChild(pastilles);
      /* Les traductions sont cliquables comme le reste : dans la fiche
       * d'un mot français, ce sont des mots anglais qu'on veut pouvoir
       * apprendre à leur tour. */
      for (const traduction of traductions) {
        const span = element('span', 'traduction');
        span.appendChild(MotsVifs.lier(traduction, autre));
        ligne.appendChild(span);
      }
      /* Un sens que le Wiktionnaire connaît et que WikDict ignore n'a pas de
       * traduction. Il vaut d'être montré — il a sa définition et son exemple —
       * mais il faut dire pourquoi la ligne des traductions est vide, sans quoi
       * on croit à une donnée manquante. */
      if (!traductions.length) {
        ligne.appendChild(element('span', 'sans-traduction',
          I18n.t('fiche.sens-sans-traduction')));
      }
      paragraphe.appendChild(ligne);

      if (definition) {
        const texte = element('p', 'definition');
        texte.appendChild(MotsVifs.tisser(definition, entree.langue, {}));
        paragraphe.appendChild(texte);
      }

      for (const [texte, marque, reference, traduction] of citations) {
        paragraphe.appendChild(citation(texte, marque, reference, entree.langue, traduction));
      }

      if (numeros.length) {
        const hote = element('div', 'exemples-du-sens');
        paragraphe.appendChild(hote);
        remplirPaires(numeros, hote, entree, cleVedette).catch(() => hote.remove());
      }

      bloc.appendChild(paragraphe);
    });
    if (tus) {
      bloc.appendChild(element('p', 'discret sens-tus', I18n.n('fiche.sens-crus-tus', tus)));
    }
    return bloc;
  }

  function synonymes(lecture, langue) {
    const liste = lecture[6] || [];
    if (!liste.length) return null;
    const ligne = element('p', 'synonymes');
    ligne.appendChild(element('b', null, I18n.t('fiche.synonymes') + ' '));
    liste.slice(0, 8).forEach((synonyme, rang) => {
      if (rang) ligne.appendChild(document.createTextNode(', '));
      ligne.appendChild(MotsVifs.lier(synonyme, langue));
    });
    return ligne;
  }

  /* Ce qu'aucune signification n'a réclamé. Une phrase dont on ne sait pas
   * quel sens elle illustre reste une phrase utile ; la ranger sous un sens au
   * hasard, non. */
  async function remplirRestantes(entree, section, cleVedette) {
    const paires = await Lexique.phrases(entree.phrases);
    if (!paires.length) { section.remove(); return; }
    section.appendChild(element('h3', null, I18n.t('fiche.exemples')));
    for (const paire of paires) {
      section.appendChild(paireTraduite(paire, entree, cleVedette));
    }
  }

  /* L'exemple qu'on a écrit soi-même pour un mot personnel.
   *
   * Il ne passe pas par le vivier de Tatoeba — il n'y est pas, et n'a rien à y
   * faire. Les deux côtés restent cliquables comme ceux du dictionnaire : un
   * mot inconnu croisé dans sa propre phrase mérite le même geste. */
  function exemplePersonnel(entree) {
    const paires = (entree.paires || []).filter((p) => p.en || p.fr);
    if (!paires.length) return null;
    const section = element('section', 'exemples');
    section.appendChild(element('h3', null, I18n.t('perso.exemple')));
    const autre = entree.langue === 'en' ? 'fr' : 'en';
    for (const paire of paires) {
      const sien = entree.langue === 'en' ? paire.en : paire.fr;
      const traduit = entree.langue === 'en' ? paire.fr : paire.en;
      const bloc = element('div', 'exemple');
      const source = element('p', 'exemple-source');
      source.appendChild(MotsVifs.tisser(sien, entree.langue,
        { cible: Lexique.cle(entree.mot) }));
      if (Voix.possible(entree.langue) || !Voix.pret) {
        const ecouter = element('button', 'ecouter-phrase', '▸');
        ecouter.type = 'button';
        ecouter.setAttribute('aria-label', I18n.t('fiche.ecouter'));
        Voix.brancherBouton(ecouter, entree.langue);
        ecouter.addEventListener('click', () => Voix.dire(sien, entree.langue));
        source.appendChild(ecouter);
      }
      bloc.appendChild(source);
      if (traduit) {
        const cible = element('p', 'exemple-cible');
        cible.appendChild(MotsVifs.tisser(traduit, autre, {}));
        bloc.appendChild(cible);
      }
      section.appendChild(bloc);
    }
    return section;
  }

  /* Modifier ou supprimer sa propre entrée, depuis sa fiche.
   *
   * Les deux boutons vivent en bas, et non près de la vedette : on ouvre une
   * fiche pour la lire, pas pour la corriger, et un « Supprimer » sous le doigt
   * au-dessus du mot serait un piège. `mesmots.js` fait le travail — c'est lui
   * qui sait demander confirmation quand il y a quelque chose à perdre. */
  function boutonsPersonnels(entree, surFermeture) {
    if (!entree.perso || !racine.MesMots) return null;
    const ligne = element('div', 'ligne-boutons perso-actions');
    const modifier = element('button', 'bouton-discret', I18n.t('perso.modifier'));
    modifier.type = 'button';
    modifier.addEventListener('click', () => MesMots.ouvrirFormulaire({
      uid: entree.perso,
      surEnregistrement: () => { if (surFermeture) surFermeture(); },
    }));
    const supprimer = element('button', 'lien-discret', I18n.t('perso.supprimer'));
    supprimer.type = 'button';
    supprimer.addEventListener('click', async () => {
      const fait = await MesMots.supprimerAvecEgards(entree.perso);
      if (fait && surFermeture) surFermeture();
    });
    ligne.appendChild(modifier);
    ligne.appendChild(supprimer);
    return ligne;
  }

  function construire(entree, surFermeture) {
    const bloc = document.createDocumentFragment();
    const cleVedette = Lexique.cle(entree.mot);

    bloc.appendChild(enteteFiche(entree, surFermeture));
    bloc.appendChild(vedette(entree));
    const us = varianteAmericaine(entree);
    if (us) bloc.appendChild(us);
    bloc.appendChild(ligneSon(entree));
    bloc.appendChild(boutonApprendre(entree));
    const origine = provenance(entree);
    if (origine) bloc.appendChild(origine);

    /* Ce que les modules disent du mot — la fiche d'argot, le terme technique
     * et son schéma, l'expression et sa traduction mot à mot, le faux ami —
     * passe avant le dictionnaire : c'est écrit pour apprendre, le
     * dictionnaire pour vérifier. */
    if (racine.Modules) {
      const apport = Modules.blocPourFiche(entree);
      if (apport) bloc.appendChild(apport);
    }

    for (const lecture of entree.lectures) {
      if (!lecture[4] || !lecture[4].length) continue;
      const section = element('section', 'lecture');
      section.appendChild(etiquettes(entree, lecture));
      const listeFormes = formes(entree, lecture);
      if (listeFormes) section.appendChild(listeFormes);
      section.appendChild(sens(entree, lecture, cleVedette));
      const listeSynonymes = synonymes(lecture, entree.langue);
      if (listeSynonymes) section.appendChild(listeSynonymes);
      const tableau = flexion(entree, lecture);
      if (tableau) section.appendChild(tableau);
      bloc.appendChild(section);
    }

    const sien = exemplePersonnel(entree);
    if (sien) bloc.appendChild(sien);

    if (!entree.perso && !entree.module) {
      const exemples = element('section', 'exemples');
      bloc.appendChild(exemples);
      remplirRestantes(entree, exemples, cleVedette).catch(() => exemples.remove());
    }

    /* Les expressions usuelles qui contiennent ce mot — après les synonymes et
     * les exemples, avant les notes. C'est là qu'on découvre « spill the
     * beans » depuis « beans », et « vendre la mèche » depuis « mèche ». */
    const tournures = expressionsDe(entree);
    if (tournures) bloc.appendChild(tournures);

    /* « Mes notes » ferme la fiche, sous le dictionnaire et sous les exemples :
     * c'est ce qu'on vient ajouter une fois qu'on a lu, et ce qu'on vient
     * relire ensuite — on y revient en faisant défiler jusqu'en bas, ce qui est
     * exactement le geste qu'on fait quand on cherche ses propres mots. */
    if (racine.Notes) bloc.appendChild(Notes.construire(entree));

    const actions = boutonsPersonnels(entree, surFermeture);
    if (actions) bloc.appendChild(actions);

    const autour = voisinage(entree);
    if (autour) bloc.appendChild(autour);

    return bloc;
  }

  /* La provenance d'une expression, et son explication, sous la vedette.
   * Une entrée traduite par la glose de l'édition d'en face le dit aussi :
   * c'est une traduction moins sûre qu'une table de traduction. */
  function provenance(entree) {
    if (entree.croisee && !entree.expression && !entree.perso) {
      return element('p', 'discret provenance', I18n.t('fiche.provenance.glose.' + entree.langue));
    }
    if (!entree.expression || entree.perso) return null;
    const bloc = element('div', 'provenance');
    if (entree.explication) {
      const texte = element('p', 'explication');
      texte.appendChild(MotsVifs.tisser(entree.explication,
        entree.langue === 'en' ? 'fr' : 'en', {}));
      bloc.appendChild(texte);
    }
    bloc.appendChild(element('p', 'discret',
      I18n.t(PROVENANCES[entree.expression] || 'fiche.provenance.dico')));
    return bloc;
  }

  /* Combien d'expressions on montre d'abord sur une fiche. Un mot courant en
   * a des dizaines ; six en disent assez, « Voir plus » déplie le reste. */
  const EXPRESSIONS_VISIBLES = 6;
  const EXPRESSIONS_PAR_PAGE = 24;

  /* « Expressions usuelles » — celles qui contiennent le mot de la fiche.
   *
   * Deux sources : l'index des expressions par mot, et ses propres entrées à
   * plusieurs mots qui contiennent ce mot. Une fiche qui est elle-même une
   * expression ne se propose pas. Rien n'est affiché quand il n'y a rien :
   * une section vide promet quelque chose qu'elle ne tient pas. */
  function expressionsDe(entree) {
    const k = Lexique.cle(entree.mot);
    const liste = Lexique.expressionsAvec(entree);
    if (racine.Perso) {
      /* Ses propres expressions — celles qu'on a déclarées telles, pas tout ce
       * qui a plusieurs mots — passent en tête : on les a écrites soi-même. */
      const siennes = [];
      for (const enregistrement of Perso.liste()) {
        if (enregistrement.id === entree.perso) continue;
        if (!Perso.estExpression(enregistrement)) continue;
        const dedans = Perso.commenceParUnMot(enregistrement.cle, k)
          || enregistrement.traductions.some((t) => Perso.commenceParUnMot(Lexique.cle(t), k));
        if (dedans) siennes.push(Perso.resultat(enregistrement, true, null));
      }
      liste.unshift(...siennes);
    }
    if (!liste.length) return null;

    const section = element('section', 'expressions-usuelles');
    section.appendChild(element('h3', null, I18n.t('fiche.expressions')));
    const ul = element('ul');

    function ligne(resultat) {
      const li = element('li');
      const bouton = element('button', 'expression-ligne');
      bouton.type = 'button';
      bouton.appendChild(element('span', 'pastille',
        I18n.t('langue.' + resultat.langue + '.court')));
      bouton.appendChild(element('span', 'mot', resultat.mot));
      if (resultat.perso) {
        bouton.appendChild(element('span', 'pastille perso', I18n.t('perso.marque')));
      }
      if (resultat.apercu) {
        bouton.appendChild(element('span', 'traduction', resultat.apercu));
      } else {
        bouton.classList.add('sans-equivalent');
        bouton.appendChild(element('span', 'traduction discret',
          I18n.t('expression.sans-equivalent')));
      }
      bouton.addEventListener('click', () => App.ouvrirFiche(resultat));
      li.appendChild(bouton);
      return li;
    }

    for (const resultat of liste.slice(0, EXPRESSIONS_VISIBLES)) ul.appendChild(ligne(resultat));
    section.appendChild(ul);
    /* Le reste se déplie par pages : « faire » a des centaines d'expressions
     * dans le paquet complet, et toutes restent à portée de clic. */
    const reste = liste.slice(EXPRESSIONS_VISIBLES);
    if (reste.length) {
      const plus = element('button', 'lien-discret');
      plus.type = 'button';
      let position = 0;
      const libeller = () => {
        plus.textContent = I18n.n('fiche.expressions.plus', reste.length - position);
      };
      libeller();
      plus.addEventListener('click', () => {
        for (const resultat of reste.slice(position, position + EXPRESSIONS_PAR_PAGE)) {
          ul.appendChild(ligne(resultat));
        }
        position += EXPRESSIONS_PAR_PAGE;
        if (position >= reste.length) plus.remove();
        else libeller();
      });
      section.appendChild(plus);
    }
    return section;
  }

  /* « Même famille ».
   *
   * Ces rapprochements viennent des dérivés que le Wiktionnaire énumère, et
   * d'un calcul par affixes filtré sur le recoupement des traductions ; ils se
   * trompent encore parfois, et la note le dit. Chaque mot porte sa première
   * traduction, qu'on lit sans ouvrir la fiche : *happiness* — bonheur. Un
   * bouton lance l'exercice « même famille » sur ce mot. */
  function voisinage(entree) {
    const liste = entree.voisins || [];
    if (!liste.length) return null;

    const section = element('section', 'voisinage');
    section.appendChild(element('h3', null, I18n.t('fiche.autour')));
    const mots = element('div', 'voisins');
    for (const voisin of liste) {
      const v = Lexique.vedette(entree.langue, voisin) || Lexique.resoudre(voisin, entree.langue);
      if (v && v.cru && !Lexique.montrerCrus) continue;
      const bouton = element('button', 'voisin');
      bouton.type = 'button';
      bouton.appendChild(element('span', 'voisin-mot', voisin));
      if (v && v.apercu) {
        bouton.appendChild(element('span', 'voisin-sens', v.apercu.split(', ')[0]));
      }
      bouton.addEventListener('click', () => {
        const trouve = v || Lexique.resoudre(voisin, entree.langue);
        if (trouve) App.ouvrirFiche(trouve);
      });
      mots.appendChild(bouton);
    }
    if (!mots.childNodes.length) return null;
    section.appendChild(mots);
    if (racine.Atelier && liste.length >= 2) {
      const exercer = element('button', 'bouton-discret', I18n.t('fiche.famille.exercer'));
      exercer.type = 'button';
      exercer.addEventListener('click', () => Atelier.lancerSur('famille', [entree]));
      section.appendChild(exercer);
    }
    section.appendChild(element('p', 'discret', I18n.t('fiche.autour.note')));
    return section;
  }

  racine.Fiche = { construire, formeParlee, nomDeNature, ARTICLES, pastillesDeMarques, estCru,
                   MARQUES };

})(window);
