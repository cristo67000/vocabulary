#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Les expressions usuelles : les reconnaître, les compléter, les indexer.

── Ce qu'on appelle une expression usuelle ─────────────────────────────────

Une suite de mots qu'on apprend comme un tout : une locution (« à petit feu »),
une tournure (« die Nase voll haben »), une formule de conversation (« kein
Problem »), un proverbe. Pas un nom composé — « base de données », « Republik
Kuba », « ancolie commune » sont des mots à plusieurs morceaux, et ils ont leur
fiche comme les autres, mais on ne les range pas ici : chercher « commune » ne
doit pas répondre par cent plantes.

── Trois sources, dans cet ordre de confiance ─────────────────────────────

1. **Le dictionnaire lui-même.** WikDict et le Wiktionnaire portent déjà des
   milliers d'expressions traduites, mêlées aux mots. On les reconnaît à leur
   nature : verbe, adverbe, adjectif, interjection, locution, ou rien du tout —
   DBnary laisse les tournures anglaises sans nature. Les noms et les noms
   propres sont écartés.

2. **Une attestation lexicale, un équivalent de Tatoeba.** Une formule comme
   « kein Problem » n'a de traduction dans aucune table du Wiktionnaire, mais
   trois éditions du Wiktionnaire la décrivent comme une expression, et Tatoeba
   la porte en phrase complète, traduite par des locuteurs. On accepte donc une
   expression **attestée par un Wiktionnaire** dont Tatoeba donne l'équivalent
   — jamais une phrase de Tatoeba seule, qui n'est qu'une phrase.

3. **L'édition d'en face.** Le Wiktionnaire français décrit « keine Ahnung » en
   français : « Aucune idée. » Une glose aussi courte est un équivalent ; une
   glose longue est une explication, et on la garde pour ce qu'elle est.

Ce qui n'a ni traduction ni équivalent attesté n'est pas inventé. L'expression
entre tout de même quand un Wiktionnaire l'atteste, avec sa définition et, s'il
s'en trouve, un exemple de Tatoeba — mais sa fiche dit qu'aucun équivalent
n'est connu, et le manifeste la compte à part.

── L'index des mots ───────────────────────────────────────────────────────

L'index des vedettes est trié par clé entière : « feu » n'y trouve pas « à petit
feu ». On écrit donc, par langue, un second index — un mot, puis les expressions
qui le contiennent, dans leur vedette ou dans leurs traductions :

    feu ⇥ fr:a petit feu|fr:mettre le feu aux poudres|…

