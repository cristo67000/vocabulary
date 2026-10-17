#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Les exemples anglais du dictionnaire, traduits et rajeunis.

── Pourquoi ────────────────────────────────────────────────────────────────

Le Wiktionary anglais illustre ses sens par des phrases anglaises, et ne les
traduit pas : c'est un dictionnaire unilingue. Pour un francophone, une
citation qu'il faut déchiffrer mot à mot n'apprend pas grand-chose. Et ces
citations sont souvent anciennes — Shakespeare, la Bible de 1611, Dickens,
un s long tous les trois mots — quand on vient apprendre l'anglais
d'aujourd'hui.

Chaque exemple anglais que montre une fiche est donc repris à la main, de
l'une de ces trois façons :

  T  traduire      la citation est gardée, sa traduction française vient
                   dessous ;
  R  remplacer     la citation date d'avant 1950 ou s'écrit en anglais
                   archaïque, et le sens n'a pas d'autre exemple : une phrase
                   contemporaine, traduite, la remplace ;
  N  ajouter       le sens d'un mot courant (bandes « premiers pas » et
                   « courant ») n'avait aucun exemple, ni citation ni phrase
                   de Tatoeba : il en reçoit un, contemporain et traduit.

Quatre règles font le tri avant qu'on traduise (`reprendre`) :

  - une phrase anglaise sans traduction ne s'affiche pas : la fiche montre
    moins d'exemples plutôt qu'un exemple qu'on ne lit pas ;
  - une citation d'avant 1950 s'efface devant un exemple d'aujourd'hui du
    même sens (citation récente ou phrase de Tatoeba) ;
  - un sens vieux ou archaïque (marque « vx ») d'un mot étendu ou rare ne
    garde pas d'exemple : on n'apprend pas à s'en servir ;
  - les paroles de chansons sont sous droits : la référence (« performed
    by », « (song) »…) les écarte.

Un sens garde deux exemples, un seul pour les mots rares (bande 3).

── Où sont les textes ──────────────────────────────────────────────────────

  build/citations/attente.json             ce que la dernière construction a
                                           laissé sans traduction (écrit par
                                           `construire.py`, non versionné)
  build/citations/a-traduire/lot-NNN.txt   le travail à faire, produit par
                                           `python build/citations.py lots`
                                           (régénérable, non versionné)
  build/citations/fr/lot-NNN.txt           le travail fait, une ligne par
                                           exemple :

      <id> <traduction française>                      (T)
      <id> = <phrase anglaise, mot ⟦marqué⟧> | <français>   (R, N, ou T)
      <id> ✗                                           (la citation est
                                                        retirée — un
                                                        fragment, un renvoi,
                                                        une phrase qui
                                                        n'illustre rien, des
                                                        paroles sous droits)

Un même identifiant peut revenir dans un lot plus récent : c'est la dernière
ligne qui compte (une citation de 1880 traduite hier peut être remplacée
aujourd'hui).

L'identifiant est une empreinte (dix signes hexadécimaux d'un SHA-1) : celle
du texte de la citation pour T et R, celle du mot et de la définition du sens
pour N. Il ne dépend ni de l'ordre des lots ni de la construction : une
citation que le Wiktionary retoucherait changerait d'empreinte, et perdrait
sa traduction plutôt que d'en recevoir une fausse.

── Usage ───────────────────────────────────────────────────────────────────

    python build/construire.py --sans-budget   # écrit citations/attente.json
    python build/citations.py lots             # écrit les lots de ce qui reste
    python build/citations.py verifier 132 133 # contrôle des lots faits
    python build/citations.py etat             # fait, restant

