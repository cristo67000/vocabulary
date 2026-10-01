#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Le Wiktionnaire intégral : définitions, exemples, marques d'usage et flexions,
sens par sens, dans les deux langues de l'application.

── Pourquoi cette source ───────────────────────────────────────────────────

WikDict, qui fournit l'ossature du dictionnaire bilingue, ne retient du
Wiktionnaire que ce qui sert à traduire : la vedette, une définition abrégée et
les mots correspondants dans l'autre langue. C'est ce qu'il faut pour chercher
un mot, et c'est insuffisant pour l'apprendre. Il manque ce qui fait qu'un mot
se retient : **une phrase par signification**, et ce qui fait qu'on l'emploie
à bon escient : **sa marque d'usage** — familier, argot, vulgaire, britannique,
vieilli.

── Trois fichiers, quatre usages ───────────────────────────────────────────

  wiktionary-en-en   le Wiktionary anglais, mots anglais : définitions en
                     anglais, exemples, prononciation britannique, tables de
                     traduction vers le français, dérivés.
  wiktionary-en-fr   le Wiktionary anglais, mots français : leurs gloses sont
                     des **traductions anglaises** (« flic » → police officer;
                     copper; pig). C'est le meilleur dictionnaire français →
                     anglais qui soit libre, et il sert de source croisée.
  wiktionnaire-fr    le Wiktionnaire français entier : les mots français
                     décrits en français, avec leurs traductions anglaises ; et
                     les mots anglais décrits en français — gloses qui sont des
                     traductions françaises (« knackered » → Crevé, épuisé).

L'édition anglaise décrit les mots anglais **en anglais**, la française les
mots français **en français** : chaque fiche montre ainsi la définition dans la
langue du mot, ce qui est la façon d'apprendre d'un niveau intermédiaire, et
ses traductions, qui sont la réponse attendue.

── Ce que ce fichier produit ──────────────────────────────────────────────

Deux extraits compacts, `build/sources/wikt-en.jsonl` et `wikt-fr.jsonl`. Chacun
contient les vedettes de sa langue (enrichissement de WikDict, vedettes neuves
traduites, expressions attestées) et, marquées `croise`, les vedettes de
l'autre langue telles que cette édition les décrit. Sans cette étape
intermédiaire, chaque essai de construction relirait près de 5 Go.

Usage :
    python build/wiktionnaire.py            # n'extrait pas ce qui est déjà là
    python build/wiktionnaire.py --forcer