Il se lit comme les autres, par dichotomie sur le préfixe du mot. Les mots très
fréquents — « de », « à », « der » — auraient des listes démesurées : on les
plafonne, les expressions les plus courantes d'abord.
"""

import io
import json
import re
from collections import defaultdict
from pathlib import Path

import commun
import corpus

# Les natures qui, sur une vedette à plusieurs mots, signalent une expression.
# Le vide en fait partie : c'est ainsi que WikDict livre les tournures
# anglaises (« die Nase voll haben »), sans nature.
NATURES_D_EXPRESSION = {"", "v", "adj", "adv", "Adverb", "locution", "interjection",
                        "preposition", "conjunction", "particle", "numeral",
                        "phraseologicalUnit", "proverb"}

# Les natures qui, à plusieurs mots, restent des mots : composés, noms propres.
NATURES_DE_MOT = {"n", "pn", "abbreviation", "prefix", "suffix", "letter"}

MOTS_MAX = 10           # au-delà, c'est une phrase, pas une expression
MOTS_MIN = 2

# --- Les formules : ce qu'on demande à Tatoeba -------------------------------

# Une formule de conversation est courte des deux côtés. Au-delà, on n'est plus
# devant « kein Problem » ↔ « pas de problème » mais devant une phrase et sa
# traduction, qui ne s'apprennent pas de la même façon.
FORMULE_MOTS_MAX = 5
EQUIVALENT_MOTS_MAX = 6
EQUIVALENTS_MAX = 4

# Une glose de l'édition d'en face passe pour un équivalent en dessous de cette
# longueur : « Aucune idée. » en est un, « Indique qu'on a bien compris » non.
GLOSE_EQUIVALENT_MOTS_MAX = 4

PONCTUATION_FINALE = re.compile(r"[\s.!?…;:,]+$")

# « se lever », « s'asseoir » : un verbe pronominal français tient en deux mots
# et n'est pas une expression — c'est un verbe, avec sa fiche de verbe.
VERBE_PRONOMINAL = re.compile(r"^s(?:e |['’])\S+$")
PARENTHESE = re.compile(r"\s*\([^)]*\)")

# Provenances, telles que l'application les lit. Courtes : elles voyagent dans
# chaque entrée.
SOURCE_DICTIONNAIRE = "dico"       # WikDict, ou une table de traduction du Wiktionnaire
SOURCE_TATOEBA = "tatoeba"         # attestée par un Wiktionnaire, traduite par Tatoeba
SOURCE_CROISEE = "croisee"         # glosée par l'édition d'en face
SOURCE_ATTESTEE = "attestee"       # attestée, définie, mais sans équivalent connu
SOURCE_EDITORIALE = "editorial"    # relue à la main : build/expressions_editoriales.json

# Les provenances qui donnent un équivalent utilisable en révision. Une
# expression « attestée » se lit, mais ne s'apprend pas.
SOURCES_TRADUITES = {SOURCE_DICTIONNAIRE, SOURCE_TATOEBA, SOURCE_CROISEE, SOURCE_EDITORIALE}

# Un équivalent de Tatoeba ne doit pas être beaucoup plus long que
# l'expression : « Je te souhaite bonne chance » traduit la phrase « Viel
# Glück ! », pas la formule. Deux mots de marge, et trois équivalents au plus.
EQUIVALENT_MARGE = 2
EQUIVALENTS_TATOEBA_MAX = 3


def mots_en(texte):
    return corpus.MOT.findall(texte)


def ressemble_a_un_nom(mot):
    """« Bad Aibling », « Britische Inseln », « Îles Britanniques » : tous les mots
    portent une majuscule. Une expression, elle, en a au moins un en minuscule
    — un article, un verbe, une préposition. Les vedettes du Wiktionnaire sont
    écrites en minuscule initiale (« kein Problem », « viel Glück »), de sorte
    que la règle ne les touche pas."""
    morceaux = mots_en(mot)
    return bool(morceaux) and all(m[0].isupper() for m in morceaux)


# --- Où le corpus emploie une expression ------------------------------------

# Une phrase d'exemple ni trop courte pour montrer l'emploi, ni trop longue
# pour se lire : les mêmes bornes que pour les mots, en un peu plus large
# puisque l'expression occupe déjà plusieurs mots.
EXEMPLE_MOTS_MAX = 16
EXEMPLE_IDEAL = 9
EXEMPLES_PAR_EXPRESSION = 3


def reperer_dans_le_corpus(cles_par_langue, paires):
    """Les paires de Tatoeba où une expression figure en entier.

    `lemmes_de` de `phrases.py` ne voit que des mots isolés : « à petit feu »
    n'y trouve jamais de phrase. Ici on cherche l'expression **comme suite de
    mots** dans la phrase normalisée. Pour ne pas tester chaque expression
    contre chaque phrase, on range les expressions sous leur mot le plus rare
    dans le corpus, et on ne les essaie que sur les phrases qui portent ce mot.

    Rend `{langue: {clé: [(score, numéro de paire), …]}}`, les meilleures
    d'abord.
    """
    # Fréquence des mots par langue, pour trouver le mot le plus rare.
    frequences = {"en": defaultdict(int), "fr": defaultdict(int)}
    normalisees = []
    for de, fr in paires:
        ligne = []
        for langue, texte in (("en", de), ("fr", fr)):
            mots = [commun.cle(m) for m in mots_en(texte)]
            for m in set(mots):
                frequences[langue][m] += 1
            ligne.append((mots, " " + " ".join(mots) + " "))
        normalisees.append(ligne)

    par_ancre = {"en": defaultdict(list), "fr": defaultdict(list)}
    for langue, cles in cles_par_langue.items():
        for k in cles:
            mots = [m for m in k.split(" ") if m]
            if len(mots) < 2:
                continue
            ancre = min(mots, key=lambda m: (frequences[langue].get(m, 0), -len(m)))
            par_ancre[langue][ancre].append((k, " " + k + " "))

    trouvees = {"en": defaultdict(list), "fr": defaultdict(list)}
    for numero, ligne in enumerate(normalisees):
        for indice, langue in ((0, "en"), (1, "fr")):
            mots, texte = ligne[indice]
            nombre = len(mots)
            if nombre > EXEMPLE_MOTS_MAX:
                continue
            for m in set(mots):
                for k, motif in par_ancre[langue].get(m, ()):
                    if motif in texte:
                        score = 100 - 3 * abs(nombre - EXEMPLE_IDEAL)
                        trouvees[langue][k].append((score, numero))
    for langue in trouvees:
        for k in trouvees[langue]:
            trouvees[langue][k].sort(key=lambda c: -c[0])
    return trouvees


def formule(texte):
    """Une phrase de Tatoeba ramenée à ce qu'on écrirait en vedette."""
    return PONCTUATION_FINALE.sub("", texte.strip()).strip()


