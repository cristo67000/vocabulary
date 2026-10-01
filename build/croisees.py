#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Les gloses croisées : ce que chaque édition dit des mots de l'autre langue.

Le Wiktionary anglais décrit 98 000 mots français **en anglais** ; le
Wiktionnaire français décrit 104 000 mots anglais **en français**. Une glose
de ce genre est, le plus souvent, une traduction : « flic » → *police officer;
copper; pig; rozzer*, « askip » → *apparently, they say (that), rumour has it
(that)*, « knackered » → *Crevé, épuisé*.

WikDict n'en tient pas compte — il ne lit que les tables de traduction. Or
l'argot, les abréviations et les mots récents sont précisément ceux que les
tables de traduction oublient et que les gloses décrivent. Ce module s'en sert
à deux fins, prudemment :

1. **Traduire une vedette qui n'a aucune traduction.** Une entrée dont aucun
   sens n'est traduit ne répond pas à la question qu'on lui pose ; la glose
   d'en face lui donne un sens de plus, « traduction seule », sans définition
   dans la langue du mot — la fiche le montre comme tel.

2. **Créer une vedette absente**, si elle est d'usage courant : wordfreq ou
   Tatoeba doivent l'attester. Un mot que personne n'emploie n'a pas à
   alourdir le paquet.

Ce qu'on ne fait pas : ajouter des équivalents à un sens déjà traduit. On ne
saurait pas à quel sens ils répondent, et une traduction sous le mauvais sens
est pire qu'une traduction absente.
"""

import re

import commun
import marques

# Une glose se découpe en équivalents (segments courts) et en explications
# (segments longs). « police officer; copper; pig; rozzer » donne quatre
# équivalents ; « irritating, frustrating, especially to describe a person »
# en donne deux et une explication.
EQUIVALENT_MOTS_MAX = 4
EQUIVALENTS_MAX = 6
PARENTHESE = re.compile(r"\s*\([^)]*\)")
CROCHETS = re.compile(r"\s*\[[^\]]*\]")

# Une vedette neuve doit être d'usage attesté : fréquence wordfreq (échelle de
# Zipf) ou nombre d'emplois dans le corpus Tatoeba.
ZIPF_MIN = 2.2
TATOEBA_MIN = 3

NATURES = {"noun": "n", "verb": "v", "adj": "adj", "adv": "adv",
           "intj": "interjection", "phrase": "locution", "prep_phrase": "locution",
           "adv_phrase": "locution", "pron": "pronoun", "prep": "preposition",
           "conj": "conjunction", "det": "determiner", "num": "numeral",
           "abbrev": "abbreviation", "contraction": "locution", "proverb": "locution",
           "particle": "particle"}

# Débuts de glose qui annoncent une explication, jamais une traduction.
EXPLICATIVES = re.compile(
    r"^(used|indicates|expresses|denotes|a |an |the |one who|someone|something"
    r"|to be |in a |of or |relating to|pertaining|formule|terme|mot |personne qui"
    r"|celui qui|celle qui|qui |se dit|désigne|action de|fait de|état de"
    # Les renvois grammaticaux que l'édition d'en face n'étiquette pas
    # toujours comme tels : « fault trees » → *pluriel de fault tree*.
    r"|pluriel |plural |féminin |masculin |contraction |forme |variante "
    r"|participe |troisième personne|première personne|alternative |abréviation "
    r"|abbreviation |synonyme )",
    re.IGNORECASE)


def equivalents(glose, langue_glose="fr"):
    """Les équivalents d'une glose, les plus courts d'abord conservés dans
    l'ordre du Wiktionnaire. Rend (équivalents, explication)."""
    propre = CROCHETS.sub("", PARENTHESE.sub("", glose)).strip().rstrip(".")
    # « Crevé, épuisé. » : la majuscule du Wiktionnaire français est celle
    # d'un début de phrase, pas du mot. On la retire quand la lettre suivante
    # est une minuscule — « LOL », « OK » gardent les leurs.
    if (langue_glose == "fr" and len(propre) > 1 and propre[0].isupper()
            and propre[1].islower()):
        propre = propre[0].lower() + propre[1:]
    sortie, explications = [], []
    for segment in re.split(r"[;]", propre):
        for morceau in re.split(r",(?![^(]*\))", segment):
            morceau = morceau.strip(" .:!?")
            if not morceau:
                continue
            nombre = len(morceau.split())
            if nombre <= EQUIVALENT_MOTS_MAX and not EXPLICATIVES.match(morceau):
                # « to love or to like » : un verbe anglais à l'infinitif garde
                # son « to » — c'est ainsi que les dictionnaires le citent.
                if morceau not in sortie:
                    sortie.append(morceau)
            else:
                explications.append(morceau)
    return sortie[:EQUIVALENTS_MAX], "; ".join(explications)[:160]


