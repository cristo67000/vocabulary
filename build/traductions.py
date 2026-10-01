#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Les traductions du Wiktionnaire — ce que WikDict ne retient pas.

── Pourquoi ce fichier existe ──────────────────────────────────────────────

Jusqu'ici, WikDict décidait seul de ce qui entrait au dictionnaire. Le
Wiktionnaire intégral n'était lu que pour **enrichir** des vedettes déjà
retenues : `wiktionnaire.extraire()` jetait toute entrée dont la clé n'était pas
déjà connue, et ne regardait pas une seule fois le champ `translations`.

C'était un choix raisonnable en version 2 — on cherchait des exemples, pas des
mots — mais il plafonne le lexique à ce que DBnary a bien voulu passer au filtre
d'attestation de WikDict. Or le Wiktionnaire porte ses tables de traduction en
propre : « Übersetzungen » dans l'édition allemande, « traductions » dans la
française, avec le numéro du sens que chacune sert.

Ce module lit ces tables. Il ne fabrique rien : une traduction retenue ici est
une traduction que le Wiktionnaire écrit, sous le sens où il l'écrit.

── Ce qu'on en tire, et dans quel ordre ────────────────────────────────────

1. **Des traductions pour des sens qui n'en avaient pas.** C'est le gain
   principal, et le moins visible : une entrée existante dont un sens portait
   « sens sans traduction connue » devient exploitable.

2. **Des vedettes entièrement nouvelles.** Un mot que WikDict ignore mais que le
   Wiktionnaire traduit — *Gelaber*, *Pfefferspray*, *bzw.*, *néophobie* —
   devient une entrée bilingue à part entière.

── Ce qu'on n'en tire pas ─────────────────────────────────────────────────

Une entrée sans **aucune** traduction attestée. Le Wiktionnaire décrit 108 000
vedettes allemandes ; les verser toutes ferait un dictionnaire monolingue deux
fois plus gros où un mot sur deux ne répondrait pas à la question qu'on lui pose
— « comment dit-on ceci dans l'autre langue ? ». Le volume n'est pas le but ;
`ntr` compte les traductions, et une entrée qui n'en a pas ne passe pas.

