#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Rapprocher les sens de WikDict et ceux du Wiktionnaire.

── Le problème ─────────────────────────────────────────────────────────────

WikDict sait qu'« abbauen » se traduit par *extraire*, *atténuer* ou
*démanteler*. Le Wiktionnaire sait qu'« abbauen » a trois significations, et
donne une phrase pour chacune. Personne ne dit lequel des trois exemples
illustre laquelle des trois traductions.

Sans ce rapprochement, la v2 n'a rien de plus que la v1 : trois phrases
alignées sous un mot, au petit bonheur. C'est **le** point dont dépend la
promesse « une phrase par signification », et il est traité ici, à part, pour
qu'on puisse l'éprouver seul.

── Ce qui le rend faisable ─────────────────────────────────────────────────

Les deux viennent de la même source. WikDict dérive de DBnary, qui extrait le
Wiktionnaire ; la définition que porte un sens WikDict *est* la glose
Wiktionnaire, à trois transformations près :

  1. `construire.py:couper()` la tronque à 130 signes et ajoute une ellipse ;
  2. DBnary garde le préfixe de domaine (« Musik: ») que wiktextract range à
     part, dans `topics` ;
  3. les guillemets ne sont pas les mêmes : „A“ contre "A".

D'où la marche à suivre : normaliser des deux côtés, comparer par préfixe
(à cause de la troncature), puis par recouvrement de vocabulaire, puis — et
seulement quand il ne reste qu'un candidat de chaque côté — par élimination.

── Ce qu'on ne fait pas ────────────────────────────────────────────────────

