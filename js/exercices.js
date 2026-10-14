'use strict';
/*
 * Les exercices, et la correction.
 *
 * ── Pourquoi plusieurs sortes ──────────────────────────────────────────────
 *
 * Reconnaître une réponse dans une liste et savoir la produire de mémoire sont
 * deux compétences distinctes, et la première donne l'illusion de la seconde.
 * Un apprenant qui ne fait que des questions à choix multiples se croit prêt et
 * reste muet le jour où il faut parler. Chaque carte passe donc par une
 * difficulté croissante, propre à sa direction.
 *
 * Carte « produire la vedette » — on ne voit que « haricot » :
 *
 *   1re fois     choisir       parmi quatre mots étrangers
 *   2e fois      écrire        au clavier
 *   ensuite      alterner      écriture, phrase à trou, écoute
 *
 * Carte « produire la traduction » — on ne voit que « bean » :
 *
 *   1re fois     reconnaître   parmi quatre traductions
 *   2e fois      écrire        la traduction au clavier
 *   ensuite      alterner      écriture, appariement de phrases
 *
 * Alterner ensuite n'est pas de la décoration : une carte toujours posée de la
 * même façon finit par être reconnue à sa forme plutôt qu'à son sens.
 *
 * ── L'exercice imposé ──────────────────────────────────────────────────────
 *
 * `preparer(carte, entree, { type })` pose l'exercice demandé au lieu de celui
 * que la maturité de la carte appellerait. C'est tout ce qu'il a fallu pour que
 * les **ateliers** existent : les huit exercices étaient écrits depuis le
 * premier jour, rien ne permettait d'en réclamer un. Un exercice qu'on ne peut
 * pas demander est un exercice qui n'existe pas pour l'utilisateur.
 *
 * L'application apprend l'anglais à un francophone : un exercice dont la
 * réponse est française ne lui demande que de reconnaître l'anglais de
 * l'énoncé. La phrase à trou et l'écoute, qui feraient travailler le
 * français, ne portent donc que sur les mots anglais.
 *
 * L'anglais a ses pièges à lui, et ses exercices : les **verbes irréguliers**
 * (*go, went, gone*), les **pluriels irréguliers** (*mouse, mice*), les
 * **familles de mots** (*happy, happiness, unhappy*), et la majuscule des
 * jours, des mois et des langues (*Monday*, *English*), qu'on signale sans la
 * compter fausse.
 *
 * ── La correction ──────────────────────────────────────────────────────────
 *
 * Elle est tolérante mais instructive. Une majuscule oubliée sur « Monday »
 * n'est pas comptée fausse — elle est expliquée. Un accent manquant non plus.
 * L'article ou le « to » de l'infinitif ajouté (« the house », « to go ») ne
 * gêne pas. Une lettre de travers donne « presque » et une seconde chance.
 * Compter faux ce qui n'est qu'une étourderie décourage sans rien enseigner ;
 * l'accepter en silence laisse l'erreur s'installer.
 */
