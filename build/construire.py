#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Construction des paquets de données de Vocabulary.

Entrée  : build/sources/  (voir telecharger.py et SOURCES.md)
Sortie  : data/noyau/, data/complet/, data/manifeste.json

Deux paquets sont produits, chacun complet et autonome :

  data/noyau/    les mots les plus courants — livré avec l'application et
                 pré-caché par le service worker : l'application est utilisable
                 hors ligne dès l'installation.
  data/complet/  tout le dictionnaire, téléchargé ensuite en arrière-plan
                 (réglage « Tout garder hors ligne », coché d'office).

Le noyau est un sous-ensemble du complet, pas une découpe : quand le complet est
installé, l'application ignore simplement le noyau.

── Format d'une entrée ─────────────────────────────────────────────────────

En tableau plutôt qu'en objet — à deux cent mille entrées, le nom des clés
répété pèserait plus que ce qu'il apporte :

    [ mot, bande, lectures, phrases, voisins, infos ]
      lectures = [ [ nature, genre, prononciation, [formes], sens,
                     flexion, synonymes ], … ]
        sens   = [ [ définition, [traductions], [citations], [phrases],
                     [marques], crues ], … ]
          citations = [ [ texte, [début, fin] du mot en gras, référence ], … ]
          phrases   = [ numéro, … ]   → dans phrases-NNN.json du même paquet
          marques   = [ "fam", "gb", … ]  → voir marques.py
          crues     = nombre de traductions, en fin de liste, qui sont des mots
                      crus : l'application les masque avec les mots crus
        flexion   = [ [ code, graphie, "" ], … ] → pluriel, temps primitifs
        synonymes = [ mot, … ]
      phrases  = [ numéro, … ]   → celles qu'aucun sens n'a réclamées
      voisins  = [ mot, … ]      → la famille du mot, même langue
      infos    = { } facultatif :
                   e   provenance d'une expression usuelle (voir expressions.py)
                   x   explication d'une expression
                   us  orthographe américaine d'une vedette anglaise
                   cru 1 si tous les sens sont crus
                   gl  1 si une traduction vient d'une glose croisée

── Ce qui est propre à Vocabulary ─────────────────────────────────────────

* **L'orthographe britannique en vedette.** Le Wiktionary range le contenu
  sous « color » et fait de « colour » un renvoi ; l'application parle anglais
  britannique, elle met « colour » en vedette avec le contenu de « color », et
  dit « US : color ». Taper « color » y mène toujours.
* **La fréquence d'usage réelle.** Classement par wordfreq (sous-titres,
  réseaux sociaux, presse, Wikipédia) plutôt que par le seul corpus Tatoeba,
  où « Tom » est le dixième mot anglais.
* **Les marques d'usage et les mots crus**, sens par sens.
* **Les gloses croisées**, qui traduisent l'argot et les abréviations que les
  tables de traduction ignorent (voir croisees.py).
"""

import argparse
import hashlib
import json
import re
import shutil
import sqlite3
import time
from collections import Counter, defaultdict
from pathlib import Path

import alignement
import citations as citations_traduites
import commun
import corpus
import croisees
import expressions
import familles
import formes_fr
import grammaire
import marques
import phrases
import tei
import traductions
import wiktionnaire

RACINE = Path(__file__).resolve().parent
SOURCES = RACINE / "sources"
DATA = RACINE.parent / "data"
LANGUES = commun.LANGUES

# --- Réglages de la construction --------------------------------------------

# Combien d'entrées par langue dans le noyau livré avec l'application. Tout mot
# affiché est cliquable ; en dessous de ce seuil, trop de clics tombaient à
# vide dans Wortschatz.
TAILLE_NOYAU = 14000

# Bornes des bandes de fréquence, en rang. Ce ne sont pas des niveaux du CECRL
# (les listes officielles sont sous droits) : ce sont des rangs d'usage
# constaté, ce qui se mesure et se vérifie.
BANDES = [1500, 5000, 14000]          # → bandes 0, 1, 2, puis 3 au-delà
NOMS_BANDES = ["premiers-pas", "courant", "etendu", "rare"]

SENS_MAX = 4
TRADUCTIONS_MAX = 6
DEFINITION_MAX = 150
FORMES_MAX = 6
ENTREES_PAR_TRANCHE = 900

CITATIONS_PAR_SENS = 2
CITATIONS_NOYAU = 1
CITATION_MAX = 200

# Un nom propre n'entre que s'il est d'usage courant : « London », « Londres »,
# « Allemagne » oui ; les milliers de localités du Wiktionnaire non.
ZIPF_NOM_PROPRE = 3.0

# Une graphie britannique ne prend la vedette que si elle n'est pas beaucoup
# plus rare que l'américaine (écart de fréquence zipf) : colour/color passent,
# dat/that ou ould/old non.
ECART_DE_FREQUENCE_GB = 1.5
ZIPF_GB_COURANT = 3.0

BUDGET_NOYAU = 32 * 1024 * 1024
BUDGET_COMPLET = 160 * 1024 * 1024


# --- Lecture et mise en forme -----------------------------------------------

def ecrire(chemin, texte):
    r"""Écrit un fichier de données en LF : sous Windows, sans `newline=""`, un
    « \r » traînant rendrait des milliers de mots introuvables."""
    chemin.write_text(texte, encoding="utf-8", newline="")


def couper(texte, limite=DEFINITION_MAX):
    texte = texte.strip()
    if len(texte) <= limite:
        return texte
    coupe = texte[:limite].rsplit(" ", 1)[0].rstrip(" ,;:—-")
    return (coupe or texte[:limite]) + "…"


def elaguer_citations(entree):
    for lecture in entree["lectures"]:
        for bloc in lecture[4]:
            if len(bloc) < 3:
                continue
            gardees = [c for c in bloc[2] if len(c[0]) <= CITATION_MAX]
            bloc[2] = gardees[:CITATIONS_PAR_SENS]


def charger_dictionnaire(fichier):
    """TEI → {mot: entrée fusionnée}, l'index des formes, et les graphies."""
    entrees = {}
    formes = defaultdict(set)
    graphies = defaultdict(set)
    for brut in tei.lire(fichier):
        mot = brut["mot"]
        sens = []
        for s in brut["sens"][:SENS_MAX]:
            codes, definition = marques.depuis_definition(s["def"])
            sens.append([couper(definition), s["trads"][:TRADUCTIONS_MAX], [], codes])
        if not sens:
            continue
        lecture = [brut["pos"], brut["genre"], brut["pron"], brut["montrer"][:FORMES_MAX], sens]
        if mot in entrees:
            entrees[mot]["lectures"].append(lecture)
        else:
            entrees[mot] = {"mot": mot, "lectures": [lecture]}

        cle_lemme = commun.cle(mot)
        for forme in brut["flechies"]:
            k = commun.cle(forme)
            if k and " " not in k and k != cle_lemme:
                formes[k].add(cle_lemme)
            if " " not in forme:
                graphies[mot].add(forme)
    return entrees, dict(formes), dict(graphies)