"""

import argparse
import gzip
import json
import re
import sys
import time
from pathlib import Path

import alignement
import commun
import marques
import tei
import traductions

RACINE = Path(__file__).resolve().parent
SOURCES = RACINE / "sources"

# --- Ce qu'on garde, et ce qu'on laisse -------------------------------------

# Une phrase d'exemple trop courte n'a pas de contexte, trop longue elle coûte
# plus d'efforts qu'elle n'en épargne. On accepte large et on classe : les
# exemples sont rendus du plus proche de la longueur idéale au plus éloigné,
# si bien que `construire.py`, qui n'en garde qu'un ou deux, prend les plus
# lisibles. (Mesure faite sur Wortschatz : un plafond serré laissait vides la
# moitié des fiches françaises, le Wiktionnaire français citant des romans.)
EXEMPLE_MOTS_MIN = 4
EXEMPLE_MOTS_MAX = 40
EXEMPLE_MOTS_IDEAL = 9

EXEMPLES_PAR_SENS = 4
SENS_MAX = 10
FORMES_MAX = 12
VOISINS_MAX = 12
DERIVES_MAX = 40
GLOSES_CROISEES_MAX = 4

REFERENCE_MAX = 70

GENRES = {"masculine": "masc", "feminine": "fem", "neuter": "neut"}

# Les natures qui n'apprennent rien : caractères, ponctuation, symboles.
NATURES_ECARTEES = {"character", "punct", "symbol", "romanization", "infix",
                    "interfix", "circumfix"}

# Les natures qui font d'une suite de mots une expression.
NATURES_D_EXPRESSION = {"phrase", "intj", "proverb", "prep_phrase", "adv_phrase"}

# La taxonomie de chaque édition pour ses expressions. Plus sûre que la nature
# grammaticale : le Wiktionnaire français dit de « simple comme bonjour » que
# c'est un adjectif, et le range dans « Expressions ». « Locutions nominales »
# est écarté à dessein : ce sont des noms composés (« pomme de terre »).
CATEGORIES_D_IDIOME = re.compile(
    r"^(English idioms|English proverbs|English phrasal verbs|English similes"
    r"|Expressions|Idiotismes|Proverbes)\b")
CATEGORIES_DE_LOCUTION = re.compile(r"^(Locutions(?!\s+nominales)|English phrases)\b")

# Les marques d'usage qui font une expression dans l'édition anglaise :
# « idiomatic » y remplace la catégorie, que kaikki ne publie plus.
ETIQUETTES_D_IDIOME = {"idiomatic"}

# Une variante d'orthographe britannique renvoie à l'américaine, qui porte
# tout le contenu : « colour » — *Commonwealth and Ireland standard spelling of
# color.* L'application met l'orthographe britannique en vedette ; il faut donc
# savoir que « colour » est la forme britannique de « color ».
RENVOI_ORTHOGRAPHE = re.compile(
    r"^(?P<ou>.*?)(?:standard |)spelling of (?P<cible>[^.;:()]+?)\.?$", re.IGNORECASE)
MARQUES_BRITANNIQUES = re.compile(
    r"\b(Commonwealth|British|UK|Britain|Ireland|Australia|Oxford)\b", re.IGNORECASE)
MARQUES_AMERICAINES = re.compile(r"\b(US|American|Canada|North American)\b")


def mots_de(texte):
    return re.findall(r"\w+", texte, flags=re.UNICODE)


def nettoyer_api(brut):
    """« /ˈnæk.əd/ » et « \\a.kœj\\ » donnent tous deux « ˈnæk.əd »."""
    if not brut:
        return ""
    return brut.strip().strip("[]/\\").strip()


BRITANNIQUES = {"UK", "Received-Pronunciation", "British", "General-British",
                "Standard-Southern-British", "England", "Southern-England"}
NOTE_BRITANNIQUE = re.compile(r"\b(UK|RP|Received Pronunciation|British|Standard Southern British)\b")
AUTRES_REGIONS = ("US", "General-American", "American", "Canada", "Canadian", "Australia",
                  "Australian", "New Zealand", "New-Zealand", "Ireland", "Irish", "Scotland",
                  "Scottish", "India", "South Africa", "South-Africa", "Northern-England",
                  "Northern England", "Wales", "Welsh", "cot-caught", "cot–caught", "Singapore",
                  "Philippines", "Jamaica", "Caribbean", "Geordie", "Cockney", "Estuary")


def api_britannique(entree):
    """La prononciation à montrer : britannique d'abord.

    Le Wiktionary anglais donne souvent plusieurs transcriptions, étiquetées
    (« UK », « US », « Received-Pronunciation ») ou annotées en clair (« New
    Zealand, weak form », « strong form », « without the cot–caught merger »).
    L'application parle anglais britannique. Dans l'ordre :

      0. une transcription marquée britannique (UK, RP) ;
      1. une transcription sans région — la forme pleine d'abord ;
      2. une forme faible sans région (« in » /ən/, quand /ɪn/ manque) ;
      3. n'importe quelle autre région — mieux vaut l'américaine que rien.

    Les transcriptions partielles (« /-ɑ/ », « [-ma-] ») ne montrent qu'un
    morceau de mot : jamais. Les crochets notent une transcription phonétique
    étroite, plus savante que ce qu'on attend sur une fiche : jamais non plus.
    Pour « in », le Wiktionary liste /ən/ (forme faible), /ɪn/ (forme pleine)
    et /ɘn/ (Nouvelle-Zélande) : c'est /ɪn/ qui s'affiche.
    """
    candidats = []
    for rang, son in enumerate(entree.get("sounds", ())):
        ipa = son.get("ipa")
        if not ipa or not ipa.startswith("/"):
            continue
        coeur = ipa.strip("/").strip()
        if not coeur or coeur.startswith("-") or coeur.endswith("-") or "…" in coeur:
            continue
        etiquettes = set(son.get("tags") or ()) | set(son.get("raw_tags") or ())
        note = son.get("note") or ""
        texte = " ".join(etiquettes) + " " + note
        if etiquettes & BRITANNIQUES or NOTE_BRITANNIQUE.search(note):
            priorite = 0
        elif any(region in texte for region in AUTRES_REGIONS):
            priorite = 3
        elif "weak" in note.lower():
            priorite = 2
        else:
            priorite = 1
        candidats.append((priorite, rang, nettoyer_api(ipa)))
    return min(candidats)[2] if candidats else ""


def api_francaise(entree):
    for son in entree.get("sounds", ()):
        ipa = son.get("ipa")
        if ipa:
            return nettoyer_api(ipa)
    return ""


def sens_utile(sens):
    """Un sens qui enseigne quelque chose.

    Le Wiktionnaire décrit aussi les formes fléchies (« houses : plural of
    house ») et les variantes (« lol : Alternative form of LOL ») : ce sont des
    renvois, pas des significations.
    """
    etiquettes = set(sens.get("tags", ()))
    if sens.get("form_of") or "form-of" in etiquettes:
        return False
    if sens.get("alt_of") or "alt-of" in etiquettes:
        return False
    if "no-gloss" in etiquettes:
        return False
    gloses = sens.get("glosses") or ()
    # « Commonwealth and Ireland standard spelling of color. » n'est pas un
    # sens mais un renvoi : `renvoi_orthographique` le lit à part.
    if gloses and est_renvoi(gloses[0]):
        return False
    return bool(gloses)


def est_renvoi(glose):
    return bool(RENVOI_ORTHOGRAPHE.match((glose or "").strip()))


PAIRES_DE_GUILLEMETS = (("«", "»"), ("“", "”"), ('"', '"'), ("‘", "’"))


def deshabiller(texte, marque):
    """Retire les guillemets qui enferment la citation entière, en déplaçant la
    marque du mot en gras d'autant."""
    for ouvrant, fermant in PAIRES_DE_GUILLEMETS:
        if len(texte) <= 2 or not texte.startswith(ouvrant) or not texte.endswith(fermant):
            continue
        interieur = texte[len(ouvrant):-len(fermant)]
        if ouvrant in interieur or fermant in interieur:
            break
        decalage = len(ouvrant)
        if marque:
            marque = [marque[0] - decalage, marque[1] - decalage]
        return interieur, marque
    return texte, marque