Pas d'appariement par rang. Le Wiktionnaire donne parfois huit sens là où
WikDict en garde trois : le troisième de l'un n'a aucune raison d'être le
troisième de l'autre. Un mauvais appariement est pire que pas d'appariement —
il colle une phrase sous une traduction qu'elle n'illustre pas, et l'apprenant
n'a aucun moyen de s'en apercevoir.
"""

import re

import commun
import marques

# --- Natures grammaticales --------------------------------------------------

# Les deux sources ne nomment pas les natures de la même façon. On les ramène à
# un vocabulaire commun, qui n'est celui d'aucune des deux : traduire l'une
# dans l'autre reviendrait à privilégier une source, et à devoir tout reprendre
# le jour où elle change.
NATURE_TEI = {
    "n": "nom", "pn": "nom-propre", "v": "verbe", "adj": "adjectif",
    "adv": "adverbe", "Adverb": "adverbe", "preposition": "preposition",
    "indefinitePronoun": "pronom", "pronoun": "pronom", "interjection": "interjection",
    "numeral": "numeral", "conjunction": "conjonction", "suffix": "suffixe",
    "prefix": "prefixe", "abbreviation": "abreviation", "letter": "lettre",
    "article": "article", "particle": "particule", "determiner": "determinant",
    "phraseologicalUnit": "locution", "proverb": "locution", "locution": "locution",
    "postposition": "preposition",
}

NATURE_WIKT = {
    "noun": "nom", "name": "nom-propre", "verb": "verbe", "adj": "adjectif",
    "adv": "adverbe", "prep": "preposition", "pron": "pronom",
    "intj": "interjection", "num": "numeral", "conj": "conjonction",
    "suffix": "suffixe", "prefix": "prefixe", "abbrev": "abreviation",
    "character": "lettre", "article": "article", "particle": "particule",
    "det": "determinant", "phrase": "locution", "proverb": "locution",
    "contraction": "contraction", "adv_phrase": "locution",
    "prep_phrase": "locution",
}

# --- Normalisation d'une définition -----------------------------------------

# « Musik: », « Biologie, übertragen: », « Zoologie : » — le domaine, que
# wiktextract range dans `topics` et que DBnary laisse dans le texte.
PREFIXE_DOMAINE = re.compile(
    r"^(?:[^:;()]{2,28}\s*:\s*)+(?=\S)", flags=re.UNICODE)

PONCTUATION = re.compile(r"[^\w\s]", flags=re.UNICODE)

PARENTHESES_DE_TETE = re.compile(r"^\s*(?:\([^()]{1,80}\)\s*)+")

# L'ellipse que `couper()` ajoute quand il tronque.
ELLIPSE = "…"


def normaliser(definition):
    """La forme sous laquelle deux définitions se comparent.

    Domaine retiré, ponctuation et guillemets effacés, accents et casse
    ramenés à leur forme neutre par `commun.cle()`.
    """
    if not definition:
        return ""
    texte = definition.strip().rstrip(ELLIPSE).strip()
    # « (of a person) Rich. » contre « Rich. » : les précisions entre
    # parenthèses en tête de définition, WikDict les garde et wiktextract les
    # range à part. On compare sans elles.
    texte = PARENTHESES_DE_TETE.sub("", texte)
    texte = PREFIXE_DOMAINE.sub("", texte)
    texte = PONCTUATION.sub(" ", texte)
    return commun.cle(texte)


def mots_pleins(texte_normalise):
    """Les mots qui portent le sens.

    On les reconnaît à leur longueur plutôt qu'à une liste de mots-outils : il
    en faudrait une par langue, elles se périment, et « der »/« le » ne sont
    pas les seuls intrus. Quatre lettres écartent l'essentiel des mots
    grammaticaux dans les deux langues sans toucher au vocabulaire.
    """
    longs = {m for m in texte_normalise.split() if len(m) >= 4}
    # Une définition qui ne serait faite que de mots courts — « ne pas être » —
    # n'aurait plus rien à comparer. On la prend alors telle quelle.
    return longs or set(texte_normalise.split())


def recouvrement(a, b):
    """Indice de Jaccard entre deux définitions normalisées, entre 0 et 1."""
    mots_a, mots_b = mots_pleins(a), mots_pleins(b)
    if not mots_a or not mots_b:
        return 0.0
    communs = len(mots_a & mots_b)
    return communs / len(mots_a | mots_b)


SEUIL_RECOUVREMENT = 0.6


def concordance(definition_wikdict, definition_wikt):
    """À quel point deux définitions décrivent le même sens, entre 0 et 1.

    1.0 quand l'une est le début de l'autre : c'est le cas ordinaire, la
    définition WikDict n'étant que la glose du Wiktionnaire tronquée.
    """
    a = normaliser(definition_wikdict)
    b = normaliser(definition_wikt)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    # La troncature va toujours dans le même sens, mais on ne s'y fie pas :
    # `couper()` n'agit qu'au-delà de 130 signes, et rien n'interdit à une
    # glose d'être plus courte que la définition qu'on lui compare.
    court, long = (a, b) if len(a) <= len(b) else (b, a)
    if len(court) >= 12 and long.startswith(court):
        return 1.0
    return recouvrement(a, b)


# --- Appariement ------------------------------------------------------------

def apparier(definitions_wikdict, definitions_wikt):
    """Rend, pour chaque sens WikDict, l'indice du sens Wiktionnaire retenu.

    Une liste de la longueur de `definitions_wikdict`, contenant des indices
    dans `definitions_wikt` ou None. Un sens Wiktionnaire ne sert qu'une fois :
    deux traductions différentes ne peuvent pas illustrer la même signification.
    """
    resultat = [None] * len(definitions_wikdict)
    pris = set()

    # 1. Les meilleures paires d'abord, quel que soit leur rang. Trier les
    #    candidats par score évite qu'un appariement médiocre trouvé tôt ne
    #    prenne la place d'un excellent trouvé plus tard.
    candidats = []
    for i, a in enumerate(definitions_wikdict):
        for j, b in enumerate(definitions_wikt):
            score = concordance(a, b)
            if score >= SEUIL_RECOUVREMENT:
                candidats.append((score, i, j))
    candidats.sort(key=lambda c: (-c[0], c[1], c[2]))

    for _score, i, j in candidats:
        if resultat[i] is None and j not in pris:
            resultat[i] = j
            pris.add(j)

    # 2. Le dernier debout. Quand il ne reste qu'un sens de chaque côté et que
    #    les deux listes sont courtes, les apparier est raisonnable : ce sont
    #    deux descriptions du même mot, et toutes les autres se sont déjà
    #    reconnues. Au-delà de trois sens, on s'abstient — le Wiktionnaire en
    #    distingue souvent plus que WictDict n'en retient, et le reliquat n'est
    #    plus un reliquat mais un tas.
    if len(definitions_wikdict) <= 3 and len(definitions_wikt) <= 3:
        orphelins = [i for i, v in enumerate(resultat) if v is None]
        libres = [j for j in range(len(definitions_wikt)) if j not in pris]
        if len(orphelins) == 1 and len(libres) == 1:
            resultat[orphelins[0]] = libres[0]

    return resultat


def choisir_enregistrement(nature_lecture, genre_lecture, enregistrements):
    """Parmi les entrées Wiktionnaire d'un mot, celle de la bonne lecture.

    Un mot a une entrée par nature : « laut » est adjectif *et* préposition. Et
    parfois deux entrées de même nature, que seul le genre sépare : « See » est
    un nom masculin quand c'est un lac, un nom féminin quand c'est la mer, avec
    des sens et des exemples entièrement distincts. Se contenter de la nature
    mettrait les vagues sous le lac.

    À défaut de nature connue des deux côtés, la première entrée — c'est la
    plus courante, le Wiktionnaire les rangeant par usage.
    """
    if not enregistrements:
        return None

    voulue = NATURE_TEI.get(nature_lecture)
    if not voulue:
        return enregistrements[0]

    memes = [e for e in enregistrements
             if NATURE_WIKT.get(e.get("p")) == voulue]
    if not memes:
        # Une nature demandée et introuvable n'autorise pas à prendre
        # n'importe laquelle : les exemples d'un nom sous une lecture de verbe
        # seraient faux, et faux sans que rien ne le signale.
        return None
    if len(memes) == 1 or not genre_lecture:
        return memes[0]

    for enregistrement in memes:
        if enregistrement.get("g") == genre_lecture:
            return enregistrement
    # Plusieurs lectures de même nature et aucune du bon genre : on ne sait pas
    # laquelle, et deviner reviendrait à choisir au hasard entre le lac et la mer.
    return None


# --- Greffe -----------------------------------------------------------------

# Combien de sens du Wiktionnaire on ajoute quand WikDict les ignore. Ils
# n'ont pas de traduction — WikDict ne leur en connaît pas — mais ils ont une
# définition et un exemple, et chacun de leurs mots est cliquable. En ajouter
# davantage noierait les sens traduits, qui sont ceux qu'on vient chercher.
SENS_SUPPLEMENTAIRES_MAX = 2

# Combien de traductions on greffe sur un sens qui n'en avait pas. Le même
# plafond que WikDict : au-delà de six, la ligne des traductions cesse d'être
# une réponse et devient une liste à trier.
TRADUCTIONS_MAX = 6


# Les traductions déplacées ou retirées, pour relecture : (mot, définition du
# sens d'origine, traduction, définition du sens d'arrivée ou "").
DEPLACEMENTS = []


def corriger_rattachements(mot, sens, appariement, enregistrement, compteur):
    """Remet chaque traduction de WikDict sous le sens qu'elle sert.

    WikDict (par DBnary) devine à quel sens appartient chaque traduction d'une
    table du Wiktionnaire, et se trompe parfois : « run » (courir) recevait
    « couler », qui est la traduction de « run » (un liquide) ; « housewife »
    (femme au foyer) recevait « garce ». Le Wiktionnaire, lui, rattache une
    partie de ses tables à leur sens avec certitude (`ts`, voir
    wiktionnaire.traductions_en).

    Une traduction quitte un sens quand trois conditions sont réunies : le
    Wiktionnaire ne la donne pas pour le sens apparié ; il la rattache avec
    certitude à un autre sens ; et cet autre sens ne ressemble pas à celui-ci
    — sinon c'est l'appariement qui hésite, pas la traduction qui est fausse.
    Elle rejoint alors le sens qu'elle sert s'il est sur la fiche, et
    disparaît sinon : une traduction juste pour un sens qu'on n'affiche pas
    vaut moins qu'une traduction fausse sous le sens qu'on affiche.
    """
    senses_w = enregistrement.get("s") or []
    if not senses_w:
        return
    tous = [{commun.cle(t) for t in list(s.get("tr", ())) + list(s.get("ts", ()))}
            for s in senses_w]
    surs = [{commun.cle(t) for t in s.get("ts", ())} for s in senses_w]
    if not any(surs):
        return
    bloc_de = {}
    for i, rang in enumerate(appariement):
        if rang is not None and rang not in bloc_de:
            bloc_de[rang] = i
    # Un sens de WikDict resté sans pendant au Wiktionnaire pourrait être
    # celui qu'une traduction sert : on ne la retire alors jamais, faute de
    # pouvoir dire qu'elle n'a nulle part où aller.
    tous_apparies = all(rang is not None for rang in appariement[:len(sens)])
    for i, bloc in enumerate(sens):
        if i >= len(appariement):
            break
        a = appariement[i]
        # Rien à juger sans preuve : un sens sans pendant (définition absente,
        # trop différente), ou un sens dont le Wiktionnaire ne donne aucune
        # table de traduction — ne pas y figurer ne prouve alors rien. Le
        # premier essai sans ces deux garde-fous retirait « rythme » de
        # « pace » et « vouloir dire » de « mean ».
        if a is None or not surs[a]:
            continue
        gardees = []
        for t in bloc[1]:
            k = commun.cle(t)
            if a is not None and k in tous[a]:
                gardees.append(t)
                continue
            ailleurs = [b for b in range(len(senses_w)) if b != a and k in surs[b]]
            if not ailleurs or any(
                    concordance(bloc[0], senses_w[b]["d"]) >= SEUIL_RECOUVREMENT for b in ailleurs):
                gardees.append(t)
                continue
            dest = next((bloc_de[b] for b in ailleurs if b in bloc_de and bloc_de[b] != i), None)
            if dest is None and not tous_apparies:
                gardees.append(t)
                continue
            if dest is not None:
                cible = sens[dest]
                if t not in cible[1] and len(cible[1]) < TRADUCTIONS_MAX:
                    cible[1].append(t)
                compteur["deplacees"] = compteur.get("deplacees", 0) + 1
            else:
                compteur["retirees"] = compteur.get("retirees", 0) + 1
            DEPLACEMENTS.append((mot, bloc[0], t, sens[dest][0] if dest is not None else ""))
        bloc[1] = gardees


def enrichir(entree, enregistrements, journal=None):
    """Greffe le Wiktionnaire sur une entrée WikDict. Modifie `entree` en place.

    Chaque sens gagne un troisième champ : ses exemples, sous la forme brute
    `[texte, marque du mot, référence]`. C'est `construire.py` qui les rangera
    ensuite dans le vivier commun et ne gardera ici que des numéros.

    L'entrée gagne ses synonymes et ses tableaux de formes, qui ne dépendent
    pas du sens.
    """
    compteur = journal if journal is not None else {}
    for cle in ("lectures", "sans_entree", "sens", "apparies", "avec_exemple",
                "sens_ajoutes", "traduits", "sens_ajoutes_traduits",
                "sens_ajoutes_illustres",
                "sens_sans_traduction"):
        compteur.setdefault(cle, 0)

    for lecture in entree["lectures"]:
        compteur["lectures"] += 1
        nature, genre, sens = lecture[0], lecture[1], lecture[4]

        # Flexion et synonymes appartiennent à la **lecture**, pas à la vedette.
        # « See » féminin est la mer, sans pluriel ; « See » masculin est le lac,
        # génitif « des Sees ». Rassemblés sur l'entrée, le génitif du lac
        # s'affichait sous la mer — du bon allemand attribué au mauvais mot,
        # exactement le genre de faute qu'un apprenant recopie sans se méfier.
        while len(lecture) < 7:
            lecture.append([])
        lecture[5] = []      # flexion
        lecture[6] = []      # synonymes

        # Tout sens part avec une liste d'exemples vide et une liste de marques
        # d'usage vide : le format doit être le même qu'il ait été enrichi ou
        # non, sans quoi l'application aurait à distinguer deux formes d'entrée.
        # [définition, traductions, citations, marques]
        for bloc in sens:
            while len(bloc) < 4:
                bloc.append([])

        enregistrement = choisir_enregistrement(nature, genre, enregistrements)
        if enregistrement is not None:
            # Le rang de l'entrée du Wiktionnaire correspondante. Le
            # Wiktionnaire range les natures par importance (« go » verbe
            # avant « go » le jeu, « maison » nom avant l'adjectif) — mieux
            # que WikDict : construire.reordonner_par_utilite() s'en sert pour
            # l'ordre des lectures.
            entree.setdefault("_rang_source", {})[id(lecture)] = next(
                i for i, e in enumerate(enregistrements) if e is enregistrement)
        compteur["sens"] += len(sens)
        # Le Wiktionnaire sait si cette vedette est une expression, mieux que
        # sa nature ne le dit : « moins que rien » est un nom, et une
        # expression. L'attestation voyage jusqu'à `expressions.py`.
        if any(e.get("idiome") for e in enregistrements):
            entree["idiome"] = ("idiome" if any(e.get("idiome") == "idiome"
                                                for e in enregistrements) else "locution")
        if enregistrement is None:
            compteur["sans_entree"] += 1
            continue

        appariement = apparier([b[0] for b in sens],
                               [s["d"] for s in enregistrement["s"]])
        rangs_sens = entree.setdefault("_rang_sens", {})
        for bloc, rang in zip(sens, appariement):
            if rang is None:
                continue
            # Le rang du sens dans le Wiktionnaire, qui range les sens par
            # importance — WikDict, lui, ouvrait « run » sur « griller (un
            # feu rouge) ». construire.reordonner_par_utilite() s'en sert.
            rangs_sens[id(bloc)] = rang
            compteur["apparies"] += 1
            exemples = enregistrement["s"][rang]["x"]
            bloc[2] = [list(x) for x in exemples]
            if exemples:
                compteur["avec_exemple"] += 1
            # Les marques d'usage des deux sources se cumulent : WikDict les
            # lit dans le texte de la définition, le Wiktionnaire les donne en
            # étiquettes, et l'une a parfois ce que l'autre a perdu.
            bloc[3] = marques.ranger(list(bloc[3]) + list(enregistrement["s"][rang].get("t", ())))

            # Une traduction attestée, là où WikDict n'en connaissait aucune.
            #
            # C'est le gain le moins spectaculaire et le plus utile de la
            # version 3 : ces sens-là s'affichaient avec la mention « sens sans
            # traduction connue », c'est-à-dire une définition à déchiffrer et
            # rien à apprendre. Le Wiktionnaire les traduit dans sa propre table
            # « Übersetzungen » ; il suffisait de la lire.
            if not bloc[1]:
                trouvees = list(enregistrement["s"][rang].get("tr", ()))
                if trouvees:
                    bloc[1] = trouvees[:TRADUCTIONS_MAX]
                    compteur["traduits"] += 1

        corriger_rattachements(entree["mot"], sens, appariement, enregistrement, compteur)

        # Les sens que WikDict ne connaît pas, quand ils apportent un exemple.
        deja = {r for r in appariement if r is not None}
        ajoutes = 0
        #
        # Un sens du Wiktionnaire vaut d'être ajouté s'il apporte quelque chose :
        # une traduction, un exemple, mieux encore les deux. Sans l'un ni
        # l'autre, c'est une définition de plus sur une fiche qui en a déjà.
        #
        # L'ordre du choix compte, et c'est le seul point délicat. Les deux
        # places disponibles doivent aller d'abord aux sens complets, puis à
        # ceux qui ont un exemple, et seulement ensuite à ceux qui n'ont qu'une
        # traduction. Prendre les sens dans l'ordre du Wiktionnaire laissait un
        # sens traduit-mais-sans-exemple occuper la place d'un sens illustré, et
        # faisait baisser d'un coup la part des sens illustrés — la mesure même
        # dont dépend l'intérêt des fiches.
        def utilite(couple):
            _rang, bloc_wikt = couple
            aTraduction = bool(bloc_wikt.get("tr"))
            aExemple = bool(bloc_wikt["x"])
            if aExemple and aTraduction:
                return 0
            if aExemple:
                return 1
            return 2

        candidats = [(rang, bloc_wikt)
                     for rang, bloc_wikt in enumerate(enregistrement["s"])
                     if rang not in deja
                     and (bloc_wikt.get("tr") or bloc_wikt["x"])]
        candidats.sort(key=lambda couple: (utilite(couple), couple[0]))

        for _rang, sens_wikt in candidats:
            if ajoutes >= SENS_SUPPLEMENTAIRES_MAX:
                break
            trouvees = list(sens_wikt.get("tr", ()))[:TRADUCTIONS_MAX]
            sens.append([sens_wikt["d"], trouvees,
                         [list(x) for x in sens_wikt["x"]],
                         list(sens_wikt.get("t", ()))])
            rangs_sens[id(sens[-1])] = _rang
            ajoutes += 1
            compteur["sens_ajoutes"] += 1
            if trouvees:
                compteur["sens_ajoutes_traduits"] += 1
            if sens_wikt["x"]:
                compteur["sens_ajoutes_illustres"] += 1

        lecture[5] = [list(f) for f in enregistrement.get("f", ())]
        lecture[6] = [m for m in enregistrement.get("syn", ())
                      if m != entree["mot"]]
        # La prononciation que le Wiktionnaire a choisie — britannique d'abord
        # (voir wiktionnaire.api_britannique) — plutôt que la première venue de
        # WikDict : « in » y était néo-zélandais, /ɘn/, et « tomato »
        # américain.
        if enregistrement.get("api"):
            lecture[2] = enregistrement["api"]
        # Les dérivés et apparentés que le Wiktionnaire énumère : la matière
        # première des familles de mots (voir familles.py).
        for champ in ("der", "rel"):
            for mot in enregistrement.get(champ, ()):
                liste = entree.setdefault("apparentes", [])
                if mot != entree["mot"] and mot not in liste:
                    liste.append(mot)

    # Ce qui reste sans traduction après la greffe. Le chiffre est publié : il
    # dit ce que l'entrée sait vraiment faire, et l'application l'affiche
    # sens par sens plutôt que de laisser croire à une donnée perdue.
    for lecture in entree["lectures"]:
        for bloc in lecture[4]:
            if not bloc[1]:
                compteur["sens_sans_traduction"] += 1

    return compteur