def charger_importance(base):
    chemin = SOURCES / base
    if not chemin.exists():
        print(f"  ! {base} absent, l'importance WikDict ne sera pas utilisée")
        return {}
    lien = sqlite3.connect(f"file:{chemin}?mode=ro", uri=True)
    valeurs = {}
    requete = ("SELECT written_rep, rel_importance FROM simple_translation "
               "WHERE rel_importance IS NOT NULL")
    for mot, importance in lien.execute(requete):
        if mot:
            valeurs[commun.cle(mot)] = importance
    lien.close()
    return valeurs


# --- Fréquences d'usage ------------------------------------------------------

class Frequences:
    """wordfreq d'abord, Tatoeba ensuite.

    wordfreq agrège des sous-titres, des réseaux sociaux, la presse, Wikipédia
    et des livres (Robyn Speer, données sous CC BY-SA 4.0) : c'est le meilleur
    témoin libre de ce qui se dit **aujourd'hui**, argot compris — « lol »,
    « mdr », « relou » y ont leur rang. Tatoeba, écrit par des apprenants et
    des bénévoles, départage ce que wordfreq ignore — les expressions surtout.
    """

    def __init__(self, textes):
        from wordfreq import get_frequency_dict, word_frequency
        self._phrase = word_frequency
        self.dico = {l: get_frequency_dict(l) for l in LANGUES}
        self.tatoeba = {}
        self.exact = {}
        self.total_tatoeba = {}
        for langue in LANGUES:
            par_cle, par_forme = corpus.compter_deux(textes[langue], langue)
            self.tatoeba[langue] = par_cle
            self.exact[langue] = par_forme
            self.total_tatoeba[langue] = max(sum(par_cle.values()), 1)

    def mot(self, langue, graphie):
        k = graphie.lower().replace("’", "'")
        if " " in k:
            # L'estimation de wordfreq pour une suite de mots est généreuse :
            # « to the » y passait pour le vingt-et-unième « mot » anglais.
            try:
                return self._phrase(k, langue) * 0.05
            except Exception:
                return 0.0
        return self.dico[langue].get(k, 0.0)

    def zipf(self, langue, graphie):
        import math
        f = self.mot(langue, graphie)
        return math.log10(f) + 9 if f > 0 else 0.0

    def emplois(self, langue, graphie):
        return self.tatoeba[langue].get(commun.cle(graphie), 0)

    def couple(self, langue, graphie):
        return self.zipf(langue, graphie), self.emplois(langue, graphie)


MOTS_D_UNE_LETTRE = {"en": {"a", "I"}, "fr": {"à", "a", "y", "ô"}}


def frequences_entrees(freq, entrees, graphies, langue):
    """Fréquence de chaque vedette : sa graphie et celles de ses formes.

    « went » atteste *go* ; « houses » atteste *house*. Une graphie que
    plusieurs vedettes se partagent ne compte que pour la plus probable — la
    première par ordre de fréquence propre —, sans quoi *lie* (mentir) et *lie*
    (être allongé) se partageraient « lay » à égalité.
    """
    proprietaires = defaultdict(list)
    for mot in entrees:
        for graphie in {mot} | set(graphies.get(mot, ())):
            proprietaires[graphie.lower()].append(mot)

    # wordfreq ignore la casse : « AND » (la porte logique), « IT », « EST »
    # recevaient la fréquence de « and », « it », « est ». Quand deux vedettes
    # ne diffèrent que par la casse, on partage selon Tatoeba, qui compte les
    # graphies exactes hors début de phrase — « in May » contre « you may ».
    par_minuscules = defaultdict(list)
    for mot in entrees:
        par_minuscules[mot.lower()].append(mot)

    def part_de_casse(mot):
        """La part de la fréquence wordfreq qui revient à cette graphie.

        « IS » (l'État islamique) n'a pas d'homographe en minuscules parmi
        les vedettes — « is » est une forme de *be* —, et recevait pourtant
        toute la fréquence de « is ». On compare donc toujours la graphie à sa
        version en minuscules dans Tatoeba, qui compte les graphies exactes
        hors début de phrase : « in May » contre « you may », « London »
        contre rien du tout.
        """
        minuscule = mot.lower()
        exact = freq.exact[langue]
        if mot == minuscule:
            majuscules = [m for m in par_minuscules[minuscule] if m != mot]
            if not majuscules:
                return 1.0
            c_bas = exact.get(mot, 0)
            c_haut = sum(exact.get(m, 0) for m in majuscules)
            return (c_bas + 0.05) / (c_bas + c_haut + 0.1)
        c_haut = exact.get(mot, 0)
        c_bas = exact.get(minuscule, 0)
        if c_haut + c_bas == 0:
            # Rien dans Tatoeba : un sigle court est rarement le mot courant
            # que wordfreq compte sous ses minuscules.
            return 0.05 if mot.isupper() and len(mot) <= 4 else 1.0
        return (c_haut + 0.05) / (c_haut + c_bas + 0.1)

    propres = {}
    for mot in entrees:
        f = freq.mot(langue, mot) * part_de_casse(mot)
        # Une lettre seule n'est pas du vocabulaire de débutant, même si
        # wordfreq la compte partout — les élisions françaises (« l' »,
        # « d' ») la font passer pour le premier mot de la langue.
        if len(commun.cle(mot)) == 1 and mot not in MOTS_D_UNE_LETTRE[langue]:
            f *= 0.001
        propres[mot] = f

    resultat = Counter()
    for mot in entrees:
        total = propres[mot]
        for graphie in set(graphies.get(mot, ())):
            g = graphie.lower()
            if g == mot.lower():
                continue
            if len(proprietaires[g]) > 1:
                meilleur = max(proprietaires[g], key=lambda m: propres.get(m, 0.0))
                if meilleur != mot:
                    continue
            total += freq.mot(langue, graphie)
        if total <= 0:
            total = freq.emplois(langue, mot) / freq.total_tatoeba[langue] * 0.2
        if total > 0:
            resultat[mot] = total
    return resultat


def classer(entrees, frequences, importance):
    def rang(entree):
        mot = entree["mot"]
        if "·" in mot:
            return (1, 0.0, mot)
        f = frequences.get(mot, 0)
        if f > 0:
            return (0, -f, mot)
        return (1, -importance.get(commun.cle(mot), 0.0), mot)
    return sorted(entrees, key=rang)