def marque_saine(texte, marque):
    if not marque:
        return None
    debut, fin = marque
    if not (0 <= debut < fin <= len(texte)):
        return None
    return marque if texte[debut:fin].strip() else None


def exemples_de(sens):
    """Les exemples d'un sens, filtrés sur la longueur et crédités.

    Une citation du Wiktionary anglais arrive parfois avec sa référence collée
    en tête (« 2003, Hugh Dauncey, … page 225, » puis un saut de ligne, puis le
    texte) : on ne garde que ce qui suit le dernier saut de ligne, et on écarte
    ce qui commence encore par une année.
    """
    candidats = []
    for rang, exemple in enumerate(sens.get("examples", ())):
        texte = (exemple.get("text") or "").strip()
        if not texte:
            continue
        gras = (exemple.get("bold_text_offsets") or [None])[0]
        marque = [int(gras[0]), int(gras[1])] if gras and len(gras) == 2 else None
        if "\n" in texte:
            coupe = texte.rfind("\n") + 1
            texte = texte[coupe:].strip()
            marque = [marque[0] - coupe, marque[1] - coupe] if marque else None
        if re.match(r"^\d{3,4}\b", texte):
            continue
        longueur = len(mots_de(texte))
        if not (EXEMPLE_MOTS_MIN <= longueur <= EXEMPLE_MOTS_MAX):
            continue
        texte, marque = deshabiller(texte, marque)
        marque = marque_saine(texte, marque)
        reference = (exemple.get("ref") or "").strip().rstrip(":")
        if len(reference) > REFERENCE_MAX:
            reference = reference[:REFERENCE_MAX].rsplit(" ", 1)[0] + "…"
        # Une phrase rédigée pour l'exemple (sans référence) passe avant une
        # citation d'auteur à longueur égale : elle est écrite pour être lue.
        penalite = 0 if not reference else 1
        candidats.append((abs(longueur - EXEMPLE_MOTS_IDEAL) + penalite, rang,
                          [texte, marque, reference]))

    candidats.sort(key=lambda c: (c[0], c[1]))
    return [c[2] for c in candidats[:EXEMPLES_PAR_SENS]]


def mots_lies(entree, champ, maximum=VOISINS_MAX):
    vus = []
    for lien in entree.get(champ, ()):
        mot = (lien.get("word") or "").strip()
        if mot and mot not in vus and len(mot) <= 40:
            vus.append(mot)
        if len(vus) >= maximum:
            break
    return vus


# --- Les formes qu'on apprend -------------------------------------------------
#
# On ne garde que les formes qu'on apprend par cœur parce que rien ne les
# prédit : le pluriel irrégulier, les temps primitifs des verbes anglais
# (*go, went, gone*), le comparatif, le féminin et le pluriel d'un adjectif
# français. La correspondance des étiquettes est **exacte** : ni plus ni moins.

FORMES_SIMPLES = {
    ("en", "noun"): (
        ("pl", ("plural",)),
    ),
    ("en", "verb"): (
        ("3sg", ("present", "singular", "third-person")),
        ("ing", ("participle", "present")),
        ("past", ("past",)),
        ("pp", ("participle", "past")),
    ),
    ("en", "adj"): (
        ("comp", ("comparative",)),
        ("sup", ("superlative",)),
    ),
    ("en", "adv"): (
        ("comp", ("comparative",)),
        ("sup", ("superlative",)),
    ),
    ("fr", "noun"): (
        ("pl", ("plural",)),
        ("fs", ("feminine",)),
    ),
    ("fr", "adj"): (
        ("fs", ("singular", "feminine")),
        ("mp", ("plural", "masculine")),
        ("fp", ("plural", "feminine")),
    ),
    ("fr", "verb"): (
        ("inf", ("infinitive", "present")),
        ("part", ("participle", "past")),
    ),
}