`construire.py` lit `charger()` et applique `reprendre()` sens par sens.
"""

import hashlib
import json
import re
import sys
from pathlib import Path

import wiktionnaire

RACINE = Path(__file__).resolve().parent
DOSSIER = RACINE / "citations"
A_TRADUIRE = DOSSIER / "a-traduire"
FAITS = DOSSIER / "fr"
ATTENTE = DOSSIER / "attente.json"

# Combien d'exemples un sens montre, selon la bande du mot : 0 « premiers
# pas », 1 « courant », 2 « étendu », 3 « rare ».
EXEMPLES_PAR_BANDE = (2, 2, 2, 1)
# Les sens qui reçoivent un exemple neuf quand ils n'en ont aucun (N).
BANDES_COMPLETEES = (0, 1)
PAR_LOT = 200
# Une citation dont la pénalité d'âge atteint ce seuil (avant 1950, ou
# orthographe archaïque) n'est pas de l'anglais d'aujourd'hui.
SEUIL_ANCIEN = 4
CHANSON = re.compile(r"performed by|\((?:song|lyrics|album|band)\)|theme song", re.IGNORECASE)

LIGNE = re.compile(r"^([0-9a-f]{10}) (.+)$")
RETIREE = "✗"
MARQUE = re.compile(r"⟦(.+?)⟧")


def empreinte(texte):
    return hashlib.sha1(texte.encode("utf-8")).hexdigest()[:10]


def cle_de_sens(mot, definition):
    return empreinte("sens\x1f" + mot + "\x1f" + definition)


def ancienne(citation):
    return wiktionnaire.penalite_d_age(citation[0], citation[2], "en") >= SEUIL_ANCIEN


def chanson(citation):
    return bool(CHANSON.search(citation[2] or ""))


# ── Lecture du travail fait ────────────────────────────────────────────────

def phrase_marquee(brute, ou):
    """« I ⟦ran⟧ home. » → (« I ran home. », [2, 5]). Exactement une marque :
    c'est le mot que la fiche met en gras."""
    marques = list(MARQUE.finditer(brute))
    if len(marques) != 1:
        raise SystemExit(f"{ou} : il faut un et un seul mot ⟦marqué⟧ — {brute[:70]}")
    m = marques[0]
    texte = brute[:m.start()] + m.group(1) + brute[m.end():]
    return texte, [m.start(), m.start() + len(m.group(1))]


def lire_lot(fichier):
    """[(numéro de ligne, id, valeur)] d'un lot fait ; valeur : traduction
    (str), RETIREE, ou (texte anglais, marque, français)."""
    sortie = []
    for numero, ligne in enumerate(fichier.read_text(encoding="utf-8").splitlines(), 1):
        if not ligne.strip() or ligne.startswith("#"):
            continue
        ou = f"{fichier.name}:{numero}"
        trouve = LIGNE.match(ligne)
        if not trouve:
            raise SystemExit(f"{ou} : ligne illisible — {ligne[:60]}")
        cle, valeur = trouve.group(1), trouve.group(2).strip()
        if valeur.startswith("= "):
            if " | " not in valeur:
                raise SystemExit(f"{ou} : « anglais | français » attendu — {valeur[:60]}")
            anglais, francais = valeur[2:].split(" | ", 1)
            texte, marque = phrase_marquee(anglais.strip(), ou)
            valeur = (texte, marque, francais.strip())
        sortie.append((numero, cle, valeur))
    return sortie


def charger():
    """{id → traduction (str) | (texte anglais, marque, français) (tuple)}.

    Une ligne qui ne suit pas le format arrête tout : une traduction égarée
    sous le mauvais identifiant serait pire qu'absente.
    """
    table = {}
    if not FAITS.exists():
        return table
    for fichier in sorted(FAITS.glob("lot-*.txt")):
        for _, cle, valeur in lire_lot(fichier):
            table[cle] = valeur
    return table