# --- 1. Reconnaître les expressions du dictionnaire --------------------------

def est_expression(entree):
    """Cette entrée du dictionnaire est-elle une expression usuelle ?

    Une vedette de deux à dix mots, d'une nature qui n'est pas celle d'un nom,
    et qui ne se traduit pas par elle-même — « carpe noctem », « Bad Brückenau »,
    « al dente » se traduisent par eux-mêmes : ce sont des emprunts ou des noms,
    pas des tournures à apprendre.
    """
    mot = entree["mot"]
    if " " not in mot:
        return False
    if VERBE_PRONOMINAL.match(mot):
        return False
    nombre = len(mots_en(mot))
    if not (MOTS_MIN <= nombre <= MOTS_MAX):
        return False
    natures = {lecture[0] for lecture in entree["lectures"]}
    # Ce que le Wiktionnaire range lui-même parmi ses expressions l'est, quelle
    # que soit sa nature ; le reste se juge à la nature.
    if not entree.get("idiome"):
        if natures & NATURES_DE_MOT and not (natures & (NATURES_D_EXPRESSION - {""})):
            return False
        if not (natures & NATURES_D_EXPRESSION):
            return False
    premiere = None
    for lecture in entree["lectures"]:
        for bloc in lecture[4]:
            if bloc[1]:
                premiere = bloc[1][0]
                break
        if premiere:
            break
    if premiere and commun.cle(premiere) == commun.cle(mot):
        return False
    if ressemble_a_un_nom(mot) and not (natures & {"interjection", "locution"}):
        return False
    return True


def marquer(dictionnaires, journal):
    """Pose `expression` sur les entrées du dictionnaire qui en sont."""
    for langue in ("en", "fr"):
        compte = 0
        for entree in dictionnaires[langue].values():
            if entree.get("expression"):
                continue
            if est_expression(entree):
                entree["expression"] = SOURCE_DICTIONNAIRE
                compte += 1
        journal[f"dictionnaire_{langue}"] = compte
    return journal


# --- 2. Les formules attestées, traduites par Tatoeba -----------------------