SERIES_DE_FORMES = {
    ("fr", "verb"): (
        (("indicative", "present"),
         ("pres1", "pres2", "pres3", "pres4", "pres5", "pres6")),
        (("indicative", "imperfect"),
         ("imp1", "imp2", "imp3", "imp4", "imp5", "imp6")),
    ),
}

# Une forme anglaise « régulière » n'a rien à apprendre : le pluriel en -s, le
# passé en -ed. On la garde tout de même — elle sert à retrouver la vedette
# quand on tape « went » ou « houses » — mais la fiche n'affiche que les
# irrégulières (voir construire.py).


def formes_de(entree, langue):
    """Les formes à retenir, `[code, graphie, ""]`."""
    brutes = []
    for forme in entree.get("forms", ()):
        graphie = (forme.get("form") or "").strip()
        etiquettes = frozenset(t for t in forme.get("tags", ()) if t)
        if not graphie or not etiquettes or len(graphie) > 60:
            continue
        # Formes marquées rares, dialectales, vieillies ou alternatives : pas
        # celles qu'on apprend (« housen », « hice » pour house).
        if etiquettes & {"dialectal", "obsolete", "archaic", "rare", "humorous",
                         "alternative", "nonstandard", "table-tags",
                         "inflection-template", "multiword-construction",
                         "romanization"}:
            continue
        if graphie.startswith(("more ", "most ")) and langue == "en":
            continue
        brutes.append((etiquettes, graphie))

    nature = entree.get("pos") or ""
    sortie = []
    vus = set()
    for code, tags in FORMES_SIMPLES.get((langue, nature), ()):
        voulu = frozenset(tags)
        for etiquettes, graphie in brutes:
            if etiquettes == voulu:
                sortie.append([code, graphie, ""])
                vus.add(code)
                break
    for tags, codes in SERIES_DE_FORMES.get((langue, nature), ()):
        voulu = frozenset(tags)
        serie = [g for e, g in brutes if e == voulu]
        if len(serie) != len(codes):
            continue
        for code, graphie in zip(codes, serie):
            if code not in vus:
                sortie.append([code, graphie, ""])
    return sortie[:FORMES_MAX]


def toutes_formes(entree):
    """Toutes les graphies fléchies utiles à la recherche (« went » → go)."""
    sortie = []
    for forme in entree.get("forms", ()):
        graphie = (forme.get("form") or "").strip()
        etiquettes = set(forme.get("tags", ()))
        if (not graphie or " " in graphie or len(graphie) > 40
                or etiquettes & {"table-tags", "inflection-template", "romanization"}):
            continue
        if graphie not in sortie:
            sortie.append(graphie)
    return sortie[:30]


# --- Les traductions de l'édition anglaise, rattachées aux sens ---------------

def traductions_en(entree, sens_gardes):
    """Les traductions françaises, rangées sous le sens qu'elles servent.

    kaikki.org rattache lui-même une table de traduction au sens quand il en est
    sûr (champ `translations` du sens). Les autres restent au niveau de
    l'entrée, avec deux indices : la glose de la table (« human abode ») et
    `_dis1`, une note de ressemblance avec chaque sens. On range ces dernières
    sous le sens le mieux noté — à condition qu'il le soit nettement, sinon
    elles vont au premier sens gardé, comme le Wiktionary les affiche.

    `sens_gardes` : liste de (rang dans l'entrée d'origine, sens brut).
    Rend deux listes parallèles : les traductions de chaque sens, et celles
    qui lui sont rattachées **avec certitude** — table liée au sens par le
    Wiktionary lui-même, note `_dis1` nettement en tête, ou sens unique.
    Seules ces dernières servent à corriger les rattachements de WikDict
    (voir alignement.corriger_rattachements).
    """
    rang_vers_indice = {rang: i for i, (rang, _s) in enumerate(sens_gardes)}
    sortie = [[] for _ in sens_gardes]
    sures = [[] for _ in sens_gardes]

    def ajouter(i, brut, sure=False):
        mot = traductions.nettoyer(brut.get("word"))
        if not mot:
            return
        # « tête de mort (m) », « chat m » : le genre arrive parfois collé.
        if mot not in sortie[i] and len(sortie[i]) < traductions.TRADUCTIONS_MAX:
            sortie[i].append(mot)
        if (sure or len(sens_gardes) == 1) and mot not in sures[i]:
            sures[i].append(mot)

    for i, (_rang, brut) in enumerate(sens_gardes):
        for t in brut.get("translations", ()):
            if t.get("lang_code") == "fr" or t.get("code") == "fr":
                ajouter(i, t, sure=True)

    if not sens_gardes:
        return sortie, sures
    for t in entree.get("translations", ()):
        if t.get("lang_code") != "fr" and t.get("code") != "fr":
            continue
        cible = None
        sure = False
        notes = (t.get("_dis1") or "").split()
        if notes:
            try:
                valeurs = [float(v) for v in notes]
            except ValueError:
                valeurs = []
            if valeurs:
                meilleur = max(range(len(valeurs)), key=lambda k: (valeurs[k], -k))
                if valeurs[meilleur] > 0 and meilleur in rang_vers_indice:
                    cible = rang_vers_indice[meilleur]
                    # Sûre si la note du sens choisi double au moins celle du
                    # suivant, et n'est pas infime : « obtenir » (31 contre 26)
                    # ne l'est pas, une table au sens évident l'est.
                    suivante = max((v for k, v in enumerate(valeurs) if k != meilleur), default=0)
                    sure = valeurs[meilleur] >= 8 and valeurs[meilleur] >= 2 * suivante
                elif valeurs[meilleur] > 0:
                    # Le sens le mieux noté n'a pas été gardé (renvoi, forme) :
                    # on prend le mieux noté parmi ceux qui restent.
                    gardes = [(valeurs[r], -r, r) for r in rang_vers_indice if r < len(valeurs)]
                    if gardes:
                        cible = rang_vers_indice[max(gardes)[2]]
        ajouter(cible if cible is not None else 0, t, sure=sure and cible is not None)
    return sortie, sures