def reprendre(mot, definition, citations, a_des_phrases, table, bande=0, marques=(),
              nature="?", attente=None):
    """Les citations d'un sens anglais, telles que la fiche les montrera :
    traduites, remplacées, ou complétées d'un exemple neuf — et rien d'autre.

    Une citation est [texte, marque, référence] ; reprise, elle gagne un
    quatrième champ, sa traduction. Un exemple rédigé pour l'application n'a
    pas de référence. Ce qui reste à faire va dans `attente` :
    {id → [genre, bande, mot, nature, définition, texte marqué]}."""
    if bande >= 2 and "vx" in marques:
        return []

    def noter(cle, genre, texte=""):
        if attente is not None:
            attente[cle] = [genre, bande, mot, nature, definition, texte]

    vues = []  # (citation montrée ou None, ancienne, id, citation d'origine)
    # Une citation ancienne retirée plutôt que remplacée dit que le sens n'a
    # plus cours : il ne réclame pas d'exemple neuf.
    sens_passe = False
    for citation in citations:
        if chanson(citation):
            continue
        cle = empreinte(citation[0])
        reprise = table.get(cle)
        if reprise == RETIREE:
            sens_passe = sens_passe or ancienne(citation)
            continue
        if isinstance(reprise, tuple):
            texte, marque, francais = reprise
            vues.append(([texte, marque, "", francais], False, cle, citation))
        else:
            montree = list(citation[:3]) + [reprise] if reprise else None
            vues.append((montree, ancienne(citation), cle, citation))

    # Une citation ancienne s'efface devant un exemple d'aujourd'hui ; seule,
    # elle reste à remplacer (et se montre, traduite, en attendant).
    if a_des_phrases or any(not vue[1] for vue in vues):
        vues = [vue for vue in vues if not vue[1]]
    else:
        vues = vues[:1]

    sortie = []
    for montree, vieille, cle, citation in vues[:EXEMPLES_PAR_BANDE[bande]]:
        if vieille:
            noter(cle, "R", marquer(citation[0], citation[1]))
        elif montree is None:
            noter(cle, "T", marquer(citation[0], citation[1]))
        if montree is not None:
            sortie.append(montree)

    # Un sens courant resté sans exemple reçoit un exemple neuf — sauf s'il
    # attend déjà la traduction ou le remplacement d'une citation.
    if not sortie and not a_des_phrases and bande in BANDES_COMPLETEES and not vues:
        cle = cle_de_sens(mot, definition)
        neuf = table.get(cle)
        if isinstance(neuf, tuple):
            texte, marque, francais = neuf
            sortie.append([texte, marque, "", francais])
        elif neuf is None and not sens_passe:
            noter(cle, "N")
    return sortie


def ecrire_attente(attente):
    DOSSIER.mkdir(parents=True, exist_ok=True)
    ATTENTE.write_text(json.dumps(attente, ensure_ascii=False, indent=0) + "\n",
                       encoding="utf-8")


# ── Le travail à faire ─────────────────────────────────────────────────────

def rang_d_usage():
    """Le rang de fréquence des mots anglais, pour reprendre d'abord ceux qu'on
    rencontre le plus."""
    try:
        from wordfreq import zipf_frequency
    except ImportError:
        return lambda mot: 0.0
    return lambda mot: -zipf_frequency(mot, "en")


def marquer(texte, marque):
    """Le mot illustré entre ⟦ ⟧, pour que la traduction le rende fidèlement."""
    if not marque:
        return texte
    debut, fin = marque
    return texte[:debut] + "⟦" + texte[debut:fin] + "⟧" + texte[fin:]


def fait(genre, reprise):
    """Une citation à remplacer n'est faite que remplacée ou retirée : sa
    traduction d'avant ne suffit plus."""
    if genre == "R":
        return isinstance(reprise, tuple) or reprise == RETIREE
    return reprise is not None


def travail():
    """[(id, genre, bande, mot, nature, définition, texte)] : ce que la dernière
    construction a laissé à faire et que les lots faits depuis ne couvrent pas,
    les mots les plus courants d'abord, puis les sens dans l'ordre de la fiche."""
    if not ATTENTE.exists():
        raise SystemExit("Pas de citations/attente.json : lancer d'abord construire.py.")
    attente = json.loads(ATTENTE.read_text(encoding="utf-8"))
    table = charger()
    rang = rang_d_usage()
    rangs = {}
    sortie = []
    for ordre, (cle, (genre, bande, mot, nat, definition, texte)) in enumerate(attente.items()):
        if fait(genre, table.get(cle)):
            continue
        if mot not in rangs:
            rangs[mot] = rang(mot)
        sortie.append(((bande, rangs[mot], mot, ordre),
                       (cle, genre, bande, mot, nat, definition, texte)))
    sortie.sort(key=lambda t: t[0])
    return [t[1] for t in sortie]


