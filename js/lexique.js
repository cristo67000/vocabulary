'use strict';
/*
 * Le dictionnaire : chargement, recherche instantanée, lemmatisation.
 *
 * ── Ce que contient un paquet de données ────────────────────────────────────
 *
 *   en.idx          une ligne par vedette, triée par clé :
 *                   clé ⇥ mot ⇥ n° de tranche ⇥ bande ⇥ aperçu ⇥ drapeaux
 *                   (drapeaux : « c » mot cru, « x » expression usuelle)
 *   en-000.json…    les entrées elles-mêmes, par tranches de 900
 *   formes-en.idx   forme fléchie ⇥ n,reste  →  lemme = forme[:n] + reste
 *                   (« went » → go, « color » → colour, « yeux » → œil)
 *   expressions-en.idx  mot ⇥ langue:vedette|langue:vedette|…
 *                   les expressions usuelles qui contiennent ce mot, dans leur
 *                   vedette ou dans leurs traductions — « beans » y mène à
 *                   « spill the beans », « mèche » aussi (« vendre la mèche »)
 *   phrases-000.json…  le vivier de phrases, partagé entre les deux langues
 *
 * ── Pourquoi l'index reste une chaîne ───────────────────────────────────────
 *
 * L'index français complet dépasse 100 000 lignes. Le découper en autant de chaînes
 * JavaScript coûterait plusieurs méga-octets rien qu'en en-têtes d'objets, sur
 * un téléphone qui n'en a pas de trop. On garde donc le texte tel qu'il est
 * arrivé et on ne retient que la position de chaque début de ligne, dans un
 * Int32Array — 4 octets par entrée. La recherche est une dichotomie sur ces
 * positions, une quinzaine de comparaisons : instantanée, sans rien construire.
 *
 * ── ⚠ cle() a un jumeau en Python ──────────────────────────────────────────
 *
 * `build/commun.py:cle()` doit donner exactement le même résultat, sinon un mot
 * présent dans l'index devient introuvable à la frappe. `build/verifier.py`
 * exécute les deux sur la même liste de cas et échoue si elles divergent.
 * Toute retouche ici doit être reportée là-bas, et inversement.
 */