# --- Les traductions de l'édition française, rattachées aux sens --------------

A_TRIER = re.compile(r"à trier", re.IGNORECASE)


def ressemblance(glose, definition):
    """La part des mots pleins d'une glose de table qu'on retrouve dans la
    définition d'un sens, entre 0 et 1. La glose est courte (« Pièce du jeu
    d'échecs »), la définition longue : on mesure l'inclusion, pas l'égalité."""
    a = alignement.mots_pleins(alignement.normaliser(glose))
    b = alignement.mots_pleins(alignement.normaliser(definition))
    if not a or not b:
        return 0.0
    return len(a & b) / len(a)


def traductions_fr(entree, sens_gardes):
    """Les traductions anglaises d'un mot français, rangées sous leur sens.

    Dans les données de wiktextract pour le Wiktionnaire, les sens ne portent
    pas de numéro ; les traductions, elles, portent la glose de leur table
    (« (Échecs) Pièce du jeu d'échecs ») et souvent le numéro du sens qu'elle
    sert, tel que l'a écrit le contributeur. Ranger par le seul numéro de sens
    perdait tout : les sens n'en ont pas. On range donc par la glose, que l'on
    retrouve dans la définition, le numéro servant de confirmation ou de
    secours ; un numéro démenti par une glose nette cède — la page a pu gagner
    un sens depuis que la table a été numérotée (« voile » : « sailing » était
    rangé au sens 3, la pratique de la navigation est le 4ᵉ).

    Rend deux listes parallèles : les traductions de chaque sens, et celles
    qui lui sont rattachées avec certitude — glose et numéro d'accord, glose
    sans équivoque, ou sens unique.
    """
    sortie = [[] for _ in sens_gardes]
    sures = [[] for _ in sens_gardes]
    if not sens_gardes:
        return sortie, sures
    unique = len(sens_gardes) == 1
    numero_vers_i = {rang + 1: i for i, (rang, _b) in enumerate(sens_gardes)}
    definitions = [" ".join(b.get("glosses") or []) for _r, b in sens_gardes]
    libres = []

    def ajouter(i, mot, sure):
        if mot not in sortie[i] and len(sortie[i]) < traductions.TRADUCTIONS_MAX:
            sortie[i].append(mot)
        if (sure or unique) and mot not in sures[i]:
            sures[i].append(mot)

    for t in entree.get("translations", ()):
        if t.get("lang_code") != "en" and t.get("code") != "en":
            continue
        mot = traductions.nettoyer(t.get("word"))
        if not mot:
            continue
        glose = (t.get("sense") or "").strip()
        if A_TRIER.search(glose):
            glose = ""
        indices = []
        for brut in traductions.indices_de(t.get("sense_index")):
            if str(brut).isdigit() and int(brut) in numero_vers_i:
                indices.append(numero_vers_i[int(brut)])
        notes = [ressemblance(glose, d) for d in definitions] if glose else [0.0] * len(definitions)
        ordre = sorted(range(len(notes)), key=lambda k: -notes[k])
        meilleur = ordre[0]
        second = notes[ordre[1]] if len(ordre) > 1 else 0.0

        cibles, sure = [], False
        if indices:
            j = indices[0]
            if glose and notes[j] >= 0.5 and notes[j] >= notes[meilleur] - 0.1:
                cibles, sure = indices, True
            elif glose and notes[meilleur] >= 0.6 and notes[meilleur] - notes[j] >= 0.3:
                cibles, sure = [meilleur], True
            else:
                cibles = indices
        elif glose and notes[meilleur] >= 0.6 and notes[meilleur] - second >= 0.25:
            cibles, sure = [meilleur], True

        if not cibles:
            libres.append(mot)
            continue
        for i in cibles:
            ajouter(i, mot, sure)

    # Les traductions qu'on ne sait rattacher à aucun sens vont à tous : c'est
    # ainsi que le Wiktionnaire les montre, ensemble, sous « à trier ».
    for mot in libres:
        for i in range(len(sens_gardes)):
            ajouter(i, mot, False)
    return sortie, sures


