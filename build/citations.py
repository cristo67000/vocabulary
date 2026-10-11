#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Les exemples anglais du dictionnaire, traduits et rajeunis.

── Pourquoi ────────────────────────────────────────────────────────────────

Le Wiktionary anglais illustre ses sens par des phrases anglaises, et ne les
traduit pas : c'est un dictionnaire unilingue. Pour un francophone, une
citation qu'il faut déchiffrer mot à mot n'apprend pas grand-chose. Et ces
citations sont souvent anciennes — Shakespeare, la Bible de 1611, un s long
tous les trois mots — quand on vient apprendre l'anglais d'aujourd'hui.

Pour les **cinq mille mots anglais les plus courants** (bandes « premiers
pas » et « courant »), chaque exemple a donc été repris à la main, de l'une
de ces trois façons :

  T  traduire      la citation est gardée, sa traduction française vient
                   dessous ;
  R  remplacer     la citation date d'avant 1800 ou s'écrit en anglais
                   archaïque : une phrase contemporaine, traduite, la
                   remplace pour le même sens ;
  N  ajouter       le sens n'avait aucun exemple, ni citation ni phrase de
                   Tatoeba : il en reçoit un, contemporain et traduit.

Les mots plus rares gardent leurs citations en anglais seul ; leurs mots sont
cliquables.

── Où sont les textes ──────────────────────────────────────────────────────

  build/citations/a-traduire/lot-NNN.txt   le travail à faire, produit par
                                           `python build/citations.py lots`
                                           (régénérable, non versionné)
  build/citations/fr/lot-NNN.txt           le travail fait, une ligne par
                                           exemple :

      <id> <traduction française>                      (T)
      <id> = <phrase anglaise, mot ⟦marqué⟧> | <français>   (R, N)
      <id> ✗                                           (T, R : la citation
                                                        est retirée — un
                                                        fragment, un renvoi,
                                                        une phrase qui
                                                        n'illustre rien)

L'identifiant est une empreinte (dix signes hexadécimaux d'un SHA-1) : celle
du texte de la citation pour T et R, celle du mot et de la définition du sens
pour N. Il ne dépend ni de l'ordre des lots ni de la construction : une
citation que le Wiktionary retoucherait changerait d'empreinte, et perdrait
sa traduction plutôt que d'en recevoir une fausse.

── Usage ───────────────────────────────────────────────────────────────────

    python build/citations.py lots      # écrit les lots de ce qui reste
    python build/citations.py etat      # fait, restant, orphelin

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
DATA = RACINE.parent / "data" / "complet"

# Les bandes reprises : 0 « premiers pas » (1 500 mots), 1 « courant »
# (3 500 mots).
BANDES = (0, 1)
PAR_LOT = 200
# Une citation dont la pénalité d'âge atteint ce seuil (avant 1800, ou
# orthographe archaïque) est remplacée plutôt que traduite.
SEUIL_ANCIEN = 11

LIGNE = re.compile(r"^([0-9a-f]{10}) (.+)$")
RETIREE = "✗"
MARQUE = re.compile(r"⟦(.+?)⟧")


def empreinte(texte):
    return hashlib.sha1(texte.encode("utf-8")).hexdigest()[:10]


def cle_de_sens(mot, definition):
    return empreinte("sens\x1f" + mot + "\x1f" + definition)


def ancienne(citation):
    return wiktionnaire.penalite_d_age(citation[0], citation[2], "en") >= SEUIL_ANCIEN


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


def charger():
    """{id → traduction (str) | (texte anglais, marque, français) (tuple)}.

    Une ligne qui ne suit pas le format arrête tout : une traduction égarée
    sous le mauvais identifiant serait pire qu'absente.
    """
    table = {}
    if not FAITS.exists():
        return table
    for fichier in sorted(FAITS.glob("lot-*.txt")):
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
                table[cle] = (texte, marque, francais.strip())
            else:
                table[cle] = valeur
    return table


