#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Les mots grammaticaux que le dictionnaire source ne contient pas.

WikDict ne retient que les entrées dotées d'une traduction bien attestée, et
quelques mots-outils français passent au travers : *mon*, *notre*, *votre*,
*leur*, *ce*, *celui*, *ne*. Ce sont pourtant les tout premiers qu'un débutant
cherche — « mes », « cette », « ne … pas » sont parmi les vingt formes les plus
fréquentes du corpus qu'aucune entrée ne savait résoudre.

Ces entrées-ci sont donc **écrites pour cette application**, à la main, et non
tirées du Wiktionnaire. C'est dit dans SOURCES.md et dans la page de
confidentialité : mêler sans le signaler du contenu rédigé à des données sous
licence serait malhonnête envers les deux.

Rien d'autre n'est ajouté. Le reste du dictionnaire vient des sources, avec ses
qualités et ses manques, et il n'est pas question de le retoucher mot à mot :
on ne saurait plus ce qui vient d'où.

Le côté anglais, lui, est complet — *my*, *this*, *not*, *the* y sont tous.
"""

ENTREES = {
    "fr": [
        {
            "mot": "mon",
            "pos": "adj", "pron": "mɔ̃",
            "formes": ["ma", "mes"],
            "sens": [("déterminant possessif de la première personne du singulier",
                      ["my"])],
        },
        {
            "mot": "notre",
            "pos": "adj", "pron": "nɔtʁ",
            "formes": ["nos"],
            "sens": [("déterminant possessif de la première personne du pluriel",
                      ["our"])],
        },
        {
            "mot": "votre",
            "pos": "adj", "pron": "vɔtʁ",
            "formes": ["vos"],
            "sens": [("déterminant possessif de la deuxième personne du pluriel, "
                      "et de la politesse", ["your"])],
        },
        {
            "mot": "leur",
            "pos": "adj", "pron": "lœʁ",
            "formes": ["leurs"],
            "sens": [("déterminant possessif de la troisième personne du pluriel",
                      ["their"]),
                     ("pronom complément de la troisième personne du pluriel",
                      ["them", "to them"])],
        },
        {
            "mot": "ce",
            "pos": "adj", "pron": "sə",
            "formes": ["cet", "cette", "ces"],
            "sens": [("déterminant démonstratif ; « cet » devant voyelle, "
                      "« cette » au féminin, « ces » au pluriel",
                      ["this", "that", "these", "those"])],
        },
        {
            "mot": "celui",
            "pos": "demonstrativePronoun", "pron": "sə.lɥi",
            "formes": ["celle", "ceux", "celles"],
            "sens": [("pronom démonstratif, celui dont on vient de parler",
                      ["the one"])],
        },
        {
            "mot": "ne",
            "pos": "adv", "pron": "nə",
            "formes": ["n’"],
            "sens": [("premier élément de la négation, employé avec « pas », "
                      "« plus », « jamais », « rien »", ["not"])],
        },
    ],
}


def ajouter(dictionnaires, journal=None):
    """Complète les dictionnaires, sans jamais écraser une entrée existante."""
    ajoutees = []
    for langue, liste in ENTREES.items():
        entrees = dictionnaires.get(langue)
        if entrees is None:
            continue
        for brut in liste:
            if brut["mot"] in entrees:
                # Le dictionnaire source a comblé le trou depuis : tant mieux,
                # on lui laisse la place.
                continue
            entrees[brut["mot"]] = {
                "mot": brut["mot"],
                "lectures": [[
                    brut.get("pos", ""),
                    brut.get("genre", ""),
                    brut.get("pron", ""),
                    list(brut.get("formes", [])),
                    [[definition, list(traductions), [], []]
                     for definition, traductions in brut["sens"]],
                ]],
            }
            ajoutees.append(brut["mot"])
    if journal is not None:
        journal["ajoutees"] = ajoutees
    return ajoutees


def formes_supplementaires():
    """forme → vedette, pour l'index de lemmatisation."""
    paires = []
    for _langue, liste in ENTREES.items():
        for brut in liste:
            for forme in brut.get("formes", ()):
                paires.append((forme, brut["mot"]))
    return paires
