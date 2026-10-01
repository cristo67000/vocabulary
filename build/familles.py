#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Les familles de mots : les mots qui en éclairent un autre.

Apprendre *happiness*, *unhappy* et *happily* quand on vient de chercher
*happy* coûte bien moins que de les apprendre séparément — la racine est déjà
là, il ne reste qu'à en voir les emplois. C'est aussi la matière de l'exercice
« même famille » : retrouver, parmi des mots qui se ressemblent, celui qui
traduit « bonheur ».

Deux procédés, de fiabilité inégale.

1. **Ce que le Wiktionnaire énumère.** Chaque entrée porte ses dérivés
   (*happiness*, *unhappy*) et ses apparentés ; `alignement.py` les a
   recueillis dans `entree["apparentes"]`. Le lien est établi par des
   lexicographes : on le prend tel quel, pourvu que l'autre mot soit au
   dictionnaire, soit un mot seul (« acid house » n'est pas de la famille de
   *house* au sens où l'on apprend), et contienne le radical — les listes de
   dérivés mêlent parfois des composés lointains.

2. **La dérivation par la forme**, par préfixes et suffixes connus, là où le
   Wiktionnaire ne dit rien. C'est là que ça dérape : *pineapple* ressemble à
   *pine*, *reliable* à *rely* — l'un est parent, l'autre non. D'où le filtre
   repris de Wortschatz : **deux mots ne sont apparentés que si leurs
   traductions le sont aussi**. *happy* se traduit par « heureux », *happily*
   par « heureusement » : même début, le lien tient.

Ce que ce fichier produit reste un **voisinage utile**, pas une filiation
étymologique établie — et l'application le présente comme tel.

Les erreurs qui subsistent se corrigent à la main dans `exclusions.txt`, une
paire de mots par ligne, séparés par une tabulation.
"""

from collections import defaultdict
from pathlib import Path

import commun

RACINE = Path(__file__).resolve().parent
EXCLUSIONS = RACINE / "exclusions.txt"

VOISINS_MAX = 8

# Rang au-delà duquel un voisin ne rend plus service : montrer *housebreaker*
# à qui consulte *house* n'apprend rien qu'on retiendra.
RANG_UTILE = 25000

PREFIXES = {
    "en": ["un", "re", "dis", "in", "im", "il", "ir", "mis", "over", "under",
           "out", "pre", "non", "anti", "de", "co", "inter", "super", "sub"],
    "fr": ["re", "de", "des", "in", "im", "il", "ir", "pre", "sur", "sous",
           "me", "anti", "co", "en", "em", "mal", "inter", "super"],
}

SUFFIXES = {
    "en": ["nesses", "ness", "ments", "ment", "tions", "tion", "sions", "sion",
           "ities", "ity", "ally", "ly", "fully", "ful", "lessly", "less",
           "ables", "able", "ibles", "ible", "ers", "er", "ors", "or", "ists",
           "ist", "isms", "ism", "ives", "ive", "ous", "als", "al", "ises", "ise",
           "izes", "ize", "ings", "ing", "ed", "es", "s", "y", "e"],
    "fr": ["tions", "tion", "sions", "sion", "ments", "ment", "euses", "euse",
           "trices", "trice", "teurs", "teur", "eurs", "eur", "ages", "age",
           "ables", "able", "ibles", "ible", "ites", "ite", "ismes", "isme",
           "istes", "iste", "esses", "esse", "ances", "ance", "ences", "ence",
           "eries", "erie", "ifs", "if", "ives", "ive", "eux", "es", "s", "e"],
}

RADICAL_MIN = 4
GROUPE_MAX = 140


def charger_exclusions():
    """Paires écartées à la main, dans les deux sens."""
    paires = set()
    if not EXCLUSIONS.exists():
        return paires
    for ligne in EXCLUSIONS.read_text(encoding="utf-8").splitlines():
        ligne = ligne.split("#")[0].strip()
        if not ligne or "\t" not in ligne:
            continue
        a, b = (x.strip() for x in ligne.split("\t", 1))
        if a and b:
            paires.add((a, b))
            paires.add((b, a))
    return paires


def radical(cle_mot, langue):
    """Le mot débarrassé de ses affixes connus, s'il en reste assez."""
    reste = cle_mot
    for prefixe in sorted(PREFIXES[langue], key=len, reverse=True):
        if reste.startswith(prefixe) and len(reste) - len(prefixe) >= RADICAL_MIN:
            reste = reste[len(prefixe):]
            break
    for suffixe in sorted(SUFFIXES[langue], key=len, reverse=True):
        if reste.endswith(suffixe) and len(reste) - len(suffixe) >= RADICAL_MIN:
            reste = reste[:-len(suffixe)]
            break
    return reste


def stems_des_traductions(entree):
    """Les débuts des traductions, pour juger d'une parenté de sens."""
    stems = set()
    for lecture in entree["lectures"]:
        for bloc in lecture[4]:
            for traduction in bloc[1]:
                k = commun.cle(traduction)
                for morceau in k.split():
                    if len(morceau) >= 4:
                        stems.add(morceau[:4])
    return stems


def partage_la_racine(a, b, langue):
    """« happy » et « unhappiness » partagent-ils une racine visible ?

    On compare les radicaux débarrassés de leurs affixes, puis on tolère que
    l'un soit le début de l'autre (« happi » dans « happiness » : le y final
    devient i). Quatre lettres communes au moins.
    """
    ra, rb = radical(commun.cle(a), langue), radical(commun.cle(b), langue)
    if ra == rb:
        return True
    court, long_ = (ra, rb) if len(ra) <= len(rb) else (rb, ra)
    if len(court) >= RADICAL_MIN and court[:-1] and long_.find(court[:-1]) != -1:
        return True
    return False


def construire(dictionnaires, positions, journal=None):
    """{langue: {mot: [voisins…]}}"""
    exclusions = charger_exclusions()
    resultat = {}
    bilan = {"wiktionnaire": 0, "derivation": 0, "ecartes": 0}

    for langue, entrees in dictionnaires.items():
        vedettes_par_cle = defaultdict(list)
        stems = {}
        for mot, entree in entrees.items():
            vedettes_par_cle[commun.cle(mot)].append(mot)
            stems[mot] = stems_des_traductions(entree)

        liens = defaultdict(set)

        def relier(a, b, certain):
            if a == b or (a, b) in exclusions:
                return False
            if commun.cle(a) == commun.cle(b):
                return False
            if not certain and not (stems[a] & stems[b]):
                bilan["ecartes"] += 1
                return False
            liens[a].add(b)
            liens[b].add(a)
            return True

        # 1. Ce que le Wiktionnaire énumère.
        for mot, entree in entrees.items():
            for parent in entree.get("apparentes", ()):
                if " " in parent or "-" in parent and " " in mot:
                    continue
                cibles = vedettes_par_cle.get(commun.cle(parent), ())
                for cible in cibles:
                    if not partage_la_racine(mot, cible, langue):
                        continue
                    if relier(mot, cible, certain=True):
                        bilan["wiktionnaire"] += 1

        # 2. Dérivation par la forme, sous condition de parenté de sens.
        par_debut = defaultdict(list)
        for mot in entrees:
            k = commun.cle(mot)
            if len(k) >= RADICAL_MIN and " " not in k:
                par_debut[k[:RADICAL_MIN]].append(mot)

        for _debut, groupe in par_debut.items():
            if len(groupe) > GROUPE_MAX:
                continue
            for i, a in enumerate(groupe):
                ka = commun.cle(a)
                ra = radical(ka, langue)
                for b in groupe[i + 1:]:
                    kb = commun.cle(b)
                    rb = radical(kb, langue)
                    if not (ka.startswith(rb) or kb.startswith(ra) or ra == rb):
                        continue
                    if relier(a, b, certain=False):
                        bilan["derivation"] += 1

        rangs = positions[langue]
        resultat[langue] = {}
        for mot, voisins in liens.items():
            if not voisins:
                continue
            classes = sorted(voisins, key=lambda v: rangs.get(v, 10 ** 9))
            utiles = [v for v in classes if rangs.get(v, 10 ** 9) < RANG_UTILE]
            resultat[langue][mot] = (utiles or classes)[:VOISINS_MAX]

    if journal is not None:
        journal.update(bilan)
        journal["mots_en"] = len(resultat.get("en", {}))
        journal["mots_fr"] = len(resultat.get("fr", {}))
    return resultat