def reprendre(mot, definition, citations, a_des_phrases, table):
    """Les citations d'un sens anglais, telles que la fiche les montrera :
    traduites, remplacées, ou complétées d'un exemple neuf.

    Une citation est [texte, marque, référence] ; reprise, elle gagne un
    quatrième champ, sa traduction. Un exemple rédigé pour l'application n'a
    pas de référence."""
    if not table:
        return citations
    sortie = []
    for citation in citations:
        reprise = table.get(empreinte(citation[0]))
        if isinstance(reprise, tuple):
            texte, marque, francais = reprise
            sortie.append([texte, marque, "", francais])
        elif reprise == RETIREE:
            continue
        elif reprise:
            sortie.append(list(citation[:3]) + [reprise])
        else:
            sortie.append(citation)
    # Un sens dont toutes les citations ont été écartées est, pour la fiche,
    # un sens sans exemple : il reçoit l'exemple neuf comme les autres.
    if not sortie and not a_des_phrases:
        neuf = table.get(cle_de_sens(mot, definition))
        if isinstance(neuf, tuple):
            texte, marque, francais = neuf
            sortie.append([texte, marque, "", francais])
    return sortie


# ── Le travail à faire ─────────────────────────────────────────────────────

def rang_d_usage():
    """Le rang de fréquence des mots anglais, pour reprendre d'abord ceux qu'on
    rencontre le plus."""
    try:
        from wordfreq import zipf_frequency
    except ImportError:
        return lambda mot: 0.0
    return lambda mot: -zipf_frequency(mot, "en")


def nature(lecture):
    return lecture[0] or "?"


def marquer(texte, marque):
    """Le mot illustré entre ⟦ ⟧, pour que la traduction le rende fidèlement."""
    if not marque:
        return texte
    debut, fin = marque
    return texte[:debut] + "⟦" + texte[debut:fin] + "⟧" + texte[fin:]


def travail():
    """([(id, genre, mot, nature, définition, texte)], déjà repris) : ce que
    les bandes reprises demandent encore, les mots les plus courants d'abord,
    puis les sens dans l'ordre de la fiche ; et le nombre d'exemples que la
    dernière construction a déjà repris. Lu dans data/complet.

    Un exemple repris se reconnaît à son quatrième champ, la traduction : la
    construction l'a écrite, il n'y a plus rien à faire — et un exemple
    remplacé n'a plus, dans les données, le texte de la citation d'origine."""
    rang = rang_d_usage()
    entrees = []
    for fichier in sorted(DATA.glob("en-*.json")):
        contenu = json.loads(fichier.read_text(encoding="utf-8"))
        for entree in contenu["e"]:
            if entree[1] in BANDES:
                entrees.append(entree)
    entrees.sort(key=lambda e: (e[1], rang(e[0]), e[0]))

    vus = set()
    sortie = []
    repris = 0
    for entree in entrees:
        mot = entree[0]
        for lecture in entree[2]:
            for sens in lecture[4]:
                definition, citations, phrases = sens[0], sens[2] or [], sens[3] or []
                for citation in citations:
                    if len(citation) > 3 and citation[3]:
                        repris += 1
                        continue
                    cle = empreinte(citation[0])
                    if cle in vus:
                        continue
                    vus.add(cle)
                    genre = "R" if ancienne(citation) else "T"
                    sortie.append((cle, genre, mot, nature(lecture), definition,
                                   marquer(citation[0], citation[1])))
                if not citations and not phrases:
                    cle = cle_de_sens(mot, definition)
                    if cle not in vus:
                        vus.add(cle)
                        sortie.append((cle, "N", mot, nature(lecture), definition, ""))
    return sortie, repris


def lots():
    A_TRADUIRE.mkdir(parents=True, exist_ok=True)
    for ancien in A_TRADUIRE.glob("lot-*.txt"):
        ancien.unlink()
    table = charger()
    restant = [t for t in travail()[0] if t[0] not in table]
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
        for cle, genre, mot, nat, definition, texte in restant[depart:depart + PAR_LOT]:
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


def etat():
    table = charger()
    a_faire, repris = travail()
    faits = sum(1 for t in a_faire if t[0] in table)
    # Un sens sans exemple qu'on a choisi de laisser tel quel (« ✗ ») reste
    # sans exemple après construction : il n'attend rien.
    laisses = sum(1 for t in a_faire if t[1] == "N" and table.get(t[0]) == RETIREE)
    restants = len(a_faire) - faits
    total = repris + len(a_faire)
    print(f"{total} exemples dans les bandes {BANDES} : {repris} repris dans les données,"
          f" {faits - laisses} repris en attente de construction, {laisses} sens laissés"
          f" sans exemple, {restants} restants"
          f" ({100 * (total - restants) / max(1, total):.1f} % faits)")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    commande = sys.argv[1] if len(sys.argv) > 1 else "etat"
    {"lots": lots, "etat": etat}.get(commande, etat)()