# --- Enregistrements compacts -------------------------------------------------

def degre_d_idiome(entree, sens_bruts):
    degre = ""
    for categorie in entree.get("categories", ()):
        nom = categorie.get("name") if isinstance(categorie, dict) else categorie
        if not nom:
            continue
        if CATEGORIES_D_IDIOME.match(nom):
            return "idiome"
        if CATEGORIES_DE_LOCUTION.match(nom):
            degre = "locution"
    for sens in sens_bruts:
        if set(sens.get("tags", ())) & ETIQUETTES_D_IDIOME:
            return "idiome"
    return degre


def compacter(entree, langue):
    """Une entrée wiktextract → l'enregistrement compact qu'on garde, ou None."""
    gardes = []
    for rang, brut in enumerate(entree.get("senses", ())):
        if sens_utile(brut):
            gardes.append((rang, brut))
        if len(gardes) >= SENS_MAX:
            break
    if not gardes:
        return None

    if langue == "en":
        par_sens, sures = traductions_en(entree, gardes)
    else:
        par_sens, sures = traductions_fr(entree, gardes)

    sens = []
    for (rang, brut), trads, siennes in zip(gardes, par_sens, sures):
        glose = brut["glosses"][-1].strip()
        # Un sous-sens du Wiktionary anglais porte la glose du sens parent en
        # tête (« A building used for something other than a residence. — A
        # workhouse. ») : c'est la dernière qui est la sienne. Quand elle est
        # trop courte pour se comprendre seule, on la fait précéder du parent.
        if len(brut["glosses"]) > 1 and len(glose) < 18:
            glose = brut["glosses"][0].rstrip(":. ") + " : " + glose
        sens.append({
            "d": glose,
            "x": exemples_de(brut),
            "th": list(brut.get("topics", ()))[:4],
            "t": marques.depuis_etiquettes(brut.get("tags", ()), brut.get("raw_tags", ())),
            "i": brut.get("sense_index") or str(rang + 1),
            "tr": trads,
        })
        if siennes:
            sens[-1]["ts"] = siennes[:traductions.TRADUCTIONS_MAX]

    etiquettes = entree.get("tags", ())
    genre = next((GENRES[t] for t in etiquettes if t in GENRES), "")
    if not genre:
        for (_r, brut) in gardes:
            genre = next((GENRES[t] for t in brut.get("tags", ()) if t in GENRES), "")
            if genre:
                break

    compact = {
        "m": entree["word"],
        "p": entree.get("pos") or "",
        "g": genre,
        "api": api_britannique(entree) if langue == "en" else api_francaise(entree),
        "s": sens,
        "f": formes_de(entree, langue),
        "fl": toutes_formes(entree),
        "syn": mots_lies(entree, "synonyms"),
        "ant": mots_lies(entree, "antonyms"),
        "der": mots_lies(entree, "derived", DERIVES_MAX),
        "rel": mots_lies(entree, "related", VOISINS_MAX),
    }
    degre = degre_d_idiome(entree, [b for _r, b in gardes])
    if degre:
        compact["idiome"] = degre
    return compact


def renvoi_orthographique(entree):
    """« colour » → ("gb", "color") ; « center » → ("us", "centre") ; sinon None.

    Seuls les renvois d'**orthographe** comptent, pas les variantes de forme
    (« alternative form of ») qui peuvent être dialectales ou vieillies.
    """
    for sens in entree.get("senses", ()):
        for glose in sens.get("glosses", ())[:1]:
            m = RENVOI_ORTHOGRAPHE.match(glose.strip())
            if not m:
                continue
            ou = m.group("ou")
            cible = m.group("cible").strip()
            if not cible or " " in cible and len(cible.split()) > 3:
                continue
            etiquettes = " ".join(sens.get("tags", ()))
            contexte = ou + " " + etiquettes
            if MARQUES_BRITANNIQUES.search(contexte):
                return ("gb", cible)
            if MARQUES_AMERICAINES.search(contexte):
                return ("us", cible)
    return None