# Les sens sexuels d'un mot courant — « take : to have sex with » — ne sont pas
# marqués crus par la source, et y arrivaient en deuxième position. Ils restent
# dans la fiche, en dernier.
SENS_SEXUEL = re.compile(
    r"\b(have sex|sexual intercourse|copulat|fornicat|to fuck|masturbat)|"
    r"\b(relations? sexuelles?|coït|copuler|forniquer|masturb)", re.IGNORECASE)


ECARTEES = RACINE / "traductions_ecartees.txt"


def ecarter_traductions(dictionnaires):
    """Retire les traductions que build/traductions_ecartees.txt désigne."""
    if not ECARTEES.exists():
        return 0
    retirees = 0
    for ligne in ECARTEES.read_text(encoding="utf-8").splitlines():
        ligne = ligne.split("#", 1)[0].rstrip()
        if not ligne.strip():
            continue
        morceaux = [m.strip() for m in ligne.split("\t")]
        if len(morceaux) not in (3, 4):
            raise SystemExit(f"traductions_ecartees.txt : trois ou quatre champs attendus — {ligne!r}")
        langue, mot, traduction = morceaux[:3]
        # Un quatrième champ, facultatif, vise un seul sens : un morceau de sa
        # définition. « couler » est juste pour « run » (un liquide), faux
        # pour « run » (courir).
        cible = morceaux[3].lower() if len(morceaux) == 4 else ""
        entree = dictionnaires.get(langue, {}).get(mot)
        if not entree:
            continue
        for lecture in entree["lectures"]:
            for bloc in lecture[4]:
                if cible and cible not in (bloc[0] or "").lower():
                    continue
                if traduction in bloc[1]:
                    bloc[1] = [t for t in bloc[1] if t != traduction]
                    retirees += 1
    return retirees


def reordonner_par_utilite(dictionnaires, positions):
    """Met en tête le sens et la traduction les plus utiles (voir Wortschatz :
    le premier sens du Wiktionnaire n'est pas toujours le plus courant)."""
    INFINI = 10 ** 9
    rangs = {}
    for langue in LANGUES:
        par_cle = {}
        for mot, place in positions[langue].items():
            k = commun.cle(mot)
            if place < par_cle.get(k, INFINI):
                par_cle[k] = place
        rangs[langue] = par_cle

    def rang_de(traduction, table):
        return table.get(commun.cle(traduction), INFINI)

    def rang_du_sens(sens, table):
        # Un sens vieilli, rare ou dialectal passe après les sens vivants,
        # quelle que soit la fréquence de sa traduction.
        penalite = INFINI // 2 if set(sens[3] if len(sens) > 3 else ()) & {
            "vx", "vieilli", "rare", "dial"} else 0
        return min((rang_de(t, table) for t in sens[1]), default=INFINI) + penalite

    def palier_du_sens(sens):
        """Ce qui fait descendre un sens, et rien d'autre.

        L'ordre des sens du Wiktionnaire est déjà celui de l'importance, pour
        l'anglais surtout. Classer les sens par la fréquence de leur traduction
        mettait en tête ceux dont la traduction est un mot passe-partout :
        « go » ouvrait sur « naviguer vers un dossier → faire », « get » sur
        « être ». On garde donc l'ordre de la source, et l'on ne fait descendre
        que ce qui doit l'être : un sens sans traduction, un sens vieilli, rare
        ou dialectal, un sens cru. Le tri est stable : à palier égal, l'ordre
        du Wiktionnaire tient.
        """
        codes = set(sens[3] if len(sens) > 3 else ())
        if codes & marques.CRUS or SENS_SEXUEL.search(sens[0] or ""):
            return 3
        if codes & {"vx", "vieilli", "rare", "dial"}:
            return 2
        if not sens[1] or not (sens[0] or "").strip():
            return 1
        return 0

    deplaces = 0
    for langue in LANGUES:
        autre = rangs[commun.AUTRE[langue]]
        for entree in dictionnaires[langue].values():
            if entree.get("expression") == expressions.SOURCE_EDITORIALE:
                continue
            avant = premiere_traduction(entree)
            # Le rang de chaque sens dans le Wiktionnaire (voir alignement.py) :
            # un sens apparié se range à la place que le Wiktionnaire lui donne,
            # un sens sans pendant vient après, dans l'ordre de WikDict.
            rangs_sens = entree.pop("_rang_sens", {})
            for lecture in entree["lectures"]:
                for bloc in lecture[4]:
                    bloc[1].sort(key=lambda t: rang_de(t, autre))
                lecture[4].sort(key=lambda s: (palier_du_sens(s), rangs_sens.get(id(s), 1000)))
            # Les lectures suivent l'ordre du Wiktionnaire, qui range les
            # natures par importance ; celui de WikDict ouvrait « go » sur le
            # jeu de go et « maison » sur l'adjectif. Une lecture sans entrée
            # du Wiktionnaire vient après, rangée par la fréquence de sa
            # traduction ; une lecture sans aucun sens de premier palier
            # recule en tout cas.
            rangs_source = entree.pop("_rang_source", {})
            entree["lectures"].sort(key=lambda l: (
                min((palier_du_sens(s) for s in l[4]), default=3),
                rangs_source.get(id(l), 50),
                min((rang_du_sens(s, autre) for s in l[4]), default=INFINI)))
            if premiere_traduction(entree) != avant:
                deplaces += 1
    return deplaces


def premiere_traduction(entree):
    for lecture in entree["lectures"]:
        for bloc in lecture[4]:
            if bloc[1]:
                return bloc[1][0]
    return ""


def bande(position):
    for numero, borne in enumerate(BANDES):
        if position < borne:
            return numero
    return len(BANDES)


# --- L'anglais britannique --------------------------------------------------

