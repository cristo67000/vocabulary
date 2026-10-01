#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Choix des phrases d'exemple.

Le corpus Tatoeba offre 156 484 paires allemand/français alignées. On n'en garde
que quelques-unes par mot, et le choix compte plus que le nombre : une phrase
d'exemple n'aide que si l'apprenant peut la lire presque entièrement. Une phrase
où trois mots sur dix sont inconnus n'enseigne rien — elle décourage.

Trois critères, dans cet ordre :

1. **La longueur.** Sept mots environ. En dessous la phrase n'a pas de contexte
   (« Ja. »), au-dessus elle demande plus d'efforts qu'elle n'en épargne.
2. **La lisibilité.** La part des mots de la phrase qui appartiennent au
   vocabulaire courant. C'est la traduction, grossière mais opérante, de l'idée
   qu'on apprend un mot nouveau dans une phrase connue, et non l'inverse.
3. **La variété.** Une même phrase ne sert que quelques mots : sans cette
   limite, les mêmes trois phrases passe-partout illustreraient la moitié du
   dictionnaire.

Les phrases retenues forment un vivier commun aux deux langues — une paire
illustre un mot allemand *et* un mot français — puis chaque entrée ne garde que
les numéros de ses phrases. Sans cela, chaque paire serait recopiée jusqu'à
quatorze fois.
"""

from collections import defaultdict

import commun
import corpus

# Ce qu'on cherche : ni « Ja. » ni une phrase de quarante mots.
LONGUEUR_IDEALE = 7
LONGUEUR_MIN = 3
LONGUEUR_MAX = 16

# Combien de phrases par mot, et combien de mots une phrase peut illustrer.
#
# Trois suffisaient tant que les phrases se rangeaient sous le mot entier. Elles
# se rangent désormais sous **chaque signification** : « abbauen » en a cinq, et
# trois phrases n'en servaient qu'une ou deux. On en retient donc davantage, et
# `attribuer_aux_sens()` les répartit ensuite ; celles qu'aucun sens ne réclame
# restent au niveau du mot, comme avant.
PAR_MOT = 8
REUTILISATION_MAX = 8

# Une fois réparties : combien par signification, et combien de « passe-partout »
# qu'aucun sens n'a su réclamer.
PAR_SENS = 3
SANS_SENS_MAX = 2

# Un mot est « courant » s'il est dans les N premiers du classement.
SEUIL_COURANT = 6000


def lemmes_de(texte, langue, vedettes, formes):
    """Les vedettes présentes dans une phrase, une seule fois chacune."""
    trouves = []
    for k in corpus.mots(texte, langue):
        if not k:
            continue
        if k in vedettes:
            for mot in vedettes[k]:
                if mot not in trouves:
                    trouves.append(mot)
        for cle_lemme in formes.get(k, ()):
            for mot in vedettes.get(cle_lemme, ()):
                if mot not in trouves:
                    trouves.append(mot)
    return trouves


def lisibilite(texte, langue, rangs, vedettes, formes):
    """Part des mots de la phrase qui appartiennent au vocabulaire courant."""
    mots = [k for k in corpus.mots(texte, langue) if k]
    if not mots:
        return 0.0
    connus = 0
    for k in mots:
        cibles = list(vedettes.get(k, ()))
        for cle_lemme in formes.get(k, ()):
            cibles += list(vedettes.get(cle_lemme, ()))
        if any(rangs.get(mot, 10 ** 9) < SEUIL_COURANT for mot in cibles):
            connus += 1
    return connus / len(mots)


def note(texte_en, texte_fr, langue, rangs, vedettes, formes):
    """Plus c'est haut, meilleure est la phrase comme exemple."""
    mots_en = len(corpus.mots(texte_en, "en"))
    mots_fr = len(corpus.mots(texte_fr, "fr"))
    if not (LONGUEUR_MIN <= mots_en <= LONGUEUR_MAX):
        return None
    if not (LONGUEUR_MIN <= mots_fr <= LONGUEUR_MAX + 4):
        return None

    texte = texte_en if langue == "en" else texte_fr
    valeur = -1.2 * abs(len(corpus.mots(texte, langue)) - LONGUEUR_IDEALE)
    valeur += 8.0 * lisibilite(texte, langue, rangs, vedettes, formes)
    # Une phrase qui se termine par un point est une phrase complète ; celles
    # qui finissent par une virgule ou rien du tout sont souvent des fragments.
    if texte_en.rstrip().endswith((".", "!", "?")):
        valeur += 0.5
    return valeur