(function (racine) {

  const REMPLACEMENTS = [
    ['ß', 'ss'], ['ẞ', 'ss'],
    ['œ', 'oe'], ['Œ', 'oe'],
    ['æ', 'ae'], ['Æ', 'ae'],
    ['’', "'"], ['‘', "'"], ['‛', "'"], ['‚', "'"], ['´', "'"], ['`', "'"],
    ['–', '-'], ['—', '-'], ['‐', '-'], ['‑', '-'],
    [' ', ' '], [' ', ' '], [' ', ' '],
  ];

  function cle(texte) {
    if (!texte) return '';
    let sortie = String(texte).toLowerCase();
    for (const [avant, apres] of REMPLACEMENTS) {
      if (sortie.indexOf(avant) !== -1) sortie = sortie.split(avant).join(apres);
    }
    sortie = sortie.normalize('NFD').replace(/\p{M}/gu, '');
    return sortie.split(/\s+/).filter(Boolean).join(' ');
  }

  // ── Index en mémoire ──────────────────────────────────────────────────────

  function indexer(texte) {
    const debuts = [];
    let position = 0;
    const taille = texte.length;
    while (position < taille) {
      debuts.push(position);
      const saut = texte.indexOf('\n', position);
      if (saut === -1) break;
      position = saut + 1;
      // Une dernière ligne vide, due au saut final, n'est pas une entrée.
      if (position >= taille) break;
    }
    return { texte, debuts: Int32Array.from(debuts) };
  }

  function cleLigne(index, numero) {
    const debut = index.debuts[numero];
    const fin = index.texte.indexOf('\t', debut);
    return index.texte.slice(debut, fin === -1 ? debut : fin);
  }

  function champs(index, numero) {
    const debut = index.debuts[numero];
    let fin = index.texte.indexOf('\n', debut);
    if (fin === -1) fin = index.texte.length;
    // Un retour chariot traînant — fichier écrit sous Windows — se collerait au
    // dernier champ et rendrait introuvable le lemme « house\r ». La
    // construction écrit en LF ; on se garde tout de même de dépendre de ça.
    if (fin > debut && index.texte.charCodeAt(fin - 1) === 13) fin -= 1;
    return index.texte.slice(debut, fin).split('\t');
  }

  /* Numéro de la première ligne dont la clé est ≥ `cible`. */
  function premiereLigne(index, cible) {
    let bas = 0;
    let haut = index.debuts.length;
    while (bas < haut) {
      const milieu = (bas + haut) >> 1;
      if (cleLigne(index, milieu) < cible) bas = milieu + 1;
      else haut = milieu;
    }
    return bas;
  }

  // ── État ──────────────────────────────────────────────────────────────────

  const etat = {
    paquet: null,          // 'noyau' ou 'complet'
    manifeste: null,
    index: {},             // langue → {texte, debuts}
    formes: {},            // langue → {texte, debuts}  (paquet complet)
    expressions: {},       // langue du mot → {texte, debuts}
    tranches: new Map(),   // 'en/12' → Map(mot → entrée)
    montrerCrus: false,    // les mots crus (vulgaires, injurieux) se montrent-ils ?
  };

  async function texteDe(chemin) {
    /* Le paquet complet d'une mouture antérieure se lit directement dans son
     * cache, par l'API Cache : ni réseau ni service worker entre les deux,
     * donc rien qui puisse substituer un fichier d'une autre mouture. Ce qui
     * n'y est pas n'y est pas — on ne va pas le chercher ailleurs. */
    if (etat.ancien && chemin.indexOf('data/complet/') === 0) {
      const cache = await caches.open(etat.ancien.nom);
      const range = await cache.match(chemin);
      if (!range) throw new Error(chemin + ' : absent de ' + etat.ancien.nom);
      return range.text();
    }
    const reponse = await fetch(chemin);
    if (!reponse.ok) throw new Error(chemin + ' : ' + reponse.status);
    return reponse.text();
  }

  /* Combien de tranches par langue porte le paquet complet d'une mouture
   * antérieure : son manifeste le dit s'il a été rangé avec lui, sinon on
   * compte ses fichiers. */
  async function tranchesDeLAncien(ancien) {
    const comptes = { en: 0, fr: 0 };
    if (ancien.manifeste) {
      for (const f of ancien.manifeste.paquets.complet.fichiers) {
        if (/\/en-\d+\.json$/.test(f)) comptes.en += 1;
        if (/\/fr-\d+\.json$/.test(f)) comptes.fr += 1;
      }
      return comptes;
    }
    const cache = await caches.open(ancien.nom);
    for (const requete of await cache.keys()) {
      if (/\/complet\/en-\d+\.json$/.test(requete.url)) comptes.en += 1;
      if (/\/complet\/fr-\d+\.json$/.test(requete.url)) comptes.fr += 1;
    }
    return comptes;
  }

  /* Charge un paquet. `options.ancien` — `{nom, manifeste}`, tel que
   * `Paquets.ancien()` le rend — fait lire le paquet complet d'une mouture
   * antérieure, entier et cohérent, en attendant le téléchargement du
   * nouveau. */
  async function charger(paquet, options) {
    const manifeste = etat.manifeste
      || JSON.parse(await texteDe('data/manifeste.json'));
    etat.ancien = (paquet === 'complet' && options && options.ancien) || null;
    etat.tranches.clear();
    etat.tranchesAnciennes = etat.ancien ? await tranchesDeLAncien(etat.ancien) : null;
    const index = {};
    const formes = {};
    const expressions = {};
    for (const langue of ['en', 'fr']) {
      index[langue] = indexer(await texteDe(`data/${paquet}/${langue}.idx`));
      /* Les deux paquets ont leur index des formes fléchies — celui du noyau
       * est restreint à ses mots. Sans lui, « went » ne mènerait à « go »
       * qu'après le téléchargement complet, et la fiche ne saurait pas
       * reconnaître « houses » dans sa phrase d'exemple. */
      formes[langue] = indexer(await texteDe(`data/${paquet}/formes-${langue}.idx`));
      /* L'index des expressions par mot. Un paquet construit avant la version 3
       * n'en a pas : on continue sans, la recherche par mot intérieur est
       * simplement muette jusqu'à la prochaine mise à jour des données. */
      try {
        expressions[langue] = indexer(
          await texteDe(`data/${paquet}/expressions-${langue}.idx`));
      } catch (erreur) {
        expressions[langue] = null;
      }
    }
    // Rien n'est publié tant que tout n'est pas lu : un chargement à moitié
    // fait laisserait l'application avec un index anglais neuf et un index
    // français périmé.
    etat.manifeste = manifeste;
    etat.paquet = paquet;
    etat.index = index;
    etat.formes = formes;
    etat.expressions = expressions;
    etat.tranches.clear();
    viviers.clear();
    return etat;
  }

  // ── Recherche ─────────────────────────────────────────────────────────────

  function collecter(langue, prefixe, exact, resultats, plafond) {
    const index = etat.index[langue];
    if (!index) return;
    let numero = premiereLigne(index, prefixe);
    while (numero < index.debuts.length && resultats.length < plafond) {
      const ligne = champs(index, numero);
      const [k, mot, tranche, bande, apercu, drapeaux] = ligne;
      if (!k.startsWith(prefixe)) break;
      const cru = !!drapeaux && drapeaux.indexOf('c') !== -1;
      /* Un mot cru n'apparaît dans les résultats que si l'on a demandé à voir
       * les mots crus : on le cherche alors en connaissance de cause. */
      if ((!exact || k === prefixe) && (!cru || etat.montrerCrus)) {
        resultats.push({
          langue, mot, cle: k,
          tranche: Number(tranche),
          bande: Number(bande),
          apercu: apercu || '',
          exact: k === prefixe,
          cru,
          via: null,
        });
      } else if (exact) {
        break;
      }
      numero += 1;
    }
  }

  /* La ligne d'index d'une vedette précise. `chercher()` ratisse trois pistes
   * dans les deux langues pour deviner ce qu'on voulait taper ; ici on sait
   * déjà, et une dichotomie suffit. Renvoie null si le mot n'est pas dans le
   * paquet installé — le paquet complet a pu être supprimé depuis qu'on l'a
   * mis en révision. */
  function vedette(langue, mot) {
    const index = etat.index[langue];
    if (!index || !mot) return null;
    const k = cle(mot);
    let numero = premiereLigne(index, k);
    while (numero < index.debuts.length) {
      const [cleLue, vedetteLue, tranche, bande, apercu, drapeaux] = champs(index, numero);
      if (cleLue !== k) return null;
      if (vedetteLue === mot) {
        return { langue, mot: vedetteLue, cle: cleLue, tranche: Number(tranche),
                 bande: Number(bande), apercu: apercu || '', via: null,
                 cru: !!drapeaux && drapeaux.indexOf('c') !== -1 };
      }
      numero += 1;
    }
    return null;
  }

  /* La vedette derrière une graphie rencontrée dans un texte.
   *
   * C'est ce qui rend les mots cliquables : on lit « houses » dans une citation
   * et il faut arriver à « house ». Deux dichotomies au plus — la graphie telle
   * quelle, puis ses lemmes — soit une trentaine de comparaisons. Une fiche en
   * contient quelques centaines de mots : le coût total se mesure en
   * millisecondes, et il n'y a rien à mettre en cache.
   *
   * Renvoie null quand le mot n'est pas dans le paquet installé. L'appelant
   * doit le prévoir : c'est le cas ordinaire pour qui n'a que le noyau, et un
   * mot muet vaut mieux qu'un bouton qui ne fait rien. */
  function resoudre(graphie, langue) {
    const k = cle(graphie);
    if (!k) return null;

    const direct = [];
    collecter(langue, k, true, direct, 8);
    if (direct.length) return meilleur(direct, graphie);

    for (const lemme of lemmes(langue, k)) {
      const lot = [];
      collecter(langue, lemme, true, lot, 8);
      if (lot.length) return meilleur(lot, graphie);
    }
    return null;
  }

  /* La vedette derrière une graphie, telle qu'un lecteur la reconnaîtrait.
   *
   * `resoudre()` ne connaît que les vedettes et les formes fléchies de
   * l'index ; c'est ce qu'il faut pour un doublon dans « Mes mots » ou une
   * liste d'exercices, où une approximation serait une erreur. En lisant, on
   * attend davantage : « don't » mène à *do*, « I'm » à *I*, « person's » à
   * *person*, « allotted » à *allot*, même quand l'index des formes ne les a
   * pas. Ces mots-là restaient du texte mort, et ce sont les plus fréquents
   * d'une phrase anglaise. (Mesure faite sur 360 fiches : 3,6 % des mots
   * anglais n'étaient pas cliquables, dont un tiers de contractions.)
   *
   * Le s long des citations anciennes (« diſtance ») se lit comme un s. */
  const CONTRACTIONS_EN = {
    "can't": 'can', "won't": 'will', "shan't": 'shall', "ain't": 'be',
    gonna: 'go', wanna: 'want', gotta: 'get', kinda: 'kind', sorta: 'sort',
    dunno: 'know', lemme: 'let', gimme: 'give', "y'all": 'you', innit: 'be',
  };
  const SUFFIXES_CONTRACTES = /^(.{1,})'(s|re|ve|ll|d|m)$/i;

  /* Les terminaisons régulières. Chaque règle propose une base ; la première
   * qui est une vedette gagne, d'où l'ordre : le pluriel avant tout (« dies »
   * est *die*, pas *dy*), le « e » final avant la base nue (« hoped » est
   * *hope*, pas *hop* ; « filled » essaie *fille*, puis *fill*), la consonne
   * doublée en dernier (« allotted » → *allot*). */
  const TERMINAISONS_EN = [
    [/([^s'])s$/, '$1'], [/s'$/, ''], [/(s|x|z|ch|sh|o)es$/, '$1'], [/ies$/, 'y'],
    [/ves$/, 'f'], [/ves$/, 'fe'],
    [/(ed|ing|er|est)$/, 'e'], [/(ed|ing|er|est)$/, ''],
    [/([b-df-hj-np-tv-z])\1(ed|ing|er|est)$/, '$1'],
    [/ied$/, 'y'], [/ier$/, 'y'], [/iest$/, 'y'],
    [/ers$/, 'e'], [/ers$/, ''], [/([b-df-hj-np-tv-z])\1ers$/, '$1'],
    [/ily$/, 'y'], [/ically$/, 'ic'], [/ally$/, 'al'], [/ly$/, 'le'], [/ly$/, ''],
  ];

  function resoudreEnLisant(graphie, langue) {
    const direct = resoudre(graphie, langue);
    if (direct) return direct;
    let g = graphie.replace(/’/g, "'");
    if (g.indexOf('ſ') !== -1) {
      g = g.replace(/ſ/g, 's');
      const lu = resoudre(g, langue);
      if (lu) return lu;
    }
    if (langue !== 'en') return null;

    const minuscule = g.toLowerCase();
    if (CONTRACTIONS_EN[minuscule]) return resoudre(CONTRACTIONS_EN[minuscule], 'en');
    if (/n't$/i.test(g) && g.length > 4) return resoudre(g.slice(0, -3), 'en');
    const contracte = SUFFIXES_CONTRACTES.exec(g);
    if (contracte) return resoudre(contracte[1], 'en');

    for (const [motif, remplacement] of TERMINAISONS_EN) {
      if (!motif.test(minuscule)) continue;
      const base = minuscule.replace(motif, remplacement);
      if (base.length < 3 || base === minuscule) continue;
      const trouve = resoudre(base, 'en');
      if (trouve) return trouve;
    }
    return null;
  }

  /* Plusieurs vedettes partagent souvent une clé : « May » le mois et « may »
   * le verbe, « été » la saison et « été » le participe. Prendre la première
   * venue ouvrait la fiche du mois quand on avait cliqué sur le verbe — la
   * clé ignore la casse. La graphie exacte tranche donc ; à défaut, le mot le
   * plus courant, qui est presque toujours celui qu'on visait. */
  function meilleur(lot, graphie) {
    const exact = lot.find((resultat) => resultat.mot === graphie);
    if (exact) return exact;
    return lot.reduce((a, b) => (b.bande < a.bande ? b : a));
  }

  /* Le lemme d'une forme fléchie, s'il est connu. Renvoie une liste : « went »
   * n'a qu'un lemme, mais certaines formes en ont plusieurs (« lay » : lay et
   * lie). */
  function lemmes(langue, k) {
    const index = etat.formes[langue];
    if (!index || !k) return [];
    const numero = premiereLigne(index, k);
    if (numero >= index.debuts.length || cleLigne(index, numero) !== k) return [];
    const [, codes] = champs(index, numero);
    return codes.split('|').map((code) => {
      const virgule = code.indexOf(',');
      const partage = Number(code.slice(0, virgule));
      return k.slice(0, partage) + code.slice(virgule + 1);
    });
  }

  /* Trois rangs, dans cet ordre :
   *
   *   0  la frappe est exactement la vedette                 « go »    → go
   *   1  la frappe est une forme fléchie de la vedette       « went »  → go
   *   2  la frappe est le début de la vedette                « wen »   → went…
   *
   * Le rang 1 doit passer avant le rang 2, et c'est tout l'intérêt de les
   * distinguer : qui tape « mice » veut « mouse », pas « micelle » — même si
   * « micelle » commence bien par « mice ». Ensuite viennent les mots les
   * plus courants, puis les plus courts : un préfixe court désigne presque
   * toujours un mot plus utile que ses composés.
   */
  function ordonner(a, b) {
    if (a.rang !== b.rang) return a.rang - b.rang;
    /* « May » tapé avec sa majuscule : le mois avant le verbe « may ». */
    if (!!a.memeCasse !== !!b.memeCasse) return a.memeCasse ? -1 : 1;
    /* À rang égal, ce qu'on a ajouté soi-même passe devant. On n'ajoute pas un
     * mot au hasard : on l'ajoute parce qu'on veut le retrouver, et le voir
     * arriver derrière quatre composés du dictionnaire donnerait le sentiment
     * que l'application ne l'a pas gardé. Ils sont peu nombreux — la liste
     * n'en est pas encombrée. */
    if (!!a.perso !== !!b.perso) return a.perso ? -1 : 1;
    if (a.bande !== b.bande) return a.bande - b.bande;
    /* À fréquence égale, l'anglais devant : « pain », « table », « place »
     * existent dans les deux langues, et c'est l'anglais qu'on apprend. */
    if (a.langue !== b.langue) return a.langue === 'en' ? -1 : 1;
    if (a.cle.length !== b.cle.length) return a.cle.length - b.cle.length;
    return a.cle < b.cle ? -1 : (a.cle > b.cle ? 1 : 0);
  }

  function chercher(saisie, plafond) {
    const limite = plafond || 40;
    const k = cle(saisie);
    if (!k) return [];

    const resultats = [];
    const vus = new Set();

    function ajouter(lot, rang, via) {
      for (const resultat of lot) {
        /* L'empreinte distingue un mot personnel d'une vedette homographe : on
         * peut très bien avoir ajouté « Zug » à soi, avec sa propre traduction,
         * alors que le dictionnaire le connaît. Les deux fiches existent, les
         * deux doivent s'afficher. */
        const empreinte = resultat.perso
          ? 'perso ' + resultat.perso
          : resultat.langue + ' ' + resultat.mot;
        if (vus.has(empreinte)) continue;
        vus.add(empreinte);
        /* Le lemme d'une forme fléchie est « exact » par rapport à ce lemme,
         * pas à la saisie : « knackered » est une vedette, et doit passer
         * devant « knacker », dont il est aussi le participe. */
        resultat.rang = resultat.exact && !via ? 0 : rang;
        // Un mot personnel atteint par sa traduction porte déjà son « via ».
        resultat.via = via || resultat.via || null;
        resultats.push(resultat);
      }
    }

    /* Les deux pistes sont suivies à chaque frappe, et non l'une à défaut de
     * l'autre. Se contenter du préfixe tant qu'il donne quelque chose paraît
     * économique et ne l'est pas : « mice » a des voisins — micelle,
     * microbe… — derrière lesquels « mouse » ne serait jamais remonté, et
     * « color » se serait fait doubler par « colorant ». */

    // 1. La saisie est-elle une forme fléchie — ou une graphie américaine —
    //    de quelque chose ?
    for (const langue of ['en', 'fr']) {
      for (const lemme of lemmes(langue, k)) {
        // « colour » se trouve lui-même parmi les graphies : c'est la vedette
        // exacte, que l'étape 2 donne sans flèche « ← colour ».
        if (lemme === k) continue;
        const lot = [];
        collecter(langue, lemme, true, lot, 4);
        ajouter(lot, 1, saisie);
      }
    }

    // 2. Le début d'un mot, l'usage ordinaire.
    for (const langue of ['en', 'fr']) {
      const lot = [];
      collecter(langue, k, false, lot, limite * 2);
      ajouter(lot, 2, null);
    }

    /* 3. Les mots qu'on a ajoutés soi-même — par leur vedette et par leurs
     *    traductions, ce qui les rend trouvables dans les deux sens sans
     *    qu'il ait fallu les saisir deux fois. Ils sont peu nombreux et vivent
     *    en mémoire : un parcours linéaire suffit là où le dictionnaire réclame
     *    une dichotomie. */
    if (racine.Perso) ajouter(Perso.chercher(k, limite), 2, null);

    const tapee = String(saisie).trim();
    for (const r of resultats) r.memeCasse = r.mot === tapee;
    resultats.sort(ordonner);
    return resultats.slice(0, limite);
  }

  // ── Les expressions usuelles, par un mot qu'elles contiennent ─────────────

  /* Les expressions qui contiennent ce mot, ou un mot qui commence ainsi.
   *
   * L'index des vedettes ne sait trouver que des débuts de vedette : « feu »
   * n'y donne pas « à petit feu ». Celui-ci est rangé par **mot**, dans les
   * deux langues — un mot de la vedette, ou un mot de ses traductions —, et se
   * lit par la même dichotomie. On regarde d'abord le mot exact, puis les mots
   * qui le prolongent (« bean » trouve aussi « beans »), jusqu'à un plafond :
   * sur « de » ou « the », les listes seraient interminables.
   *
   * Rend des références `{langue, mot, exact}` — pas des entrées : il faut
   * encore passer par `vedette()` pour savoir dans quelle tranche elles vivent.
   * Un mot qui n'y est pas rend une liste vide, jamais une erreur.
   */
  /* Les expressions rangées sous un mot — ou sous tous les mots qui commencent
   * ainsi, pendant la frappe. L'index est complet : sous « de », le paquet
   * complet en range près de deux mille, et on les lit toutes. C'est le seul
   * moyen qu'une recherche à deux mots retrouve « de bonne heure » : chaque
   * mot rend sa liste entière, et c'est leur intersection qui isole. Le
   * plafond ne sert qu'aux appelants qui veulent s'arrêter tôt ;
   * `exactSeulement` à ceux qui ne veulent que le mot lui-même — le mot
   * exact est rangé en tête, la lecture s'arrête juste après. */
  function expressionsPar(langue, k, plafond, exactSeulement) {
    const index = etat.expressions[langue];
    if (!index || !k) return [];
    const limite = plafond || Infinity;
    const sortie = [];
    const vues = new Set();
    let numero = premiereLigne(index, k);
    while (numero < index.debuts.length && sortie.length < limite) {
      const [motLu, liste] = champs(index, numero);
      if (!motLu.startsWith(k)) break;
      if (exactSeulement && motLu !== k) break;
      const exact = motLu === k;
      for (const marque of liste.split('|')) {
        const deuxPoints = marque.indexOf(':');
        if (deuxPoints === -1) continue;
        const empreinte = marque;
        if (vues.has(empreinte)) continue;
        vues.add(empreinte);
        sortie.push({ langue: marque.slice(0, deuxPoints),
                      mot: marque.slice(deuxPoints + 1), exact, par: motLu });
        if (sortie.length >= limite) break;
      }
      numero += 1;
    }
    return sortie;
  }

  /* Les expressions atteintes par une saisie, prêtes à être affichées.
   *
   * Plusieurs mots tapés doivent tous s'y trouver : « petit feu » ne rend que
   * ce qui contient « petit » et « feu ». Chaque mot est cherché dans les deux
   * langues — on ne sait pas laquelle on tape, et une expression anglaise se
   * trouve aussi par sa traduction française.
   *
   * Le classement : d'abord les expressions atteintes par un mot **entier**
   * (« feu » plutôt que « feuille »), puis celles qui ont un équivalent —
   * elles s'apprennent, les autres se lisent —, puis les plus courantes,
   * puis les plus courtes. La liste est rendue entière ; c'est à l'affichage
   * de n'en montrer que le début. L'appelant retire les doublons avec ses
   * propres résultats de mots.
   */
  function chercherExpressions(saisie, plafond) {
    const k = cle(saisie);
    if (!k) return [];
    const mots = k.split(' ').filter((m) => m.length >= 2);
    if (!mots.length) return [];
    const limite = plafond || Infinity;

    // Le mot le plus discriminant en premier : le plus long.
    const ordonnes = mots.slice().sort((a, b) => b.length - a.length);
    let candidats = null;
    for (const mot of ordonnes) {
      const lot = new Map();
      for (const langue of ['en', 'fr']) {
        for (const ref of expressionsPar(langue, mot)) {
          const empreinte = ref.langue + ' ' + ref.mot;
          const deja = lot.get(empreinte);
          if (!deja || (ref.exact && !deja.exact)) lot.set(empreinte, ref);
        }
      }
      if (candidats === null) {
        candidats = lot;
      } else {
        for (const empreinte of Array.from(candidats.keys())) {
          if (!lot.has(empreinte)) candidats.delete(empreinte);
        }
      }
      if (!candidats.size) return [];
    }

    const resultats = [];
    for (const ref of candidats.values()) {
      const v = vedette(ref.langue, ref.mot);
      if (!v || (v.cru && !etat.montrerCrus)) continue;
      v.exact = ref.exact;
      v.expression = true;
      v.sansEquivalent = !v.apercu;
      resultats.push(v);
    }
    resultats.sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1;
      if (a.sansEquivalent !== b.sansEquivalent) return a.sansEquivalent ? 1 : -1;
      // L'anglais, qu'on apprend, devant le français, qui y mène.
      if (a.langue !== b.langue) return a.langue === 'en' ? -1 : 1;
      if (a.bande !== b.bande) return a.bande - b.bande;
      if (a.mot.length !== b.mot.length) return a.mot.length - b.mot.length;
      return a.mot < b.mot ? -1 : (a.mot > b.mot ? 1 : 0);
    });
    return limite === Infinity ? resultats : resultats.slice(0, limite);
  }

  /* Les expressions qui contiennent une vedette donnée, pour le bas de sa
   * fiche. On cherche le mot exact, dans sa langue et — s'il figure dans des
   * traductions — dans l'autre. La vedette elle-même est écartée : « à petit
   * feu » ne se propose pas à sa propre fiche.
   *
   * L'anglais d'abord, puisque c'est lui qu'on apprend : une fiche anglaise
   * ne propose que des expressions anglaises (« house » : on the house, full
   * house), une fiche française d'abord les anglaises que ses traductions
   * atteignent (« maison » : at home), puis les françaises, qui ont toutes
   * leur équivalent. */
  function expressionsAvec(entree, plafond) {
    const k = cle(entree.mot);
    const sortie = [];
    const vues = new Set();
    for (const langue of entree.langue === 'en' ? ['en'] : ['en', 'fr']) {
      for (const ref of expressionsPar(langue, k)) {
        if (!ref.exact) continue;
        const empreinte = ref.langue + ' ' + ref.mot;
        if (vues.has(empreinte)) continue;
        if (ref.langue === entree.langue && ref.mot === entree.mot) continue;
        vues.add(empreinte);
        const v = vedette(ref.langue, ref.mot);
        if (v && (!v.cru || etat.montrerCrus)) {
          v.expression = true; v.sansEquivalent = !v.apercu; sortie.push(v);
        }
      }
    }
    sortie.sort((a, b) => {
      // L'anglais d'abord, puis les traduites, puis les plus courantes, puis
      // les courtes.
      const anglaisA = a.langue === 'en' ? 0 : 1;
      const anglaisB = b.langue === 'en' ? 0 : 1;
      if (anglaisA !== anglaisB) return anglaisA - anglaisB;
      if (a.sansEquivalent !== b.sansEquivalent) return a.sansEquivalent ? 1 : -1;
      if (a.bande !== b.bande) return a.bande - b.bande;
      return a.mot.length - b.mot.length;
    });
    return plafond ? sortie.slice(0, plafond) : sortie;
  }

  /* Une entrée est-elle une expression usuelle ?
   *
   * Pour le dictionnaire, c'est sa provenance qui le dit — « dico »,
   * « tatoeba », « croisee », « attestee », « editorial » —, jamais le seul
   * fait d'avoir plusieurs mots : « base de données » ou « Republik Kuba »
   * sont des mots à plusieurs morceaux. Pour une entrée personnelle, c'est
   * un choix explicite au formulaire, que `Perso` traduit en « perso ». */
  function estExpression(entree) {
    return !!(entree && entree.expression);
  }

  // ── Ouverture d'une entrée ────────────────────────────────────────────────

  async function tranche(langue, numero) {
    const nom = langue + '/' + numero;
    if (etat.tranches.has(nom)) return etat.tranches.get(nom);
    const brut = JSON.parse(await texteDe(
      `data/${etat.paquet}/${langue}-${String(numero).padStart(3, '0')}.json`));
    const carte = new Map();
    for (const [mot, bande, lectures, numerosDePhrases, voisins, infos] of brut.e) {
      /* Le numéro de tranche voyage avec l'entrée : une carte de révision ne
       * garde que de quoi retrouver le mot, et sans lui elle ne saurait pas
       * dans quel fichier aller le chercher. */
      const entree = {
        mot, langue, bande, lectures, tranche: numero,
        phrases: numerosDePhrases || [],
        voisins: voisins || [],
      };
      /* Les renseignements facultatifs, dans un objet que les mots ordinaires
       * n'ont pas :
       *   e    provenance d'une expression usuelle — « dico », « tatoeba »,
       *        « croisee », « attestee », « editorial » ;
       *   x    son explication ;
       *   us   la graphie américaine d'une vedette anglaise (color → colour) ;
       *   cru  tous les sens sont crus ;
       *   gl   une traduction vient d'une glose de l'édition d'en face. */
      if (infos) {
        if (infos.e) {
          entree.expression = infos.e;
          if (infos.x) entree.explication = infos.x;
        }
        if (infos.us) entree.us = infos.us;
        if (infos.cru) entree.cru = true;
        if (infos.gl) entree.croisee = true;
      }
      carte.set(mot, entree);
    }
    // Une poignée de tranches en mémoire suffit à la navigation ; au-delà on
    // relâche les plus anciennes plutôt que de garder 25 Mo au chaud.
    if (etat.tranches.size >= 8) {
      etat.tranches.delete(etat.tranches.keys().next().value);
    }
    etat.tranches.set(nom, carte);
    return carte;
  }

  /* Ouvre une entrée, du dictionnaire ou de soi.
   *
   * Les deux sortes rendent le même objet — mêmes lectures, mêmes sens, mêmes
   * traductions. C'est ce qui permet à la fiche, aux exercices et aux ateliers
   * de ne pas savoir qu'il en existe deux sortes. */
  async function ouvrir(resultat) {
    if (!resultat) return null;
    if (resultat.perso) {
      return (racine.Perso && Perso.entree(resultat.perso)) || null;
    }
    /* Une phrase ou une réplique de « Phrases et dialogues » : même forme
     * d'entrée, servie par son propre module — elle ne vit dans aucune
     * tranche. */
    if (resultat.conversation) {
      return (racine.Conversation && Conversation.entree(resultat.conversation)) || null;
    }
    /* Une fiche de module que le dictionnaire ne connaît pas (« tbh »,
     * « prompt injection ») : servie par son module, au format des entrées. */
    if (resultat.module) {
      return (racine.Modules && Modules.entree(resultat.module)) || null;
    }
    /* Le numéro de tranche qu'une carte de révision garde date du jour où
     * elle a été créée. Une mouture plus récente des données déplace les mots
     * d'une tranche à l'autre — trois vedettes de plus au noyau suffisent —
     * et la carte pointerait alors à côté. On essaie sa tranche, puis on
     * redemande à l'index où le mot vit aujourd'hui : c'est ce qui fait
     * qu'une révision survit à une mise à jour du dictionnaire. */
    if (Number.isInteger(resultat.tranche) && resultat.tranche >= 0) {
      const carte = await tranche(resultat.langue, resultat.tranche).catch(() => null);
      const entree = carte && carte.get(resultat.mot);
      if (entree) return entree;
    }
    const v = vedette(resultat.langue, resultat.mot);
    if (!v || v.tranche === resultat.tranche) return null;
    const carte = await tranche(v.langue, v.tranche).catch(() => null);
    return (carte && carte.get(v.mot)) || null;
  }

  /* Un lot d'entrées prises au hasard, pour fabriquer les leurres des questions
   * à choix multiples. On tire une tranche entière plutôt que des entrées une
   * par une : la tranche est de toute façon chargée d'un bloc, et elle contient
   * 900 mots voisins par l'alphabet — assez de variété une fois filtrés par
   * nature et par bande. */
  function nombreDeTranches(langue) {
    if (!etat.manifeste || !etat.paquet) return 0;
    if (etat.ancien && etat.tranchesAnciennes) return etat.tranchesAnciennes[langue] || 0;
    const fichiers = etat.manifeste.paquets[etat.paquet].fichiers;
    return fichiers.filter((f) => f.indexOf('/' + langue + '-') !== -1).length;
  }

  /* Des entrées tirées au hasard, pour les leurres et les ateliers.
   *
   * Les tranches sont rangées dans l'ordre alphabétique : en puiser tous les
   * candidats dans une seule donnait des leurres qui commençaient tous par
   * les mêmes lettres — « pyroxène, pyrane, pythiade » en face d'« oignon ».
   * On en ouvre donc plusieurs, et l'on prend dans chacune, à tour de rôle.
   * `bande`, quand elle est donnée, ne garde que les mots d'un niveau voisin :
   * un leurre bien plus rare que la réponse se reconnaît sans connaître le mot.
   */
  async function entreesAuHasard(langue, combien, bande) {
    const total = nombreDeTranches(langue);
    if (!total) return [];
    const parTranche = [];
    const vues = new Set();
    const TRANCHES = Math.min(total, 4);
    for (let essai = 0; essai < TRANCHES * 3 && parTranche.length < TRANCHES; essai += 1) {
      const numero = Math.floor(Math.random() * total);
      if (vues.has(numero)) continue;
      vues.add(numero);
      try {
        const retenues = [];
        for (const entree of (await tranche(langue, numero)).values()) {
          if (bande === undefined || Math.abs(entree.bande - bande) <= 1) retenues.push(entree);
        }
        if (retenues.length) parTranche.push(melanger(retenues));
      } catch (erreur) {
        /* Une tranche absente n'est pas une raison d'interrompre une séance. */
      }
    }
    const lot = [];
    for (let rang = 0; lot.length < combien; rang += 1) {
      let ajout = false;
      for (const liste of parTranche) {
        if (rang < liste.length) { lot.push(liste[rang]); ajout = true; }
        if (lot.length >= combien) break;
      }
      if (!ajout) break;
    }
    return lot;
  }

  function melanger(liste) {
    const copie = liste.slice();
    for (let i = copie.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
  }

  // ── Phrases d'exemple ─────────────────────────────────────────────────────

  /* Les phrases sont partagées entre les deux langues — une paire illustre un
   * mot anglais et un mot français — et vivent donc dans un vivier commun. Une
   * entrée n'en garde que les numéros. */
  const PAR_TRANCHE = 900;
  const viviers = new Map();

  async function trancheDePhrases(numero) {
    if (viviers.has(numero)) return viviers.get(numero);
    const brut = JSON.parse(await texteDe(
      `data/${etat.paquet}/phrases-${String(numero).padStart(3, '0')}.json`));
    if (viviers.size >= 6) viviers.delete(viviers.keys().next().value);
    viviers.set(numero, brut.p);
    return brut.p;
  }

  async function phrases(numeros) {
    if (!numeros || !numeros.length) return [];
    const sortie = [];
    for (const identifiant of numeros) {
      try {
        const lot = await trancheDePhrases(Math.floor(identifiant / PAR_TRANCHE));
        const paire = lot[identifiant % PAR_TRANCHE];
        if (paire) sortie.push({ en: paire[0], fr: paire[1] });
      } catch (erreur) {
        /* Une tranche manquante ne doit pas emporter la fiche : le mot, sa
         * traduction et sa prononciation valent d'être montrés même sans
         * exemple. */
      }
    }
    return sortie;
  }

  racine.Lexique = {
    cle,
    charger,
    chercher,
    vedette,
    resoudre,
    resoudreEnLisant,
    ouvrir,
    phrases,
    entreesAuHasard,
    nombreDeTranches,
    lemmes,
    expressionsPar, chercherExpressions, expressionsAvec, estExpression,
    etat,
    get paquet() { return etat.paquet; },
    get montrerCrus() { return etat.montrerCrus; },
    set montrerCrus(valeur) { etat.montrerCrus = !!valeur; },
    get ancien() { return etat.ancien; },
    get manifeste() { return etat.manifeste; },
  };

})(window);