def orthographe_britannique(dictionnaires, variantes, index_formes, index_graphies, journal):
    """Met l'orthographe britannique en vedette, garde l'américaine en renvoi.

    `variantes` : {graphie britannique: ("gb", graphie américaine)}. Quand la
    vedette américaine porte le contenu et que la britannique n'est qu'un
    renvoi (ou manque), on déplace l'entrée sous la graphie britannique, on
    note « us », et la graphie américaine devient une forme qui y mène.

    Les traductions françaises suivent : « couleur » se traduit par « colour »,
    et « color » ne reste qu'en variante. Rend la table américaine →
    britannique, mot à mot, pour les traductions.
    """
    anglais = dictionnaires["en"]
    carte = {}
    cles_us_gb = {}
    deplacees = fusionnees = 0
    # Garde-fou : une vraie graphie britannique est à peu près aussi courante
    # que l'américaine (colour/color, centre/center). Une graphie bien plus
    # rare est une prononciation notée (« dat » pour that, « ould » pour old) :
    # la mettre en vedette ferait disparaître le mot courant.
    try:
        from wordfreq import zipf_frequency
    except ImportError:
        zipf_frequency = None
    ecartees = []
    # Le Wiktionnaire note parfois la paire à l'envers (« civilize » → civilise) :
    # on retient toute graphie qui figure dans une paire, dans un sens ou l'autre.
    graphies_en_paire = ({commun.cle(g) for g in variantes}
                         | {commun.cle(g) for _, g in variantes.values()})
    for britannique, (sens, americaine) in variantes.items():
        if sens != "gb" or britannique == americaine:
            continue
        if americaine not in anglais:
            continue
        # Le garde-fou ne vaut que pour un mot courant : entre deux mots rares
        # (atomize, canonise), l'écart de fréquence ne dit rien.
        if zipf_frequency and zipf_frequency(americaine, "en") >= ZIPF_GB_COURANT and (
                zipf_frequency(americaine, "en")
                - zipf_frequency(britannique, "en")) > ECART_DE_FREQUENCE_GB:
            ecartees.append(britannique)
            continue
        # « tanks » est le pluriel de tank, pas une graphie de thanks ; mais
        # « counselling » et « counseling » mènent tous deux à counsel, et
        # « civilised » mène à civilise, elle-même une graphie en paire.
        cle_us = commun.cle(americaine)
        famille_us = index_formes.get(cle_us, set()) | {cle_us}
        autres_lemmes = {l for l in index_formes.get(commun.cle(britannique), set()) - famille_us
                         if l not in graphies_en_paire}
        if autres_lemmes and britannique not in anglais:
            ecartees.append(britannique)
            continue
        carte[americaine] = britannique
        entree_us = anglais[americaine]
        if britannique in anglais:
            # Les deux existent : on garde la britannique comme vedette et on
            # lui verse les lectures américaines qu'elle n'a pas.
            entree_gb = anglais[britannique]
            if not any(bloc[1] for l in entree_gb["lectures"] for bloc in l[4]):
                entree_gb["lectures"] = entree_us["lectures"]
            for champ in ("apparentes",):
                if entree_us.get(champ):
                    entree_gb.setdefault(champ, []).extend(entree_us[champ])
            entree_gb["us"] = americaine
            del anglais[americaine]
            fusionnees += 1
        else:
            entree_us["mot"] = britannique
            entree_us["us"] = americaine
            anglais[britannique] = entree_us
            del anglais[americaine]
            deplacees += 1
        cle_gb, cle_us = commun.cle(britannique), commun.cle(americaine)
        cles_us_gb[cle_us] = cle_gb
        index_formes.setdefault(cle_us, set()).add(cle_gb)
        # Les formes fléchies américaines (colors, colored) mènent aussi à la
        # vedette britannique.
        for graphie in index_graphies.pop(americaine, set()):
            index_graphies.setdefault(britannique, set()).add(graphie)
            k = commun.cle(graphie)
            if k != cle_gb:
                index_formes.setdefault(k, set()).add(cle_gb)

    # Une forme qui menait au lemme américain mène désormais au britannique :
    # une seule traversée de l'index, pas une par variante.
    for k, lemmes in index_formes.items():
        touches = lemmes & cles_us_gb.keys()
        if touches:
            for cle_us in touches:
                if k != cle_us:
                    lemmes.discard(cle_us)
                lemmes.add(cles_us_gb[cle_us])

    # Les traductions anglaises des entrées françaises, mot à mot.
    remplacees = 0
    for entree in dictionnaires["fr"].values():
        for lecture in entree["lectures"]:
            for bloc in lecture[4]:
                nouvelles = []
                for t in bloc[1]:
                    morceaux = t.split(" ")
                    changes = [carte.get(m, m) for m in morceaux]
                    t2 = " ".join(changes)
                    if t2 != t:
                        remplacees += 1
                    if t2 not in nouvelles:
                        nouvelles.append(t2)
                bloc[1] = nouvelles
    journal.update({"deplacees": deplacees, "fusionnees": fusionnees,
                    "traductions": remplacees, "ecartees": ecartees})
    return carte


# --- Mots crus ---------------------------------------------------------------

def marquer_crus(dictionnaires, journal):
    """Pose `cru` sur les entrées dont tous les sens sont crus, et range en fin
    de liste les traductions qui sont des mots crus de l'autre langue.

    L'application masque les mots crus tant qu'on ne demande pas à les voir.
    Un sens cru disparaît avec eux ; une traduction crue d'un sens qui ne
    l'est pas (« knackered » → *avoir la tête dans le cul*) disparaît seule —
    d'où le compte `crues` porté par le sens : les N dernières traductions.
    """
    crus = {}
    for langue in LANGUES:
        ensemble = set()
        for mot, entree in dictionnaires[langue].items():
            blocs = [b for l in entree["lectures"] for b in l[4]]
            if blocs and all(marques.est_cru(b[3] if len(b) > 3 else ()) for b in blocs):
                entree["cru"] = True
                ensemble.add(commun.cle(mot))
        crus[langue] = ensemble
    deplacees = 0
    for langue in LANGUES:
        autre = crus[commun.AUTRE[langue]]
        for entree in dictionnaires[langue].values():
            for lecture in entree["lectures"]:
                for bloc in lecture[4]:
                    while len(bloc) < 5:
                        bloc.append([] if len(bloc) == 3 else 0)
                    propres, crues = [], []
                    for t in bloc[1]:
                        k = commun.cle(t)
                        if k in autre or any(m in autre for m in k.split(" ") if len(m) > 2):
                            crues.append(t)
                        else:
                            propres.append(t)
                    bloc[1] = propres + crues
                    bloc[4] = len(crues)
                    deplacees += len(crues)
    journal.update({"entrees_crues_en": len(crus["en"]), "entrees_crues_fr": len(crus["fr"]),
                    "traductions_crues": deplacees})


# --- Écriture des paquets ----------------------------------------------------

def apercu(entree):
    vues = []
    for lecture in entree["lectures"]:
        for bloc in lecture[4]:
            n = len(bloc[1]) - (bloc[4] if len(bloc) > 4 else 0)
            for traduction in bloc[1][:max(n, 0)]:
                if traduction not in vues:
                    vues.append(traduction)
                if len(vues) >= 3:
                    break
            if len(vues) >= 3:
                break
        if len(vues) >= 3:
            break
    texte = ", ".join(vues)
    return texte if len(texte) <= 60 else texte[:59] + "…"