Une vedette dont la **clé** existe déjà, non plus. « Gehen » le nom et « gehen »
le verbe partagent la clé `gehen` : les verser côte à côte fabriquerait deux
résultats concurrents là où l'enrichissement des sens fait déjà le travail sur
l'entrée existante. On préfère un dictionnaire un peu plus petit à un
dictionnaire qui se répète.
"""

import re

import commun

# Pour chaque édition du Wiktionnaire, la langue des traductions qui nous
# intéressent. L'édition anglaise traduit vers le français, et l'inverse.
CIBLE = {"en": "fr", "fr": "en"}

TRADUCTIONS_MAX = 8
TRADUCTION_MAX_SIGNES = 60

# Une traduction arrive parfois avec sa glose collée : « QI (für quotient
# intellectuel) », « disque compact (DC) ». La glose explique, elle ne se dit
# pas — et sur une fiche elle passerait pour une partie du mot.
GLOSE_FINALE = re.compile(r"\s*[(\[][^()\[\]]*[)\]]\s*$")

# Ce qui n'est pas un mot mais une note du rédacteur.
BRUIT = ("?", "…", "...", "→", "see ", "voir ", "please add")


def indices_de(brut):
    """Les numéros de sens qu'une traduction sert.

    Le Wiktionnaire écrit « 1 », « 1, 3 », parfois « 1–2 ». C'est ce qui permet
    de ranger la traduction **sous le bon sens** au lieu de l'entasser au bas de
    la fiche : « Hallo [1] → salut » n'a rien à voir avec « Hallo [2] ».
    """
    if not brut:
        return []
    sortie = []
    for morceau in re.split(r"[,;]", str(brut)):
        morceau = morceau.strip()
        if not morceau:
            continue
        plage = re.fullmatch(r"(\d+)\s*[-–—]\s*(\d+)", morceau)
        if plage:
            debut, fin = int(plage.group(1)), int(plage.group(2))
            if 0 <= fin - debut < 20:
                sortie.extend(str(n) for n in range(debut, fin + 1))
            continue
        sortie.append(morceau)
    return sortie


def nettoyer(brut):
    """Une traduction utilisable, ou la chaîne vide.

    On enlève la glose finale entre parenthèses et la ponctuation de liste. On
    refuse ce qui n'est pas un mot : une note, un renvoi, une chaîne trop
    longue pour être autre chose qu'une phrase d'explication.
    """
    mot = (brut or "").strip()
    if not mot:
        return ""
    mot = GLOSE_FINALE.sub("", mot).strip()
    mot = mot.strip(" ,;:·|")
    if not mot or len(mot) > TRADUCTION_MAX_SIGNES:
        return ""
    minuscule = mot.lower()
    if any(marque in minuscule for marque in BRUIT):
        return ""
    # Au moins une lettre : « — », « 1. » ou « ( ) » ne traduisent rien.
    if not re.search(r"\w", mot, flags=re.UNICODE):
        return ""
    return mot


def par_indice(entree, cible):
    """Les traductions vers `cible`, rangées par numéro de sens.

    La clé vide rassemble celles que le Wiktionnaire n'a rattachées à aucun
    sens — fréquent sur les mots à sens unique, où le numéro serait superflu.
    """
    table = {}
    for brut in entree.get("translations", ()):
        if brut.get("lang_code") != cible and brut.get("code") != cible:
            continue
        mot = nettoyer(brut.get("word"))
        if not mot:
            continue
        for indice in (indices_de(brut.get("sense_index")) or [""]):
            liste = table.setdefault(indice, [])
            if mot not in liste and len(liste) < TRADUCTIONS_MAX:
                liste.append(mot)
    return table


def pour_le_sens(table, indice_du_sens, libres):
    """Les traductions d'un sens : les siennes, puis celles sans numéro.

    Un mot à sens unique porte souvent ses traductions sans indice ; les
    ignorer reviendrait à jeter la moitié de la récolte. Un mot à plusieurs sens
    les reçoit toutes, faute de savoir laquelle va où — c'est le comportement du
    Wiktionnaire lui-même, qui les affiche ensemble.
    """
    sortie = []
    for indice in indices_de(indice_du_sens):
        for mot in table.get(indice, ()):
            if mot not in sortie:
                sortie.append(mot)
    for mot in libres:
        if mot not in sortie:
            sortie.append(mot)
    return sortie[:TRADUCTIONS_MAX]


# --- Vedettes entièrement nouvelles -----------------------------------------

# wiktextract → le vocabulaire de natures de l'application, qui est celui du
# TEI. Une nature absente de cette table donne une étiquette vide : mieux vaut
# pas d'étiquette qu'un code brut affiché tel quel sur la fiche.
NATURE = {
    "noun": "n", "name": "pn", "verb": "v", "adj": "adj", "adv": "adv",
    "prep": "preposition", "conj": "conjunction", "intj": "interjection",
    "num": "numeral", "article": "article", "particle": "particle",
    "character": "letter", "abbrev": "abbreviation", "suffix": "suffix",
    "prefix": "prefix", "pron": "pronoun", "det": "determiner",
    "phrase": "locution", "proverb": "locution", "adv_phrase": "locution",
}

# Une vedette plus longue que cela est une phrase entière, pas une expression.
VEDETTE_MAX = 48

# Combien de sens on garde d'une entrée neuve. Le même plafond que pour les
# entrées WikDict : au-delà, la fiche se disperse.
SENS_MAX = 3
DEFINITION_MAX = 130


def couper(texte, limite=DEFINITION_MAX):
    """Coupe au mot, sans laisser de moitié de phrase."""
    texte = " ".join((texte or "").split())
    if len(texte) <= limite:
        return texte
    tete = texte[:limite].rsplit(" ", 1)[0]
    return (tete or texte[:limite]) + "…"


def recevable(enregistrement):
    """Cette entrée neuve mérite-t-elle une fiche ?

    Trois conditions, et la première est la seule qui compte : au moins une
    traduction attestée. Une entrée sans traduction n'est pas un demi-mot, c'est
    un mot dans un dictionnaire qui n'est pas le nôtre.
    """
    mot = enregistrement.get("m") or ""
    if not mot or len(mot) > VEDETTE_MAX:
        return False
    if not any(sens.get("tr") for sens in enregistrement.get("s", ())):
        return False
    # Une vedette qui n'est que ponctuation ou chiffres n'apprend rien.
    if not re.search(r"[^\W\d_]", mot, flags=re.UNICODE):
        return False
    return True


def en_entree(enregistrement):
    """Un enregistrement wiktextract → une entrée au format de `construire.py`.

    Le format est exactement celui que `charger_dictionnaire()` produit à partir
    du TEI, et ce n'est pas un hasard : tout ce qui suit dans la construction —
    classement, familles, phrases, écriture des paquets — doit continuer de ne
    connaître qu'une seule sorte d'entrée.
    """
    sens = []
    for brut in enregistrement.get("s", ())[:SENS_MAX]:
        traductions = list(brut.get("tr", ()))[:TRADUCTIONS_MAX]
        if not traductions:
            continue
        citations = [list(x) for x in brut.get("x", ())]
        sens.append([couper(brut.get("d", "")), traductions, citations,
                     list(brut.get("t", ()))])
    if not sens:
        return None

    lecture = [
        NATURE.get(enregistrement.get("p") or "", ""),
        enregistrement.get("g") or "",
        enregistrement.get("api") or "",
        [],                                   # formes à montrer : le TEI seul en donne
        sens,
        [list(f) for f in enregistrement.get("f", ())],
        [m for m in enregistrement.get("syn", ()) if m != enregistrement["m"]],
    ]
    entree = {"mot": enregistrement["m"], "lectures": [lecture], "neuve": True}
    apparentes = [m for m in list(enregistrement.get("der", ())) + list(enregistrement.get("rel", ()))
                  if m != enregistrement["m"]]
    if apparentes:
        entree["apparentes"] = apparentes
    return entree


def ajouter(dictionnaires, index_formes, index_graphies, langue, par_mot, journal):
    """Verse au dictionnaire les vedettes que WikDict ignore.

    `par_mot` est l'extrait de `wiktionnaire.charger()`. On ne retient que les
    enregistrements marqués `n` — ceux dont la clé était absente du TEI — et
    seulement s'ils portent une traduction.

    Les formes fléchies suivent : sans elles, « Pfeffersprays » ne mènerait pas
    à « Pfefferspray », et le mot cliquable d'une citation tomberait à vide.
    """
    journal.setdefault("examinees", 0)
    journal.setdefault("ajoutees", 0)
    journal.setdefault("sans_traduction", 0)
    journal.setdefault("lectures", 0)
    journal.setdefault("exemples", [])

    entrees = dictionnaires[langue]
    for mot, enregistrements in par_mot.items():
        for enregistrement in enregistrements:
            if not enregistrement.get("n"):
                continue
            journal["examinees"] += 1
            if not recevable(enregistrement):
                journal["sans_traduction"] += 1
                continue
            entree = en_entree(enregistrement)
            if entree is None:
                journal["sans_traduction"] += 1
                continue
            if mot in entrees:
                # Un homographe déjà versé par un autre enregistrement du même
                # mot — deux natures, deux lectures d'une même vedette.
                entrees[mot]["lectures"].extend(entree["lectures"])
                journal["lectures"] += 1
                continue
            entrees[mot] = entree
            journal["ajoutees"] += 1
            if len(journal["exemples"]) < 12:
                journal["exemples"].append(
                    (mot, entree["lectures"][0][0], entree["lectures"][0][4][0][1][:3]))

            cle_lemme = commun.cle(mot)
            graphies = [f[1] for f in enregistrement.get("f", ())] + list(enregistrement.get("fl", ()))
            for graphie in graphies:
                k = commun.cle(graphie)
                if k and " " not in k and k != cle_lemme:
                    index_formes.setdefault(k, set()).add(cle_lemme)
                if graphie and " " not in graphie:
                    index_graphies.setdefault(mot, set()).add(graphie)

    return journal