def choisir(paires, dictionnaires, index_formes, ordres, journal=None,
            supplements=None):
    """Sélectionne les phrases et les rattache aux vedettes.

    Renvoie `(vivier, par_vedette)` :
      vivier      liste de [texte allemand, texte français]
      par_vedette {langue: {vedette: [numéros dans le vivier]}}

    `supplements`, s'il est donné, apporte des candidates que `lemmes_de` ne
    sait pas trouver : `{langue: {vedette: [(valeur, numéro), …]}}`. C'est par
    là que les expressions à plusieurs mots reçoivent leurs phrases — « à petit
    feu » n'est le lemme d'aucun mot, mais il figure tel quel dans des phrases.
    """
    rangs = {}
    vedettes = {}
    for langue in ("en", "fr"):
        rangs[langue] = {e["mot"]: i for i, e in enumerate(ordres[langue])}
        par_cle = defaultdict(list)
        for mot in dictionnaires[langue]:
            par_cle[commun.cle(mot)].append(mot)
        vedettes[langue] = dict(par_cle)

    # Pour chaque vedette, les meilleures phrases candidates.
    candidates = {"en": defaultdict(list), "fr": defaultdict(list)}
    for numero, (texte_en, texte_fr) in enumerate(paires):
        for langue in ("en", "fr"):
            valeur = note(texte_en, texte_fr, langue, rangs[langue],
                          vedettes[langue], index_formes[langue])
            if valeur is None:
                continue
            texte = texte_en if langue == "en" else texte_fr
            for mot in lemmes_de(texte, langue, vedettes[langue], index_formes[langue]):
                candidates[langue][mot].append((valeur, numero))

    if supplements:
        for langue in ("en", "fr"):
            for mot, lot in supplements.get(langue, {}).items():
                if mot in dictionnaires[langue]:
                    candidates[langue][mot].extend(lot)

    # Attribution, du mot le plus utile au moins utile : les mots que l'on
    # apprendra en premier ont droit aux meilleures phrases, et à celles qui ne
    # sont pas encore usées.
    usage = defaultdict(int)
    retenues = {"en": {}, "fr": {}}
    numeros_gardes = {}

    for langue in ("en", "fr"):
        for entree in ordres[langue]:
            mot = entree["mot"]
            lot = candidates[langue].get(mot)
            if not lot:
                continue
            lot.sort(key=lambda c: -c[0])
            choisies = []
            # Tatoeba donne souvent plusieurs traductions d'une même phrase :
            # « Heute Abend gehen wir in die Kirche » apparaît avec « nous
            # allons » et avec « nous irons ». Ce sont deux paires distinctes,
            # mais un seul exemple — les montrer toutes deux donne à la fiche
            # l'air de bégayer. On ne garde qu'une paire par phrase source.
            deja_vues = set()
            for _valeur, numero in lot:
                if usage[numero] >= REUTILISATION_MAX:
                    continue
                source = paires[numero][0 if langue == "en" else 1]
                if source in deja_vues:
                    continue
                deja_vues.add(source)
                choisies.append(numero)
                usage[numero] += 1
                if len(choisies) >= PAR_MOT:
                    break
            if choisies:
                retenues[langue][mot] = choisies
                for numero in choisies:
                    numeros_gardes.setdefault(numero, len(numeros_gardes))

    # Renumérotation : le vivier ne contient que les phrases effectivement
    # retenues, et les entrées pointent dessus.
    vivier = [None] * len(numeros_gardes)
    for ancien, nouveau in numeros_gardes.items():
        vivier[nouveau] = list(paires[ancien])
    for langue in ("en", "fr"):
        for mot, liste in retenues[langue].items():
            retenues[langue][mot] = [numeros_gardes[n] for n in liste]

    if journal is not None:
        journal["paires"] = len(paires)
        journal["vivier"] = len(vivier)
        journal["mots_en"] = len(retenues["en"])
        journal["mots_fr"] = len(retenues["fr"])

    return vivier, retenues


