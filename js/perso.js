'use strict';
/*
 * Mes mots — les entrées qu'on ajoute soi-même.
 *
 * ── Pourquoi elles existent ────────────────────────────────────────────────
 *
 * Un dictionnaire, même de cent mille mots, ne contient pas le vocabulaire du
 * chantier où l'on travaille, le prénom du chat de la voisine, ni l'expression
 * entendue hier au marché. Or c'est justement ce qu'on veut retenir, parce que
 * c'est ce qu'on va réemployer. Une recherche qui ne donne rien était jusqu'ici
 * un cul-de-sac ; elle devient le meilleur moment pour ajouter un mot.
 *
 * ── Ce qu'elles ne sont pas ────────────────────────────────────────────────
 *
 * Elles ne touchent jamais au dictionnaire. Elles vivent dans IndexedDB, à côté
 * des cartes et des notes, et le dictionnaire peut être remplacé, supprimé,
 * retéléchargé dans une version plus récente sans qu'elles bougent. Si une mise
 * à jour ajoute enfin « doomscrolling » au dictionnaire, l'entrée personnelle
 * reste : c'est la sienne, avec sa note et ses révisions, et personne n'a le
 * droit de décider qu'elle fait double emploi.
 *
 * ── L'identifiant ne dépend pas de l'orthographe ───────────────────────────
 *
 * `p-<instant>-<hasard>`, tiré une fois pour toutes. Corriger « recieve » en
 * « receive » ne change que le champ `mot` : la note reste attachée, les
 * cartes gardent leur intervalle, leur facilité et leur échéance. Un
 * identifiant fondé sur la graphie aurait fait d'une correction de faute de
 * frappe une remise à zéro silencieuse — la pire sorte de perte, celle qu'on
 * ne remarque que trois semaines plus tard.
 *
 * ── L'entrée a la forme de celles du dictionnaire ──────────────────────────
 *
 * `entree(uid)` rend exactement ce que `Lexique.ouvrir()` rend pour un mot du
 * dictionnaire : même tableau de lectures, mêmes sens, mêmes traductions. C'est
 * ce qui permet à la fiche, aux exercices, au planificateur et aux ateliers de
 * ne rien savoir des mots personnels — ils reçoivent une entrée, et travaillent.
 * Un seul champ les distingue, `perso`, que seuls l'affichage et l'identité des
 * cartes regardent.
 *
 * ── Tout ce qu'on tape reste du texte ──────────────────────────────────────
 *
 * `assainir()` passe sur chaque champ, et l'affichage se fait au `textContent`.
 * Rien de ce qui est saisi ici, ni de ce qui arrive par un fichier importé,
 * n'est jamais interprété comme du balisage.
 */