def ecrire_formes(chemin, formes):
    """Index forme fléchie → lemme, en codage suffixe (voir Wortschatz)."""
    lignes = []
    for forme in sorted(formes):
        codes = []
        candidats = sorted(formes[forme], key=lambda l: (l.count(" "), len(l), l))
        for lemme in candidats[:3]:
            partage = 0
            while (partage < len(forme) and partage < len(lemme)
                   and forme[partage] == lemme[partage]):
                partage += 1
            if partage < 3:
                partage = 0
            codes.append(f"{partage},{lemme[partage:]}")
        lignes.append(forme + "\t" + "|".join(codes))
    texte = "\n".join(lignes) + "\n"
    ecrire(chemin, texte)
    return texte


def formes_restreintes(formes, selection):
    """Les formes dont le lemme est une vedette du paquet.

    Vaut pour le complet comme pour le noyau : une forme qui renvoie à une
    vedette absente ne mène nulle part. Les « formes » qui sont des restes de
    la source — une prononciation « \\ti.tjɛ\\ » glissée dans le champ, une
    étiquette « (rare) », un « *69ed » — sont écartées au passage.
    """
    cibles = {commun.cle(e["mot"]) for e in selection}
    sortie = {}
    for cle_forme, cles_lemmes in formes.items():
        if not cle_forme or cle_forme[0] in "*-'" or any(c in cle_forme for c in "\\()[]{}\t"):
            continue
        gardees = {c for c in cles_lemmes if c in cibles}
        if gardees:
            sortie[cle_forme] = gardees
    return sortie


def ecrire_vivier(dossier, vivier):
    fichiers, octets = [], 0
    for depart in range(0, len(vivier), ENTREES_PAR_TRANCHE):
        indice = depart // ENTREES_PAR_TRANCHE
        texte = json.dumps({"p": vivier[depart:depart + ENTREES_PAR_TRANCHE]},
                           ensure_ascii=False, separators=(",", ":"))
        ecrire(dossier / f"phrases-{indice:03d}.json", texte)
        octets += len(texte.encode("utf-8"))
        fichiers.append(f"phrases-{indice:03d}.json")
    return fichiers, octets


SANS_PHRASES = {"sens": {}, "libres": []}


# Les exemples anglais repris à la main — traduits, remplacés quand ils
# étaient anciens, ajoutés aux sens qui n'en avaient pas (voir citations.py).
# Chargés une fois par main().
EXEMPLES_REPRIS = {}


def entree_ecrite(entree, rang_de_bande, attribution, voisins, citations_max, langue):
    """Une entrée dans sa forme définitive. Le rang du sens dans la liste
    aplatie fait le lien avec `phrases.attribuer_aux_sens` : les deux
    parcourent les lectures puis les sens dans le même ordre."""
    par_sens = attribution["sens"]
    lectures = []
    rang = 0
    for lecture in entree["lectures"]:
        sens = []
        for bloc in lecture[4]:
            citations = bloc[2][:citations_max] if len(bloc) > 2 else []
            if langue == "en":
                citations = citations_traduites.reprendre(
                    entree["mot"], bloc[0], citations, bool(par_sens.get(rang)), EXEMPLES_REPRIS)
            codes = list(bloc[3]) if len(bloc) > 3 else []
            crues = bloc[4] if len(bloc) > 4 else 0
            ecrit = [bloc[0], bloc[1], citations, par_sens.get(rang, []), codes]
            if crues:
                ecrit.append(crues)
            sens.append(ecrit)
            rang += 1
        lectures.append([lecture[0], lecture[1], lecture[2], lecture[3], sens,
                         lecture[5] if len(lecture) > 5 else [],
                         lecture[6] if len(lecture) > 6 else []])

    ecrite = [entree["mot"], rang_de_bande, lectures, attribution["libres"], voisins]
    infos = {}
    if entree.get("expression"):
        infos["e"] = entree["expression"]
        if entree.get("explication"):
            infos["x"] = entree["explication"]
    if entree.get("us"):
        infos["us"] = entree["us"]
    if entree.get("cru"):
        infos["cru"] = 1
    if entree.get("croisee"):
        infos["gl"] = 1
    if infos:
        ecrite.append(infos)
    return ecrite


def drapeaux(entree):
    """Le sixième champ de l'index : ce que la liste de résultats doit savoir
    sans ouvrir la tranche. `c` : mot cru ; `x` : expression usuelle."""
    d = ""
    if entree.get("cru"):
        d += "c"
    if entree.get("expression"):
        d += "x"
    return d


def ecrire_paquet(dossier, langue, selection, positions, phrases_, voisins,
                  citations_max, formes=None):
    dossier.mkdir(parents=True, exist_ok=True)
    triees = sorted(selection, key=lambda e: (commun.cle(e["mot"]), e["mot"]))

    lignes, octets = [], 0
    for depart in range(0, len(triees), ENTREES_PAR_TRANCHE):
        tranche = triees[depart:depart + ENTREES_PAR_TRANCHE]
        indice = depart // ENTREES_PAR_TRANCHE
        contenu = {
            "l": langue,
            "e": [entree_ecrite(e, bande(positions[e["mot"]]),
                                phrases_.get(e["mot"], SANS_PHRASES),
                                voisins.get(e["mot"], []), citations_max, langue)
                  for e in tranche],
        }
        texte = json.dumps(contenu, ensure_ascii=False, separators=(",", ":"))
        ecrire(dossier / f"{langue}-{indice:03d}.json", texte)
        octets += len(texte.encode("utf-8"))
        for entree in tranche:
            lignes.append("\t".join((
                commun.cle(entree["mot"]), entree["mot"], str(indice),
                str(bande(positions[entree["mot"]])), apercu(entree), drapeaux(entree))))

    texte_index = "\n".join(lignes) + "\n"
    ecrire(dossier / f"{langue}.idx", texte_index)
    octets += len(texte_index.encode("utf-8"))

    nb_tranches = (len(triees) + ENTREES_PAR_TRANCHE - 1) // ENTREES_PAR_TRANCHE
    fichiers = [f"{langue}.idx"] + [f"{langue}-{i:03d}.json" for i in range(nb_tranches)]

    if formes is not None:
        texte_formes = ecrire_formes(dossier / f"formes-{langue}.idx", formes)
        octets += len(texte_formes.encode("utf-8"))
        fichiers.append(f"formes-{langue}.idx")

    return fichiers, octets, len(triees)