def glose_croisee(entree):
    """Ce qu'une édition dit d'un mot de l'autre langue : ses gloses, avec les
    marques d'usage de chacune. Rend None pour une forme fléchie."""
    gloses = []
    for brut in entree.get("senses", ()):
        if not sens_utile(brut):
            continue
        glose = brut["glosses"][-1].strip()
        if not glose or len(glose) > 220:
            continue
        gloses.append([glose, marques.depuis_etiquettes(brut.get("tags", ()),
                                                        brut.get("raw_tags", ()))])
        if len(gloses) >= GLOSES_CROISEES_MAX:
            break
    return gloses or None


# --- Lecture des dumps --------------------------------------------------------

def lignes(chemin):
    with gzip.open(chemin, "rt", encoding="utf-8", errors="replace") as flux:
        for ligne in flux:
            yield ligne


def extraire_langue(chemin, langue, vedettes, journal):
    """Les vedettes de `langue` décrites par leur propre édition."""
    lues = retenues = neuves = expressions = renvois = 0
    debut = time.time()
    motif = f'"lang_code": "{langue}"'
    for ligne in lignes(chemin):
        lues += 1
        if lues % 200000 == 0:
            vitesse = lues / max(time.time() - debut, 0.001)
            sys.stdout.write(f"\r  … {lues:>9,} lignes, {retenues:>7,} retenues"
                             f" ({vitesse:,.0f}/s)   ".replace(",", " "))
            sys.stdout.flush()
        if motif not in ligne and '"lang_code":"' + langue + '"' not in ligne:
            continue
        try:
            entree = json.loads(ligne)
        except ValueError:
            continue
        if entree.get("lang_code") != langue:
            continue
        mot = (entree.get("word") or "").strip()
        if not mot or entree.get("pos") in NATURES_ECARTEES:
            continue

        if langue == "en":
            renvoi = renvoi_orthographique(entree)
            if renvoi:
                renvois += 1
                yield {"m": mot, "p": entree.get("pos") or "", "var": renvoi}

        compact = compacter(entree, langue)
        if compact is None:
            continue
        connue = commun.cle(mot) in vedettes
        if not connue:
            if " " in mot and (entree.get("pos") in NATURES_D_EXPRESSION
                               or compact.get("idiome")):
                compact["fx"] = 1
                expressions += 1
            elif not any(bloc["tr"] for bloc in compact["s"]):
                continue
            else:
                compact["n"] = 1
                neuves += 1
        retenues += 1
        yield compact
    sys.stdout.write("\r" + " " * 78 + "\r")
    journal.update({"lues": lues, "retenues": retenues, "neuves": neuves,
                    "expressions": expressions, "renvois": renvois})


def extraire_croises(chemin, langue_decrite, journal, motif_langue=True):
    """Les vedettes de `langue_decrite` telles qu'une autre édition les glose."""
    lues = gardees = 0
    motif = f'"lang_code": "{langue_decrite}"'
    for ligne in lignes(chemin):
        lues += 1
        if motif_langue and motif not in ligne and '"lang_code":"' + langue_decrite + '"' not in ligne:
            continue
        try:
            entree = json.loads(ligne)
        except ValueError:
            continue
        if entree.get("lang_code") != langue_decrite:
            continue
        mot = (entree.get("word") or "").strip()
        if not mot or len(mot) > 60 or entree.get("pos") in NATURES_ECARTEES:
            continue
        gloses = glose_croisee(entree)
        if not gloses:
            continue
        gardees += 1
        enregistrement = {"m": mot, "l": langue_decrite, "p": entree.get("pos") or "",
                          "croise": 1, "g": gloses}
        genre = next((GENRES[t] for t in entree.get("tags", ()) if t in GENRES), "")
        if not genre:
            for brut in entree.get("senses", ()):
                genre = next((GENRES[t] for t in brut.get("tags", ()) if t in GENRES), "")
                if genre:
                    break
        if genre:
            enregistrement["genre"] = genre
        yield enregistrement
    journal.update({"croisees_lues": lues, "croisees": gardees})


def vedettes_de(fichier_tei):
    return {commun.cle(brut["mot"]) for brut in tei.lire(fichier_tei)}


def chemin_extrait(langue):
    return SOURCES / f"wikt-{langue}.jsonl"


def moutures():
    chemin = SOURCES / "moutures.json"
    if not chemin.exists():
        return {}
    try:
        table = json.loads(chemin.read_text(encoding="utf-8"))
    except ValueError:
        return {}
    return {"en": table.get("wiktionary-en-en.jsonl.gz", ""),
            "fr": table.get("wiktionnaire-fr.jsonl.gz", "")}