def equivalents_tatoeba(paires):
    """Pour chaque phrase courte, ses traductions courtes, dans les deux sens.

    Rend `{langue: {clé: {"graphie": …, "equivalents": [(graphie, poids), …]}}}`.
    On ne garde que ce qui ressemble à une formule des deux côtés ; le reste du
    corpus, qui est immense, ne nous concerne pas ici.
    """
    table = {"en": defaultdict(lambda: {"graphies": defaultdict(int),
                                         "equivalents": defaultdict(int),
                                         "graphies_eq": {}}),
             "fr": defaultdict(lambda: {"graphies": defaultdict(int),
                                         "equivalents": defaultdict(int),
                                         "graphies_eq": {}})}
    for de, fr in paires:
        for langue, source, cible in (("en", de, fr), ("fr", fr, de)):
            f = formule(source)
            if not f or len(mots_en(f)) > FORMULE_MOTS_MAX or len(f) > 40:
                continue
            g = formule(cible)
            if not g or len(mots_en(g)) > EQUIVALENT_MOTS_MAX or len(g) > 60:
                continue
            k = commun.cle(f)
            ligne = table[langue][k]
            ligne["graphies"][f] += 1
            kg = commun.cle(g)
            ligne["equivalents"][kg] += 1
            ligne["graphies_eq"].setdefault(kg, g)
    return table


def glose_en_equivalents(glose):
    """Découpe une glose de l'édition d'en face : les segments courts sont des
    équivalents, les longs une explication. « Aucune idée. Je n'en sais rien. »
    donne deux équivalents ; « Indique qu'on a bien compris » une explication."""
    equivalents, explications = [], []
    propre = PARENTHESE.sub("", glose).strip()
    for segment in re.split(r"[.;!?]+", propre):
        segment = segment.strip(" ,:")
        if not segment:
            continue
        if len(mots_en(segment)) <= GLOSE_EQUIVALENT_MOTS_MAX and not segment[0].islower():
            equivalents.append(segment)
        elif len(mots_en(segment)) <= GLOSE_EQUIVALENT_MOTS_MAX:
            equivalents.append(segment)
        else:
            explications.append(segment)
    return equivalents, explications


def equivalent_plausible(equivalent, expression):
    """Un équivalent relevé dans Tatoeba peut-il valoir pour la formule ?

    Tatoeba traduit des phrases : une réplique évasive (« Alors là… »), ou une
    phrase entière là où la formule tient en deux mots, en sortent aussi. On
    écarte ce qui reste en suspens et ce qui déborde de plus de deux mots.
    """
    if "…" in equivalent or "..." in equivalent:
        return False
    return len(mots_en(equivalent)) <= len(mots_en(expression)) + EQUIVALENT_MARGE


def enregistrement_en_entree(enregistrement, langue, tatoeba, croises, journal):
    """Une expression attestée par un Wiktionnaire → une entrée, si elle vaut.

    L'ordre des équivalents dit d'où ils viennent : la table de traduction du
    Wiktionnaire d'abord, Tatoeba ensuite, la glose d'en face enfin. La
    provenance retenue est celle du **premier** équivalent trouvé.
    """
    mot = enregistrement["m"]
    k = commun.cle(mot)
    sens_wikt = enregistrement.get("s", [])

    traductions = []
    for bloc in sens_wikt:
        for t in bloc.get("tr", ()):
            if t not in traductions:
                traductions.append(t)
    source = SOURCE_DICTIONNAIRE if traductions else None

    # Tatoeba aligne des phrases, pas des expressions : « Nach links ! » se
    # traduit par « Tourne à gauche ! », qui n'est pas l'équivalent de « nach
    # links ». On ne prend donc son équivalent que sur deux signaux
    # indépendants : plusieurs traductions distinctes de la même phrase, ou
    # une expression que deux éditions du Wiktionnaire décrivent — une formule
    # que plusieurs dictionnaires retiennent n'est pas une phrase quelconque.
    ligne = tatoeba[langue].get(k)
    attestations = enregistrement.get("attestations", 1)
    if ligne and (len(ligne["equivalents"]) >= 2 or attestations >= 2):
        classes = sorted(ligne["equivalents"].items(), key=lambda x: -x[1])
        retenus = 0
        for kg, _poids in classes:
            g = ligne["graphies_eq"][kg]
            if not equivalent_plausible(g, mot) or g in traductions:
                continue
            traductions.append(g)
            retenus += 1
            if retenus >= EQUIVALENTS_TATOEBA_MAX:
                break
        if source is None and retenus:
            source = SOURCE_TATOEBA

    explications = []
    for croise in croises.get(k, ()):
        for glose in croise.get("g", ()):
            # Depuis Vocabulary, chaque glose croisée arrive avec ses marques
            # d'usage : [texte, [codes]].
            if isinstance(glose, list):
                glose = glose[0]
            eq, ex = glose_en_equivalents(glose)
            for e in eq:
                if e not in traductions:
                    traductions.append(e)
            explications.extend(ex)
            if source is None and eq:
                source = SOURCE_CROISEE

    if source is None:
        source = SOURCE_ATTESTEE
        journal["sans_equivalent"] += 1

    traductions = traductions[:EQUIVALENTS_MAX + 2]
    definition = (sens_wikt[0].get("d", "") if sens_wikt else "") or (
        explications[0] if explications else "")
    citations = [list(x) for x in (sens_wikt[0].get("x", ()) if sens_wikt else ())]

    lecture = [
        "locution" if enregistrement.get("p") in ("phrase", "prep_phrase", "adv_phrase")
        else ("interjection" if enregistrement.get("p") == "intj" else "locution"),
        "", enregistrement.get("api", "") or "", [],
        [[definition[:130], traductions, citations]],
        [], [],
    ]
    entree = {"mot": mot, "lectures": [lecture], "neuve": True, "expression": source}
    if enregistrement.get("idiome"):
        entree["idiome"] = True
    if explications and definition != explications[0]:
        entree["explication"] = explications[0][:160]
    return entree