# --- Répartition par signification -------------------------------------------

def sens_plats(entree):
    """Les sens d'une entrée, à plat, dans l'ordre où l'application les lira.

    Une entrée a des lectures, chaque lecture a des sens ; l'application les
    affiche les uns sous les autres. Le rang dans cette liste aplatie est donc
    l'identifiant naturel d'une signification, et `construire.py` la reparcourt
    dans le même ordre. Changer l'ordre d'un côté sans l'autre rattacherait les
    phrases aux mauvais sens, sans que rien ne le signale.
    """
    plat = []
    for lecture in entree["lectures"]:
        for bloc in lecture[4]:
            plat.append(bloc)
    return plat


def cles_presentes(texte, langue, formes):
    """Les clés des mots d'une phrase, lemmes compris.

    « il a extrait » doit permettre de reconnaître la traduction « extraire » :
    on ajoute donc, à côté de chaque forme rencontrée, les lemmes auxquels elle
    peut remonter.
    """
    presentes = set()
    for k in corpus.mots(texte, langue):
        if not k:
            continue
        presentes.add(k)
        presentes.update(formes.get(k, ()))
    return presentes


def sens_illustre(traductions_par_sens, presentes):
    """Quelle signification cette paire illustre-t-elle ? None si on ne sait pas.

    Le raisonnement tient en une phrase : une paire alignée montre le mot
    allemand d'un côté et sa traduction française de l'autre ; **la traduction
    qui figure réellement en face désigne le sens employé**. « Im Mittelalter
    wurde hier Silber abgebaut. » traduit par « on extrayait de l'argent »
    illustre *extraire*, pas *démanteler*.

    On s'abstient dès que deux sens répondent **avec la même précision**. Deux
    traductions d'un seul mot présentes dans la même phrase, c'est soit une
    coïncidence, soit deux sens voisins : dans les deux cas, choisir serait
    deviner.

    Une locution, en revanche, désigne son sens bien plus sûrement qu'un mot
    isolé. Si la phrase porte à la fois « aller » et « aller au travail », c'est
    le second qui dit quel sens est employé — le premier est contenu dans le
    second, et l'ambiguïté n'est qu'apparente. On départage donc par le nombre
    de mots de la traduction trouvée, et on s'abstient toujours à égalité.

    La règle a été ajoutée en version 3, quand les traductions du Wiktionnaire
    ont fait passer la part des sens traduits de 51 % à 89 % du côté français.
    Chaque sens traduit de plus est un candidat de plus, donc une chance de plus
    de tomber sur deux réponses : sans départage, l'abondance nouvelle faisait
    perdre les phrases qu'elle aurait dû aider à ranger.
    """
    candidats = []           # (précision, rang, clés des traductions trouvées)
    for rang, traductions in enumerate(traductions_par_sens):
        trouvees = set()
        precision = 0
        for traduction in traductions:
            cle = commun.cle(traduction)
            morceaux = cle.split()
            if morceaux and all(m in presentes for m in morceaux):
                trouvees.add(cle)
                precision = max(precision, len(morceaux))
        if trouvees:
            candidats.append((precision, rang, trouvees))

    if not candidats:
        return None

    sommet = max(candidat[0] for candidat in candidats)
    tetes = [candidat for candidat in candidats if candidat[0] == sommet]
    if len(tetes) == 1:
        return tetes[0][1]

    # Plusieurs sens répondent avec la même précision. Reste à savoir s'ils
    # répondent par la MÊME traduction : WikDict et le Wiktionnaire ne découpent
    # pas les significations de la même façon, et la version 3, en greffant les
    # traductions du Wiktionnaire, a multiplié les cas où deux sens voisins
    # portent le mot « aller » tous les deux. Ce n'est pas une ambiguïté sur ce
    # que la phrase illustre — c'est le même sens décrit deux fois. On prend
    # alors le premier, celui que le reclassement a jugé le plus utile.
    #
    # Deux traductions DIFFÉRENTES, en revanche, désignent deux sens distincts :
    # là, choisir serait deviner, et on s'abstient comme avant.
    communes = set.intersection(*[candidat[2] for candidat in tetes])
    if communes:
        return min(candidat[1] for candidat in tetes)
    return None