def est_traduite(entree):
    return any(bloc[1] for lecture in entree["lectures"] for bloc in lecture[4])


def vedette_recevable(mot, langue, frequence, index_formes, journal):
    """Une vedette neuve tirée d'une glose croisée vaut-elle d'entrer ?

    Quatre écueils, vus sur la première construction :

    * **la forme fléchie** — « years » a sa glose au Wiktionnaire français,
      mais c'est le pluriel de *year*, déjà au dictionnaire ;
    * **le mot de l'autre langue** — « de », « ich » sont décrits comme mots
      anglais (particule de nom, dialecte) et wordfreq leur donne un rang
      élevé parce qu'ils traînent dans des textes anglais : on les écarte
      quand ils sont bien plus fréquents dans l'autre langue ;
    * **la lettre seule, le sigle d'une ou deux lettres** ;
    * **le mot rare** : wordfreq ou Tatoeba doivent l'attester.
    """
    k = commun.cle(mot)
    if k in index_formes.get(langue, {}):
        journal["ecartees_formes"] += 1
        return False
    if len(k) <= 1 or (len(k) == 2 and not mot.isupper()):
        journal["ecartees_courtes"] += 1
        return False
    # « Rand », « Bart » : une majuscule initiale sur un mot qui n'est pas un
    # sigle annonce un nom propre ou une abréviation savante, et wordfreq lui
    # prête la fréquence de ses minuscules (« rand », « bart »).
    if mot[:1].isupper() and not mot.isupper():
        journal["ecartees_courtes"] += 1
        return False
    zipf, emplois = frequence(langue, mot)
    zipf_autre, _ = frequence(commun.AUTRE[langue], mot)
    if zipf_autre > zipf + 0.5:
        journal["ecartees_autre_langue"] += 1
        return False
    if zipf < ZIPF_MIN and emplois < TATOEBA_MIN:
        journal["ecartees_rares"] += 1
        return False
    return True


def completer(dictionnaires, croises, frequence, journal, index_formes=None):
    """Complète les dictionnaires par les gloses croisées.

    `croises[langue]` : `{clé: [enregistrement]}` des mots de `langue` décrits
    par l'édition de l'autre langue. `frequence(langue, mot)` rend un couple
    (zipf, emplois dans Tatoeba). `index_formes[langue]` : forme → lemmes.
    """
    index_formes = index_formes or {}
    for cle_journal in ("traduites", "creees", "ecartees_rares", "ecartees_vides",
                        "ecartees_formes", "ecartees_courtes", "ecartees_autre_langue"):
        journal.setdefault(cle_journal, 0)
    journal.setdefault("exemples", [])
    journal.setdefault("toutes", [])

    for langue in commun.LANGUES:
        entrees = dictionnaires[langue]
        par_cle = {}
        for mot in entrees:
            par_cle.setdefault(commun.cle(mot), []).append(mot)

        for k, enregistrements in croises.get(langue, {}).items():
            blocs = []
            nature = genre = ""
            for enregistrement in enregistrements:
                if enregistrement.get("p") == "name":
                    continue
                for glose, codes in enregistrement.get("g", ()):
                    eq, explication = equivalents(glose, commun.AUTRE[langue])
                    if not eq:
                        continue
                    blocs.append(["", eq, [], marques.ranger(codes), explication])
                    nature = nature or NATURES.get(enregistrement.get("p") or "", "")
                    genre = genre or enregistrement.get("genre", "")
            if not blocs:
                journal["ecartees_vides"] += 1
                continue

            existants = par_cle.get(k, [])
            if existants:
                for mot in existants:
                    entree = entrees[mot]
                    if est_traduite(entree):
                        continue
                    lecture = entree["lectures"][0]
                    for bloc in blocs[:2]:
                        lecture[4].append(list(bloc[:4]))
                    entree["croisee"] = True
                    journal["traduites"] += 1
                continue

            mot = enregistrements[0]["m"]
            if not vedette_recevable(mot, langue, frequence, index_formes, journal):
                continue
            lecture = [nature, genre, "", [], [list(b[:4]) for b in blocs[:3]], [], []]
            entrees[mot] = {"mot": mot, "lectures": [lecture], "neuve": True, "croisee": True}
            par_cle.setdefault(k, []).append(mot)
            journal["creees"] += 1
            journal["toutes"].append((langue, mot, nature, " / ".join(blocs[0][1][:4]),
                                      ",".join(blocs[0][3])))
            if len(journal["exemples"]) < 14:
                journal["exemples"].append((langue, mot, blocs[0][1][:3]))
    return journal


if __name__ == "__main__":
    for essai in ["police officer; copper; pig; rozzer",
                  "irritating, frustrating, especially to describe a person",
                  "apparently, appaz, they say (that), rumour has it (that)",
                  "Crevé, épuisé.",
                  "Used to express surprise"]:
        print(essai, "→", equivalents(essai))