(function (racine) {

  const MOT_MAX = 80;
  const TRADUCTIONS_MAX = 12;
  const FORMES_MAX = 8;
  const EXEMPLE_MAX = 300;

  /* Les natures qu'on propose. Volontairement peu nombreuses : une liste de
   * vingt catégories grammaticales devant un champ facultatif fait renoncer.
   * Les codes sont ceux du dictionnaire, pour que la fiche et les exercices
   * n'aient qu'un vocabulaire. */
  const NATURES = ['', 'n', 'v', 'adj', 'adv', 'locution', 'preposition',
                   'conjunction', 'interjection', 'pronoun', 'numeral'];

  const GENRES = { en: [''], fr: ['', 'masc', 'fem'] };

  // Les entrées en mémoire : peu nombreuses, on les garde toutes.
  let table = new Map();      // uid → enregistrement brut
  let chargee = false;

  function maintenant() {
    return Date.now();
  }

  function nouvelIdentifiant() {
    const hasard = Math.random().toString(36).slice(2, 8);
    return 'p-' + maintenant().toString(36) + '-' + hasard;
  }

  // ── Ce qu'on accepte ──────────────────────────────────────────────────────

  /* Un champ d'une seule ligne : espaces resserrés, signes de commande jetés.
   *
   * Les sauts de ligne partent aussi — un mot vedette qui en contiendrait
   * casserait l'index de recherche et l'affichage d'une liste. Les notes, qui
   * en veulent, passent par `Notes.assainir()`. */
  function assainir(texte, limite) {
    if (texte === undefined || texte === null) return '';
    return String(texte)
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F\u00A0\u2028\u2029]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limite || MOT_MAX);
  }

  /* Un exemple garde ses sauts de ligne — une phrase peut en compter. */
  function assainirPhrase(texte) {
    if (texte === undefined || texte === null) return '';
    return String(texte)
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F\u2028\u2029]/g, '')
      .replace(/[ \t]+/g, ' ')
      .trim()
      .slice(0, EXEMPLE_MAX);
  }

  function listeAssainie(valeur, limite, combien) {
    const brut = Array.isArray(valeur) ? valeur : String(valeur || '').split(/[,;\n]/);
    const vues = [];
    for (const morceau of brut) {
      const propre = assainir(morceau, limite || MOT_MAX);
      if (propre && vues.indexOf(propre) === -1) vues.push(propre);
      if (vues.length >= (combien || TRADUCTIONS_MAX)) break;
    }
    return vues;
  }

  /* Met en forme ce qui a été saisi, et dit ce qui manque.
   *
   * Trois champs seulement sont obligatoires — le mot, sa langue, et au moins
   * une traduction. Tout le reste est facultatif, et l'application s'adapte à
   * ce qui est là : pas de genre, pas de question de genre. */
  function normaliser(brut) {
    const langue = (brut.langue === 'en' || brut.langue === 'fr') ? brut.langue : null;
    const mot = assainir(brut.mot, MOT_MAX);
    const traductions = listeAssainie(brut.traductions, MOT_MAX, TRADUCTIONS_MAX);
    const nature = NATURES.indexOf(brut.nature) !== -1 ? brut.nature : '';
    /* Une expression usuelle se déclare : plusieurs mots ne suffisent pas,
     * « base de données » en a trois et reste un nom. Le formulaire pose la
     * question quand le mot en a plusieurs ; une locution ou une interjection
     * de plusieurs mots en est une d'office. */
    const expression = /\s/.test(mot)
      && (brut.expression === true || nature === 'locution' || nature === 'interjection');
    const genresPossibles = GENRES[langue] || [''];
    const genre = (nature === 'n' && genresPossibles.indexOf(brut.genre) !== -1)
      ? brut.genre : '';

    const manques = [];
    if (!mot) manques.push('mot');
    if (!langue) manques.push('langue');
    if (!traductions.length) manques.push('traductions');

    return {
      valide: manques.length === 0,
      manques,
      valeurs: {
        mot,
        langue,
        cle: langue ? Lexique.cle(mot) : '',
        nature,
        genre,
        expression,
        traductions,
        pluriel: assainir(brut.pluriel, MOT_MAX),
        formes: listeAssainie(brut.formes, MOT_MAX, FORMES_MAX),
        exemple: assainirPhrase(brut.exemple),
        exempleTraduit: assainirPhrase(brut.exempleTraduit),
      },
    };
  }

  // ── Lecture et écriture ───────────────────────────────────────────────────

  async function charger() {
    try {
      const tous = await Store.tousLesMotsPerso();
      table = new Map(tous.map((m) => [m.id, m]));
    } catch (erreur) {
      /* Une base refusée — navigation privée — ne doit pas empêcher le
       * dictionnaire de s'ouvrir. On repart sans mots personnels. */
      table = new Map();
    }
    chargee = true;
    return table;
  }

  function liste() {
    return Array.from(table.values()).sort((a, b) => b.modifie - a.modifie);
  }

  function brut(uid) {
    return table.get(uid) || null;
  }

  function compte() {
    return table.size;
  }

  /* Les entrées personnelles qui portent cette clé, dans cette langue. Sert à
   * prévenir d'un doublon avant d'en créer un. */
  function memeCle(langue, mot, saufUid) {
    const k = Lexique.cle(mot);
    if (!k) return [];
    return liste().filter((m) => m.langue === langue && m.cle === k && m.id !== saufUid);
  }

  async function creer(donnees) {
    const controle = normaliser(donnees);
    if (!controle.valide) throw new Error('perso : ' + controle.manques.join(', '));
    const instant = maintenant();
    const enregistrement = Object.assign({
      id: nouvelIdentifiant(), cree: instant, modifie: instant,
    }, controle.valeurs);
    await Store.ecrireMotPerso(enregistrement);
    table.set(enregistrement.id, enregistrement);
    return enregistrement;
  }

  /* Modifier ne recrée rien : l'identifiant, la date de création, les cartes et
   * la note restent les mêmes. Seules les cartes voient leur `mot` et leur
   * `langue` suivre la correction — elles servent à l'affichage des listes, et
   * une carte qui garderait l'ancienne graphie afficherait un mot qui n'existe
   * plus. */
  async function modifier(uid, donnees) {
    const ancien = table.get(uid);
    if (!ancien) throw new Error('perso : identifiant inconnu');
    const controle = normaliser(donnees);
    if (!controle.valide) throw new Error('perso : ' + controle.manques.join(', '));
    const enregistrement = Object.assign({}, ancien, controle.valeurs,
      { id: uid, cree: ancien.cree, modifie: maintenant() });
    await Store.ecrireMotPerso(enregistrement);
    table.set(uid, enregistrement);
    await accorderLesCartes(enregistrement);
    if (racine.Notes) await Notes.renommer(uid, enregistrement.langue, enregistrement.mot);
    return enregistrement;
  }

  /* Après une modification, les cartes doivent redire la vérité : la graphie
   * ou la langue ont pu changer, les cartes les recopient, sans que rien de
   * leur planification ne bouge. */
  async function accorderLesCartes(enregistrement) {
    const cartes = await Store.cartesDuMot(null, null, enregistrement.id).catch(() => []);
    for (const carte of cartes) {
      if (carte.mot === enregistrement.mot && carte.langue === enregistrement.langue) continue;
      carte.mot = enregistrement.mot;
      carte.langue = enregistrement.langue;
      await Store.ecrireCarte(carte).catch(() => {});
    }
  }

  /* Supprimer, et pouvoir le défaire.
   *
   * Rend de quoi tout remettre : l'enregistrement, ses cartes et sa note. Un
   * mot appris depuis trois mois emporte son intervalle et sa facilité ; les
   * lui rendre à l'identique est la seule annulation qui vaille. C'est
   * l'appelant — `mesmots.js` — qui décide s'il faut demander confirmation, et
   * il ne la demande que lorsqu'il y a quelque chose à perdre. */
  async function supprimer(uid) {
    const enregistrement = table.get(uid);
    if (!enregistrement) return null;
    const cartes = await Store.cartesDuMot(null, null, uid).catch(() => []);
    const note = await Store.lireNote('perso:' + uid).catch(() => null);
    for (const carte of cartes) await Store.supprimerCarte(carte.id).catch(() => {});
    if (note) await Store.supprimerNote(note.id).catch(() => {});
    await Store.supprimerMotPerso(uid);
    table.delete(uid);
    return { enregistrement, cartes, note: note || null };
  }

  async function remettre(retrait) {
    if (!retrait || !retrait.enregistrement) return;
    await Store.ecrireMotPerso(retrait.enregistrement);
    table.set(retrait.enregistrement.id, retrait.enregistrement);
    for (const carte of retrait.cartes) await Store.ecrireCarte(carte).catch(() => {});
    if (retrait.note) await Store.ecrireNote(retrait.note).catch(() => {});
  }

  // ── L'entrée, au format du dictionnaire ───────────────────────────────────

  /* Les paires de phrases exploitables par les exercices.
   *
   * Une phrase à trou n'a besoin que de la phrase dans la langue du mot ; sa
   * traduction, quand elle est là, sert d'indice. L'appariement de phrases, lui,
   * demande les deux côtés — et plusieurs paires, qu'un mot personnel n'a
   * jamais. Il ne sera donc pas proposé, ce qui est exactement voulu. */
  function pairesDe(enregistrement) {
    if (!enregistrement.exemple) return [];
    const autre = enregistrement.exempleTraduit || '';
    return enregistrement.langue === 'en'
      ? [{ en: enregistrement.exemple, fr: autre }]
      : [{ en: autre, fr: enregistrement.exemple }];
  }

  /* Le tableau de flexion, réduit à ce qu'on a bien voulu saisir.
   *
   * Seul le pluriel y figure, et seulement s'il diffère du mot : c'est la forme
   * qu'on demande à l'exercice « pluriel », et la seule que le formulaire
   * réclame nommément. Sans elle, l'exercice ne se propose pas — plutôt que de
   * poser une question sans réponse. */
  function flexionDe(enregistrement) {
    if (!enregistrement.pluriel || enregistrement.pluriel === enregistrement.mot) return [];
    return [['pl', enregistrement.pluriel, '']];
  }

  /* L'entrée telle que la voit le reste de l'application.
   *
   * La bande vaut 0 — « premiers pas ». Ce n'est pas une mesure d'usage : c'est
   * la place que le mot occupe dans la liste de quelqu'un qui l'a ajouté à la
   * main, c'est-à-dire la première. La fiche n'affiche d'ailleurs pas cette
   * bande pour un mot personnel, elle affiche « Personnel ». */
  /* L'entrée personnelle est-elle une expression usuelle ? Les entrées
   * écrites avant que la question existe n'ont pas le champ : seule leur
   * nature en décide alors, et rien ne change pour elles. */
  function estExpression(enregistrement) {
    if (!enregistrement || !/\s/.test(enregistrement.mot || '')) return false;
    return enregistrement.expression === true
      || enregistrement.nature === 'locution' || enregistrement.nature === 'interjection';
  }

  function entree(uid) {
    const enregistrement = table.get(uid);
    if (!enregistrement) return null;
    const sens = [[
      '',                                   // pas de définition : on ne l'invente pas
      enregistrement.traductions.slice(),
      [],                                   // pas de citation
      [],                                   // pas de numéro de phrase du vivier
      [],                                   // pas de marque d'usage
    ]];
    const lecture = [
      enregistrement.nature || '',
      enregistrement.genre || '',
      '',                                   // pas de prononciation
      enregistrement.formes.slice(),
      sens,
      flexionDe(enregistrement),
      [],                                   // pas de synonymes
    ];
    return {
      mot: enregistrement.mot,
      langue: enregistrement.langue,
      bande: 0,
      lectures: [lecture],
      tranche: -1,
      phrases: [],
      voisins: [],
      paires: pairesDe(enregistrement),
      perso: uid,
      cree: enregistrement.cree,
      modifie: enregistrement.modifie,
      expression: estExpression(enregistrement) ? 'perso' : undefined,
    };
  }

  /* Le résultat de recherche d'un mot personnel, au format de `Lexique`. */
  function resultat(enregistrement, exact, via) {
    return {
      langue: enregistrement.langue,
      mot: enregistrement.mot,
      cle: enregistrement.cle,
      tranche: -1,
      bande: 0,
      apercu: enregistrement.traductions.slice(0, 3).join(', '),
      exact: !!exact,
      via: via || null,
      perso: enregistrement.id,
      expression: estExpression(enregistrement),
    };
  }

  /* Cette clé commence-t-elle par la saisie, ou l'un de ses mots ?
   *
   * Le dictionnaire ne sait faire que le premier test : son index est trié, et
   * une dichotomie ne trouve que des préfixes de ligne entière — taper
   * « ensemble » n'y donne pas « dans l'ensemble ». Ici on peut mieux faire,
   * parce qu'on parcourt quelques dizaines d'entrées et non soixante mille :
   * « FFI » retrouve « les FFI », et « chantier » retrouve « bruit de
   * chantier ». C'est le comportement qu'on attend de ses propres mots, qu'on a
   * souvent notés avec leur article ou leur tournure complète.
   */
  function commenceParUnMot(cle, k) {
    if (!cle) return false;
    if (cle.startsWith(k)) return true;
    if (cle.indexOf(' ') === -1) return false;
    const mots = cle.split(' ');
    for (let rang = 1; rang < mots.length; rang += 1) {
      if (mots[rang].startsWith(k)) return true;
    }
    return false;
  }

  /* Les mots personnels que cette saisie atteint, dans les deux sens.
   *
   * Deux façons de tomber sur une entrée : par sa vedette (« vélo ») ou par
   * l'une de ses traductions (« bike »). La seconde est ce qui fait que la
   * recherche marche dans les deux sens sans qu'il faille saisir le mot deux
   * fois — l'entrée n'est écrite qu'une fois, et se trouve des deux côtés.
   *
   * Le parcours est linéaire, et c'est très bien : on compte les mots
   * personnels par dizaines, là où le dictionnaire se compte en dizaines de
   * milliers et réclame une dichotomie. */
  function chercher(k, plafond) {
    if (!chargee || !k) return [];
    const limite = plafond || 12;
    const sortie = [];
    for (const enregistrement of table.values()) {
      if (sortie.length >= limite) break;
      if (enregistrement.cle === k) {
        sortie.push(resultat(enregistrement, true, null));
        continue;
      }
      if (commenceParUnMot(enregistrement.cle, k)) {
        sortie.push(resultat(enregistrement, false, null));
        continue;
      }
      const atteinte = enregistrement.traductions.find(
        (t) => commenceParUnMot(Lexique.cle(t), k));
      if (atteinte) sortie.push(resultat(enregistrement, false, atteinte));
    }
    return sortie;
  }

  /* Retrouve une entrée personnelle par sa langue et sa graphie — ce que les
   * cartes de révision anciennes gardaient avant que l'identifiant n'existe, et
   * ce dont la liste des mots suivis a besoin pour ouvrir une fiche. */
  function parGraphie(langue, mot) {
    for (const enregistrement of table.values()) {
      if (enregistrement.langue === langue && enregistrement.mot === mot) {
        return enregistrement;
      }
    }
    return null;
  }

  racine.Perso = {
    NATURES, GENRES, MOT_MAX, EXEMPLE_MAX, TRADUCTIONS_MAX,
    charger, liste, brut, compte, entree, resultat, estExpression,
    creer, modifier, supprimer, remettre, accorderLesCartes,
    chercher, memeCle, parGraphie, normaliser, commenceParUnMot,
    assainir, assainirPhrase, listeAssainie, nouvelIdentifiant,
    get chargee() { return chargee; },
  };

})(window);