# Les natures que le Wiktionnaire anglais donne aux expressions.
NATURES_EN = ("phrase", "intj", "proverb", "prep_phrase")


def charger_attestations_en(croises_fr):
    """Les expressions françaises que le Wiktionary anglais décrit.

    Dans Wortschatz, ce fichier lisait des extraits par nature du Wiktionary
    anglais pour attester des tournures allemandes et françaises. Ici le
    Wiktionary anglais est une source à part entière : ses entrées françaises
    sont déjà lues, sous forme croisée (`wiktionnaire.charger_croises("en")`),
    avec leurs gloses — qui sont précisément des équivalents anglais. On y
    prend les expressions (« avoir le cafard », « ça marche ») comme
    attestations, et l'on garde leurs gloses : `enregistrement_en_entree` les
    lira comme équivalents d'en face.

    Les expressions anglaises, elles, sont attestées par leur propre édition —
    le Wiktionary anglais — dans l'extrait `wikt-en`.
    """
    par_langue = {"en": {}, "fr": {}}
    for k, enregistrements in (croises_fr or {}).items():
        for e in enregistrements:
            mot = e.get("m") or ""
            if " " not in mot or len(mot) > 60:
                continue
            if e.get("p") not in NATURES_EN and e.get("p") != "adv_phrase":
                continue
            par_langue["fr"].setdefault(k, {"m": mot, "p": e.get("p"), "s": []})
    return par_langue