(function (racine) {

  /* Les articles. Ils ne se réclament plus — l'exigence « un / une »
   * servait l'anglophone qui apprend le genre français —, mais une réponse
   * qui en porte un reste juste : « la maison » vaut « maison », « the house »
   * vaut « house ». `ARTICLES` nomme encore le genre d'un nom français dans le
   * formulaire des mots à soi. */
  const ARTICLES = {
    fr: { masc: 'un', fem: 'une' },
  };

  const GENRE_DE_L_ARTICLE = {
    fr: { un: 'masc', le: 'masc', une: 'fem', la: 'fem' },
  };

  /* Les autres articles qu'on reconnaît pour les retirer avant de comparer :
   * élidés ou pluriels en français, et en anglais l'article et le « to » de
   * l'infinitif. */
  const AUTRES_ARTICLES = {
    fr: ['l', 'les', 'des', 'du'],
    en: ['the', 'a', 'an', 'to'],
  };

  function auHasard(liste) {
    return liste[Math.floor(Math.random() * liste.length)];
  }

  function melanger(liste) {
    const copie = liste.slice();
    for (let i = copie.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
  }

  // ── Ce qu'on demande, et ce qu'on accepte ─────────────────────────────────

  /* Les traductions d'un sens qu'on peut montrer : sans les traductions
   * crues rangées en fin de liste (`bloc[5]` en donne le nombre), tant qu'on
   * n'a pas demandé à voir les mots crus. */
  function montrables(bloc) {
    const liste = bloc[1] || [];
    const crues = bloc[5] || 0;
    if (!crues || Lexique.montrerCrus) return liste;
    return liste.slice(0, Math.max(0, liste.length - crues));
  }

  /* Un sens cru (vulgaire, injurieux) ne sert pas d'exercice tant que les
   * mots crus sont masqués. */
  function sensMontrable(bloc) {
    if (Lexique.montrerCrus) return true;
    const marques = bloc[4] || [];
    return marques.indexOf('vulg') === -1 && marques.indexOf('inj') === -1;
  }

  /* Toutes les traductions d'une entrée, sans doublon, sens par sens. */
  function traductions(entree) {
    const vues = [];
    for (const lecture of entree.lectures) {
      for (const bloc of lecture[4]) {
        if (!sensMontrable(bloc)) continue;
        for (const mot of montrables(bloc)) {
          if (vues.indexOf(mot) === -1) vues.push(mot);
        }
      }
    }
    return vues;
  }

  function premiereLecture(entree) {
    return entree.lectures[0] || [];
  }

  /* Les sens d'une entrée qui ont des équivalents, avec leur définition. */
  function sensTraduits(entree) {
    const sortie = [];
    for (const lecture of entree.lectures) {
      for (const bloc of lecture[4]) {
        const liste = montrables(bloc);
        if (liste.length && sensMontrable(bloc)) {
          sortie.push({ definition: bloc[0] || '', equivalents: liste.slice() });
        }
      }
    }
    return sortie;
  }

  /* Le sens sur lequel porte la question.
   *
   * « Bank » veut dire la banque ou la berge ; « feu » est *fire*, *traffic
   * light* ou *light* (pour une cigarette).
   * Demander « que veut dire à petit feu ? » sans dire lequel, c'est poser une
   * question à plusieurs bonnes réponses et n'en afficher qu'une. Quand les
   * sens ont des équivalents distincts et une définition pour les
   * distinguer, la question en vise un seul, tiré au sort, et le dit. Rend
   * null quand il n'y a rien à distinguer — un seul sens, ou les mêmes
   * équivalents partout, comme WikDict en répand souvent. */
  function sensVise(entree) {
    const sens = sensTraduits(entree).filter((s) => s.definition);
    if (sens.length < 2) return null;
    const distincts = new Set(sens.map((s) => s.equivalents.map(Lexique.cle).sort().join('|')));
    if (distincts.size < 2) return null;
    return auHasard(sens);
  }

  function genreDe(entree) {
    for (const lecture of entree.lectures) {
      if (lecture[0] === 'n' && lecture[1]) return lecture[1];
    }
    return null;
  }

  /* Tous les genres sous lesquels le mot se lit, dans l'ordre. « Livre » est
   * masculin quand c'est un ouvrage et féminin quand c'est un poids : les deux
   * réponses sont justes, et n'en accepter qu'une punirait qui sait les deux. */
  function genresDe(entree) {
    const vus = [];
    for (const lecture of entree.lectures) {
      if (lecture[0] === 'n' && lecture[1] && vus.indexOf(lecture[1]) === -1) {
        vus.push(lecture[1]);
      }
    }
    return vus;
  }

  function estNom(entree) {
    return premiereLecture(entree)[0] === 'n';
  }

  /* Une expression : plusieurs mots. Les exercices qui portent sur un mot —
   * le genre, l'article, le pluriel — ne s'y appliquent pas. */
  function estExpression(entree) {
    return Lexique.estExpression(entree);
  }

  // ── Correction ────────────────────────────────────────────────────────────

  function nettoyer(texte) {
    return String(texte || '')
      .replace(/[.,;:!?…"«»()\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Distance de Levenshtein, plafonnée : au-delà de 2 la réponse n'est plus
   * une étourderie, inutile de compter plus loin. */
  function distance(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    let precedente = [];
    for (let j = 0; j <= b.length; j += 1) precedente[j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      const courante = [i];
      let minimum = i;
      for (let j = 1; j <= b.length; j += 1) {
        const cout = a[i - 1] === b[j - 1] ? 0 : 1;
        courante[j] = Math.min(courante[j - 1] + 1, precedente[j] + 1, precedente[j - 1] + cout);
        if (courante[j] < minimum) minimum = courante[j];
      }
      if (minimum > 2) return 3;
      precedente = courante;
    }
    return precedente[b.length];
  }

  /* Sépare l'article de ce qui le suit. Renvoie { article, mot } ; `article`
   * est nul quand le premier mot n'en est pas un — « pomme de terre » commence
   * par « pomme », il n'y a rien à couper. */
  function decouper(texte, langue) {
    const connus = GENRE_DE_L_ARTICLE[langue] || {};
    const autres = AUTRES_ARTICLES[langue] || [];
    const estArticle = (mot) => connus[mot] !== undefined || autres.indexOf(mot) !== -1;

    const elide = /^(\p{L}+)['’]\s*(\S.*)$/u.exec(texte);
    if (elide && estArticle(elide[1].toLowerCase())) {
      return { article: elide[1].toLowerCase(), mot: elide[2] };
    }
    const morceaux = texte.split(' ');
    const tete = morceaux[0].toLowerCase();
    if (morceaux.length > 1 && estArticle(tete)) {
      return { article: tete, mot: morceaux.slice(1).join(' ') };
    }
    return { article: null, mot: texte };
  }

  /* L'article est facultatif : « the house » et « house » valent la même
   * réponse, « la maison » et « maison » aussi, et « to go » vaut « go ». */
  function sansArticle(texte, langue) {
    if (langue !== 'en' && langue !== 'fr') return texte;
    return decouper(texte, langue).mot;
  }

  /* Compare un mot nu à des réponses nues. C'est le cœur de la correction ;
   * `corriger` l'habille selon ce que l'exercice réclamait. */
  function comparerMot(brut, candidats, reglages) {
    const langue = reglages.langue || 'en';

    // 1. Exactement la bonne réponse.
    for (const attendu of candidats) {
      if (brut === attendu) return { verdict: 'juste', attendu, remarque: null };
    }

    // 2. La bonne réponse à la casse ou aux accents près.
    //
    // On juge sur le mot débarrassé de son article, des deux côtés : « the
    // house » pour « house », « la maison » pour « maison », « to go » pour
    // « go ».
    const nu = sansArticle(brut, langue);
    const cleSaisie = Lexique.cle(nu);
    for (const attenduBrut of candidats) {
      const attendu = sansArticle(attenduBrut, langue);
      if (Lexique.cle(attendu) !== cleSaisie) continue;
      let remarque = null;
      // « monday » pour « Monday » : juste, mais l'anglais met la majuscule
      // aux jours, aux mois, aux langues et aux nationalités — on le dit.
      if (langue === 'en' && nu[0] && nu[0] === nu[0].toLowerCase()
          && attendu[0] && attendu[0] !== attendu[0].toLowerCase()) {
        remarque = { cle: 'exercice.remarque.majuscule', valeurs: { mot: attenduBrut } };
      } else if (nu.toLowerCase() !== attendu.toLowerCase()) {
        remarque = { cle: 'exercice.remarque.accents', valeurs: { mot: attenduBrut } };
      }
      return { verdict: 'juste', attendu: attenduBrut, remarque };
    }

    // 3. Une lettre de travers, sur un mot assez long pour que ce soit une
    //    faute de frappe et non un autre mot.
    for (const attendu of candidats) {
      const cible = Lexique.cle(attendu);
      if (cible.length >= 5 && distance(cleSaisie, cible) <= 1) {
        return { verdict: 'presque', attendu, remarque: null };
      }
    }

    return { verdict: 'faux', attendu: candidats[0], remarque: null };
  }

  /* Une phrase entière se compare autrement qu'un mot.
   *
   * La ponctuation est déjà partie (`nettoyer`). Restent l'apostrophe et le
   * trait d'union, que les claviers de téléphone écrivent de dix façons
   * — « n'ai », « n’ai », « allez-vous », « allez vous » — et qui ne sont pas
   * ce qu'on apprend : ils comptent pour une espace. Puis les accents :
   * « Ou est la gare » vaut « Où est la gare », avec la remarque. Enfin une
   * étourderie : une lettre de travers sur une phrase courte, deux sur une
   * phrase longue. On ne va pas plus loin — au-delà, on ne sait plus si la
   * phrase est sue ou devinée.
   *
   * Jamais de remarque de majuscule : une phrase commence par une majuscule
   * dans les deux langues, et « where is the station » a les mots justes. */
  function clePhrase(texte) {
    return Lexique.cle(String(texte || '').replace(/[’'‘-]/g, ' '));
  }

  function comparerPhrase(brut, candidats) {
    for (const attendu of candidats) {
      if (brut === attendu) return { verdict: 'juste', attendu, remarque: null };
    }
    const saisie = clePhrase(brut);
    for (const attendu of candidats) {
      if (clePhrase(attendu) !== saisie) continue;
      const lettres = (t) => t.replace(/[’'‘-]/g, ' ').replace(/\s+/g, ' ').toLowerCase();
      const remarque = lettres(brut) === lettres(attendu)
        ? null : { cle: 'exercice.remarque.accents', valeurs: { mot: attendu } };
      return { verdict: 'juste', attendu, remarque };
    }
    for (const attendu of candidats) {
      const cible = clePhrase(attendu);
      const tolerance = cible.length >= 20 ? 2 : (cible.length >= 5 ? 1 : 0);
      if (tolerance && distance(saisie, cible) <= tolerance) {
        return { verdict: 'presque', attendu, remarque: null };
      }
    }
    return { verdict: 'faux', attendu: candidats[0], remarque: null };
  }

  /* Compare une saisie à une liste de réponses acceptables.
   *
   * Renvoie { verdict, attendu, remarque } où verdict vaut
   *   'juste'   — accepté, éventuellement avec une remarque à lire
   *   'presque' — une lettre de travers, on redonne la main
   *   'faux'    — autre chose
   */
  function corriger(saisie, attendus, options) {
    const reglages = options || {};
    const brut = nettoyer(saisie);
    const candidats = attendus.map(nettoyer).filter(Boolean);
    if (!brut || !candidats.length) {
      return { verdict: 'faux', attendu: candidats[0] || attendus[0], remarque: null };
    }
    const verdict = reglages.phrase
      ? comparerPhrase(brut, candidats)
      : comparerMot(brut, candidats, reglages);
    /* Une réponse juste pour un autre sens que celui demandé n'est pas fausse
     * — on connaît l'expression —, mais ce n'est pas la réponse à la question
     * posée : « presque », et la remarque dit lequel des sens on demandait. */
    if (verdict.verdict === 'faux' && reglages.autresSens && reglages.autresSens.length) {
      const autres = reglages.autresSens.map(nettoyer).filter(Boolean);
      const ailleurs = autres.length ? comparerMot(brut, autres, reglages) : null;
      if (ailleurs && ailleurs.verdict !== 'faux') {
        return { verdict: 'presque', attendu: candidats[0],
                 remarque: { cle: 'exercice.remarque.autre-sens',
                             valeurs: { reponse: attendus[0], sens: reglages.contexte || '' } } };
      }
    }
    return verdict;
  }

  // ── Fabrication des questions ─────────────────────────────────────────────

  /* Des mots plausibles mais faux, pour les questions à choix.
   *
   * Un bon leurre est de même nature et de même niveau que la réponse : mettre
   * « magnetoencephalography » en face de « house » ne fait rien apprendre, la
   * réponse se devine sans connaître le mot. Un leurre dont la traduction
   * recoupe celle de la cible serait au contraire injuste : on l'écarte.
   */
  /* Les leurres d'une séance lancée sur une liste — un thème de module, par
   * exemple. S'exercer sur « Cuisine et repas » et devoir choisir « oignon »
   * entre « ail », « farine » et « poivre » fait travailler le thème ; le
   * choisir entre trois mots savants tirés au hasard ne fait que deviner. */
  let vivier = null;

  function vivierDeLeurres(entrees) {
    vivier = entrees && entrees.length >= 4 ? entrees.slice() : null;
  }

  function leurresDuVivier(entree, combien) {
    if (!vivier) return [];
    const nature = premiereLecture(entree)[0];
    const interdites = traductions(entree).map((t) => Lexique.cle(t));
    const admissibles = vivier.filter((autre) => autre && autre !== entree
      && autre.langue === entree.langue && autre.mot !== entree.mot
      && (!autre.cru || Lexique.montrerCrus)
      && traductions(autre).length
      && !traductions(autre).some((t) => interdites.indexOf(Lexique.cle(t)) !== -1));
    const memeNature = admissibles.filter((autre) => (premiereLecture(autre)[0] || '') === (nature || ''));
    const choix = memeNature.length >= combien ? memeNature : admissibles;
    return choix.length >= combien ? melanger(choix).slice(0, combien) : [];
  }

  async function distracteurs(entree, combien) {
    /* Une phrase de « Phrases et dialogues » ne se distingue pas d'un mot
     * du dictionnaire : la réponse se devinerait à sa longueur. Ses leurres
     * sont d'autres phrases, de la même situation d'abord. */
    if (entree.conversation && racine.Conversation) {
      return Conversation.leurres(entree, combien);
    }
    const duVivier = leurresDuVivier(entree, combien);
    if (duVivier.length) return duVivier;
    const nature = premiereLecture(entree)[0];
    const interdites = traductions(entree).map((t) => Lexique.cle(t));
    const candidats = [];

    const lot = await Lexique.entreesAuHasard(entree.langue, 260, entree.bande);
    for (const autre of lot) {
      if (autre.mot === entree.mot) continue;
      if (Math.abs(autre.bande - entree.bande) > 1) continue;
      const sienne = (autre.lectures[0] || [])[0];
      // Un nom propre se repère sans connaître le mot : « Mount Fuji » en face
      // de « water » ne fait pas travailler, il fait deviner.
      if (sienne === 'pn') continue;
      // Un mot cru ne sert pas de leurre tant qu'on masque les mots crus.
      if (autre.cru && !Lexique.montrerCrus) continue;
      if (nature && sienne !== nature) continue;
      const siennes = traductions(autre);
      if (!siennes.length) continue;
      if (siennes.some((t) => interdites.indexOf(Lexique.cle(t)) !== -1)) continue;
      candidats.push(autre);
    }

    // Faute de candidats de même nature — cela arrive pour les natures rares —
    // on relâche la contrainte plutôt que de ne rien proposer.
    if (candidats.length < combien) {
      for (const autre of lot) {
        if (autre.mot === entree.mot || candidats.indexOf(autre) !== -1) continue;
        if ((autre.lectures[0] || [])[0] === 'pn') continue;
        if (autre.cru && !Lexique.montrerCrus) continue;
        if (!traductions(autre).length) continue;
        candidats.push(autre);
        if (candidats.length >= combien * 3) break;
      }
    }
    return melanger(candidats).slice(0, combien);
  }

  /* Une forme fléchie précise — le pluriel, le participe, la 3ᵉ personne.
   * Rend `{graphie, article}` ou null. Les tableaux pendent de la lecture ;
   * on prend la première qui porte le code demandé. */
  function formeFlechie(entree, code) {
    for (const lecture of entree.lectures) {
      for (const [c, graphie, article] of (lecture[5] || [])) {
        if (c === code) return { graphie, article: article || '' };
      }
    }
    return null;
  }

  function synonymesDe(entree) {
    const vus = [];
    for (const lecture of entree.lectures) {
      for (const mot of (lecture[6] || [])) {
        if (mot !== entree.mot && vus.indexOf(mot) === -1) vus.push(mot);
      }
    }
    return vus;
  }

  /* Quel exercice poser.
   *
   * Trois choses décident, dans cet ordre :
   *
   *   1. `options.type` — un atelier a demandé cet exercice-là, on le pose.
   *      C'est tout ce qu'il a fallu ajouter pour que les huit exercices déjà
   *      écrits deviennent accessibles : ils existaient, rien ne permettait de
   *      les réclamer.
   *   2. la direction et la maturité — voir plus bas.
   *
   * Les deux directions n'ont pas la même échelle de difficulté, et c'est
   * normal : reconnaître ce que veut dire « house » est plus facile que de
   * sortir « house » de mémoire en ne voyant que « maison ». La carte qui
   * produit la vedette passe donc par l'écriture ; celle qui produit la
   * traduction s'en tient à la reconnaissance puis à la saisie de la traduction.
   */
  function typeDExercice(carte, entree, phrases, options) {
    const reglages = options || {};
    if (reglages.type) return reglages.type;

    const vues = carte.reussites;

    /* Direction « comprendre » : la réponse est dans l'autre langue. */
    if (!Revision.produitLaVedette(carte)) {
      if (vues === 0) return 'qcm-comprendre';
      if (vues === 1) return 'saisie-traduction';
      const possibles = ['saisie-traduction', 'saisie-traduction'];
      if (phrases && phrases.length) possibles.push('paire-phrase');
      return auHasard(possibles);
    }

    /* Direction « produire » : il faut ressortir la vedette. */
    if (vues === 0) return 'qcm-produire';
    if (vues === 1) return 'saisie';

    // Ensuite on varie. La phrase à trou n'est proposée que si une phrase
    // existe, l'écoute que si une voix est installée — et l'une comme l'autre
    // pour un mot anglais seulement : sur « maison », elles feraient
    // travailler le français.
    const possibles = ['saisie', 'saisie'];
    if (carte.langue === 'en' && phrases && phrases.length) possibles.push('trou');
    if (carte.langue === 'en' && Voix.possible('en')) possibles.push('ecoute');
    // Un verbe anglais irrégulier revient aussi par ses temps primitifs.
    if (carte.langue === 'en' && estIrregulier(entree)) possibles.push('conjugaison');
    return auHasard(possibles);
  }

  /* Les phrases dont dispose une entrée.
   *
   * Une entrée du dictionnaire garde des numéros, qui désignent des paires du
   * vivier commun ; un mot personnel porte directement la phrase qu'on a écrite
   * pour lui. La différence s'arrête ici : le reste des exercices ne voit qu'une
   * liste de paires, et ne sait pas d'où elle vient.
   *
   * Une paire dont un côté manque — un exemple saisi sans sa traduction — reste
   * utilisable pour la phrase à trou, qui ne lit que la langue du mot. Les
   * exercices qui réclament les deux côtés la filtrent eux-mêmes. */
  async function phrasesDe(entree) {
    /* Les exemples qu'on a écrits soi-même pour ce mot (« Mes exemples »)
     * s'ajoutent à ceux du dictionnaire : la phrase à trou peut tomber sur
     * sa propre phrase. */
    const siens = racine.Notes ? await Notes.exemplesDe(entree).catch(() => []) : [];
    if (entree.paires) return entree.paires.slice().concat(siens);
    /* Les phrases d'une entrée sont de deux sortes : celles rangées sous un
     * sens précis, et celles laissées au niveau du mot. Les exercices
     * prenaient les secondes seulement — et une expression comme « no
     * worries », dont toutes les phrases sont rangées sous son unique sens,
     * n'en avait aucune à proposer. On prend les deux : pour la phrase à
     * trou, une phrase est une phrase. */
    const numeros = (entree.phrases || []).slice();
    for (const lecture of entree.lectures || []) {
      for (const bloc of lecture[4] || []) {
        for (const numero of (bloc[3] || [])) {
          if (numeros.indexOf(numero) === -1) numeros.push(numero);
        }
      }
    }
    return (await Lexique.phrases(numeros)).concat(siens);
  }

  /* Construit la question. Renvoie un objet décrivant ce qu'il faut afficher ;
   * c'est seance.js qui le met en page.
   *
   * Une phrase de « Phrases et dialogues » passe par les mêmes exercices —
   * reconnaître, retrouver, écrire, traduire, écouter — et la question porte
   * `phrase: true` : la séance corrige alors avec la tolérance d'une phrase,
   * et nomme la phrase plutôt que le mot dans ses consignes. */
  async function preparer(carte, entree, options) {
    const question = await composer(carte, entree, options);
    if (entree.conversation) question.phrase = true;
    return question;
  }

  /* Les graphies acceptées pour la vedette : elle-même, et pour une phrase
   * ses variantes enregistrées — rien d'autre n'est deviné. */
  function graphiesDeLaVedette(entree) {
    const variantes = entree.variantes && entree.variantes[entree.langue];
    return [entree.mot].concat(variantes || []);
  }

  async function composer(carte, entree, options) {
    const phrases = await phrasesDe(entree);
    const type = typeDExercice(carte, entree, phrases, options);
    /* Les réponses : celles du sens visé quand il y en a un, sinon toutes. Les
     * équivalents des autres sens restent connus de la correction, qui les
     * comptera « presque ». Le contexte — la définition du sens — n'est
     * montré que dans la direction « comprendre » : c'est là qu'il lève
     * l'ambiguïté. Dans l'autre, la réponse est la vedette quel que soit le
     * sens, et la définition pourrait la contenir. */
    const vise = sensVise(entree);
    const reponses = vise ? vise.equivalents : traductions(entree);
    const autresSens = vise
      ? traductions(entree).filter((t) => reponses.indexOf(t) === -1) : [];
    const contexte = vise ? vise.definition : null;
    /* La langue dans laquelle on attend la réponse. Elle ne se déduit pas du
     * nom de l'exercice : « reconnaître le sens » d'une entrée française veut
     * dire répondre en anglais. C'est pourtant ce que la consigne doit
     * annoncer, sans quoi on lit « Que veut dire ce mot ? » devant « maison »
     * en devant répondre « house ». */
    const autreLangue = carte.langue === 'en' ? 'fr' : 'en';
    const nom = estNom(entree) && !estExpression(entree);

    if (type === 'qcm-comprendre') {
      const leurres = await distracteurs(entree, 3);
      const options = melanger([
        { texte: reponses[0], juste: true },
      ].concat(leurres.map((a) => ({ texte: traductions(a)[0], juste: false }))));
      return { type, carte, entree, enonce: entree.mot, options,
               indice: contexte || undefined,
               attendu: reponses[0], langueReponse: autreLangue };
    }

    /* L'énoncé de la direction « produire » : un mot montre jusqu'à deux de
     * ses traductions ; une phrase n'en montre qu'une — ses variantes sont
     * des reformulations, pas des sens à aligner. */
    const enonceProduire = entree.conversation ? reponses[0] : reponses.slice(0, 2).join(', ');

    if (type === 'qcm-produire') {
      const leurres = await distracteurs(entree, 3);
      const options = melanger([
        { texte: entree.mot, juste: true },
      ].concat(leurres.map((a) => ({ texte: a.mot, juste: false }))));
      return { type, carte, entree, enonce: enonceProduire, options,
               attendu: entree.mot, langueReponse: carte.langue };
    }

    /* Écrire la traduction. C'est l'autre moitié du « dans les deux sens » :
     * la réponse attendue n'est plus la vedette mais l'un de ses équivalents,
     * dans l'autre langue. `langueReponse` le dit à la séance, qui s'en sert
     * pour le clavier d'accents et pour la correction. */
    if (type === 'saisie-traduction') {
      const autre = carte.langue === 'en' ? 'fr' : 'en';
      return {
        type, carte, entree,
        enonce: entree.mot,
        attendu: reponses[0],
        /* Toutes les traductions enregistrées sont acceptées : « no
         * worries » se dit « pas de souci » ou « pas de problème », et les
         * deux sont attestées. Rien d'autre ne l'est — une variante qui n'a
         * pas été enregistrée n'est pas devinée. */
        attendus: reponses,
        autresSens,
        indice: contexte || undefined,
        estNom: nom,
        langueReponse: autre,
      };
    }

    /* Le pluriel d'un nom — « mouse » → « mice », « cheval » → « chevaux ».
     * Surtout utile pour les pluriels irréguliers, que rien ne prédit. */
    if (type === 'pluriel') {
      const pluriel = formeFlechie(entree, 'pl');
      if (pluriel && pluriel.graphie !== entree.mot) {
        return {
          type, carte, entree,
          enonce: entree.mot,
          attendu: pluriel.graphie,
          attendus: [pluriel.graphie],
          estNom: true,
          langueReponse: entree.langue,
        };
      }
    }

    /* Une forme conjuguée précise, tirée au sort parmi celles qu'on connaît :
     * pour l'anglais, les temps primitifs — prétérit et participe passé —,
     * c'est-à-dire ce qu'on apprend par cœur des verbes irréguliers. */
    if (type === 'conjugaison') {
      const codes = ['past', 'pp', '3sg'].filter((code) => formeFlechie(entree, code));
      if (codes.length) {
        const code = auHasard(codes);
        const cible = formeFlechie(entree, code);
        return {
          type, carte, entree,
          enonce: entree.mot,
          indice: I18n.t('flexion.' + code),
          attendu: cible.graphie,
          attendus: [cible.graphie],
          estNom: false,
          langueReponse: entree.langue,
        };
      }
    }

    /* La famille du mot : parmi quatre mots de même racine, lequel veut dire
     * ceci ? « happy » → lequel veut dire « bonheur » : happiness, happily,
     * unhappy, happy. On apprend la racine une fois, et ses dérivés viennent
     * presque gratuitement — c'est ce que la question fait sentir. */
    if (type === 'famille') {
      const question = await questionDeFamille(entree);
      if (question) return Object.assign({ type, carte }, question);
    }

    /* Reconnaître un synonyme parmi quatre. Les leurres viennent du même tirage
     * que les autres questions à choix : même nature, même bande, et aucune
     * traduction commune avec la cible — un leurre synonyme serait injuste. */
    if (type === 'synonyme') {
      const proches = synonymesDe(entree);
      if (proches.length) {
        const leurres = await distracteurs(entree, 3);
        const bonne = auHasard(proches);
        const choix = melanger([{ texte: bonne, juste: true }]
          .concat(leurres.map((a) => ({ texte: a.mot, juste: false }))));
        return { type, carte, entree, enonce: entree.mot, options: choix,
                 attendu: bonne, langueReponse: carte.langue };
      }
    }

    if (type === 'trou' && phrases.length) {
      const utilisables = phrases.filter(
        (p) => (carte.langue === 'en' ? p.en : p.fr));
      const paire = utilisables.length ? auHasard(utilisables) : null;
      const source = paire && (carte.langue === 'en' ? paire.en : paire.fr);
      const cible = paire && (carte.langue === 'en' ? paire.fr : paire.en);
      if (!source) return saisieSimple(carte, entree, reponses);
      const troue = trouer(source, carte.langue, Lexique.cle(entree.mot));
      if (troue) {
        return { type, carte, entree, enonce: troue.texte, indice: cible || null,
                 attendu: troue.mot, attendus: [troue.mot, entree.mot],
                 estNom: nom, langueReponse: carte.langue };
      }
    }

    /* L'appariement de phrases réclame les deux côtés : sans traduction en
     * face, il n'y a rien à apparier. Un exemple personnel saisi seul est donc
     * écarté ici, et l'exercice de repli prend la main. */
    const appariables = phrases.filter((p) => p.en && p.fr);
    if (type === 'paire-phrase' && appariables.length) {
      const paire = auHasard(appariables);
      const source = carte.langue === 'en' ? paire.en : paire.fr;
      const bonne = carte.langue === 'en' ? paire.fr : paire.en;
      const autres = melanger(appariables.filter((p) => p !== paire))
        .slice(0, 2)
        .map((p) => (carte.langue === 'en' ? p.fr : p.en));
      if (autres.length >= 1) {
        const options = melanger([{ texte: bonne, juste: true }]
          .concat(autres.map((t) => ({ texte: t, juste: false }))));
        return { type, carte, entree, enonce: source, options, attendu: bonne,
                 langueReponse: autreLangue };
      }
    }

    if (type === 'ecoute') {
      return { type, carte, entree, enonce: null,
               aEcouter: entree.conversation && racine.Conversation
                 ? Conversation.texteParle(entree.mot) : entree.mot,
               attendu: entree.mot, attendus: graphiesDeLaVedette(entree),
               estNom: nom, langueReponse: carte.langue };
    }

    // Par défaut, et pour tout ce qui précède qui n'a pas abouti : la saisie.
    return saisieSimple(carte, entree, reponses);
  }

  /* Le repli : écrire la vedette, en ne voyant que sa traduction.
   *
   * Toute question qui n'aboutit pas retombe ici — une phrase où le mot ne se
   * reconnaît pas, un pluriel absent, un synonyme qu'on n'a pas. Une séance ne
   * doit jamais rester sans question à poser : l'exercice de repli demande le
   * moins de données possible, et il y en a toujours assez. */
  function saisieSimple(carte, entree, reponses) {
    return {
      type: 'saisie',
      carte, entree,
      enonce: entree.conversation ? reponses[0] : reponses.slice(0, 2).join(', '),
      attendu: entree.mot,
      attendus: graphiesDeLaVedette(entree),
      estNom: estNom(entree) && !estExpression(entree),
      langueReponse: carte.langue,
    };
  }

  /* Remplace le mot cible par des points de suspension dans une phrase.
   * Renvoie null si le mot n'y figure pas de façon reconnaissable — mieux vaut
   * ne pas poser la question que de la poser mal. */
  function trouer(texte, langue, cleCible) {
    const morceaux = texte.split(/(\p{L}[\p{L}'’-]*)/u);
    for (let i = 0; i < morceaux.length; i += 1) {
      const morceau = morceaux[i];
      if (!morceau || !/\p{L}/u.test(morceau)) continue;
      const k = Lexique.cle(morceau);
      if (k === cleCible || Lexique.lemmes(langue, k).indexOf(cleCible) !== -1) {
        const copie = morceaux.slice();
        copie[i] = '…';
        return { texte: copie.join(''), mot: morceau };
      }
    }
    return null;
  }

  // ── Les verbes irréguliers, les familles ──────────────────────────────────

  /* Un verbe anglais irrégulier : son prétérit ou son participe ne se
   * forment pas en -ed. « go, went, gone » ; « put, put, put ». */
  function estIrregulier(entree) {
    if (entree.langue !== 'en') return false;
    const passe = formeFlechie(entree, 'past');
    const participe = formeFlechie(entree, 'pp');
    if (!passe && !participe) return false;
    return [passe, participe].some((f) => f && !/ed$/.test(f.graphie));
  }

  /* Un pluriel qui ne se forme pas en -s / -es (anglais), en -s / -x
   * (français). */
  function estPlurielIrregulier(entree) {
    const pluriel = formeFlechie(entree, 'pl');
    if (!pluriel) return false;
    const mot = entree.mot;
    const g = pluriel.graphie;
    if (entree.langue === 'en') {
      return !(g === mot + 's' || g === mot + 'es'
        || (/y$/.test(mot) && g === mot.slice(0, -1) + 'ies'));
    }
    return !(g === mot + 's' || g === mot + 'x' || g === mot);
  }

  /* Les membres de la famille d'une entrée, chacun avec sa première
   * traduction. Rend au plus `combien` entrées ouvertes. */
  async function famille(entree, combien) {
    const sortie = [];
    for (const mot of (entree.voisins || []).slice(0, 10)) {
      const v = Lexique.vedette(entree.langue, mot);
      if (!v || (v.cru && !Lexique.montrerCrus)) continue;
      const ouverte = await Lexique.ouvrir(v).catch(() => null);
      if (!ouverte || !traductions(ouverte).length) continue;
      sortie.push(ouverte);
      if (sortie.length >= combien) break;
    }
    return sortie;
  }

  async function questionDeFamille(entree) {
    const membres = await famille(entree, 5);
    if (membres.length < 2) return null;
    const tous = [entree].concat(membres);
    const cible = auHasard(membres);
    const sens = traductions(cible)[0];
    // Aucun autre membre ne doit partager cette traduction.
    const cleSens = Lexique.cle(sens);
    const leurres = tous.filter((m) => m !== cible
      && traductions(m).every((t) => Lexique.cle(t) !== cleSens));
    if (leurres.length < 2) return null;
    const options = melanger([{ texte: cible.mot, juste: true }]
      .concat(melanger(leurres).slice(0, 3).map((m) => ({ texte: m.mot, juste: false }))));
    return {
      entree, enonce: sens, racine: entree.mot, options,
      attendu: cible.mot, langueReponse: entree.langue,
      apprendre: cible,
    };
  }

  racine.Exercices = {
    ARTICLES, vivierDeLeurres,
    corriger, comparerPhrase, clePhrase, distancePour: distance, nettoyer, decouper,
    traductions, montrables, sensMontrable, genreDe, genresDe, estNom, estExpression,
    formeFlechie, synonymesDe, estIrregulier, estPlurielIrregulier,
    famille, questionDeFamille,
    preparer, typeDExercice, trouer, melanger, phrasesDe,
  };

})(window);