def lots():
    A_TRADUIRE.mkdir(parents=True, exist_ok=True)
    for ancien in A_TRADUIRE.glob("lot-*.txt"):
        ancien.unlink()
    restant = travail()
    pris = [int(f.stem.split("-")[1]) for f in FAITS.glob("lot-*.txt")] if FAITS.exists() else []
    numero = max(pris, default=0)
    for depart in range(0, len(restant), PAR_LOT):
        numero += 1
        lignes = [
            f"# lot {numero:03d}",
            "# T id | mot (nature) | citation, mot illustré entre ⟦ ⟧ → « id traduction »",
            "# R id | mot (nature) | sens ‖ citation ancienne → « id = phrase contemporaine"
            " avec le ⟦mot⟧ | traduction »",
            "# N id | mot (nature) | sens → « id = phrase contemporaine avec le ⟦mot⟧ | traduction »",
        ]
        for cle, genre, _, mot, nat, definition, texte in restant[depart:depart + PAR_LOT]:
            if genre == "T":
                lignes.append(f"T {cle} | {mot} ({nat}) | {texte}")
            elif genre == "R":
                lignes.append(f"R {cle} | {mot} ({nat}) | {definition} ‖ {texte}")
            else:
                lignes.append(f"N {cle} | {mot} ({nat}) | {definition}")
        (A_TRADUIRE / f"lot-{numero:03d}.txt").write_text("\n".join(lignes) + "\n",
                                                          encoding="utf-8")
    genres = {g: sum(1 for t in restant if t[1] == g) for g in "TRN"}
    print(f"{len(restant)} exemples à reprendre ({genres['T']} à traduire, {genres['R']} à"
          f" remplacer, {genres['N']} à ajouter), en {-(-len(restant) // PAR_LOT)} lots"
          f" (lots {max(pris, default=0) + 1:03d} et suivants)")


def verifier(numeros):
    """Un lot fait reprend toutes les lignes de son lot à faire, et rien
    d'autre ; une citation à remplacer ne se contente pas d'une traduction."""
    erreurs = 0
    for numero in numeros:
        nom = f"lot-{int(numero):03d}.txt"
        source, fait_ = A_TRADUIRE / nom, FAITS / nom
        if not fait_.exists():
            print(f"{nom} : pas encore fait")
            erreurs += 1
            continue
        attendus = {}
        if source.exists():
            for ligne in source.read_text(encoding="utf-8").splitlines():
                if ligne[:2] in ("T ", "R ", "N "):
                    attendus[ligne[2:12]] = ligne[0]
        vus = set()
        for ligne, cle, valeur in lire_lot(fait_):
            ou = f"{nom}:{ligne}"
            if cle in vus:
                print(f"{ou} : {cle} en double")
                erreurs += 1
            vus.add(cle)
            genre = attendus.get(cle)
            if source.exists() and genre is None:
                print(f"{ou} : {cle} n'est pas dans le lot à faire")
                erreurs += 1
            elif genre in ("R", "N") and isinstance(valeur, str) and valeur != RETIREE:
                print(f"{ou} : {genre} demande « = anglais ⟦mot⟧ | français » ou ✗")
                erreurs += 1
            francais = valeur[2] if isinstance(valeur, tuple) else valeur
            if "⟦" in francais or "⟧" in francais or not francais.strip():
                print(f"{ou} : traduction vide ou marquée")
                erreurs += 1
        manquants = [c for c in attendus if c not in vus]
        if manquants:
            print(f"{nom} : {len(manquants)} lignes manquantes ({', '.join(manquants[:5])}…)")
            erreurs += 1
        if not erreurs:
            print(f"{nom} : {len(vus)} lignes, conformes")
    return erreurs


def etat():
    if not ATTENTE.exists():
        raise SystemExit("Pas de citations/attente.json : lancer d'abord construire.py.")
    attente = json.loads(ATTENTE.read_text(encoding="utf-8"))
    table = charger()
    par_bande = {}
    for cle, (genre, bande, *_) in attente.items():
        compte = par_bande.setdefault(bande, [0, 0])
        compte[0] += 1
        if fait(genre, table.get(cle)):
            compte[1] += 1
    total = sum(c[0] for c in par_bande.values())
    faits = sum(c[1] for c in par_bande.values())
    print(f"{len(table)} lignes de travail fait. À la dernière construction, {total}"
          f" exemples attendaient ; {faits} sont faits depuis, {total - faits} restent.")
    for bande in sorted(par_bande):
        a, f = par_bande[bande]
        print(f"  bande {bande} : {f}/{a} ({100 * f / max(1, a):.1f} %)")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    commande = sys.argv[1] if len(sys.argv) > 1 else "etat"
    if commande == "lots":
        lots()
    elif commande == "verifier":
        sys.exit(1 if verifier(sys.argv[2:]) else 0)
    else:
        etat()