def charger(langue):
    """L'extrait d'une langue, rangé par vedette (sans les croisés ni les
    renvois orthographiques)."""
    chemin = chemin_extrait(langue)
    if not chemin.exists():
        raise SystemExit(
            f"{chemin.name} manque — lancez d'abord python build/wiktionnaire.py")
    par_mot = {}
    with chemin.open("r", encoding="utf-8") as flux:
        for ligne in flux:
            ligne = ligne.strip()
            if not ligne:
                continue
            enregistrement = json.loads(ligne)
            if enregistrement.get("croise") or enregistrement.get("var"):
                continue
            # Un extrait fait avant que les renvois d'orthographe ne soient
            # écartés à la source en porte encore : on les retire ici.
            enregistrement["s"] = [s for s in enregistrement["s"] if not est_renvoi(s["d"])]
            if not enregistrement["s"]:
                continue
            par_mot.setdefault(enregistrement["m"], []).append(enregistrement)
    return par_mot


def charger_croises(edition):
    """Les vedettes de l'autre langue, décrites par cette édition.

    `charger_croises("fr")` rend les mots **anglais** glosés en français par le
    Wiktionnaire français ; `charger_croises("en")` les mots **français** glosés
    en anglais par le Wiktionary. Rend `{clé: [enregistrement, …]}`.
    """
    chemin = chemin_extrait(edition)
    if not chemin.exists():
        return {}
    par_cle = {}
    with chemin.open("r", encoding="utf-8") as flux:
        for ligne in flux:
            ligne = ligne.strip()
            if not ligne:
                continue
            enregistrement = json.loads(ligne)
            if not enregistrement.get("croise"):
                continue
            par_cle.setdefault(commun.cle(enregistrement["m"]), []).append(enregistrement)
    return par_cle


def charger_variantes():
    """Les renvois d'orthographe de l'édition anglaise.

    Rend `{graphie: (sens, cible)}` : « colour » → ("gb", "color"),
    « center » → ("us", "centre") quand l'américaine renvoie à la britannique.
    """
    chemin = chemin_extrait("en")
    sortie = {}
    if not chemin.exists():
        return sortie
    with chemin.open("r", encoding="utf-8") as flux:
        for ligne in flux:
            if '"var"' not in ligne:
                continue
            enregistrement = json.loads(ligne)
            if enregistrement.get("var"):
                sortie.setdefault(enregistrement["m"], tuple(enregistrement["var"]))
    return sortie


# --- Programme --------------------------------------------------------------

def main():
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument("--forcer", action="store_true",
                           help="réextraire même si l'extrait est déjà là")
    options = analyseur.parse_args()

    travaux = [
        ("en", "eng-fra.tei", "wiktionary-en-en.jsonl.gz",
         ("fr", "wiktionary-en-fr.jsonl.gz", False)),
        ("fr", "fra-eng.tei", "wiktionnaire-fr.jsonl.gz",
         ("en", "wiktionnaire-fr.jsonl.gz", True)),
    ]

    for langue, nom_tei, nom_dump, (decrite, nom_croise, filtrer) in travaux:
        sortie = chemin_extrait(langue)
        if sortie.exists() and not options.forcer:
            print(f"= {sortie.name} déjà là ({commun.humain(sortie.stat().st_size)})")
            continue
        for nom in (nom_dump, nom_croise):
            if not (SOURCES / nom).exists():
                raise SystemExit(f"{nom} manque — lancez d'abord python build/telecharger.py")

        print(f"\n{langue} — vedettes du dictionnaire bilingue…")
        vedettes = vedettes_de(SOURCES / nom_tei)
        print(f"  {len(vedettes):,} vedettes".replace(",", " "))

        debut = time.time()
        journal = {}
        provisoire = sortie.with_suffix(".partiel")
        with provisoire.open("w", encoding="utf-8", newline="") as flux:
            print(f"{langue} — lecture de {nom_dump}")
            for enregistrement in extraire_langue(SOURCES / nom_dump, langue, vedettes, journal):
                flux.write(json.dumps(enregistrement, ensure_ascii=False,
                                      separators=(",", ":")) + "\n")
            print(f"{langue} — mots {decrite} décrits dans {nom_croise}")
            for enregistrement in extraire_croises(SOURCES / nom_croise, decrite, journal,
                                                   motif_langue=filtrer):
                flux.write(json.dumps(enregistrement, ensure_ascii=False,
                                      separators=(",", ":")) + "\n")
        provisoire.replace(sortie)

        duree = time.time() - debut
        print(f"  ✓ {journal['lues']:,} lignes lues, {journal['retenues']:,} retenues"
              f" dont {journal['neuves']:,} vedettes neuves traduites"
              f" et {journal['expressions']:,} expressions sans traduction ;"
              f" {journal['renvois']:,} renvois d'orthographe ;"
              f" {journal['croisees']:,} vedettes {decrite} glosées"
              f", en {duree:.0f} s".replace(",", " "))
        print(f"  → {sortie.name}, {commun.humain(sortie.stat().st_size)}")

    print("\nÉtape suivante : python build/construire.py")


if __name__ == "__main__":
    main()