def ajouter_formules(dictionnaires, par_mot, croises_par_langue, attestations_en,
                     paires, journal):
    """Verse au dictionnaire les expressions attestées qu'il n'avait pas.

    `par_mot[langue]` est l'extrait du Wiktionnaire de cette langue, où les
    enregistrements marqués `fx` sont les expressions sans traduction ;
    `croises_par_langue[langue]` ce que l'édition d'en face dit des expressions
    de cette langue ; `attestations_en[langue]` celles que le Wiktionnaire
    anglais décrit ; `paires` le corpus Tatoeba.
    """
    for cle in ("ajoutees_en", "ajoutees_fr", "sans_equivalent", "tatoeba", "croisee",
                "ecartees_noms", "ecartees_sans_exemple"):
        journal.setdefault(cle, 0)
    journal.setdefault("exemples", [])
    tatoeba = equivalents_tatoeba(paires)

    # Les candidates de chaque langue : les expressions marquées `fx`, celles
    # que seule l'édition d'en face connaît — « alles klar » n'est pas une
    # vedette du Wiktionnaire allemand, mais le français l'explique —, et
    # celles que le Wiktionnaire anglais décrit.
    candidats = {"en": {}, "fr": {}}
    for langue in ("en", "fr"):
        cles_presentes = {commun.cle(m) for m in dictionnaires[langue]}
        editions = defaultdict(set)     # clé → éditions qui l'attestent
        for mot, enregistrements in par_mot[langue].items():
            for e in enregistrements:
                if e.get("fx"):
                    candidats[langue].setdefault(commun.cle(mot), e)
                    editions[commun.cle(mot)].add(langue)
        for k, enregistrement in attestations_en.get(langue, {}).items():
            candidats[langue].setdefault(k, enregistrement)
            editions[k].add("en")
        # L'édition d'en face ne fait pas candidate à elle seule : elle range
        # « télévision interactive » parmi ses « phrases » comme « alles klar ».
        # Sa glose enrichit ce que sa propre édition ou l'anglaise atteste.
        for k in croises_par_langue.get(langue, {}):
            if k in candidats[langue]:
                editions[k].add("croise")
        for k in list(candidats[langue]):
            if k in cles_presentes:
                del candidats[langue][k]
            else:
                candidats[langue][k]["attestations"] = len(editions[k])

    # Où le corpus emploie ces candidates : nécessaire à celles qui n'ont pas
    # d'équivalent, et une lecture unique du corpus pour les deux langues.
    reperees = reperer_dans_le_corpus(
        {langue: list(candidats[langue]) for langue in ("en", "fr")}, paires)

    for langue in ("en", "fr"):
        entrees = dictionnaires[langue]
        croises = croises_par_langue.get(langue, {})
        for k, enregistrement in candidats[langue].items():
            mot = enregistrement["m"]
            if not (MOTS_MIN <= len(mots_en(mot)) <= MOTS_MAX):
                continue
            if ressemble_a_un_nom(mot) and enregistrement.get("p") != "proverb":
                journal["ecartees_noms"] += 1
                continue
            entree = enregistrement_en_entree(enregistrement, langue, tatoeba, croises, journal)
            traduites = entree["lectures"][0][4][0][1]
            if traduites and commun.cle(traduites[0]) == k:
                journal["ecartees_noms"] += 1
                continue
            # Sans équivalent, une expression n'entre que si le corpus la
            # montre en emploi, traduite — ou si le Wiktionnaire la range
            # lui-même parmi ses expressions : « simple comme bonjour » a sa
            # définition, et vaut d'être trouvée, même sans équivalent connu.
            if (entree["expression"] == SOURCE_ATTESTEE
                    and not reperees[langue].get(k)
                    and enregistrement.get("idiome") != "idiome"):
                journal["sans_equivalent"] -= 1
                journal["ecartees_sans_exemple"] += 1
                continue
            entrees[mot] = entree
            journal[f"ajoutees_{langue}"] += 1
            if entree["expression"] == SOURCE_TATOEBA:
                journal["tatoeba"] += 1
            elif entree["expression"] == SOURCE_CROISEE:
                journal["croisee"] += 1
            if len(journal["exemples"]) < 16 and traduites:
                journal["exemples"].append((langue, mot, traduites[:3], entree["expression"]))
    return journal


# --- Ce qui entre au noyau ----------------------------------------------------

# En dessous de cette longueur, un mot est un outil — « à », « au », « la »,
# « in », « zu » — et n'a pas à être une vedette du noyau pour qu'une expression
# y entre.
MOT_OUTIL_MAX = 2

# Au-delà, l'expression est un proverbe ou une tournure longue : utile, mais
# pas au point de la précacher chez tout le monde.
NOYAU_MOTS_MAX = 5