def noyau_force():
    """Les vedettes que les modules exigent dans le noyau (`build/modules.py`
    les écrit) : un mot d'argot du module doit s'ouvrir hors ligne dès
    l'installation, même s'il n'est pas parmi les plus fréquents."""
    chemin = RACINE / "noyau_force.txt"
    force = {l: set() for l in LANGUES}
    if chemin.exists():
        for ligne in chemin.read_text(encoding="utf-8").splitlines():
            if ":" in ligne:
                langue, mot = ligne.split(":", 1)
                if langue in force:
                    force[langue].add(commun.cle(mot.strip()))
    return force


# --- Enchaînement ------------------------------------------------------------


def empreinte_des_paquets():
    """Une empreinte du contenu des paquets écrits : chemins et octets.

    Elle entre dans le nom de la mouture — et donc dans celui du cache où
    l'appareil range le paquet complet. La date seule ne suffisait pas : deux
    constructions le même jour auraient partagé un nom de cache, et un appareil
    aurait gardé les fichiers de la première en croyant avoir la seconde.
    """
    h = hashlib.sha256()
    for dossier in ("noyau", "complet"):
        for fichier in sorted((DATA / dossier).rglob("*")):
            if fichier.is_file():
                h.update(fichier.relative_to(DATA).as_posix().encode("utf-8") + b"\0")
                h.update(fichier.read_bytes())
    return h.hexdigest()[:10]