def attribuer_aux_sens(vivier, retenues, dictionnaires, index_formes, journal=None):
    """Range les phrases retenues sous les significations qu'elles illustrent.

    Renvoie `{langue: {vedette: {"sens": {rang: [numéros]}, "libres": [numéros]}}}`.
    Les « libres » sont celles qu'aucun sens n'a réclamées : elles restent
    rattachées au mot entier, ce qui vaut mieux que de les jeter — une phrase
    d'exemple sans étiquette reste une phrase d'exemple.
    """
    compteur = journal if journal is not None else {}
    for cle in ("phrases", "rangees", "libres"):
        compteur.setdefault(cle, 0)

    sortie = {"en": {}, "fr": {}}
    for langue in ("en", "fr"):
        autre = "fr" if langue == "en" else "en"
        formes_autre = index_formes[autre]
        for mot, numeros in retenues[langue].items():
            entree = dictionnaires[langue].get(mot)
            if not entree:
                continue
            traductions_par_sens = [bloc[1] for bloc in sens_plats(entree)]

            par_sens = {}
            libres = []
            for numero in numeros:
                compteur["phrases"] += 1
                texte_autre = vivier[numero][1 if langue == "en" else 0]
                presentes = cles_presentes(texte_autre, autre, formes_autre)
                rang = sens_illustre(traductions_par_sens, presentes)
                if rang is None:
                    if len(libres) < SANS_SENS_MAX:
                        libres.append(numero)
                        compteur["libres"] += 1
                    continue
                lot = par_sens.setdefault(rang, [])
                if len(lot) < PAR_SENS:
                    lot.append(numero)
                    compteur["rangees"] += 1

            sortie[langue][mot] = {"sens": par_sens, "libres": libres}
    return sortie


def sous_ensemble(vivier, attributions, mots_en, mots_fr):
    """Restreint le vivier aux phrases utiles à une sélection de vedettes.

    Le paquet noyau ne contient que 12 000 mots par langue : lui livrer les
    phrases des 106 000 le ferait peser plus que le dictionnaire lui-même.

    Les numéros sont renumérotés au passage, la répartition par sens comprise :
    ce qui compte est que chaque signification retrouve *ses* phrases dans le
    vivier réduit, et non les numéros qu'elles portaient dans le grand.
    """
    gardes = {}

    def garder(numeros):
        return [gardes.setdefault(n, len(gardes)) for n in numeros]

    petites = {"en": {}, "fr": {}}
    for langue, mots in (("en", mots_en), ("fr", mots_fr)):
        for mot in mots:
            attribution = attributions[langue].get(mot)
            if not attribution:
                continue
            petites[langue][mot] = {
                "sens": {rang: garder(liste)
                         for rang, liste in attribution["sens"].items()},
                "libres": garder(attribution["libres"]),
            }

    petit_vivier = [None] * len(gardes)
    for ancien, nouveau in gardes.items():
        petit_vivier[nouveau] = vivier[ancien]
    return petit_vivier, petites