def va_au_noyau(entree, cles_du_noyau):
    """Une expression entre au noyau si ses mots y sont déjà.

    Le noyau est le vocabulaire courant. Une expression faite de mots courants
    — « à petit feu », « die Nase voll haben » — en fait partie de plein droit :
    c'est sur la fiche de « feu » ou de « Nase » qu'on la rencontrera, et cette
    fiche doit la montrer sans attendre un téléchargement. Les formules de
    conversation entrent toutes : elles sont ce qu'un débutant dit en premier.
    """
    if not entree.get("expression"):
        return False
    if entree["expression"] in (SOURCE_TATOEBA, SOURCE_CROISEE, SOURCE_EDITORIALE):
        return True
    # Sans équivalent, une expression n'a rien à faire dans le paquet qu'on
    # installe d'office ; elle attend le paquet complet.
    if entree["expression"] == SOURCE_ATTESTEE:
        return False
    morceaux = mots_en(entree["mot"])
    if len(morceaux) > NOYAU_MOTS_MAX:
        return False
    for morceau in morceaux:
        k = commun.cle(morceau)
        if len(k) > MOT_OUTIL_MAX and k not in cles_du_noyau:
            return False
    return True


# --- 3. L'index des mots ------------------------------------------------------

# Les mots qu'on n'indexe pas : trop courts pour désigner quoi que ce soit.
LONGUEUR_MIN = 2

def est_traduite(entree):
    """L'expression a-t-elle un équivalent — se révise-t-elle ?"""
    return any(bloc[1] for lecture in entree["lectures"] for bloc in lecture[4])


def index_des_mots(entrees_par_langue, positions):
    """{langue du mot: {mot: [(priorité, rang, langue de l'expression, vedette)]}}.

    Chaque expression est rangée sous chacun des mots de sa vedette (dans sa
    langue) et de ses traductions (dans l'autre langue) : « à petit feu » se
    trouve par « feu » côté français et par « Flamme » côté allemand.

    L'index est **complet** : aucun plafond par mot. « de » réunit près de
    deux mille expressions dans le paquet complet, et une ligne de cinquante
    kilooctets se lit en une dichotomie ; un plafond, lui, rendrait la
    quarante-et-unième introuvable pour toujours, y compris quand on tape
    « de » avec un second mot qui l'aurait isolée. C'est à l'affichage de
    borner, pas à l'index. Sous chaque mot, les expressions traduites passent
    devant celles qui n'ont pas d'équivalent, puis les plus courantes.
    """
    index = {"en": defaultdict(list), "fr": defaultdict(list)}
    for langue, entrees in entrees_par_langue.items():
        autre = "fr" if langue == "en" else "en"
        for entree in entrees:
            if not entree.get("expression"):
                continue
            mot = entree["mot"]
            rang = positions[langue].get(mot, 10 ** 9)
            priorite = 0 if est_traduite(entree) else 1
            vus = set()
            for morceau in mots_en(mot):
                k = commun.cle(morceau)
                if len(k) >= LONGUEUR_MIN and k not in vus:
                    vus.add(k)
                    index[langue][k].append((priorite, rang, langue, mot))
            vus_autre = set()
            for lecture in entree["lectures"]:
                for bloc in lecture[4]:
                    for traduction in bloc[1]:
                        for morceau in mots_en(traduction):
                            k = commun.cle(morceau)
                            if len(k) >= LONGUEUR_MIN and k not in vus_autre:
                                vus_autre.add(k)
                                index[autre][k].append((priorite, rang, langue, mot))
    return index


def ecrire_index(chemin, index_langue, ecrire):
    """Une ligne par mot : `mot ⇥ langue:vedette|langue:vedette|…`, triée."""
    lignes = []
    for mot in sorted(index_langue):
        liste = sorted(index_langue[mot])
        # Une même expression peut être atteinte par deux graphies d'un mot
        # (« Glück » et « Glücks ») ramenées à une seule clé : on dédoublonne.
        vues, morceaux = set(), []
        for _priorite, _rang, langue, vedette in liste:
            marque = langue + ":" + vedette
            if marque not in vues:
                vues.add(marque)
                morceaux.append(marque)
        lignes.append(mot + "\t" + "|".join(morceaux))
    texte = "\n".join(lignes) + "\n"
    ecrire(chemin, texte)
    return len(lignes), len(texte.encode("utf-8"))