def main():
    analyseur = argparse.ArgumentParser(description="Construction des paquets Vocabulary")
    analyseur.add_argument("--sans-budget", action="store_true",
                           help="construire même si les budgets de taille sont dépassés")
    options = analyseur.parse_args()

    debut = time.time()
    if not (SOURCES / "eng-fra.tei").exists():
        raise SystemExit("Sources absentes. Lance d'abord : python build/telecharger.py")

    EXEMPLES_REPRIS.update(citations_traduites.charger())
    print(f"Exemples anglais repris à la main : {len(EXEMPLES_REPRIS)}\n")

    print("Lecture des dictionnaires TEI")
    dictionnaires, index_formes, index_graphies, moutures = {}, {}, {}, {}
    for langue, fichier in (("en", "eng-fra.tei"), ("fr", "fra-eng.tei")):
        mouture, _extent = tei.entete(SOURCES / fichier)
        moutures[langue] = mouture
        entrees, formes, graphies = charger_dictionnaire(SOURCES / fichier)
        dictionnaires[langue] = entrees
        index_formes[langue] = formes
        index_graphies[langue] = graphies
        print(f"  {langue} : {len(entrees)} vedettes, {len(formes)} formes fléchies "
              f"({fichier}, mouture {mouture})")

    journal_grammaire = {}
    grammaire.ajouter(dictionnaires, journal_grammaire)
    if journal_grammaire["ajoutees"]:
        print(f"  + {len(journal_grammaire['ajoutees'])} entrées grammaticales "
              f"écrites pour l'application : {', '.join(journal_grammaire['ajoutees'])}")

    print("\nGreffe du Wiktionnaire — définitions, exemples, marques, traductions")
    gain = {}
    extraits = {}
    for langue in LANGUES:
        par_mot = wiktionnaire.charger(langue)
        extraits[langue] = par_mot
        avant = len(dictionnaires[langue])
        journal_wikt = {}
        depuis = len(alignement.DEPLACEMENTS)
        for mot, entree in dictionnaires[langue].items():
            alignement.enrichir(entree, par_mot.get(mot, []), journal_wikt)
            elaguer_citations(entree)
        print(f"  {langue} : {journal_wikt.get('deplacees', 0)} traductions remises sous leur sens, "
              f"{journal_wikt.get('retirees', 0)} retirées d'un sens qu'elles ne servaient pas")
        # Le journal à relire : build/traductions-deplacees.tsv.
        with open(RACINE / "traductions-deplacees.tsv", "a" if depuis else "w",
                  encoding="utf-8", newline="") as sortie:
            if not depuis:
                sortie.write("\t".join(["langue", "vedette", "sens d'origine", "traduction",
                                        "sens d'arrivée"]) + "\n")
            for vedette, origine, traduction, arrivee in alignement.DEPLACEMENTS[depuis:]:
                sortie.write("\t".join([langue, vedette, origine[:90], traduction,
                                        arrivee[:90] or "(retirée)"]) + "\n")
        part = 100 * journal_wikt["avec_exemple"] / max(journal_wikt["sens"], 1)
        print(f"  {langue} : {journal_wikt['apparies']} sens sur "
              f"{journal_wikt['sens']} appariés, {journal_wikt['avec_exemple']} "
              f"avec citation ({part:.1f} %)")
        print(f"       {journal_wikt['sens_ajoutes']} sens ajoutés, "
              f"{journal_wikt['traduits']} sens traduits par le Wiktionnaire là où "
              f"WikDict ne connaissait rien")
        journal_neuves = {}
        traductions.ajouter(dictionnaires, index_formes[langue],
                            index_graphies[langue], langue, par_mot, journal_neuves)
        print(f"       + {journal_neuves['ajoutees']} vedettes neuves traduites "
              f"({journal_neuves['examinees']} examinées)")
        # Toutes les formes fléchies que le Wiktionnaire connaît mènent à leur
        # vedette : « went » → go, « mice » → mouse, « yeux » → œil.
        for mot, enregistrements in par_mot.items():
            if mot not in dictionnaires[langue]:
                continue
            cle_lemme = commun.cle(mot)
            for e in enregistrements:
                for graphie in list(e.get("fl", ())) + [f[1] for f in e.get("f", ())]:
                    k = commun.cle(graphie)
                    if k and " " not in k and k != cle_lemme:
                        index_formes[langue].setdefault(k, set()).add(cle_lemme)
                    if graphie and " " not in graphie:
                        index_graphies[langue].setdefault(mot, set()).add(graphie)
        gain[langue] = {
            "wikdict": avant,
            "neuves": journal_neuves["ajoutees"],
            "sens_traduits": journal_wikt["traduits"] + journal_wikt["sens_ajoutes_traduits"],
            "sens_sans_traduction": journal_wikt["sens_sans_traduction"],
        }

    print("\nL'orthographe britannique en vedette")
    journal_gb = {}
    carte_us_gb = orthographe_britannique(dictionnaires, wiktionnaire.charger_variantes(),
                                          index_formes["en"], index_graphies["en"], journal_gb)
    print(f"  {journal_gb['deplacees']} vedettes passées sous leur graphie britannique, "
          f"{journal_gb['fusionnees']} fusionnées, {journal_gb['traductions']} traductions "
          f"françaises mises à l'anglais britannique")
    if journal_gb["ecartees"]:
        print(f"  {len(journal_gb['ecartees'])} graphies écartées, bien plus rares que "
              f"la vedette : {', '.join(sorted(journal_gb['ecartees']))}")

    print("\nLecture du corpus Tatoeba")
    paires_alignees, anglaises, francaises = corpus.paires()
    textes = {"en": list(anglaises.values()), "fr": list(francaises.values())}
    print(f"  {len(anglaises)} phrases anglaises, {len(francaises)} françaises, "
          f"{len(paires_alignees)} paires")

    print("\nFréquences d'usage (wordfreq + Tatoeba)")
    freq = Frequences(textes)

    print("\nGloses croisées — ce que chaque édition dit de l'autre langue")
    croises = {"en": wiktionnaire.charger_croises("fr"),
               "fr": wiktionnaire.charger_croises("en")}
    journal_croisees = {}
    croisees.completer(dictionnaires, croises, freq.couple, journal_croisees, index_formes)
    print(f"  {journal_croisees['traduites']} vedettes sans traduction traduites, "
          f"{journal_croisees['creees']} vedettes courantes créées ; écartées : "
          f"{journal_croisees['ecartees_rares']} trop rares, "
          f"{journal_croisees['ecartees_formes']} formes fléchies, "
          f"{journal_croisees['ecartees_courtes']} trop courtes, "
          f"{journal_croisees['ecartees_autre_langue']} de l'autre langue")
    for langue, mot, eq in journal_croisees["exemples"][:10]:
        print(f"       {langue} {mot} → {' / '.join(eq)}")
    # La liste entière, à relire : c'est la source la moins sûre du paquet.
    ecrire(RACINE / "croisees-creees.tsv",
           "".join("\t".join(ligne) + "\n" for ligne in journal_croisees["toutes"]))

    print("\nExpressions usuelles")
    journal_expr = {}
    expressions.marquer(dictionnaires, journal_expr)
    print(f"  {journal_expr['dictionnaire_en']} anglaises et "
          f"{journal_expr['dictionnaire_fr']} françaises reconnues dans le dictionnaire")
    attestations = expressions.charger_attestations_en(croises["fr"])
    expressions.ajouter_formules(dictionnaires, extraits, croises, attestations,
                                 paires_alignees, journal_expr)
    supplement = expressions.charger_supplement()
    editoriaux = {"en": {}, "fr": {}}
    for langue, mot, en, fr in expressions.appliquer_supplement(
            dictionnaires, supplement, journal_expr):
        paires_alignees.append((en, fr))
        editoriaux[langue].setdefault(mot, []).append((1000, len(paires_alignees) - 1))
    print(f"  {journal_expr['editoriales_creees']} créées et "
          f"{journal_expr['editoriales_corrigees']} corrigées par le supplément éditorial")
    reperees = expressions.reperer_dans_le_corpus(
        {langue: [commun.cle(e["mot"]) for e in dictionnaires[langue].values()
                  if e.get("expression")] for langue in LANGUES},
        paires_alignees)
    supplements = {}
    for langue in LANGUES:
        par_cle = {}
        for e in dictionnaires[langue].values():
            if e.get("expression"):
                par_cle.setdefault(commun.cle(e["mot"]), []).append(e["mot"])
        supplements[langue] = {}
        for k, lot in reperees[langue].items():
            for mot in par_cle.get(k, ()):
                supplements[langue][mot] = lot[:expressions.EXEMPLES_PAR_EXPRESSION * 2]
        for mot, lot in editoriaux[langue].items():
            supplements[langue][mot] = lot + supplements[langue].get(mot, [])
    for entree in list(dictionnaires["en"].values()) + list(dictionnaires["fr"].values()):
        if entree.get("neuve") and entree.get("expression"):
            elaguer_citations(entree)
        # Toute entrée a désormais ses sens au format [déf, trad, cit, marques].
        for lecture in entree["lectures"]:
            while len(lecture) < 7:
                lecture.append([])
            for bloc in lecture[4]:
                while len(bloc) < 4:
                    bloc.append([])
    print(f"  + {journal_expr['ajoutees_en']} anglaises et "
          f"{journal_expr['ajoutees_fr']} françaises attestées par un Wiktionnaire, "
          f"dont {journal_expr['tatoeba']} traduites par Tatoeba, "
          f"{journal_expr['croisee']} glosées par l'édition d'en face, "
          f"{journal_expr['sans_equivalent']} sans équivalent connu")

    print("\nFormes fléchies du français")
    journal = {}
    par_cle_fr, _ = corpus.compter_deux(francaises.values(), "fr")
    reconstituees = formes_fr.construire(dictionnaires["fr"], par_cle_fr, journal)
    for cle_forme, cles_lemmes in reconstituees.items():
        index_formes["fr"].setdefault(cle_forme, set()).update(cles_lemmes)
    print(f"  {journal['base']} de la base WikDict, {journal['irreguliers']} verbes "
          f"irréguliers, {journal['regles']} par règle")
    for langue in LANGUES:
        print(f"  index {langue} : {len(index_formes[langue])} formes au total")

    print("\nNoms propres : ne garder que les courants")
    for langue in LANGUES:
        retires = 0
        for mot in list(dictionnaires[langue]):
            entree = dictionnaires[langue][mot]
            natures = {l[0] for l in entree["lectures"]}
            if natures == {"pn"} and freq.zipf(langue, mot) < ZIPF_NOM_PROPRE:
                del dictionnaires[langue][mot]
                retires += 1
        print(f"  {langue} : {retires} noms propres rares retirés")

    print("\nClassement du vocabulaire")
    ordres, positions = {}, {}
    for langue, base in (("en", "en-fr.sqlite3"), ("fr", "fr-en.sqlite3")):
        importance = charger_importance(base)
        frequences = frequences_entrees(freq, dictionnaires[langue], index_graphies[langue], langue)
        ordre = classer(dictionnaires[langue].values(), frequences, importance)
        ordres[langue] = ordre
        positions[langue] = {e["mot"]: i for i, e in enumerate(ordre)}
        attestes = sum(1 for e in ordre if frequences.get(e["mot"], 0) > 0)
        print(f"  {langue} : {attestes} mots attestés, "
              f"{len(ordre) - attestes} classés par le score WikDict")
        print(f"       tête de liste : {', '.join(e['mot'] for e in ordre[:24])}")

    ecartees = ecarter_traductions(dictionnaires)
    if ecartees:
        print(f"  {ecartees} traductions écartées à la main (traductions_ecartees.txt)")
    deplaces = reordonner_par_utilite(dictionnaires, positions)
    print(f"  {deplaces} entrées dont le sens de tête a changé après reclassement")

    # Après le reclassement, qui trie les traductions : les crues doivent
    # rester en fin de liste, c'est ce que leur compte désigne.
    print("\nMots crus")
    journal_crus = {}
    marquer_crus(dictionnaires, journal_crus)
    print(f"  {journal_crus['entrees_crues_en']} entrées anglaises et "
          f"{journal_crus['entrees_crues_fr']} françaises entièrement crues ; "
          f"{journal_crus['traductions_crues']} traductions crues rangées en fin de liste")

    print("\nFamilles de mots")
    journal_familles = {}
    voisinages = familles.construire(dictionnaires, positions, journal_familles)
    print(f"  {journal_familles['wiktionnaire']} liens tirés du Wiktionnaire, "
          f"{journal_familles['derivation']} par dérivation "
          f"({journal_familles['ecartes']} écartés faute de sens commun)")
    print(f"  {journal_familles['mots_en']} mots anglais et "
          f"{journal_familles['mots_fr']} mots français ont une famille")

    print("\nChoix des phrases d'exemple")
    journal_phrases = {}
    vivier_complet, attributions_completes = phrases.choisir(
        paires_alignees, dictionnaires, index_formes, ordres, journal_phrases,
        supplements=supplements)
    print(f"  {journal_phrases['paires']} paires examinées, "
          f"{journal_phrases['vivier']} retenues")
    journal_repartition = {}
    attributions_completes = phrases.attribuer_aux_sens(
        vivier_complet, attributions_completes, dictionnaires, index_formes,
        journal_repartition)
    rangees = journal_repartition["rangees"]
    total_phrases = max(journal_repartition["phrases"], 1)
    print(f"  {rangees} rattachées à une signification précise "
          f"({100 * rangees / total_phrases:.0f} %), "
          f"{journal_repartition['libres']} gardées au niveau du mot")

    if DATA.exists():
        for dossier in ("noyau", "complet"):
            if (DATA / dossier).exists():
                shutil.rmtree(DATA / dossier)
    DATA.mkdir(parents=True, exist_ok=True)

    manifeste = {
        # La version du **format** des données, qui nomme le cache du paquet
        # complet. Elle change quand des fichiers gardent leur nom mais plus
        # leur contenu.
        "version": 1,
        "construit": time.strftime("%Y-%m-%d"),
        "moutures": moutures,
        "moutures_wiktionnaire": wiktionnaire.moutures(),
        "bandes": NOMS_BANDES,
        "gain": gain,
        "paquets": {},
    }

    force = noyau_force()
    print("\nÉcriture des paquets")
    for nom, borne, budget, citations_max in (
        ("noyau", TAILLE_NOYAU, BUDGET_NOYAU, CITATIONS_NOYAU),
        ("complet", None, BUDGET_COMPLET, CITATIONS_PAR_SENS),
    ):
        dossier = DATA / nom
        selections = {}
        for langue in LANGUES:
            if borne is None:
                selections[langue] = ordres[langue]
                continue
            base = ordres[langue][:borne]
            cles_du_noyau = {commun.cle(e["mot"]) for e in base}
            en_plus = [e for e in ordres[langue][borne:]
                       if expressions.va_au_noyau(e, cles_du_noyau)
                       or commun.cle(e["mot"]) in force[langue]]
            selections[langue] = base + en_plus
        vivier, attributions = phrases.sous_ensemble(
            vivier_complet, attributions_completes,
            [e["mot"] for e in selections["en"]],
            [e["mot"] for e in selections["fr"]])

        fichiers, octets, comptes, traduites = [], 0, {}, {}
        for langue in LANGUES:
            traduites[langue] = sum(
                1 for e in selections[langue]
                if any(bloc[1] for lecture in e["lectures"] for bloc in lecture[4]))
            formes = formes_restreintes(index_formes[langue], selections[langue])
            presents = {e["mot"] for e in selections[langue]}
            voisins = {
                mot: [v for v in liste_voisins if v in presents]
                for mot, liste_voisins in voisinages.get(langue, {}).items()
                if mot in presents
            }
            liste, poids, nombre = ecrire_paquet(
                dossier, langue, selections[langue], positions[langue],
                attributions[langue], voisins, citations_max, formes=formes,
            )
            fichiers += [f"{nom}/{x}" for x in liste]
            octets += poids
            comptes[langue] = nombre

        liste, poids = ecrire_vivier(dossier, vivier)
        fichiers += [f"{nom}/{x}" for x in liste]
        octets += poids

        index_expr = expressions.index_des_mots(selections, positions)
        nb_expressions, sans_equivalent = {}, {}
        for langue in LANGUES:
            nb_mots, poids = expressions.ecrire_index(
                dossier / f"expressions-{langue}.idx", index_expr[langue], ecrire)
            fichiers.append(f"{nom}/expressions-{langue}.idx")
            octets += poids
            nb_expressions[langue] = sum(1 for e in selections[langue] if e.get("expression"))
            sans_equivalent[langue] = sum(
                1 for e in selections[langue]
                if e.get("expression") and not expressions.est_traduite(e))

        manifeste["paquets"][nom] = {
            "entrees": comptes,
            "traduites": traduites,
            "expressions": nb_expressions,
            "expressions_traduites": {l: nb_expressions[l] - sans_equivalent[l] for l in LANGUES},
            "expressions_sans_equivalent": sans_equivalent,
            "phrases": len(vivier),
            "octets": octets,
            "fichiers": fichiers,
        }
        etat = "ok" if octets <= budget else "DÉPASSEMENT"
        print(f"  {nom:8} {comptes['en']:6d} en + {comptes['fr']:6d} fr  "
              f"({traduites['en'] + traduites['fr']} traduites)  "
              f"{commun.humain(octets):>9}  (budget {commun.humain(budget)}) {etat}")
        if octets > budget and not options.sans_budget:
            raise SystemExit(
                f"\nLe paquet « {nom} » dépasse son budget de "
                f"{commun.humain(octets - budget)}.")

    # La mouture nomme le cache du paquet complet : date et empreinte du
    # contenu, pour que deux constructions ne se confondent jamais.
    manifeste["mouture"] = f"{manifeste['construit']}-{empreinte_des_paquets()}"
    ecrire(DATA / "manifeste.json", json.dumps(manifeste, ensure_ascii=False, indent=2) + "\n")

    fichiers = [f for f in (DATA / "noyau").rglob("*") if f.is_file()] + \
               [f for f in (DATA / "complet").rglob("*") if f.is_file()]
    total = sum(f.stat().st_size for f in fichiers)
    print(f"\ndata/ : {commun.humain(total)} en {len(fichiers)} fichiers"
          f" — {time.time() - debut:.0f} s")


if __name__ == "__main__":
    main()