# --- 4. Le supplément éditorial ----------------------------------------------

# Ce que les sources n'ont pas, ou traduisent mal, relu à la main. Le fichier
# dit lui-même ce qu'il est et ce qu'il écarte.
SUPPLEMENT = Path(__file__).resolve().parent / "expressions_editoriales.json"


def charger_supplement(chemin=SUPPLEMENT):
    """Les entrées du supplément, telles qu'écrites — vérifiées au passage."""
    if not Path(chemin).exists():
        return []
    with io.open(chemin, encoding="utf-8") as f:
        contenu = json.load(f)
    entrees = contenu.get("entrees", [])
    for e in entrees:
        assert e.get("langue") in ("en", "fr"), e
        assert e.get("mot") and " " in e["mot"], e
        assert e.get("sens"), e
        for bloc in e["sens"]:
            assert bloc.get("definition") and bloc.get("equivalents"), (e["mot"], bloc)
            for exemple in bloc.get("exemples", ()):
                assert len(exemple) == 2 and all(exemple), (e["mot"], exemple)
    return entrees


def appliquer_supplement(dictionnaires, supplement, journal):
    """Verse le supplément au dictionnaire, par-dessus ce qui s'y trouve.

    Une entrée qui existe garde sa vedette, sa prononciation, ses formes et
    ses voisins ; ses sens et ses équivalents sont remplacés par ceux du
    supplément. Les citations du Wiktionnaire suivent le sens que `reprend`
    désigne — un mot de son ancienne définition, ou `*` pour toutes. Une
    entrée qui n'existe pas est créée. Dans les deux cas la provenance devient
    « editorial » : la fiche dira que des mains humaines sont passées.

    Rend les exemples rédigés, `(langue, vedette, allemand, français)`, à
    verser au corpus : ils deviennent les phrases de l'expression.
    """
    journal.setdefault("editoriales_creees", 0)
    journal.setdefault("editoriales_corrigees", 0)
    exemples = []
    for record in supplement:
        langue, mot = record["langue"], record["mot"]
        entrees = dictionnaires[langue]
        existante = entrees.get(mot)
        if existante is None:
            k = commun.cle(mot)
            existante = next((e for m, e in entrees.items() if commun.cle(m) == k), None)
        anciens_blocs = []
        if existante is not None:
            for lecture in existante["lectures"]:
                anciens_blocs.extend(lecture[4])

        sens = []
        for bloc in record["sens"]:
            citations = []
            reprend = bloc.get("reprend")
            if reprend:
                for ancien in anciens_blocs:
                    if reprend == "*" or reprend.lower() in (ancien[0] or "").lower():
                        citations.extend(list(c) for c in ancien[2])
            sens.append([bloc["definition"], list(bloc["equivalents"]), citations])
            for texte, traduction in bloc.get("exemples", ()):
                de, fr = (texte, traduction) if langue == "en" else (traduction, texte)
                exemples.append((langue, mot, de, fr))

        premiere = existante["lectures"][0] if existante else None
        lecture = [
            record.get("nature") or (premiere[0] if premiere else "locution"),
            "",
            premiere[2] if premiere else "",
            list(premiere[3]) if premiere else [],
            sens,
            list(premiere[5]) if premiere and len(premiere) > 5 else [],
            list(premiere[6]) if premiere and len(premiere) > 6 else [],
        ]
        if existante is not None:
            entree = existante
            if entree["mot"] != mot:
                del entrees[entree["mot"]]
                entree["mot"] = mot
                entrees[mot] = entree
            journal["editoriales_corrigees"] += 1
        else:
            entree = {"mot": mot, "neuve": True}
            entrees[mot] = entree
            journal["editoriales_creees"] += 1
        entree["lectures"] = [lecture]
        entree["expression"] = SOURCE_EDITORIALE
        entree.pop("idiome", None)
        if record.get("explication"):
            entree["explication"] = record["explication"][:240]
        else:
            entree.pop("explication", None)
    return exemples
